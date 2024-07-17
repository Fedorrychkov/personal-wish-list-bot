import { Module } from '@nestjs/common'
import { CategoryWhitelistEntity, CategroyEntity, UserEntity } from 'src/entities'

import { CustomConfigModule } from '../config'
import { FavoriteModule } from '../favorite'
import { CategoryWhitelistController } from './category-whitelist.controller'
import { CategoryWhitelistService } from './category-whitelist.service'

@Module({
  imports: [FavoriteModule, CustomConfigModule],
  controllers: [CategoryWhitelistController],
  providers: [CategoryWhitelistEntity, CategoryWhitelistService, UserEntity, CategroyEntity],
  exports: [CategoryWhitelistEntity, CategoryWhitelistService],
})
export class CategoryWhitelistModule {}
