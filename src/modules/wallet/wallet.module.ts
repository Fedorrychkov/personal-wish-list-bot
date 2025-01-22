import { Module } from '@nestjs/common'

import { PaymentProvidersModule } from '../payment-providers'
import { WalletService } from './wallet.service'

@Module({
  imports: [PaymentProvidersModule],
  controllers: [],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
