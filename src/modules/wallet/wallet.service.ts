import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { beginCell } from '@ton/ton'
import { CHAIN, toUserFriendlyAddress, Wallet, WalletInfo } from '@tonconnect/sdk'
import * as QRCode from 'qrcode'
import { TonConnectService, TonConnectWallets } from 'src/services'

import { CustomConfigService } from '../config'
import { PAYMENT_PROVIDER, PaymentProvidersService } from '../payment-providers'
import { WalletNames } from './wallet.type'

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name)
  private readonly newConnectRequestListenersMap = new Map<number, () => void>()
  private readonly tonDepositAddress: string
  private readonly tonWithdrawAddress: string

  constructor(
    private readonly tonConnectWallets: TonConnectWallets,
    private readonly tonConnectService: TonConnectService,
    private readonly configService: ConfigService,
    private readonly paymentProvidersService: PaymentProvidersService,
    private readonly customConfigService: CustomConfigService,
  ) {
    this.tonDepositAddress = this.configService.get('TON_DEPOSIT_ADDRESS')
    this.tonWithdrawAddress = this.configService.get('TON_WITHDRAW_ADDRESS')
  }

  public async disconnectWallet(chatId: number) {
    const connector = this.tonConnectService.getConnector(chatId)
    await connector.restoreConnection()

    if (!connector.connected) {
      return {
        isError: true,
        message: 'У вас нет подключенного кошелька',
      }
    }

    const walletName =
      (await this.tonConnectWallets.getWalletInfo(connector?.wallet?.device?.appName))?.name ||
      connector?.wallet?.device?.appName
    const walletAddress = toUserFriendlyAddress(
      connector.wallet.account.address,
      connector.wallet.account.chain === CHAIN.TESTNET,
    )

    await connector.disconnect()

    return {
      isError: false,
      message: `Кошелек ${walletName} отключен`,
      address: walletAddress,
      walletName,
    }
  }

  public async checkConnectedWallet(chatId: number) {
    const connector = this.tonConnectService.getConnector(chatId)

    await connector.restoreConnection()

    if (!connector.connected) {
      return {
        isError: true,
        message: 'У вас нет подключенного кошелька',
      }
    }

    if (connector.wallet.account.chain === CHAIN.TESTNET && !this.customConfigService.testnetEnabled) {
      return {
        isError: true,
        message: 'Вы не можете подключить кошелек в тестовой сети',
      }
    }

    return {
      isError: false,
      message: 'Кошелек подключен',
    }
  }

  public async sendTonTransaction(
    chatId: number,
    amount: string,
    type: 'deposit' | 'withdraw' = 'deposit',
    txMessage?: string,
    requestSent?: (walletInfo: WalletInfo, walletAddress: string, isTestnet: boolean) => void,
  ) {
    const connector = this.tonConnectService.getConnector(chatId)

    await connector.restoreConnection()

    if (!connector.connected) {
      return {
        isError: true,
        message: 'У вас нет подключенного кошелька',
      }
    }

    if (!type) {
      return {
        isError: true,
        message: 'Не удалось получить тип транзакции',
      }
    }

    if (connector.wallet.account.chain === CHAIN.TESTNET && !this.customConfigService.testnetEnabled) {
      return {
        isError: true,
        message: 'Вы не можете оплачивать кошельком в тестовой сети',
      }
    }

    const nanos = await this.paymentProvidersService.getNanos(PAYMENT_PROVIDER.TON, amount)

    const walletInfo = await this.tonConnectWallets.getWalletInfo(connector?.wallet?.device?.appName)

    const body = beginCell()
      .storeUint(0, 32) // write 32 zero bits to indicate that a text comment will follow
      .storeStringTail(txMessage) // write our text comment
      .endCell()

    if (type === 'deposit') {
      const transaction = await connector.sendTransaction(
        {
          /**
           * 20 minutes
           */
          validUntil: Math.floor(Date.now() / 1000) + 20 * 60,
          messages: [
            {
              address: this.tonDepositAddress,
              amount: nanos.validAmount.toString(),
              payload: body.toBoc().toString('base64'),
            },
          ],
        },
        {
          onRequestSent: () => {
            requestSent?.(
              walletInfo,
              connector.wallet.account.address,
              connector.wallet.account.chain === CHAIN.TESTNET,
            )
          },
        },
      )

      const { hash, scanUrl } = await this.paymentProvidersService.getMsgHashAndScan(
        PAYMENT_PROVIDER.TON,
        transaction.boc,
      )

      const walletAddress = toUserFriendlyAddress(
        connector.wallet.account.address,
        connector.wallet.account.chain === CHAIN.TESTNET,
      )

      return {
        isError: false,
        message: 'Транзакция отправлена',
        transaction: {
          hash,
          scanUrl,
          chain: connector.wallet.account.chain,
          walletAddress,
        },
      }
    }
  }

  public async showConnectedWallet(chatId: number) {
    const connector = this.tonConnectService.getConnector(chatId)

    await connector.restoreConnection()

    if (!connector.connected) {
      return {
        isError: true,
      }
    }

    const walletName =
      (await this.tonConnectWallets.getWalletInfo(connector?.wallet?.device?.appName))?.name ||
      connector?.wallet?.device?.appName

    const address = toUserFriendlyAddress(
      connector.wallet.account.address,
      connector.wallet.account.chain === CHAIN.TESTNET,
    )

    const balance = await this.paymentProvidersService.getBalance(PAYMENT_PROVIDER.TON, address)

    return {
      address,
      walletName,
      balance,
      message: `Connected wallet: ${walletName}\nYour address: ${toUserFriendlyAddress(
        connector.wallet.account.address,
        connector.wallet.account.chain === CHAIN.TESTNET,
      )}`,
      isTestnet: connector.wallet.account.chain === CHAIN.TESTNET,
    }
  }

  public async getAvailableWallets(availableWallets?: WalletNames[]) {
    let wallets = await this.tonConnectWallets.getWallets()

    if (availableWallets?.length) {
      wallets = wallets.filter((wallet) => availableWallets.includes(wallet.appName))
    }

    return wallets
  }

  public async getWalletListWithLink(
    chatId: number,
    availableWallets?: WalletNames[],
    onStatusChangedSuccessHandler?: (wallet: Wallet) => Promise<void>,
    onStatusChangedErrorHandler?: (error: Error) => Promise<void>,
  ) {
    this.newConnectRequestListenersMap.get(chatId)?.()

    const connector = this.tonConnectService.getConnector(chatId, () => {
      unsubscribe()
      this.newConnectRequestListenersMap.delete(chatId)
    })

    await connector.restoreConnection()

    let unsubscribe: () => void

    if (onStatusChangedSuccessHandler) {
      unsubscribe = connector.onStatusChange(
        (wallet) => {
          unsubscribe()
          this.newConnectRequestListenersMap.delete(chatId)

          this.logger.log('connector.success', wallet)

          const isTestnetChainError =
            connector.wallet.account.chain === CHAIN.TESTNET && !this.customConfigService.testnetEnabled

          if (onStatusChangedSuccessHandler && !isTestnetChainError) {
            onStatusChangedSuccessHandler?.(wallet)
          }

          if (isTestnetChainError && onStatusChangedErrorHandler) {
            onStatusChangedErrorHandler?.(
              new Error('Вы не можете подключить кошелек в тестовой сети, попробуйте поменять сеть на Mainnet'),
            )

            connector.disconnect()
          }
        },
        (error) => {
          this.logger.error('connector.error', error)
          onStatusChangedErrorHandler?.(error)
        },
      )
    }

    this.newConnectRequestListenersMap.set(chatId, async () => {
      unsubscribe()

      this.newConnectRequestListenersMap.delete(chatId)
    })

    const wallets = await this.getAvailableWallets(availableWallets)

    const link = connector.connect(wallets)

    const image = await QRCode.toBuffer(link)

    return { image, link, wallets }
  }

  public async tryToConnectToWallet(
    chatId: number,
    walletName: WalletNames,
    onStatusChangedSuccessHandler?: (wallet: Wallet) => Promise<void>,
    onStatusChangedErrorHandler?: (error: Error) => Promise<void>,
  ) {
    this.newConnectRequestListenersMap.get(chatId)?.()

    const connector = this.tonConnectService.getConnector(chatId, () => {
      unsubscribe()
      this.newConnectRequestListenersMap.delete(chatId)
    })

    await connector.restoreConnection()

    let unsubscribe: () => void

    if (onStatusChangedSuccessHandler) {
      unsubscribe = connector.onStatusChange(
        (wallet) => {
          unsubscribe()
          this.newConnectRequestListenersMap.delete(chatId)

          this.logger.log('connector.success', wallet)

          const isTestnetChainError =
            connector.wallet.account.chain === CHAIN.TESTNET && !this.customConfigService.testnetEnabled

          if (onStatusChangedSuccessHandler && !isTestnetChainError) {
            onStatusChangedSuccessHandler?.(wallet)
          }

          if (isTestnetChainError && onStatusChangedErrorHandler) {
            onStatusChangedErrorHandler?.(
              new Error('Вы не можете подключить кошелек в тестовой сети, попробуйте поменять сеть на Mainnet'),
            )

            connector.disconnect()
          }
        },
        (error) => {
          this.logger.error('connector.error', error)
          onStatusChangedErrorHandler?.(error)
        },
      )
    }

    const wallets = await this.getAvailableWallets()

    const selectedWallet = wallets.find((wallet) => wallet.appName === walletName)

    const link = connector.connect({
      bridgeUrl: selectedWallet.bridgeUrl,
      universalLink: selectedWallet.universalLink,
    })

    this.newConnectRequestListenersMap.set(chatId, async () => {
      unsubscribe()

      this.newConnectRequestListenersMap.delete(chatId)
    })

    const image = await QRCode.toBuffer(link)

    return { image, link }
  }
}
