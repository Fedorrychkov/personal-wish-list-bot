import { Module } from '@nestjs/common'
import { UserModule, WishModule } from 'src/modules'

import { SharedService } from './shared.scene.service'

@Module({
  imports: [WishModule, UserModule],
  controllers: [],
  providers: [SharedService],
  exports: [SharedService],
})
export class SharedSceneModule {}
