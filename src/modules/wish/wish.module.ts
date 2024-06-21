import { Module } from '@nestjs/common'
import { WishEntity } from 'src/entities'

import { CustomConfigModule } from '../config'
import { UserModule } from '../user'
import { WishController } from './wish.controller'
import { WishService } from './wish.service'

@Module({
  imports: [UserModule, CustomConfigModule],
  controllers: [WishController],
  providers: [WishEntity, WishService],
  exports: [WishEntity],
})
export class WishModule {}
