import { Module } from '@nestjs/common'
import { CustomConfigModule, FavoriteModule, UserModule } from 'src/modules'

import { FavoriteMainSceneService } from './favorite.main.scene.service'

@Module({
  imports: [UserModule, FavoriteModule, CustomConfigModule],
  controllers: [],
  providers: [FavoriteMainSceneService],
  exports: [],
})
export class FavoriteSceneModule {}
