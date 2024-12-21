import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { UserContext } from 'src/decorator'
import { WishDocument } from 'src/entities'
import { TgDataGuard } from 'src/guards'
import { getFileTypesRegexp, IMG_MAX_5MB_SIZE_IN_BYTE, listDefaultImageExt } from 'src/services'
import { TgInitUser } from 'src/types'

import { WishFilterDto, WishPatchDto } from './dto'
import { WishService } from './wish.service'

@Controller('v1/wish')
export class WishController {
  constructor(private readonly wishService: WishService) {}

  @UseGuards(TgDataGuard)
  @Get('/list')
  async list(@UserContext() user: TgInitUser, @Query() filter: WishFilterDto): Promise<WishDocument[]> {
    return this.wishService.getList(user?.id, filter, user)
  }

  @UseGuards(TgDataGuard)
  @Get('/list/count')
  async listCount(@UserContext() user: TgInitUser, @Query() filter: { userId?: string }): Promise<{ count: number }> {
    return this.wishService.getWishSize(filter?.userId || user?.id?.toString?.())
  }

  @UseGuards(TgDataGuard)
  @Post('/')
  async create(@UserContext() user: TgInitUser, @Body() body: WishPatchDto): Promise<WishDocument> {
    return this.wishService.createAndNotifySubscribers(user, body)
  }

  @UseGuards(TgDataGuard)
  @Get('/list/:id')
  async listByUserId(
    @Param() params: { id: string },
    @Query() filter: WishFilterDto,
    @UserContext() requestorUser: TgInitUser,
  ): Promise<WishDocument[]> {
    return this.wishService.getList(params?.id, filter, requestorUser)
  }

  @UseGuards(TgDataGuard)
  @Get('/:id')
  async item(@Param() params: { id: string }, @UserContext() user: TgInitUser): Promise<WishDocument> {
    return this.wishService.getItem(params?.id, user)
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
  @Patch('/given/:id')
  async givenToggle(@UserContext() user: TgInitUser, @Param() params: { id: string }): Promise<WishDocument> {
    return this.wishService.givenToggle(user, params?.id)
  }

  @UseGuards(TgDataGuard)
  @Post('/copy/:id')
  async copy(@UserContext() user: TgInitUser, @Param() params: { id: string }): Promise<WishDocument> {
    return this.wishService.copy(user, params?.id)
  }

  @UseGuards(TgDataGuard)
  @Delete('/:id')
  async deleteItem(@UserContext() user: TgInitUser, @Param() params: { id: string }) {
    return this.wishService.deleteItem(user, params?.id)
  }

  @UseGuards(TgDataGuard)
  @Post('/:id/image')
  @UseInterceptors(FileInterceptor('file', { limits: { files: 1 } }))
  async uploadFileAndPassValidation(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: IMG_MAX_5MB_SIZE_IN_BYTE }),
          new FileTypeValidator({ fileType: getFileTypesRegexp(listDefaultImageExt) }),
        ],
      }),
    )
    file: Express.Multer.File,
    @UserContext() user: TgInitUser,
    @Param() params: { id: string },
  ): Promise<WishDocument> {
    return this.wishService.updateImage(user, params.id, file)
  }

  @UseGuards(TgDataGuard)
  @Delete('/:id/image')
  async removeAvatar(@UserContext() user: TgInitUser, @Param() params: { id: string }): Promise<WishDocument> {
    return this.wishService.removeImage(user, params.id)
  }
}
