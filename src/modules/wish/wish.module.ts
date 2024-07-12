import { Module } from '@nestjs/common'
import { WishEntity } from 'src/entities'

import { CustomConfigModule } from '../config'
import { FavoriteModule } from '../favorite'
import { UserModule } from '../user'
import { WishController } from './wish.controller'
import { WishService } from './wish.service'

@Module({
  imports: [UserModule, CustomConfigModule, FavoriteModule],
  controllers: [WishController],
  providers: [WishEntity, WishService],
  exports: [WishEntity, WishService],
})
export class WishModule {}
