import { Module } from '@nestjs/common'
import { UserModule, WishModule } from 'src/modules'
import { SharedSceneModule } from 'src/scenes/shared'

import { WishByLinkSceneService } from './byLink'
import {
  WishDescriptionEditSceneService,
  WishImageUrlEditSceneService,
  WishLinkEditSceneService,
  WishNameEditSceneService,
} from './editable'
import { WishMainService } from './wish.scene.service'

@Module({
  imports: [WishModule, UserModule, SharedSceneModule],
  controllers: [],
  providers: [
    WishMainService,
    WishByLinkSceneService,
    WishNameEditSceneService,
    WishDescriptionEditSceneService,
    WishLinkEditSceneService,
    WishImageUrlEditSceneService,
  ],
  exports: [],
})
export class WishSceneModule {}
