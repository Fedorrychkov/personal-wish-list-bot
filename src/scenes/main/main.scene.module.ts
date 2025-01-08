import { Module } from '@nestjs/common'
import { CategoryModule, CustomConfigModule, FileModule, TransactionModule, UserModule, WishModule } from 'src/modules'
import { GameModule } from 'src/modules/games'
import { SharedSceneModule } from 'src/scenes/shared'

import { MainSceneService } from './main.scene.service'
import { SendNewsSceneService } from './send-news'

@Module({
  imports: [
    UserModule,
    WishModule,
    SharedSceneModule,
    FileModule,
    CustomConfigModule,
    CategoryModule,
    GameModule,
    TransactionModule,
  ],
  controllers: [],
  providers: [MainSceneService, SendNewsSceneService],
  exports: [],
})
export class MainSceneModule {}
