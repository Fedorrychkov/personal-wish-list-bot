import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { isWalletInfoRemote, WalletInfoRemote, WalletsListManager } from '@tonconnect/sdk'

@Injectable()
export class TonConnectWallets {
  private readonly walletsListManager

  constructor(private readonly configService: ConfigService) {
    this.walletsListManager = new WalletsListManager({
      cacheTTLMs: Number(this.configService.get('WALLETS_LIST_CACHE_TTL_MS')),
    })
  }

  async getWallets(): Promise<WalletInfoRemote[]> {
    const wallets = await this.walletsListManager.getWallets()

    return wallets.filter(isWalletInfoRemote)
  }

  async getWalletInfo(walletAppName: string): Promise<WalletInfoRemote | undefined> {
    const wallets = await this.getWallets()

    return wallets.find((wallet) => wallet.appName.toLowerCase() === walletAppName.toLowerCase())
  }
}
