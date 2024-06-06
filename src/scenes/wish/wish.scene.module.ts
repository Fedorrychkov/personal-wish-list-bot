import { Module } from '@nestjs/common'
import { UserModule, WishModule } from 'src/modules'
import { SharedSceneModule } from 'src/scenes/shared'

import { GetAnotherWishListByUserNameceneService } from './another-wish-list'
import { WishByLinkSceneService } from './by-link'
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
    GetAnotherWishListByUserNameceneService,
  ],
  exports: [],
})
export class WishSceneModule {}
