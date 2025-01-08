import { Module } from '@nestjs/common'
import { TransactionEntity } from 'src/entities'
import { TelegrafCustomModule } from 'src/services'

import { CustomConfigModule } from '../config'
import { WishModule } from '../wish'
import { TransactionController } from './transaction.controller'
import { TransactionService } from './transaction.service'

@Module({
  imports: [TelegrafCustomModule, CustomConfigModule, WishModule],
  controllers: [TransactionController],
  providers: [TransactionEntity, TransactionService],
  exports: [TransactionEntity, TransactionService],
})
export class TransactionModule {}
