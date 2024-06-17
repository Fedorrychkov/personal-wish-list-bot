import { Module } from '@nestjs/common'
import { UserEntity } from 'src/entities'

import { UserController } from './user.controller'
import { UserService } from './user.service'

@Module({
  imports: [],
  controllers: [UserController],
  providers: [UserEntity, UserService],
  exports: [UserEntity],
})
export class UserModule {}
