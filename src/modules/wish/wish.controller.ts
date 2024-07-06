import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from '@nestjs/common'
import { UserContext } from 'src/decorator'
import { WishDocument } from 'src/entities'
import { TgDataGuard } from 'src/guards'
import { TgInitUser } from 'src/types'

import { WishPatchDto } from './dto'
import { WishService } from './wish.service'

@Controller('v1/wish')
export class WishController {
  constructor(private readonly wishService: WishService) {}

  @UseGuards(TgDataGuard)
  @Get('/list')
  async list(@UserContext() user: TgInitUser): Promise<WishDocument[]> {
    return this.wishService.getList(user?.id)
  }

  @UseGuards(TgDataGuard)
  @Get('/list/:id')
  async listByUserId(@Param() params: { id: string }): Promise<WishDocument[]> {
    return this.wishService.getList(params?.id)
  }

  @UseGuards(TgDataGuard)
  @Get('/:id')
  async item(@Param() params: { id: string }): Promise<WishDocument> {
    return this.wishService.getItem(params?.id)
  }

  @UseGuards(TgDataGuard)
  @Patch('/:id')
  async update(
    @UserContext() user: TgInitUser,
    @Param() params: { id: string },
    @Body() body: WishPatchDto,
  ): Promise<WishDocument> {
    return this.wishService.update(user, params?.id, body)
  }

  @UseGuards(TgDataGuard)
  @Patch('/book/:id')
  async bookToggle(@UserContext() user: TgInitUser, @Param() params: { id: string }): Promise<WishDocument> {
    return this.wishService.bookToggle(user, params?.id)
  }

  @UseGuards(TgDataGuard)
  @Delete('/:id')
  async deleteItem(@UserContext() user: TgInitUser, @Param() params: { id: string }) {
    return this.wishService.deleteItem(user, params?.id)
  }
}
