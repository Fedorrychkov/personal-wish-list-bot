import { Module } from '@nestjs/common'
import { CustomConfigModule, UserModule, WishModule } from 'src/modules'
import { FileModule } from 'src/modules/file'
import { SharedSceneModule } from 'src/scenes/shared'

import { GetAnotherWishListByUserNameceneService } from './another-wish-list'
import { WishByLinkSceneService } from './by-link'
import {
  WishDescriptionEditSceneService,
  WishImageUrlEditSceneService,
  WishLinkEditSceneService,
  WishNameEditSceneService,
} from './editable'
import { WishItemEditService } from './wish.item.edit.service'
import { WishItemManipulationService } from './wish.item.manipulation.service'
import { WishMainSceneService } from './wish.main.scene.service'

@Module({
  imports: [WishModule, UserModule, SharedSceneModule, FileModule, CustomConfigModule],
  controllers: [],
  providers: [
    WishMainSceneService,
    WishItemEditService,
    WishItemManipulationService,
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
