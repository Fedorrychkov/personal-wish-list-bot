import { Timestamp } from '@google-cloud/firestore'
import { Injectable, Logger } from '@nestjs/common'
import { Ctx, Hears, Scene, SceneEnter } from 'nestjs-telegraf'
import { SCENE_NAVIGATION_KEYBOARDS } from 'src/constants/keyboards'
import { WishDocument, WishEntity } from 'src/entities'
import { time } from 'src/helpers'
import { SceneContext } from 'telegraf/typings/scenes'

import { SharedService } from '../../shared/shared.scene.service'
import { WISH_SCENE_EDIT_DESCRIPTION_SCENE } from '../constants'

@Scene(WISH_SCENE_EDIT_DESCRIPTION_SCENE)
@Injectable()
export class WishDescriptionEditSceneService {
  private logger = new Logger(WishDescriptionEditSceneService.name)

  constructor(private readonly wishEntity: WishEntity, private readonly sharedService: SharedService) {}

  @SceneEnter()
  async enter(@Ctx() ctx: SceneContext) {
    const state = (ctx.scene?.state || { wish: undefined }) as { wish: WishDocument | undefined; messageId: number }
    const { messageId } = state || {}
    await ctx.telegram.editMessageText(ctx.chat.id, messageId, '0', 'Введите новое описание в ответном сообщении')
  }

  @Hears(/.*/)
  async editName(@Ctx() ctx: SceneContext) {
    const state = (ctx.scene?.state || { wish: undefined }) as { wish: WishDocument | undefined; messageId: number }
    const { wish, messageId } = state || {}

    const handleUpdateLastMessage = async (text: string) => {
      await ctx.telegram.editMessageText(ctx.chat.id, messageId, '0', text, {
        reply_markup: {
          inline_keyboard: SCENE_NAVIGATION_KEYBOARDS,
        },
      })
    }

    if (!wish) {
      await handleUpdateLastMessage('Произошла ошибка получения состояния, попробуйте еще раз')

      await ctx.scene.leave()

      return
    }

    const description = (ctx?.text || '')?.trim?.() || ''

    if (!description) {
      await handleUpdateLastMessage('Произошла ошибка получения описания, попробуйте ввести еще раз')

      return
    }

    if (description.length > 600) {
      await handleUpdateLastMessage('Описание не должно быть длинее 600 символов')

      return
    }

    const { doc, data } = await this.wishEntity.getUpdate(wish.id)

    if (!doc) {
      await handleUpdateLastMessage('Этого желания более не существует, попробуйте сначала')
      await this.sharedService.enterWishScene(ctx)
      await ctx.scene.leave()

      return
    }

    const dueDateMillis = time().valueOf()
    const updatedAt = Timestamp.fromMillis(dueDateMillis)

    await doc.update({ ...data, description, updatedAt })

    await this.sharedService.showEditWishItem(ctx, { wishId: wish.id, type: 'deleteAndReply', messageId })

    await ctx.scene.leave()
  }
}
