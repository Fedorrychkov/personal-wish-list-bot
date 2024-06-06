import { Module } from '@nestjs/common'
import { WishEntity } from 'src/entities'

@Module({
  imports: [],
  controllers: [],
  providers: [WishEntity],
  exports: [WishEntity],
})
export class WishModule {}
