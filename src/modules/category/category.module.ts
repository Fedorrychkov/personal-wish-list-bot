import { Module } from '@nestjs/common'
import { CategoryWhitelistEntity, CategroyEntity, WishEntity } from 'src/entities'

import { CategoryController } from './category.controller'
import { CategoryService } from './category.service'

@Module({
  imports: [],
  controllers: [CategoryController],
  providers: [CategroyEntity, CategoryService, WishEntity, CategoryWhitelistEntity],
  exports: [CategroyEntity, CategoryService],
})
export class CategoryModule {}
