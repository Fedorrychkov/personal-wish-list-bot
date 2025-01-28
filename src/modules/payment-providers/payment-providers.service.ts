import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common'

import {
  BlockchainTxResponse,
  GetTransactionOptions,
  TransferFromWithdrawalWalletToTargetWalletOptions,
} from './payment-provider.interfaces'
import { PAYMENT_PROVIDER } from './payment-providers.types'
import { TonProviderService } from './ton/ton-provider.service'

@Injectable()
export class PaymentProvidersService {
  private readonly logger = new Logger(PaymentProvidersService.name)

  constructor(private readonly tonProviderService: TonProviderService) {}

  private async getProvider(provider: PAYMENT_PROVIDER | string) {
    switch (provider) {
      case PAYMENT_PROVIDER.TON:
        return this.tonProviderService
      default:
        throw new InternalServerErrorException('Provider not found')
    }
  }

  public async healthcheck(provider: PAYMENT_PROVIDER | string) {
    const providerService = await this.getProvider(provider)

    return providerService.healthcheck()
  }

  public async getBalance(provider: PAYMENT_PROVIDER | string, address: string) {
    const providerService = await this.getProvider(provider)

    return providerService.getBalance(address)
  }

  public async getNanos(provider: PAYMENT_PROVIDER | string, amount: string | number) {
    const providerService = await this.getProvider(provider)

    return providerService.getNanos(amount)
  }

  public async getMsgHashAndScan(provider: PAYMENT_PROVIDER | string, boc: string) {
    const providerService = await this.getProvider(provider)

    return providerService.getMsgHashAndScan(boc)
  }

  public async getTransaction(
    provider: PAYMENT_PROVIDER | string,
    txHash: string,
    options?: GetTransactionOptions,
  ): Promise<BlockchainTxResponse> {
    const providerService = await this.getProvider(provider)

    return providerService.getTransaction(txHash, options)
  }

  public async transferFromWithdrawalWalletToTargetWallet(
    provider: PAYMENT_PROVIDER | string,
    options: TransferFromWithdrawalWalletToTargetWalletOptions,
  ) {
    const providerService = await this.getProvider(provider)

    return providerService.trasferFromWithdrawalWalletToTargetWallet(options)
  }

  public async getDefaultTransferFee(provider: PAYMENT_PROVIDER | string) {
    const providerService = await this.getProvider(provider)

    return providerService.getDefaultTransferFee()
  }
}
