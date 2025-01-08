import { Timestamp } from '@google-cloud/firestore'
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import {
  getMainOpenWebAppButton,
  TRANSACTION_BOOKED_USERS_XTR_AMOUNT,
  TRANSACTION_DEPOSIT_COMISSION,
  TRANSACTION_DEPOSIT_COMISSION_NUMBER,
  TRANSACTION_WITHDRAW_COMISSION,
  TRANSACTION_WITHDRAW_COMISSION_NUMBER,
} from 'src/constants'
import {
  BalanceTransfer,
  Purchase,
  PurchaseFilter,
  TransactionBalanceItem,
  TransactionBalanceTopup,
  TransactionBalanceTopupResponse,
  transactionCurrencyLabels,
  TransactionDocument,
  TransactionEntity,
  TransactionPayload,
  TransactionPayloadType,
  TransactionProvider,
  TransactionResponse,
  TransactionStatus,
  TransactionType,
  WishEntity,
} from 'src/entities'
import { ERROR_CODES } from 'src/errors'
import { getUniqueId, jsonStringify, time, truncate } from 'src/helpers'
import { TelegrafCustomService } from 'src/services'
import { TgInitUser } from 'src/types'

import { CustomConfigService } from '../config'

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name)

  constructor(
    private readonly transactionEntity: TransactionEntity,
    private readonly telegrafCustomService: TelegrafCustomService,
    private readonly customConfigService: CustomConfigService,
    private readonly wishEntity: WishEntity,
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
      {
        userId: user?.id?.toString(),
        types: [TransactionType.USER_TOPUP, TransactionType.USER_WITHDRAW, TransactionType.PURCHASE],
      },
      false,
    )

    if (!transactions.length) {
      return []
    }

    const balances: TransactionBalanceItem[] = transactions.reduce((acc: TransactionBalanceItem[], transaction) => {
      const isTopup = transaction?.type === TransactionType.USER_TOPUP
      const isWithdraw = [TransactionType.USER_WITHDRAW, TransactionType.PURCHASE].includes(transaction?.type)

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
    const logKey = `${getUniqueId()}-createWithPartialDto}`
    const isComissionType = withComission && [TransactionType.USER_TOPUP].includes(dto?.type)

    const comissionPercent = isComissionType ? TRANSACTION_DEPOSIT_COMISSION : 0
    const amount = isComissionType
      ? String(Number(dto.amount || 0) - Number(dto.amount || 0) * TRANSACTION_DEPOSIT_COMISSION_NUMBER)
      : dto.amount
    const currency = dto.currency
    const comissionAmount = isComissionType
      ? String(Number(dto.amount || 0) * TRANSACTION_DEPOSIT_COMISSION_NUMBER)
      : '0'

    const payload = this.transactionEntity.getValidProperties(
      {
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
      },
      false,
      logKey,
    )

    return this.transactionEntity.createOrUpdate(payload)
  }

  public async update(
    id?: string,
    definedTransaction?: TransactionDocument,
    dto?: Partial<TransactionDocument>,
  ): Promise<TransactionDocument> {
    const logKey = `${getUniqueId()}-update`

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
      logKey,
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

  async findPurchase(user: TgInitUser, filter: PurchaseFilter): Promise<TransactionDocument[]> {
    const { wishId } = filter
    const transactions = await this.transactionEntity.findAll(
      {
        userId: user?.id?.toString(),
        wishId,
        type: TransactionType.PURCHASE,
        status: TransactionStatus.CONFIRMED,
      },
      false,
    )

    return transactions
  }

  async purchase(user: TgInitUser, dto: Purchase): Promise<TransactionDocument> {
    const logKey = `${getUniqueId()}-purchase`

    if (dto?.payload?.type !== TransactionPayloadType.SHOW_WISH_BOOKED_USER) {
      throw new BadRequestException({
        code: ERROR_CODES.transaction.codes.TRANSACTION_NOT_SUPPORTED_PURCHASE_TYPE,
        message: ERROR_CODES.transaction.messages.TRANSACTION_NOT_SUPPORTED_PURCHASE_TYPE,
      })
    }

    const { amount, currency, payload, wishId } = dto

    if (!wishId) {
      throw new NotFoundException({
        code: ERROR_CODES.wish.codes.WISH_NOT_FOUND,
        message: ERROR_CODES.wish.codes.WISH_NOT_FOUND,
      })
    }

    const isXtrCurrency = currency === 'XTR'

    if (!isXtrCurrency) {
      throw new BadRequestException({
        code: ERROR_CODES.transaction.codes.TRANSACTION_NOT_SUPPORT_CURRENCY,
        message: ERROR_CODES.transaction.messages.TRANSACTION_NOT_SUPPORT_CURRENCY,
      })
    }

    const balance = await this.balance({ id: Number(user?.id) })
    const balanceByCurrency = balance.find((item) => item?.currency === dto?.currency)

    if (isXtrCurrency && Number(balanceByCurrency?.amount) < TRANSACTION_BOOKED_USERS_XTR_AMOUNT) {
      throw new BadRequestException({
        code: ERROR_CODES.transaction.codes.TRANSACTION_NOT_ENOUGH_BALANCE,
        message: ERROR_CODES.transaction.messages.TRANSACTION_NOT_ENOUGH_BALANCE,
      })
    }

    const wish = await this.wishEntity.get(wishId)

    if (!wish) {
      throw new NotFoundException({
        code: ERROR_CODES.wish.codes.WISH_NOT_FOUND,
        message: ERROR_CODES.wish.codes.WISH_NOT_FOUND,
      })
    }

    try {
      const transactionPayload = this.transactionEntity.getValidProperties(
        {
          userId: user?.id?.toString(),
          type: TransactionType.PURCHASE,
          status: TransactionStatus.CONFIRMED,
          provider: TransactionProvider.INTERNAL,
          payload: jsonStringify<TransactionPayload>(payload),
          wishId,
          amount,
          currency,
          refundExpiredAt: Timestamp.fromDate(time().toDate()),
        },
        false,
        logKey,
      )

      const transaction = await this.transactionEntity.createOrUpdate(transactionPayload)

      return transaction
    } catch (error) {
      this.logger.error(`Error with purchase transaction logKey=${logKey}`, error, {
        userId: user?.id,
        amount: dto?.amount,
        currency: dto?.currency,
        logKey,
      })
    }
  }

  async transfer(user: TgInitUser, dto: BalanceTransfer, withComission = true): Promise<TransactionDocument> {
    const logKey = `${getUniqueId()}-transfer`

    if (dto?.targetUserId === user?.id?.toString() || !dto?.targetUserId) {
      throw new BadRequestException({
        code: ERROR_CODES.transaction.codes.TRANSACTION_TARGET_USER_EMPTY_OR_EQUAL_USER,
        message: ERROR_CODES.transaction.messages.TRANSACTION_TARGET_USER_EMPTY_OR_EQUAL_USER,
      })
    }

    try {
      const balance = await this.balance({ id: Number(user?.id) })
      const balanceByCurrency = balance.find((item) => item?.currency === dto?.currency)

      if (!balanceByCurrency || Number(balanceByCurrency?.amount) < Number(dto?.amount)) {
        throw new BadRequestException({
          code: ERROR_CODES.transaction.codes.TRANSACTION_NOT_ENOUGH_BALANCE,
          message: ERROR_CODES.transaction.messages.TRANSACTION_NOT_ENOUGH_BALANCE,
        })
      }

      const isComissionType = withComission

      const comissionPercent = isComissionType ? TRANSACTION_WITHDRAW_COMISSION : 0
      const amount = isComissionType
        ? String(Number(dto.amount || 0) - Number(dto.amount || 0) * TRANSACTION_WITHDRAW_COMISSION_NUMBER)
        : dto.amount
      const currency = dto.currency
      const comissionAmount = isComissionType
        ? String(Number(dto.amount || 0) * TRANSACTION_DEPOSIT_COMISSION_NUMBER)
        : '0'

      const targetTransactionId = getUniqueId()

      const refundExpiredAt = Timestamp.fromDate(time().toDate())

      const userWithdrawalTransaction = this.transactionEntity.getValidProperties(
        {
          userId: user?.id?.toString(),
          type: TransactionType.USER_WITHDRAW,
          /**
           * Оставляем сумму без комиссии, так как мы именно столько списываем с пользователя
           */
          amount: String(dto?.amount),
          currency: currency,
          provider: TransactionProvider.INTERNAL,
          status: TransactionStatus.CONFIRMED,
          childrenTransactionId: targetTransactionId,
          comissionPercent,
          comissionAmount,
          comissionCurrency: currency,
          refundExpiredAt,
          payload: jsonStringify<TransactionPayload>({
            message: 'Внутренний перевод другому пользователю',
            type: TransactionPayloadType.TRANSFER,
            userId: dto?.targetUserId,
          }),
        },
        false,
        logKey,
      )

      const targetUserTopupTransaction = this.transactionEntity.getValidProperties(
        {
          id: targetTransactionId,
          userId: dto?.targetUserId,
          type: TransactionType.USER_TOPUP,
          /**
           * Начисляем сумму с учетом комиссии, так как мы именно столько начисляем пользователю
           */
          amount,
          currency,
          provider: TransactionProvider.INTERNAL,
          status: TransactionStatus.CONFIRMED,
          parentTransactionId: userWithdrawalTransaction?.id,
          refundExpiredAt,
          payload: jsonStringify<TransactionPayload>({
            message: 'Внутренний перевод от пользователя',
            type: TransactionPayloadType.TRANSFER,
            userId: user?.id?.toString(),
            isAnonymous: dto?.isAnonymous,
          }),
        },
        false,
        logKey,
      )

      const buttons = [
        [getMainOpenWebAppButton(`${this.customConfigService.miniAppUrl}/transaction`, 'Открыть список транзакций')],
      ]

      if (!dto?.isAnonymous) {
        buttons.push([
          getMainOpenWebAppButton(`${this.customConfigService.miniAppUrl}/user/${user?.id}`, 'Отправитель'),
        ])
      }

      const message = !dto?.isAnonymous
        ? `Вы получили перевод от пользователя ${
            user?.username ? `@${user?.username}` : `${user?.firstName} ${user?.lastName}`
          } на сумму ${truncate(amount, 4)} ${transactionCurrencyLabels[currency]}`
        : `Вы получили перевод от анонимного пользователя на сумму ${truncate(amount, 4)} ${
            transactionCurrencyLabels[currency]
          }`

      const response = await this.transactionEntity.createOrUpdate(userWithdrawalTransaction)
      await this.transactionEntity.createOrUpdate(targetUserTopupTransaction)

      await this.telegrafCustomService.telegraf.telegram.sendMessage(Number(dto?.targetUserId), message, {
        reply_markup: {
          inline_keyboard: buttons,
        },
      })

      return response
    } catch (error) {
      this.logger.error(`Error with transfer transaction logKey=${logKey}`, error, {
        userId: user?.id,
        targetUserId: dto?.targetUserId,
        amount: dto?.amount,
        currency: dto?.currency,
        logKey,
      })

      throw error
    }
  }
}
