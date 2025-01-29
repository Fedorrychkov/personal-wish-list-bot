import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import {
  TransactionEntity,
  TransactionPayload,
  TransactionProvider,
  TransactionStatus,
  TransactionType,
} from 'src/entities'
import { getUniqueId, jsonParse, jsonStringify, time, timeout, truncate } from 'src/helpers'

import { CustomConfigService } from '../config'
import { PaymentProvidersService } from '../payment-providers'
import { TransactionService } from './transaction.service'

@Injectable()
export class TransactionSchedule {
  private readonly logger = new Logger(TransactionSchedule.name)

  constructor(
    private readonly transactionEntity: TransactionEntity,
    private readonly paymentProvidersService: PaymentProvidersService,
    private readonly transactionService: TransactionService,
    private readonly customConfigService: CustomConfigService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  public async checkCreatedTransaction() {
    const logKey = `checkCreatedTransaction-${getUniqueId()}`
    const transactions = await this.transactionEntity.findAll(
      {
        status: TransactionStatus.CREATED,
        limit: 300,
      },
      false,
    )

    if (!transactions.length) {
      return
    }

    const blockchainTransactions = transactions.filter(
      (transaction) =>
        transaction.provider === TransactionProvider.BLOCKCHAIN &&
        transaction.type === TransactionType.USER_WITHDRAW &&
        time().diff(transaction.createdAt.toDate(), 'day') < 1,
    )

    if (!blockchainTransactions.length) {
      return
    }

    for await (const transaction of blockchainTransactions) {
      try {
        const payload = jsonParse<TransactionPayload>(transaction.payload)

        if (!payload.targetWalletAddress || !payload.finalAmountToGet?.amount || !payload.finalAmountToGet?.currency) {
          this.logger.error(`${logKey} - Target wallet address is not found in payload`, {
            transaction,
          })

          await this.transactionService.update(transaction.id, transaction, {
            status: TransactionStatus.FAILED,
            statusMessage: 'Target wallet address or finalAmountToGet is not found in payload',
          })

          continue
        }

        const response = await this.paymentProvidersService.transferFromWithdrawalWalletToTargetWallet(
          transaction.blockchainProvider,
          {
            targetWalletAddress: payload.targetWalletAddress,
            amount: String(truncate(payload.finalAmountToGet.amount, 4)),
            currency: payload.finalAmountToGet.currency,
            comment: `Withdrawal balance from @${this.customConfigService.tgBotUsername}`,
            logKey,
          },
        )

        this.logger.debug(`${logKey} - Response from payment provider`, response)

        await this.transactionService.update(transaction.id, transaction, {
          actionAddress: response.actionAddress,
          status: TransactionStatus.PENDING,
          providerInvoiceId: response.hash,
          payload: jsonStringify<TransactionPayload>({
            ...payload,
            message: 'Вывод успешно отправлен в блокчейн, пожалуйста, дождитесь завершения транзакции',
            txScanUrl: response.scanUrl,
            addressScanUrl: `${response.rootScanUrl}/address/${payload.targetWalletAddress}`,
          }),
        })

        /**
         * После каждого успешного, мы выходим из цикла, так как нужно время для обновления seqno кошелька вывода в блокчейне.
         */
        break
      } catch (error) {
        this.logger.error(`${logKey} - Error with transferFromWithdrawalWalletToTargetWallet`, {
          error,
          transaction,
        })

        continue
      }
    }
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  public async checkPendingTransaction() {
    const logKey = `checkPendingTransaction-${getUniqueId()}`
    const transactions = await this.transactionEntity.findAll(
      {
        status: TransactionStatus.PENDING,
        limit: 30,
      },
      false,
    )

    if (!transactions.length) {
      return
    }

    const blockchainTransactions = transactions.filter(
      (transaction) => transaction.provider === TransactionProvider.BLOCKCHAIN,
    )

    if (!blockchainTransactions.length) {
      return
    }

    for await (const transaction of blockchainTransactions) {
      try {
        const response = await this.paymentProvidersService.getTransaction(
          transaction.blockchainProvider,
          transaction.providerInvoiceId,
          {
            address: transaction.actionAddress,
            limit: 10,
            transactionAmount:
              transaction.type === TransactionType.USER_WITHDRAW
                ? jsonParse<TransactionPayload>(transaction.payload)?.finalAmountToGet?.amount || transaction.amount
                : transaction.amount,
            logKey,
          },
        )

        this.logger.log(transaction.id, response, 'response')

        const { status, isValidAmount, finalAmount, statusMessage } = response

        const isCurrentAmount = !isValidAmount || transaction.comissionAmount

        if (status !== TransactionStatus.CONFIRMED) {
          const createdAt = time(transaction.createdAt.toDate())
          const currentTime = time()

          // Если транзакция создавалась меньше 2 минут назад, то ждем следующего запроса
          const isAwaitNext = currentTime.diff(createdAt, 'minute') < 2

          if (isAwaitNext) {
            continue
          }
        }

        const payload = jsonParse<TransactionPayload>(transaction.payload)

        await this.transactionService.update(transaction.id, transaction, {
          status,
          statusMessage: `Tx from ${transaction.blockchainProvider} api, ${
            !isCurrentAmount ? 'but amount may be uncorrent' : ''
          } finalAmountTxAmount=${finalAmount}, statusMessage=${statusMessage}`,
          payload: jsonStringify<TransactionPayload>({
            ...payload,
            message: 'Обработка транзакции завершена. Если что-то пошло не так, пожалуйста, обратитесь в поддержку.',
          }),
        })

        await timeout(300)
      } catch (error) {
        await this.transactionService.update(transaction.id, transaction, {
          status: TransactionStatus.FAILED,
          statusMessage: error.message || error?.toString?.() || 'Unknown in pending schedule error',
        })

        this.logger.error(error)

        await timeout(300)
      }
    }
  }
}
