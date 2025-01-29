import { Module } from '@nestjs/common'
import { TransactionEntity } from 'src/entities'
import { TelegrafCustomModule } from 'src/services'

import { CustomConfigModule } from '../config'
import { CurrencyModule } from '../currency'
import { GameModule } from '../games'
import { PaymentProvidersModule } from '../payment-providers'
import { UserModule } from '../user'
import { WishModule } from '../wish'
import { TransactionController } from './transaction.controller'
import { TransactionPurchaseService } from './transaction.purchase.service'
import { TransactionSchedule } from './transaction.schedule'
import { TransactionService } from './transaction.service'

@Module({
  imports: [
    TelegrafCustomModule,
    CustomConfigModule,
    WishModule,
    GameModule,
    UserModule,
    PaymentProvidersModule,
    CurrencyModule,
  ],
  controllers: [TransactionController],
  providers: [TransactionEntity, TransactionService, TransactionPurchaseService, TransactionSchedule],
  exports: [TransactionEntity, TransactionService],
})
export class TransactionModule {}
