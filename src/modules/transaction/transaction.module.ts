import { Module } from '@nestjs/common'
import { TransactionEntity } from 'src/entities'
import { TelegrafCustomModule } from 'src/services'

import { CustomConfigModule } from '../config'
import { GameModule } from '../games'
import { UserModule } from '../user'
import { WishModule } from '../wish'
import { TransactionController } from './transaction.controller'
import { TransactionPurchaseService } from './transaction.purchase.service'
import { TransactionService } from './transaction.service'

@Module({
  imports: [TelegrafCustomModule, CustomConfigModule, WishModule, GameModule, UserModule],
  controllers: [TransactionController],
  providers: [TransactionEntity, TransactionService, TransactionPurchaseService],
  exports: [TransactionEntity, TransactionService],
})
export class TransactionModule {}
