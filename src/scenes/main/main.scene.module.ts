import { Module } from '@nestjs/common'
import { CategoryModule, CustomConfigModule, UserModule, WishModule } from 'src/modules'
import { FileModule } from 'src/modules/file'
import { SharedSceneModule } from 'src/scenes/shared'

import { MainSceneService } from './main.scene.service'

@Module({
  imports: [UserModule, WishModule, SharedSceneModule, FileModule, CustomConfigModule, CategoryModule],
  controllers: [],
  providers: [MainSceneService],
  exports: [],
})
export class MainSceneModule {}
