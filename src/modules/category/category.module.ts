import { Module } from '@nestjs/common'
import { CategroyEntity } from 'src/entities'

import { CategoryController } from './category.controller'
import { CategoryService } from './category.service'

@Module({
  imports: [],
  controllers: [CategoryController],
  providers: [CategroyEntity, CategoryService],
  exports: [CategroyEntity],
})
export class CategoryModule {}
