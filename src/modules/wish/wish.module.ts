import { Module } from '@nestjs/common'
import { WishEntity } from 'src/entities'

import { WishController } from './wish.controller'
import { WishService } from './wish.service'

@Module({
  imports: [],
  controllers: [WishController],
  providers: [WishEntity, WishService],
  exports: [WishEntity],
})
export class WishModule {}
