import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { TransactionEntity, TransactionProvider, TransactionStatus } from 'src/entities'
import { time, timeout } from 'src/helpers'

import { PaymentProvidersService } from '../payment-providers'
import { TransactionService } from './transaction.service'

@Injectable()
export class TransactionSchedule {
  private readonly logger = new Logger(TransactionSchedule.name)

  constructor(
    private readonly transactionEntity: TransactionEntity,
    private readonly paymentProvidersService: PaymentProvidersService,
    private readonly transactionService: TransactionService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  public async checkPendingTransaction() {
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
            transactionAmount: transaction.amount,
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

        await this.transactionService.update(transaction.id, transaction, {
          status,
          statusMessage: `Tx from ${transaction.blockchainProvider} api, ${
            !isCurrentAmount ? 'but amount may be uncorrent' : ''
          } finalAmountTxAmount=${finalAmount}, statusMessage=${statusMessage}`,
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
