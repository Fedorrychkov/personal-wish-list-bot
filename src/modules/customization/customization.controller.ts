import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { UserContext } from 'src/decorator'
import { CustomizationDocument } from 'src/entities'
import { TgDataGuard } from 'src/guards'
import { TgInitUser } from 'src/types'

import { CustomizationService } from './customization.service'
import { CustomizationDto } from './dto'

@Controller('v1/customization')
export class CustomizationController {
  constructor(private readonly customizationService: CustomizationService) {}

  @UseGuards(TgDataGuard)
  @Post('/')
  async createOrUpdate(
    @UserContext() user: TgInitUser,
    @Body() body: CustomizationDto,
  ): Promise<CustomizationDocument> {
    return this.customizationService.createOrUpdate(user, body)
  }

  @UseGuards(TgDataGuard)
  @Get('/:userId')
  async item(@Param() params: { userId: string }): Promise<CustomizationDocument> {
    return this.customizationService.getItemByUserId(params?.userId)
  }
}
