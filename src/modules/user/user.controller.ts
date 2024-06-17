import { Controller, Get, UseGuards } from '@nestjs/common'
import { UserContext } from 'src/decorator'
import { UserDocument } from 'src/entities/user/user.document'
import { TgDataGuard } from 'src/guards'
import { TgInitUser } from 'src/types'

import { UserService } from './user.service'

@Controller('v1/user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(TgDataGuard)
  @Get('/')
  async getUser(@UserContext() user: TgInitUser): Promise<UserDocument> {
    return this.userService.getUser(user)
  }
}
