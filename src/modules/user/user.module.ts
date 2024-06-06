import { Module } from '@nestjs/common'
import { UserEntity } from 'src/entities'

@Module({
  imports: [],
  controllers: [],
  providers: [UserEntity],
  exports: [UserEntity],
})
export class UserModule {}
