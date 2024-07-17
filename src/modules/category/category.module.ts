import { Module } from '@nestjs/common'
import { CategroyEntity, WishEntity } from 'src/entities'

import { CategoryController } from './category.controller'
import { CategoryService } from './category.service'

@Module({
  imports: [],
  controllers: [CategoryController],
  providers: [CategroyEntity, CategoryService, WishEntity],
  exports: [CategroyEntity, CategoryService],
})
export class CategoryModule {}
