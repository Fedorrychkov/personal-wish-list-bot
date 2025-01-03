import { Module } from '@nestjs/common'
import { CategoryModule, CustomConfigModule, UserModule, WishModule } from 'src/modules'
import { FileModule } from 'src/modules/file'
import { GameModule } from 'src/modules/games'
import { SharedSceneModule } from 'src/scenes/shared'

import { MainSceneService } from './main.scene.service'
import { SendNewsSceneService } from './send-news'

@Module({
  imports: [UserModule, WishModule, SharedSceneModule, FileModule, CustomConfigModule, CategoryModule, GameModule],
  controllers: [],
  providers: [MainSceneService, SendNewsSceneService],
  exports: [],
})
export class MainSceneModule {}
