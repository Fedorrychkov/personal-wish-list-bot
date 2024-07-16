import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { UserContext } from 'src/decorator'
import { CategoryDocument } from 'src/entities'
import { TgDataGuard } from 'src/guards'
import { TgInitUser } from 'src/types'

import { CategoryService } from './category.service'
import { CategoryDto } from './dto'

@Controller('v1/category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @UseGuards(TgDataGuard)
  @Get('/list')
  async list(@UserContext() user: TgInitUser): Promise<CategoryDocument[]> {
    return this.categoryService.getList(user?.id)
  }

  @UseGuards(TgDataGuard)
  @Post('/')
  async create(@UserContext() user: TgInitUser, @Body() body: CategoryDto): Promise<CategoryDocument> {
    return this.categoryService.create(user, body)
  }

  @UseGuards(TgDataGuard)
  @Get('/list/:id')
  async listByUserId(@Param() params: { id: string }): Promise<CategoryDocument[]> {
    return this.categoryService.getList(params?.id)
  }

  @UseGuards(TgDataGuard)
  @Get('/:id')
  async item(@Param() params: { id: string }): Promise<CategoryDocument> {
    return this.categoryService.getItem(params?.id)
  }

  @UseGuards(TgDataGuard)
  @Delete('/:id')
  async delete(
    @UserContext() user: TgInitUser,
    @Param() params: { id: string },
  ): Promise<{ success: boolean; id: string }> {
    return this.categoryService.delete(user, params?.id)
  }

  @UseGuards(TgDataGuard)
  @Patch('/:id')
  async update(
    @UserContext() user: TgInitUser,
    @Body() body: CategoryDto,
    @Param() params: { id: string },
  ): Promise<CategoryDocument> {
    return this.categoryService.update(user, body, params.id)
  }
}
