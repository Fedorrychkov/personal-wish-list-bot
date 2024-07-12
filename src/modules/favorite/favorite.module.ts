import { Module } from '@nestjs/common'
import { FavoriteEntity } from 'src/entities/favorite'

import { FavoriteController } from './favorite.controller'
import { FavoriteService } from './favorite.service'

@Module({
  imports: [],
  controllers: [FavoriteController],
  providers: [FavoriteEntity, FavoriteService],
  exports: [FavoriteEntity],
})
export class FavoriteModule {}
