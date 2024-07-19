import {
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { UserContext } from 'src/decorator'
import { UserDocument } from 'src/entities/user/user.document'
import { TgDataGuard } from 'src/guards'
import { getFileTypesRegexp, IMG_MAX_5MB_SIZE_IN_BYTE, listDefaultImageExt } from 'src/services'
import { TgInitUser } from 'src/types'

import { UserService } from './user.service'

@Controller('v1/user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(TgDataGuard)
  @Get('/')
  async getCurrentUser(@UserContext() user: TgInitUser): Promise<UserDocument> {
    return this.userService.getUser(user)
  }

  @UseGuards(TgDataGuard)
  @Get('/:id')
  async getUser(@UserContext() user: TgInitUser, @Param() params: { id: string }): Promise<UserDocument> {
    return this.userService.getUser(user, params)
  }

  @UseGuards(TgDataGuard)
  @Post('/avatar')
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
  ): Promise<UserDocument> {
    return this.userService.updateAvatar(user, file)
  }

  @UseGuards(TgDataGuard)
  @Delete('/avatar')
  async removeAvatar(@UserContext() user: TgInitUser): Promise<UserDocument> {
    return this.userService.removeAvatar(user)
  }

  @UseGuards(TgDataGuard)
  @Get('/find/username/:username')
  async find(@UserContext() user: TgInitUser, @Param() params: { username: string }): Promise<UserDocument> {
    return this.userService.findUserByUsername(user, params.username)
  }
}
