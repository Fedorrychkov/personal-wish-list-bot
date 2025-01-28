import { Timestamp } from '@google-cloud/firestore'
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import {
  getMainOpenWebAppButton,
  TRANSACTION_DEPOSIT_COMISSION,
  TRANSACTION_DEPOSIT_COMISSION_NUMBER,
  TRANSACTION_NEW_USER_REFFERER_XTR_AMOUNT,
  TRANSACTION_NEW_USER_XTR_AMOUNT,
  TRANSACTION_USER_REFFERER_XTR_COMISSION_NUMBER,
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
  TransactionBlockchainProvider,
  transactionCurrencyLabels,
  TransactionDocument,
  TransactionEntity,
  TransactionFilter,
  TransactionPayload,
  TransactionPayloadType,
  TransactionProvider,
  TransactionResponse,
  TransactionStatus,
  TransactionType,
  UserDocument,
  UserEntity,
  WithdrawalDto,
} from 'src/entities'
import { ERROR_CODES } from 'src/errors'
import { getUniqueId, jsonParse, jsonStringify, time, truncate } from 'src/helpers'
import { TelegrafCustomService } from 'src/services'
import { PaginationResponse, TgInitUser } from 'src/types'

import { CustomConfigService } from '../config'
import { CurrencyService } from '../currency'
import { PAYMENT_PROVIDER, PaymentProvidersService } from '../payment-providers'
import { computedBalance } from './helper'
import { TransactionPurchaseService } from './transaction.purchase.service'

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name)

  constructor(
    private readonly transactionEntity: TransactionEntity,
    private readonly userEntity: UserEntity,
    private readonly telegrafCustomService: TelegrafCustomService,
    private readonly customConfigService: CustomConfigService,
    private readonly transactionPurchaseService: TransactionPurchaseService,
    private readonly paymentProvidersService: PaymentProvidersService,
    private readonly currencyService: CurrencyService,
  ) {}

  public async getList(
    id: string | number,
    filter: TransactionFilter,
  ): Promise<PaginationResponse<TransactionDocument>> {
    const response = await this.transactionEntity.findAllWithPagination(
      {
        ...filter,
        userId: id?.toString(),
        limit: 10,
      },
      true,
    )

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

  public async getRefferalBlockedBalance(user: TgInitUser): Promise<TransactionBalanceItem[]> {
    const transactions = await this.transactionEntity.findAll(
      {
        userId: user?.id?.toString(),
        types: [TransactionType.REFFERAL],
        status: TransactionStatus.CONFIRMED,
      },
      false,
    )

    if (!transactions.length) {
      return []
    }

    const balances: TransactionBalanceItem[] = transactions.reduce((acc: TransactionBalanceItem[], transaction) => {
      const isTopup = [TransactionType.REFFERAL].includes(transaction?.type)

      const isAvailableTopup = isTopup && [TransactionStatus.CONFIRMED].includes(transaction?.status)

      const balanceCurrency = transaction?.currency
      const balanceAmount = transaction?.amount || '0'

      const isAvailableAfterRefundableDateLimit = transaction?.refundExpiredAt
        ? time(transaction?.refundExpiredAt?.toDate()).isAfter(time())
        : true

      if (isAvailableTopup && !isAvailableAfterRefundableDateLimit && transaction?.type === TransactionType.REFFERAL) {
        return acc
      }

      /**
       * На первом шаге формируем первую запись баланса, или оставляем пустой массив
       */
      if (!acc?.length && isAvailableTopup) {
        acc.push({ amount: balanceAmount, currency: balanceCurrency })

        return acc
      }

      const balanceByCurrency = acc.find((item) => item?.currency === balanceCurrency)
      const filteredBalances = acc.filter((item) => item?.currency !== balanceCurrency)

      // TODO: нужно REFERRAL проверять на срок refundExpiredAt, показываем на балансе, только если срок возврата истек

      if (isAvailableTopup) {
        const newAcc = [...(filteredBalances || [])]

        newAcc.push({
          amount: String(Number(balanceByCurrency.amount) + Number(balanceAmount)),
          currency: balanceByCurrency.currency,
        })

        return newAcc
      }

      return acc
    }, [])

    return balances
  }

  public async balance(user: TgInitUser): Promise<TransactionBalanceItem[]> {
    const transactions = await this.transactionEntity.findAll(
      {
        userId: user?.id?.toString(),
        types: [
          TransactionType.USER_TOPUP,
          TransactionType.USER_WITHDRAW,
          TransactionType.PURCHASE,
          TransactionType.BONUS,
          TransactionType.REFFERAL,
        ],
      },
      false,
    )

    if (!transactions.length) {
      return []
    }

    const balances: TransactionBalanceItem[] = transactions.reduce((acc: TransactionBalanceItem[], transaction) => {
      const isTopup = [TransactionType.USER_TOPUP, TransactionType.BONUS, TransactionType.REFFERAL].includes(
        transaction?.type,
      )
      const isWithdraw = [TransactionType.USER_WITHDRAW, TransactionType.PURCHASE].includes(transaction?.type)

      const isAvailableTopup = isTopup && [TransactionStatus.CONFIRMED].includes(transaction?.status)
      const isAvailableWithdraw =
        isWithdraw &&
        [
          TransactionStatus.CONFIRMED,
          TransactionStatus.CREATED,
          TransactionStatus.PENDING,
          TransactionStatus.PAID,
        ].includes(transaction?.status)

      return computedBalance(acc, transaction, {
        isAvailableTopup,
        isAvailableWithdraw,
      })
    }, [])

    return balances
  }

  public async donatesBalance(user: TgInitUser): Promise<TransactionBalanceItem[]> {
    const transactions = await this.transactionEntity.findAll(
      {
        userId: user?.id?.toString(),
        types: [TransactionType.SUPPORT],
      },
      false,
    )

    if (!transactions.length) {
      return []
    }

    const balances: TransactionBalanceItem[] = transactions.reduce((acc: TransactionBalanceItem[], transaction) => {
      const isAvailableTopup = [TransactionStatus.CONFIRMED].includes(transaction?.status)

      return computedBalance(acc, transaction, {
        isAvailableTopup,
        isAvailableWithdraw: false,
      })
    }, [])

    return balances
  }

  public async purchasesBalanceAndSize(
    user: TgInitUser,
  ): Promise<{ balances: TransactionBalanceItem[]; size: number; santas: number; wishes: number }> {
    const transactions = await this.transactionEntity.findAll(
      {
        userId: user?.id?.toString(),
        types: [TransactionType.PURCHASE],
      },
      false,
    )

    if (!transactions.length) {
      return {
        balances: [],
        size: 0,
        santas: 0,
        wishes: 0,
      }
    }

    const balances: TransactionBalanceItem[] = transactions.reduce((acc: TransactionBalanceItem[], transaction) => {
      const isAvailableTopup = [TransactionStatus.CONFIRMED].includes(transaction?.status)

      return computedBalance(acc, transaction, {
        isAvailableTopup,
        isAvailableWithdraw: false,
      })
    }, [])

    return {
      balances,
      size: transactions.filter((transaction) => transaction?.status === TransactionStatus.CONFIRMED).length,
      santas: transactions.filter((transaction) => !!transaction?.santaGameId).length,
      wishes: transactions.filter((transaction) => !!transaction?.wishId).length,
    }
  }

  public async platformBalanceByComissions(user: TgInitUser): Promise<TransactionBalanceItem[]> {
    const transactions = await this.transactionEntity.findAll(
      {
        userId: user?.id?.toString(),
      },
      false,
    )

    if (!transactions.length) {
      return []
    }

    const balances: TransactionBalanceItem[] = transactions.reduce((acc: TransactionBalanceItem[], transaction) => {
      const isAvailableTopupStatus = [TransactionStatus.CONFIRMED].includes(transaction?.status)
      const isAvailableFee =
        !Number.isNaN(Number(transaction?.comissionAmount)) && Number(transaction?.comissionAmount) > 0

      return computedBalance(acc, transaction, {
        isAvailableTopup: isAvailableTopupStatus && isAvailableFee,
        isAvailableWithdraw: false,
        currencyPropertyName: 'comissionCurrency',
        amountPropertyName: 'comissionAmount',
      })
    }, [])

    return balances
  }

  public async createWithPartialDto(
    dto: Partial<TransactionDocument>,
    withComission = true,
  ): Promise<TransactionDocument> {
    const logKey = `${getUniqueId()}-createWithPartialDto`
    const isComissionType = withComission && [TransactionType.USER_TOPUP].includes(dto?.type)

    const comissionPercent = isComissionType ? TRANSACTION_DEPOSIT_COMISSION : 0
    const amount = isComissionType
      ? String(Number(dto.amount || 0) - Number(dto.amount || 0) * TRANSACTION_DEPOSIT_COMISSION_NUMBER)
      : dto.amount
    const currency = dto.currency
    const comissionAmount = isComissionType
      ? String(Number(dto.amount || 0) * TRANSACTION_DEPOSIT_COMISSION_NUMBER)
      : '0'

    const depositTransactionId = getUniqueId()
    let payload = this.transactionEntity.getValidProperties(
      {
        userId: '',
        status: TransactionStatus.CREATED,
        provider: TransactionProvider.TELEGRAM,
        refundExpiredAt: Timestamp.fromDate(time().add(21, 'day').toDate()),
        /**
         * Need to rewrite important info
         */
        ...dto,
        id: depositTransactionId,
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

    const user = await this.userEntity.get(payload?.userId)

    if (!!user?.refferrerUserId && isComissionType) {
      this.logger.log('User has refferrerUserId', {
        userId: user?.id,
        refferrerUserId: user?.refferrerUserId,
      })

      const reffererUser = await this.userEntity.get(user?.refferrerUserId)

      if (reffererUser) {
        const reffererBonusTransactionId = getUniqueId()

        payload = {
          ...payload,
          payload: jsonStringify<TransactionPayload>({
            type: TransactionPayloadType.WITH_REFFERAL_COMISSION,
            message: 'С учетом комиссии реферера',
            userId: user?.refferrerUserId,
          }),
          childrenTransactionId: reffererBonusTransactionId,
        }

        const amount = String(Number(dto.amount || 0) * TRANSACTION_USER_REFFERER_XTR_COMISSION_NUMBER)
        const currency = dto.currency

        const reffererBonusPayload = this.transactionEntity.getValidProperties(
          {
            id: reffererBonusTransactionId,
            userId: reffererUser?.id,
            parentTransactionId: depositTransactionId,
            refundExpiredAt: Timestamp.fromDate(time().add(21, 'day').add(1, 'hour').toDate()),
            status: TransactionStatus.CONFIRMED,
            provider: TransactionProvider.INTERNAL,
            type: TransactionType.REFFERAL,
            amount,
            currency,
            payload: jsonStringify<TransactionPayload>({
              type: TransactionPayloadType.REFFERAL_BONUS,
              message: 'Реферальный бонус',
              userId: user?.id,
            }),
          },
          false,
          logKey,
        )

        this.transactionEntity.createOrUpdate(reffererBonusPayload)
      }
    }

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
        statusMessage: transaction?.statusMessage
          ? `${transaction?.statusMessage} => ${dto?.statusMessage || ''}`
          : dto?.statusMessage,
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
    const isRefundableProvider = [TransactionProvider.TELEGRAM].includes(transaction?.provider)
    const isUserTopupType = transaction?.type === TransactionType.USER_TOPUP
    const balanceAvailable =
      isUserTopupType && !isRefunded ? await this.balance({ id: Number(transaction?.userId) }) : []
    const currentBalance = balanceAvailable.find((item) => item?.currency === transaction?.currency)

    const isBalanceAvailable =
      isUserTopupType && !isRefunded ? Number(currentBalance?.amount) >= Number(transaction?.amount) : true

    const isUnexpiredRefund = transaction?.refundExpiredAt
      ? time(transaction?.refundExpiredAt?.toDate()).isAfter(time())
      : true
    const isCanRefund =
      isConfirmed && isRefundableType && isRefundableProvider && isUnexpiredRefund && isBalanceAvailable && !isRefunded

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

    if (!isRefundableProvider) {
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

      const hasChildrenTransaction = refundableInfo?.childrenTransactionId

      if (hasChildrenTransaction) {
        const childrenTransaction = await this.transactionEntity.get(refundableInfo?.childrenTransactionId)

        if (!childrenTransaction) {
          this.logger.error('Children transaction not found', {
            childrenTransactionId: refundableInfo?.childrenTransactionId,
          })
        } else if (
          childrenTransaction?.status === TransactionStatus.CONFIRMED &&
          childrenTransaction?.type === TransactionType.REFFERAL
        ) {
          this.logger.log('Refund children transaction', {
            childrenTransactionId: refundableInfo?.childrenTransactionId,
            userId: childrenTransaction?.userId,
            amount: childrenTransaction?.amount,
            currency: childrenTransaction?.currency,
            status: childrenTransaction?.status,
            type: childrenTransaction?.type,
          })

          await this.update(refundableInfo?.childrenTransactionId, childrenTransaction, {
            status: TransactionStatus.REFUNDED,
            refundedAt: Timestamp.fromDate(time().toDate()),
          })
        }
      }

      return refundedTransaction
    } catch (error) {
      throw error
    }
  }

  async findPurchase(user: TgInitUser, filter: PurchaseFilter): Promise<TransactionDocument[]> {
    if (filter?.wishId) {
      return this.transactionPurchaseService.findWishPurchase(user, filter)
    }

    if (filter?.santaGameId) {
      return this.transactionPurchaseService.findSecretSantaPurchase(user, filter)
    }

    throw new NotFoundException({
      code: ERROR_CODES.transaction.codes.TRANSACTION_NOT_FOUND,
      message: ERROR_CODES.transaction.messages.TRANSACTION_NOT_FOUND,
    })
  }

  async purchase(user: TgInitUser, dto: Purchase): Promise<TransactionDocument> {
    const logKey = `${getUniqueId()}-purchase-${dto?.payload?.type}`

    if (
      ![TransactionPayloadType.SHOW_WISH_BOOKED_USER, TransactionPayloadType.SHOW_SECRET_SANTA_USER].includes(
        dto?.payload?.type,
      )
    ) {
      throw new BadRequestException({
        code: ERROR_CODES.transaction.codes.TRANSACTION_NOT_SUPPORTED_PURCHASE_TYPE,
        message: ERROR_CODES.transaction.messages.TRANSACTION_NOT_SUPPORTED_PURCHASE_TYPE,
      })
    }

    const { currency } = dto

    const isXtrCurrency = currency === 'XTR'

    if (!isXtrCurrency) {
      throw new BadRequestException({
        code: ERROR_CODES.transaction.codes.TRANSACTION_NOT_SUPPORT_CURRENCY,
        message: ERROR_CODES.transaction.messages.TRANSACTION_NOT_SUPPORT_CURRENCY,
      })
    }

    const balance = await this.balance({ id: Number(user?.id) })
    const balanceByCurrency = balance.find((item) => item?.currency === dto?.currency)

    if (dto?.payload?.type === TransactionPayloadType.SHOW_WISH_BOOKED_USER) {
      return this.transactionPurchaseService.purchaseWish(user, dto, balanceByCurrency, logKey)
    }

    if (dto?.payload?.type === TransactionPayloadType.SHOW_SECRET_SANTA_USER) {
      return this.transactionPurchaseService.purchaseSecretSanta(user, dto, balanceByCurrency, logKey)
    }
  }

  async sendRefferalSystemBonus(referrerUser: UserDocument, invitedUser: UserDocument) {
    const logKey = `${getUniqueId()}-sendRefferalSystemBonus`

    try {
      const targetTransactionId = getUniqueId()

      const refundExpiredAt = Timestamp.fromDate(time().toDate())

      const userReffererTopupTransaction = this.transactionEntity.getValidProperties(
        {
          userId: referrerUser?.id,
          type: TransactionType.BONUS,
          amount: String(TRANSACTION_NEW_USER_REFFERER_XTR_AMOUNT),
          currency: 'XTR',
          provider: TransactionProvider.INTERNAL,
          status: TransactionStatus.CONFIRMED,
          childrenTransactionId: targetTransactionId,
          refundExpiredAt,
          payload: jsonStringify<TransactionPayload>({
            message: 'Бонус за приглашение в бот',
            type: TransactionPayloadType.INVITED_NEW_USER,
            userId: invitedUser?.id,
          }),
        },
        false,
        logKey,
      )

      const userInvitedTopupTransaction = this.transactionEntity.getValidProperties(
        {
          id: targetTransactionId,
          userId: invitedUser?.id,
          type: TransactionType.BONUS,
          /**
           * Начисляем сумму с учетом комиссии, так как мы именно столько начисляем пользователю
           */
          amount: String(TRANSACTION_NEW_USER_XTR_AMOUNT),
          currency: 'XTR',
          provider: TransactionProvider.INTERNAL,
          status: TransactionStatus.CONFIRMED,
          parentTransactionId: userReffererTopupTransaction?.id,
          refundExpiredAt,
          payload: jsonStringify<TransactionPayload>({
            message: 'Бонус за вступление в бот',
            type: TransactionPayloadType.INVITEE_BONUS,
            userId: referrerUser?.id,
          }),
        },
        false,
        logKey,
      )

      await this.transactionEntity.createOrUpdate(userReffererTopupTransaction)
      await this.transactionEntity.createOrUpdate(userInvitedTopupTransaction)
    } catch (error) {
      this.logger.error(`Error with sendRefferalSystemBonus transaction logKey=${logKey}`, error, {
        referrerUserId: referrerUser?.id,
        invitedUserId: invitedUser?.id,
        logKey,
      })

      throw error
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
        ? String(Number(dto.amount || 0) * TRANSACTION_WITHDRAW_COMISSION_NUMBER)
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

  async getWithdrawBalance(user: TgInitUser) {
    const balance = await this.balance({ id: user?.id })

    const hasBalance = balance?.some((item) => !Number.isNaN(Number(item.amount)) && Number(item.amount) > 0)
    const defaultTransferFee = await this.paymentProvidersService.getDefaultTransferFee(PAYMENT_PROVIDER.TON)

    const balancesWithConversionInfo = await Promise.all(
      balance.map(async (item) => {
        const conversionRate = await this.currencyService.getRate(item.currency, 'TON')

        return {
          amount: truncate(Number(item.amount), 4),
          currency: item.currency,
          conversionRate,
          conversionAmount: truncate(Number(item.amount) * conversionRate, 4),
        }
      }),
    )

    return {
      hasBalance,
      defaultTransferFee,
      balancesWithConversionInfo,
    }
  }

  async getAmountWithFees(
    dto: WithdrawalDto,
    { defaultTransferFee }: { defaultTransferFee?: { totalFee: number; currency: string } },
  ) {
    const { amount } = dto

    const finalDefaultTransferFee =
      defaultTransferFee || (await this.paymentProvidersService.getDefaultTransferFee(PAYMENT_PROVIDER.TON))

    const serviceFee = Number(amount) * (TRANSACTION_WITHDRAW_COMISSION / 100)

    const finalAmountToGet = Number(amount) - (Number(finalDefaultTransferFee.totalFee) + serviceFee)

    return {
      /**
       * service fee for withdrawal
       */
      serviceFee: String(serviceFee),
      /**
       * fixed transfer fee by provider
       */
      defaultTransferFee: finalDefaultTransferFee,
      /**
       * Final get amount by user
       */
      finalAmountToGet: {
        amount: String(truncate(finalAmountToGet, 4)),
        currency: 'TON',
      },
    }
  }

  async checkingWithdrawal(user: TgInitUser, dto: WithdrawalDto) {
    const { currency, amount } = dto
    const balance = await this.balance({ id: user.id })

    const balanceItem = balance?.find((item) => item.currency === currency)
    const defaultTransferFee = await this.paymentProvidersService.getDefaultTransferFee(PAYMENT_PROVIDER.TON)
    const conversionRate = await this.currencyService.getRate(currency, 'TON')
    const conversionCurrency = 'TON'

    const finalAmount = amount || balanceItem?.amount

    const conversionAmount = truncate(Number(finalAmount) * conversionRate, 4)
    const isNotEnoughBalance = !balanceItem || Number(conversionAmount) > Number(balanceItem?.amount)
    const minimalWithdrawalAmount = defaultTransferFee.totalFee * 2

    if (isNotEnoughBalance) {
      throw new BadRequestException({
        code: ERROR_CODES.transaction.codes.TRANSACTION_NOT_ENOUGH_BALANCE,
        message: ERROR_CODES.transaction.messages.TRANSACTION_NOT_ENOUGH_BALANCE,
      })
    }

    if (Number(conversionAmount) < minimalWithdrawalAmount) {
      throw new BadRequestException({
        code: ERROR_CODES.transaction.codes.TRANSACTION_NOT_ENOUGH_BALANCE_FOR_MINIMAL_WITHDRAWAL,
        message: ERROR_CODES.transaction.messages.TRANSACTION_NOT_ENOUGH_BALANCE_FOR_MINIMAL_WITHDRAWAL?.replace(
          '{minWithdrawalAmount}',
          String(truncate(defaultTransferFee.totalFee * 2, 4)),
        ).replace('{currency}', `${transactionCurrencyLabels[conversionCurrency]} (${conversionCurrency})`),
      })
    }

    return {
      /**
       * balance amount
       */
      amount: finalAmount,
      /**
       * balance currency
       */
      currency,
      /**
       * fixed fee in withdrawal currency
       */
      defaultTransferFee,
      /**
       * withdrawal target amount
       */
      conversionAmount: String(truncate(conversionAmount, 4)),
      /**
       * withdrawal target currency
       */
      conversionCurrency,
      conversionRate,
    }
  }

  async withdrawal(user: TgInitUser, dto: WithdrawalDto) {
    const logKey = `${getUniqueId()}-withdrawal`

    if (!dto.targetWalletAddress) {
      throw new BadRequestException({
        code: ERROR_CODES.transaction.codes.TRANSACTION_TARGET_WALLET_ADDRESS_EMPTY,
        message: ERROR_CODES.transaction.messages.TRANSACTION_TARGET_WALLET_ADDRESS_EMPTY,
      })
    }

    const { amount, defaultTransferFee, currency, conversionAmount, conversionCurrency, conversionRate } =
      await this.checkingWithdrawal(user, {
        currency: dto.currency,
        amount: dto.amount,
      })

    const { finalAmountToGet, serviceFee } = await this.getAmountWithFees(
      {
        currency: conversionCurrency,
        amount: conversionAmount,
      },
      { defaultTransferFee },
    )

    this.logger.debug({
      amount,
      defaultTransferFee,
      currency,
      finalAmountToGet,
      serviceFee,
      conversionAmount,
      conversionCurrency,
    })

    const depositConversionCurrencyTransactionId = getUniqueId()
    const withdrawTargetCurrencyTransactionId = getUniqueId()

    if (currency !== conversionCurrency) {
      const withdrawSourceCurrencyTransaction = this.transactionEntity.getValidProperties(
        {
          userId: user?.id?.toString(),
          type: TransactionType.USER_WITHDRAW,
          amount,
          currency: currency,
          provider: TransactionProvider.INTERNAL,
          status: TransactionStatus.CONFIRMED,
          childrenTransactionId: depositConversionCurrencyTransactionId,
          payload: jsonStringify<TransactionPayload>({
            message: 'Конвертация баланса',
            type: TransactionPayloadType.CONVERT_BALANCE,
            conversionRate: {
              fromCurrency: currency,
              toCurrency: conversionCurrency,
              rate: String(truncate(conversionRate, 4)),
              amount: conversionAmount,
            },
          }),
        },
        false,
        logKey,
      )

      const depositSourceCurrencyTransaction = this.transactionEntity.getValidProperties(
        {
          id: depositConversionCurrencyTransactionId,
          userId: user?.id?.toString(),
          type: TransactionType.USER_TOPUP,
          amount: conversionAmount,
          currency: conversionCurrency,
          provider: TransactionProvider.INTERNAL,
          status: TransactionStatus.CONFIRMED,
          parentTransactionId: withdrawSourceCurrencyTransaction.id,
          childrenTransactionId: withdrawTargetCurrencyTransactionId,
          payload: jsonStringify<TransactionPayload>({
            message: 'Конвертация баланса',
            type: TransactionPayloadType.CONVERT_BALANCE,
            conversionRate: {
              fromCurrency: currency,
              toCurrency: conversionCurrency,
              rate: String(truncate(conversionRate, 4)),
              amount: conversionAmount,
            },
          }),
        },
        false,
        logKey,
      )

      await this.transactionEntity.createOrUpdate(withdrawSourceCurrencyTransaction)
      await this.transactionEntity.createOrUpdate(depositSourceCurrencyTransaction)

      this.logger.log(`${logKey} - Payload deposit and withdraw source currency transaction`, {
        withdrawSourceCurrencyTransaction,
        depositSourceCurrencyTransaction,
      })
    }

    let payloadFinalUserWithdrawalTransaction = this.transactionEntity.getValidProperties(
      {
        id: withdrawTargetCurrencyTransactionId,
        userId: user?.id?.toString(),
        type: TransactionType.USER_WITHDRAW,
        /**
         * Оставляем сумму без комиссии, так как мы именно столько списываем с пользователя
         */
        parentTransactionId: depositConversionCurrencyTransactionId,
        amount: conversionAmount,
        currency: conversionCurrency,
        provider: TransactionProvider.BLOCKCHAIN,
        status: TransactionStatus.CREATED,
        blockchainProvider: TransactionBlockchainProvider.TON,
        comissionPercent: TRANSACTION_WITHDRAW_COMISSION,
        actionAddress: null,
        providerInvoiceId: null,
        comissionAmount: serviceFee,
        comissionCurrency: conversionCurrency,
        refundExpiredAt: Timestamp.fromDate(time().toDate()),
        payload: jsonStringify<TransactionPayload>({
          message:
            'Вывод создан, может занять до 24 часов. Если транзакция так и не завершилась или завершилась с ошибкой, то обратитесь в поддержку.',
          type: TransactionPayloadType.WITHDRAWAL_TO_EXTERNAL_WALLET,
          targetWalletAddress: dto.targetWalletAddress,
          serviceFee,
          finalAmountToGet: {
            amount: String(truncate(Number(finalAmountToGet.amount), 4)),
            currency: finalAmountToGet.currency,
          },
          conversionCurrency,
          conversionAmount,
        }),
      },
      false,
      logKey,
    )

    this.logger.log(`${logKey} - Payload final user withdrawal transaction`, {
      payloadFinalUserWithdrawalTransaction,
    })

    try {
      const response = await this.paymentProvidersService.transferFromWithdrawalWalletToTargetWallet(
        PAYMENT_PROVIDER.TON,
        {
          targetWalletAddress: dto.targetWalletAddress,
          amount: String(truncate(Number(finalAmountToGet.amount), 4)),
          currency: finalAmountToGet.currency,
          comment: `Withdrawal balance from @${this.customConfigService.tgBotUsername}`,
          logKey,
        },
      )

      this.logger.debug(`${logKey} - Response from payment provider`, response)

      const payload = jsonParse<TransactionPayload>(payloadFinalUserWithdrawalTransaction.payload)

      payloadFinalUserWithdrawalTransaction = this.transactionEntity.getValidProperties(
        {
          ...payloadFinalUserWithdrawalTransaction,
          actionAddress: response.actionAddress,
          status: TransactionStatus.PENDING,
          providerInvoiceId: response.hash,
          payload: jsonStringify<TransactionPayload>({
            ...payload,
            message: 'Вывод успешно отправлен в блокчейн, пожалуйста, дождитесь завершения транзакции',
            txScanUrl: response.scanUrl,
            addressScanUrl: `${response.rootScanUrl}/address/${dto.targetWalletAddress}`,
          }),
        },
        false,
        logKey,
      )

      this.logger.debug(`${logKey} - Final user withdrawal transaction`, payloadFinalUserWithdrawalTransaction)
      await this.transactionEntity.createOrUpdate(payloadFinalUserWithdrawalTransaction)

      return {
        isError: false,
        ...response,
        finalAmountToGet,
        conversionCurrency,
      }
    } catch (error) {
      this.logger.error(
        `${logKey} - Error with transfer from withdrawal wallet to target wallet, but save transaction in created status`,
        error,
        payloadFinalUserWithdrawalTransaction,
      )
      await this.transactionEntity.createOrUpdate(payloadFinalUserWithdrawalTransaction)

      return {
        isError: true,
        scanUrl: null,
        finalAmountToGet,
        conversionCurrency,
      }
    }
  }
}
