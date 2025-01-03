import { Module } from '@nestjs/common'
import { TelegrafCustomModule } from 'src/services'

import { CustomConfigModule } from '../config'
import { GameController } from './game.controller'
import { GameService } from './game.service'
import { SantaModule } from './santa'

@Module({
  imports: [SantaModule, TelegrafCustomModule, CustomConfigModule],
  controllers: [GameController],
  providers: [GameService],
  exports: [GameService],
})
export class GameModule {}
