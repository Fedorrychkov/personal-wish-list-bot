import { Timestamp } from '@google-cloud/firestore'
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import {
  TransactionBalanceItem,
  TransactionBalanceTopup,
  TransactionBalanceTopupResponse,
  TransactionDocument,
  TransactionEntity,
  TransactionProvider,
  TransactionResponse,
  TransactionStatus,
  TransactionType,
} from 'src/entities'
import { ERROR_CODES } from 'src/errors'
import { time } from 'src/helpers'
import { TelegrafCustomService } from 'src/services'
import { TgInitUser } from 'src/types'

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name)

  constructor(
    private readonly transactionEntity: TransactionEntity,
    private readonly telegrafCustomService: TelegrafCustomService,
  ) {}

  public async getList(id: string | number): Promise<TransactionDocument[]> {
    const response = await this.transactionEntity.findAll({ userId: id?.toString() })

    return response
  }

  public async getItem(user: TgInitUser, transactionId: string): Promise<TransactionDocument> {
    const [transaction] = await this.transactionEntity.findAll(
      { userId: user?.id?.toString(), id: transactionId },
      false,
    )

    if (!transaction) {
      throw new NotFoundException('Transaction not found')
    }

    return transaction
  }

  public async balanceTopup(_: TgInitUser, body: TransactionBalanceTopup): Promise<TransactionBalanceTopupResponse> {
    const { amount, currency, type } = body

    const isSupportType = type === TransactionType.SUPPORT
    const isUserTopupType = type === TransactionType.USER_TOPUP

    if (isSupportType && currency !== 'XTR') {
      throw new BadRequestException({
        code: ERROR_CODES.transaction.codes.TRANSACTION_SUPPORT_CURRENCY_ONLY_XTR,
        message: ERROR_CODES.transaction.messages.TRANSACTION_SUPPORT_CURRENCY_ONLY_XTR,
      })
    }

    if (currency !== 'XTR') {
      throw new BadRequestException({
        code: ERROR_CODES.transaction.codes.TRANSACTION_NOT_SUPPORT_CURRENCY,
        message: ERROR_CODES.transaction.messages.TRANSACTION_NOT_SUPPORT_CURRENCY,
      })
    }

    const invoiceLink = await this.telegrafCustomService.telegraf.telegram.createInvoiceLink({
      title: isSupportType
        ? 'Поддержка разработчика'
        : isUserTopupType
        ? 'Пополнение баланса'
        : 'Не известная транзакция',
      description: isSupportType
        ? 'Ваш вклад в развитие бота и на хлеб разработчику'
        : isUserTopupType
        ? 'Пополнение баланса'
        : 'Не известная транзакция',
      payload: isSupportType ? 'support_with_xtr' : 'user_topup_with_xtr',
      provider_token: '',
      prices: [{ label: `Оплатить ${amount} ⭐️`, amount: Number(amount) }],
      currency: 'XTR',
    })

    return {
      invoiceLink,
    }
  }

  public async balance(user: TgInitUser): Promise<TransactionBalanceItem[]> {
    const transactions = await this.transactionEntity.findAll(
      { userId: user?.id?.toString(), types: [TransactionType.USER_TOPUP, TransactionType.USER_WITHDRAW] },
      false,
    )

    if (!transactions.length) {
      return []
    }

    const balances: TransactionBalanceItem[] = transactions.reduce((acc: TransactionBalanceItem[], transaction) => {
      const isTopup = transaction?.type === TransactionType.USER_TOPUP
      const isWithdraw = transaction?.type === TransactionType.USER_WITHDRAW

      const isAvailableTopup =
        isTopup && [TransactionStatus.CONFIRMED, TransactionStatus.PAID].includes(transaction?.status)
      const isAvailableWithdraw =
        isWithdraw &&
        [
          TransactionStatus.CONFIRMED,
          TransactionStatus.CREATED,
          TransactionStatus.PENDING,
          TransactionStatus.PAID,
        ].includes(transaction?.status)

      const balanceCurrency = transaction?.currency
      const balanceAmount = transaction?.amount || '0'

      /**
       * На первом шаге формируем первую запись баланса, или оставляем пустой массив
       */
      if (!acc?.length && (isAvailableTopup || isAvailableWithdraw)) {
        acc.push(
          isAvailableTopup
            ? { amount: balanceAmount, currency: balanceCurrency }
            : { amount: String(Number(balanceAmount) * -1), currency: balanceCurrency },
        )

        return acc
      }

      const balanceByCurrency = acc.find((item) => item?.currency === balanceCurrency)
      const filteredBalances = acc.filter((item) => item?.currency !== balanceCurrency)

      if (isAvailableTopup || isAvailableWithdraw) {
        const newAcc = [...(filteredBalances || [])]

        newAcc.push(
          isAvailableTopup
            ? {
                amount: String(Number(balanceByCurrency.amount) + Number(balanceAmount)),
                currency: balanceByCurrency.currency,
              }
            : {
                /**
                 * Для вывода, мы делаем сумму позитивной и отнимаем от нее сумму из транзакции вывода и снова делаем отрицательной
                 */
                amount: String(Number(balanceByCurrency.amount) - Number(balanceAmount)),
                currency: balanceByCurrency.currency,
              },
        )

        return newAcc
      }

      return acc
    }, [])

    return balances
  }

  public async createWithPartialDto(
    dto: Partial<TransactionDocument>,
    withComission = true,
  ): Promise<TransactionDocument> {
    const isComissionType = withComission && [TransactionType.USER_TOPUP].includes(dto?.type)

    const comissionPercent = isComissionType ? 10 : 0
    const amount = isComissionType ? String(Number(dto.amount || 0) - Number(dto.amount || 0) * 0.1) : dto.amount
    const currency = dto.currency
    const comissionAmount = isComissionType ? String(Number(dto.amount || 0) * 0.1) : '0'

    const payload = this.transactionEntity.getValidProperties({
      userId: '',
      status: TransactionStatus.CREATED,
      provider: TransactionProvider.TELEGRAM,
      refundExpiredAt: Timestamp.fromDate(time().add(21, 'day').toDate()),
      /**
       * Need to rewrite important info
       */
      ...dto,
      type: dto?.type || TransactionType.SUPPORT,
      amount,
      currency,
      comissionPercent,
      comissionAmount,
      comissionCurrency: currency,
    })

    return this.transactionEntity.createOrUpdate(payload)
  }

  public async update(
    id?: string,
    definedTransaction?: TransactionDocument,
    dto?: Partial<TransactionDocument>,
  ): Promise<TransactionDocument> {
    const transaction = definedTransaction
      ? await Promise.resolve(definedTransaction)
      : await this.transactionEntity.get(id)

    const payload = this.transactionEntity.getValidProperties(
      {
        ...transaction,
        /**
         * Need to rewrite important info
         */
        ...dto,
      },
      true,
    )

    return this.transactionEntity.createOrUpdate(payload)
  }

  public async canRefund(id?: string, definedTransaction?: TransactionDocument): Promise<TransactionDocument> {
    const transaction = definedTransaction
      ? await Promise.resolve(definedTransaction)
      : await this.transactionEntity.get(id)

    if (!transaction) {
      throw new NotFoundException({
        code: ERROR_CODES.transaction.codes.TRANSACTION_NOT_FOUND,
        message: ERROR_CODES.transaction.messages.TRANSACTION_NOT_FOUND,
      })
    }

    const isConfirmed = transaction?.status === TransactionStatus.CONFIRMED
    const isRefunded = transaction?.status === TransactionStatus.REFUNDED
    const isRefundableType = [TransactionType.SUPPORT, TransactionType.USER_TOPUP].includes(transaction?.type)
    const isUserTopupType = transaction?.type === TransactionType.USER_TOPUP
    const balanceAvailable =
      isUserTopupType && !isRefunded ? await this.balance({ id: Number(transaction?.userId) }) : []
    const currentBalance = balanceAvailable.find((item) => item?.currency === transaction?.currency)

    const isBalanceAvailable =
      isUserTopupType && !isRefunded ? Number(currentBalance?.amount) >= Number(transaction?.amount) : true

    const isUnexpiredRefund = transaction?.refundExpiredAt
      ? time(transaction?.refundExpiredAt?.toDate()).isAfter(time())
      : true
    const isCanRefund = isConfirmed && isRefundableType && isUnexpiredRefund && isBalanceAvailable && !isRefunded

    if (isCanRefund) {
      return transaction
    }

    if (isRefunded) {
      throw new BadRequestException({
        code: ERROR_CODES.transaction.codes.TRANSACTION_ALREADY_REFUNDED,
        message: ERROR_CODES.transaction.messages.TRANSACTION_ALREADY_REFUNDED,
      })
    }

    if (!isConfirmed) {
      throw new BadRequestException({
        code: ERROR_CODES.transaction.codes.TRANSACTION_NOT_CONFIRMED,
        message: ERROR_CODES.transaction.messages.TRANSACTION_NOT_CONFIRMED,
      })
    }

    if (!isUnexpiredRefund) {
      throw new BadRequestException({
        code: ERROR_CODES.transaction.codes.TRANSACTION_REFUNDABLE_EXPIRAED,
        message: ERROR_CODES.transaction.messages.TRANSACTION_REFUNDABLE_EXPIRAED,
      })
    }

    if (!isBalanceAvailable) {
      throw new BadRequestException({
        code: ERROR_CODES.transaction.codes.TRANSACTION_BALANCE_NOT_AVAILABLE,
        message: ERROR_CODES.transaction.messages.TRANSACTION_BALANCE_NOT_AVAILABLE,
      })
    }

    throw new BadRequestException({
      code: ERROR_CODES.transaction.codes.TRANSACTION_NOT_REFUNDABLE,
      message: ERROR_CODES.transaction.messages.TRANSACTION_NOT_REFUNDABLE,
    })
  }

  public transform(transaction: TransactionDocument): TransactionResponse {
    return this.transactionEntity.transform(transaction)
  }

  public async refund(user: TgInitUser, transactionId: string): Promise<TransactionDocument> {
    try {
      const refundableInfo = await this.canRefund(transactionId)

      await this.telegrafCustomService.telegraf.telegram
        .callApi('refundStarPayment' as any, {
          user_id: Number(user?.id),
          telegram_payment_charge_id: refundableInfo?.providerInvoiceId,
        })
        .catch((error) => {
          this.logger.error('Error with refund transaction', error, {
            userId: user?.id,
            providerInvoiceId: refundableInfo?.providerInvoiceId,
          })

          throw error
        })

      this.logger.log('Refund transaction success', {
        userId: user?.id,
        providerInvoiceId: refundableInfo?.providerInvoiceId,
      })

      const refundedTransaction = await this.update(transactionId, refundableInfo, {
        status: TransactionStatus.REFUNDED,
        refundedAt: Timestamp.fromDate(time().toDate()),
      })

      return refundedTransaction
    } catch (error) {
      throw error
    }
  }
}
