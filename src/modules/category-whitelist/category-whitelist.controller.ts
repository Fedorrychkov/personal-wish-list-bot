import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { UserContext } from 'src/decorator'
import { CategoryWhitelistDocument, CategoryWhitelistFilter } from 'src/entities'
import { TgDataGuard } from 'src/guards'
import { TgInitUser } from 'src/types'

import { CategoryWhitelistService } from './category-whitelist.service'
import { CategoryWhitelistDto } from './dto'

@Controller('v1/category-whitelist')
export class CategoryWhitelistController {
  constructor(private readonly categoryWhitelistService: CategoryWhitelistService) {}

  @UseGuards(TgDataGuard)
  @Get('/list')
  async list(
    @UserContext() user: TgInitUser,
    @Query() query: CategoryWhitelistFilter,
  ): Promise<CategoryWhitelistDocument[]> {
    return this.categoryWhitelistService.getList(user?.id, query)
  }

  @UseGuards(TgDataGuard)
  @Post('/')
  async create(
    @UserContext() user: TgInitUser,
    @Body() body: CategoryWhitelistDto,
  ): Promise<CategoryWhitelistDocument> {
    return this.categoryWhitelistService.create(user, body)
  }

  @UseGuards(TgDataGuard)
  @Delete('/:id')
  async delete(
    @UserContext() user: TgInitUser,
    @Param() params: { id: string },
  ): Promise<{ success: boolean; id: string }> {
    return this.categoryWhitelistService.delete(user, params?.id)
  }
}
