import { Module } from '@nestjs/common'

import { CustomConfigModule } from '../config'
import { PaymentProvidersModule } from '../payment-providers'
import { WalletService } from './wallet.service'

@Module({
  imports: [PaymentProvidersModule, CustomConfigModule],
  controllers: [],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
