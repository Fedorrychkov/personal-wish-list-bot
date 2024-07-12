import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { UserContext } from 'src/decorator'
import { FavoriteDocument } from 'src/entities'
import { TgDataGuard } from 'src/guards'
import { TgInitUser } from 'src/types'

import { FavoriteDto } from './dto'
import { FavoriteService } from './favorite.service'

@Controller('v1/favorite')
export class FavoriteController {
  constructor(private readonly favoriteService: FavoriteService) {}

  @UseGuards(TgDataGuard)
  @Get('/list')
  async list(@UserContext() user: TgInitUser): Promise<FavoriteDocument[]> {
    return this.favoriteService.getList(user?.id)
  }

  @UseGuards(TgDataGuard)
  @Post('/')
  async create(@UserContext() user: TgInitUser, @Body() dto: FavoriteDto): Promise<FavoriteDocument> {
    return this.favoriteService.create(user, dto)
  }

  @UseGuards(TgDataGuard)
  @Patch('/')
  async update(@UserContext() user: TgInitUser, @Body() dto: FavoriteDto): Promise<FavoriteDocument> {
    return this.favoriteService.update(user, dto)
  }

  @UseGuards(TgDataGuard)
  @Get('/:id')
  async item(@UserContext() user: TgInitUser, @Param() params: { id: string }): Promise<FavoriteDocument> {
    return this.favoriteService.getItem(user, params?.id)
  }

  @UseGuards(TgDataGuard)
  @Delete('/:id')
  async delete(@UserContext() user: TgInitUser, @Param() params: { id: string }): Promise<{ success: boolean }> {
    return this.favoriteService.delete(user, params?.id)
  }
}
