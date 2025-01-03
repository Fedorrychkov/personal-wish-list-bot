import { Module } from '@nestjs/common'
import { CustomConfigModule, UserModule, WishModule } from 'src/modules'
import { GameModule } from 'src/modules/games'

import { GamesSceneService } from './games.scene.service'
import { SendSantaMessageSceneService } from './send-santa-message.scene.service'

@Module({
  imports: [UserModule, WishModule, CustomConfigModule, GameModule],
  controllers: [],
  providers: [GamesSceneService, SendSantaMessageSceneService],
  exports: [],
})
export class GamesSceneModule {}
