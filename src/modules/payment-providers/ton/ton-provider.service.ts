import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  Address,
  beginCell,
  Cell,
  external,
  fromNano,
  internal,
  SendMode,
  storeMessage,
  toNano,
  Transaction,
} from '@ton/core'
import { KeyPair, mnemonicToWalletKey } from '@ton/crypto'
import { TonClient, WalletContractV3R2, WalletContractV5R1 } from '@ton/ton'
import { isNil } from 'lodash'
import { TransactionStatus } from 'src/entities'
import { ERROR_CODES } from 'src/errors'
import { truncate } from 'src/helpers'

import { CustomConfigService } from '../../config'
import {
  GetTransactionOptions,
  IPaymentProviderService,
  TransferFromWithdrawalWalletToTargetWalletOptions,
} from '../payment-provider.interfaces'

@Injectable()
/**
 * Docs:
 * 1. Wallets working https://github.com/ton-community/tutorials/blob/main/01-wallet/index.md
 */
export class TonProviderService implements IPaymentProviderService {
  private readonly logger = new Logger(TonProviderService.name)
  private readonly client: TonClient
  private readonly depositAddress: string
  private readonly withdrawAddress: string
  private readonly tonCenterApiKey: string
  private readonly withdrawalMnemonic: string
  private readonly tonscanUrl: string
  private withdrawalWallet: WalletContractV5R1 | WalletContractV3R2
  private withdrawalWalletKeyPair: KeyPair

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
    this.withdrawalMnemonic = this.configService.get('TON_WITHDRAWAL_MNEMONIC')

    this.tonscanUrl = `https://${this.customConfigService.testnetEnabled ? 'testnet.' : ''}tonscan.org`

    this.initWithdrawalWallet()
  }

  private async initWithdrawalWallet() {
    // Получаем ключи из мнемоники
    if (!this.withdrawalMnemonic) {
      return
    }

    const mnemonic = this.withdrawalMnemonic.split?.(' ')

    const keyPair = await mnemonicToWalletKey(mnemonic)

    this.withdrawalWallet = this.customConfigService.testnetEnabled
      ? WalletContractV3R2.create({ publicKey: keyPair.publicKey, workchain: 0 })
      : WalletContractV5R1.create({ publicKey: keyPair.publicKey, workchain: 0 })

    this.withdrawalWalletKeyPair = keyPair

    this.getSeqnoForWithdrawalWallet()
  }

  public async getSeqnoForWithdrawalWallet() {
    try {
      const walletContract = this.client.open(this.withdrawalWallet)
      const seqno = await walletContract.getSeqno()

      const isDeployed = await this.client.isContractDeployed(this.withdrawalWallet.address)

      if (!isDeployed) {
        throw new InternalServerErrorException('Withdrawal contract is not deployed')
      }

      this.logger.log(`Seqno for withdrawal wallet=${seqno}`)

      return seqno
    } catch (error) {
      this.logger.error('Error getting seqno for withdrawal wallet', { error })

      throw error
    }
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
      scanUrl: `${this.tonscanUrl}/tx/${hash}`,
    }
  }

  public async getTransaction(txHash: string, options?: GetTransactionOptions) {
    const { address, limit, transactionAmount } = options

    try {
      this.logger.log(`${options?.logKey} - Get transaction`, {
        address,
        limit,
        txHash,
        transactionAmount,
      })

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
        this.logger.log(`${options?.logKey} - Found transaction`, {
          address,
          limit,
          txHash,
          transactionAmount,
        })

        const outMessages = foundTransaction.outMessages.values()
        const firstOutMessage = outMessages[0]

        const finalAmount = firstOutMessage?.info.type === 'internal' ? firstOutMessage.info.value.coins : ''
        const isValidAmount = finalAmount === toNano(transactionAmount)

        return {
          status:
            firstOutMessage?.info.type === 'internal'
              ? firstOutMessage?.info?.bounce
                ? TransactionStatus.PENDING
                : TransactionStatus.CONFIRMED
              : TransactionStatus.FAILED,
          fees: {
            total: fromNano(foundTransaction?.totalFees?.coins).toString(),
            currency: 'TON',
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
    } catch (error) {
      this.logger.error(`${options?.logKey} - Error getting transaction`, {
        error,
        txHash,
      })
    }
  }

  public async canWithdrawal(amount: string, currency: string) {
    const nanos = toNano(amount)
    const balance = await this.getBalance(this.withdrawAddress)

    if (balance.currency !== currency) {
      return false
    }

    return nanos <= toNano(balance.amount)
  }

  public async getDefaultTransferFee() {
    const lump_price = 400000
    const bit_price = 26214400
    const cell_price = 2621440000
    const first_frac = 21845
    const nano = 10 ** -9
    const bit16 = 2 ** 16

    const fwd_fee = lump_price + Math.ceil((bit_price * 0 + cell_price * 0) / bit16)

    const gas_fees = 0.0011976 // Gas fees out of scope here
    const storage_fees = 0.000000003 // And storage fees as well
    const total_action_fees = +((fwd_fee * first_frac) / bit16).toFixed(9)
    const import_fee = lump_price + Math.ceil((bit_price * 528 + cell_price * 1) / bit16)
    const total_fee = gas_fees + storage_fees + total_action_fees * nano + import_fee * nano

    return {
      totalFee: this.customConfigService.testnetEnabled
        ? truncate(total_fee + 0.001, 6) * 2
        : truncate(total_fee + 0.001, 6) * 2,
      currency: 'TON',
    }
  }

  public async trasferFromWithdrawalWalletToTargetWallet(options: TransferFromWithdrawalWalletToTargetWalletOptions) {
    const { targetWalletAddress, amount, currency, comment, logKey } = options

    const canWithdrawal = await this.canWithdrawal(amount, currency)

    if (!canWithdrawal) {
      this.logger.error(`${logKey} - Not enough balance for withdrawal`, {
        targetWalletAddress,
        amount,
        currency,
      })

      throw new BadRequestException({
        code: ERROR_CODES.wallet.codes.NOT_ENOUGH_BALANCE_FOR_WITHDRAWAL,
        message: ERROR_CODES.wallet.messages.NOT_ENOUGH_BALANCE_FOR_WITHDRAWAL,
      })
    }

    const withdrawalWalletAddressFromWallet = this.withdrawalWallet.address.toString({
      urlSafe: true,
      bounceable: false,
      testOnly: false,
    })

    const seqno = await this.getSeqnoForWithdrawalWallet()

    this.logger.log(`${logKey} - Get Seqno from withdrawal wallet`, {
      seqno,
      amount,
      currency,
    })

    const internalMessage = internal({
      to: Address.parse(targetWalletAddress),
      value: toNano(amount),
      body: comment,
      bounce: false,
    })

    const promise =
      this.withdrawalWallet instanceof WalletContractV5R1
        ? this.withdrawalWallet.createTransfer({
            secretKey: this.withdrawalWalletKeyPair.secretKey,
            seqno,
            messages: [internalMessage],
            sendMode: SendMode.NONE,
          })
        : this.withdrawalWallet.createTransfer({
            secretKey: this.withdrawalWalletKeyPair.secretKey,
            seqno,
            messages: [internalMessage],
          })

    const transfer = await promise

    const externalMessage = external({
      to: withdrawalWalletAddressFromWallet,
      init: this.withdrawalWallet.init,
      body: transfer,
    })

    const externalMessageCell = beginCell().store(storeMessage(externalMessage)).endCell()

    /**
     * signed transaction - это тот самый boc, который по итогу отправляется далее
     */
    const signedTransaction = externalMessageCell.toBoc()
    const hash = externalMessageCell.hash().toString('base64')

    this.logger.log(`${logKey} - Get Hash from withdrawal wallet`, {
      hash,
      amount,
      currency,
    })

    await this.client.sendFile(signedTransaction)

    return {
      hash,
      scanUrl: `${this.tonscanUrl}/tx/${hash}`,
      rootScanUrl: this.tonscanUrl,
      actionAddress: withdrawalWalletAddressFromWallet,
    }
  }
}
