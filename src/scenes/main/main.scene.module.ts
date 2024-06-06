import { Module } from '@nestjs/common'
import { UserEntity } from 'src/entities'
import { SharedSceneModule } from 'src/scenes/shared'

import { MainSceneService } from './main.scene.service'

@Module({
  imports: [SharedSceneModule],
  controllers: [],
  providers: [UserEntity, MainSceneService],
  exports: [],
})
export class MainSceneModule {}
