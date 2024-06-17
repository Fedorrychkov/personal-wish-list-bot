import { Module } from '@nestjs/common'
import { CustomConfigModule, UserModule, WishModule } from 'src/modules'
import { FileModule } from 'src/modules/file'
import { SharedSceneModule } from 'src/scenes/shared'

import { MainSceneService } from './main.scene.service'

@Module({
  imports: [UserModule, WishModule, SharedSceneModule, FileModule, CustomConfigModule],
  controllers: [],
  providers: [MainSceneService],
  exports: [],
})
export class MainSceneModule {}
