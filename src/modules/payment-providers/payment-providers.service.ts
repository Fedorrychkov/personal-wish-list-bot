import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common'

import { PAYMENT_PROVIDER } from './payment-providers.types'
import { TonProviderService } from './ton/ton-provider.service'

@Injectable()
export class PaymentProvidersService {
  private readonly logger = new Logger(PaymentProvidersService.name)

  constructor(private readonly tonProviderService: TonProviderService) {}

  private async getProvider(provider: PAYMENT_PROVIDER) {
    switch (provider) {
      case PAYMENT_PROVIDER.TON:
        return this.tonProviderService
      default:
        throw new InternalServerErrorException('Provider not found')
    }
  }

  public async healthcheck(provider: PAYMENT_PROVIDER) {
    const providerService = await this.getProvider(provider)

    return providerService.healthcheck()
  }

  public async getBalance(provider: PAYMENT_PROVIDER, address: string) {
    const providerService = await this.getProvider(provider)

    return providerService.getBalance(address)
  }
}
