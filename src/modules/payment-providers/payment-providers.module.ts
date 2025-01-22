import { Module } from '@nestjs/common'

import { CustomConfigModule } from '../config'
import { PaymentProvidersService } from './payment-providers.service'
import { TonProviderModule } from './ton/ton-provider.module'

@Module({
  imports: [TonProviderModule, CustomConfigModule],
  controllers: [],
  providers: [PaymentProvidersService],
  exports: [TonProviderModule, PaymentProvidersService],
})
export class PaymentProvidersModule {}
