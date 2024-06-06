import { Timestamp } from '@google-cloud/firestore'
import { Injectable, Logger } from '@nestjs/common'
import { Ctx, Hears, Scene, SceneEnter } from 'nestjs-telegraf'
import { WishDocument, WishEntity } from 'src/entities'
import { time } from 'src/helpers'
import { SceneContext } from 'telegraf/typings/scenes'

import { WISH_SCENE_EDIT_NAME_SCENE } from '../constants'
import { SharedService } from './../../shared/shared.scene.service'

@Scene(WISH_SCENE_EDIT_NAME_SCENE)
@Injectable()
export class WishNameEditSceneService {
  private logger = new Logger(WishNameEditSceneService.name)

  constructor(private readonly wishEntity: WishEntity, private readonly sharedService: SharedService) {}

  @SceneEnter()
  async enter(@Ctx() ctx: SceneContext) {
    const state = (ctx.scene?.state || { wish: undefined }) as { wish: WishDocument | undefined; messageId: number }
    const { messageId } = state || {}
    await ctx.telegram.editMessageText(ctx.chat.id, messageId, '0', 'Введите новое название в ответном сообщении')
  }

  @Hears(/.*/)
  async editName(@Ctx() ctx: SceneContext) {
    const state = (ctx.scene?.state || { wish: undefined }) as { wish: WishDocument | undefined; messageId: number }
    const { wish, messageId } = state || {}

    const handleUpdateLastMessage = async (text: string) => {
      await ctx.telegram.editMessageText(ctx.chat.id, messageId, '0', text)
    }

    if (!wish) {
      await handleUpdateLastMessage('Произошла ошибка получения состояния, попробуйте еще раз')

      await ctx.scene.leave()

      return
    }

    const name = (ctx?.text || '')?.trim?.() || ''

    if (!name) {
      await handleUpdateLastMessage('Произошла ошибка получения названия, попробуйте ввести еще раз')

      return
    }

    if (name.length > 160) {
      await handleUpdateLastMessage('Название не должно быть длинее 160 символов')

      return
    }

    const { doc, data } = await this.wishEntity.getUpdate(wish.id)

    if (!doc) {
      await handleUpdateLastMessage('Данного элемента более не существует, попробуйте сначала')
      await this.sharedService.enterWishScene(ctx)
      await ctx.scene.leave()

      return
    }

    const dueDateMillis = time().valueOf()
    const updatedAt = Timestamp.fromMillis(dueDateMillis)

    await doc.update({ ...data, name, updatedAt })

    await this.sharedService.showEditWishItem(ctx, { wishId: wish.id, type: 'deleteAndReply', messageId })

    await ctx.scene.leave()
  }
}
