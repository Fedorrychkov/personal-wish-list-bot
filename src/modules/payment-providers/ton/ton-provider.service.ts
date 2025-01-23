import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Address, beginCell, Cell, fromNano, storeMessage, toNano, Transaction } from '@ton/core'
import { TonClient } from '@ton/ton'
import { isNil } from 'lodash'
import { TransactionStatus } from 'src/entities'

import { CustomConfigService } from '../../config'
import { GetTransactionOptions, IPaymentProviderService } from '../payment-provider.interfaces'

@Injectable()
export class TonProviderService implements IPaymentProviderService {
  private readonly logger = new Logger(TonProviderService.name)
  private readonly client: TonClient
  private readonly depositAddress: string
  private readonly withdrawAddress: string
  private readonly tonCenterApiKey: string

  constructor(
    private readonly customConfigService: CustomConfigService,
    private readonly configService: ConfigService,
  ) {
    this.tonCenterApiKey = this.configService.get<string>('TON_CENTER_API_KEY')

    this.client = new TonClient({
      endpoint: this.customConfigService.testnetEnabled
        ? 'https://testnet.toncenter.com/api/v2/jsonRPC'
        : 'https://toncenter.com/api/v2/jsonRPC',
      apiKey: this.tonCenterApiKey,
    })

    this.depositAddress = this.configService.get('TON_DEPOSIT_ADDRESS')
    this.withdrawAddress = this.configService.get('TON_WITHDRAW_ADDRESS')
  }

  public async healthcheck() {
    const balance = await this.client.getBalance(Address.parse(this.depositAddress))

    if (isNil(balance)) {
      return false
    }

    return true
  }

  public async getBalance(address: string) {
    const balance = await this.client.getBalance(Address.parse(address))

    if (isNil(balance)) {
      return { amount: '0', currency: 'TON' }
    }

    const ton = fromNano(balance)

    return { amount: ton, currency: 'TON' }
  }

  public async getNanos(amount: string | number) {
    const nanos = toNano(amount)

    return { validAmount: nanos.toString() }
  }

  public async getMsgHashAndScan(boc: string) {
    const cell = Cell.fromBase64(boc)
    const buffer = cell.hash()
    const hash = buffer.toString('base64')

    return {
      hash,
      scanUrl: `https://${this.customConfigService.testnetEnabled ? 'testnet.' : ''}tonscan.org/tx/${hash}`,
    }
  }

  public async getTransaction(txHash: string, options?: GetTransactionOptions) {
    const { address, limit, transactionAmount } = options
    const transactions = await this.client.getTransactions(Address.parse(address), {
      limit,
      lt: undefined,
      hash: txHash,
      to_lt: undefined,
      inclusive: true,
      archival: true,
    })

    let foundTransaction: Transaction | null = null

    for await (const transaction of transactions) {
      const inMessage = transaction.inMessage

      if (inMessage?.info.type === 'external-in') {
        const inMessageCell = beginCell().store(storeMessage(inMessage)).endCell()
        const inMessageHash = inMessageCell.hash()

        if (inMessageHash.toString('base64') === txHash) {
          foundTransaction = transaction

          break
        }

        continue
      }
    }

    if (foundTransaction) {
      const outMessages = foundTransaction.outMessages.values()
      const firstOutMessage = outMessages[0]

      const finalAmount = firstOutMessage?.info.type === 'internal' ? firstOutMessage.info.value.coins : ''
      const isValidAmount = finalAmount === toNano(transactionAmount)?.toString?.()

      return {
        status:
          firstOutMessage?.info.type === 'internal'
            ? firstOutMessage?.info?.bounce
              ? TransactionStatus.PENDING
              : TransactionStatus.CONFIRMED
            : TransactionStatus.FAILED,
        fees: {
          total: foundTransaction?.totalFees?.coins?.toString(),
        },
        finalAmount: fromNano(finalAmount),
        isValidAmount,
        statusMessage: 'Транзакция найдена',
      }
    }

    return {
      status: TransactionStatus.FAILED,
      statusMessage: 'Транзакция не найдена',
    }
  }
}
