import { Module } from '@nestjs/common'
import { CustomConfigModule, UserModule, WishModule } from 'src/modules'

import { SharedService } from './shared.scene.service'

@Module({
  imports: [WishModule, UserModule, CustomConfigModule],
  controllers: [],
  providers: [SharedService],
  exports: [SharedService],
})
export class SharedSceneModule {}
