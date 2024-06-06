import { Module } from '@nestjs/common'
import { UserModule, WishModule } from 'src/modules'
import { SharedSceneModule } from 'src/scenes/shared'

import { MainSceneService } from './main.scene.service'

@Module({
  imports: [UserModule, WishModule, SharedSceneModule],
  controllers: [],
  providers: [MainSceneService],
  exports: [],
})
export class MainSceneModule {}
