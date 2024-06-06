import { Injectable } from '@nestjs/common'
import { Action, Ctx, Update } from 'nestjs-telegraf'
import { WishEntity } from 'src/entities'
import { SceneContext } from 'telegraf/typings/scenes'

import { SharedService } from '../shared'
import {
  WISH_CALLBACK_DATA,
  WISH_SCENE_BY_LINK_NAME,
  WISH_SCENE_EDIT_DESCRIPTION_SCENE,
  WISH_SCENE_EDIT_IMAGE_URL_SCENE,
  WISH_SCENE_EDIT_LINK_SCENE,
  WISH_SCENE_EDIT_NAME_SCENE,
} from './constants'

@Update()
@Injectable()
export class WishMainService {
  constructor(private readonly wishEntity: WishEntity, private readonly sharedService: SharedService) {}

  @Action(WISH_CALLBACK_DATA.addNewByLink)
  async editItemName(@Ctx() ctx: SceneContext) {
    await ctx.editMessageText('Отправьте в следующем сообщении ссылку на желаемое', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Назад', callback_data: WISH_CALLBACK_DATA.openWishScene }]],
      },
    })

    await ctx.scene.enter(WISH_SCENE_BY_LINK_NAME)
  }

  @Action(new RegExp(WISH_CALLBACK_DATA.editWishItemName))
  async editWishItemName(@Ctx() ctx: SceneContext) {
    const [, id] = (ctx as any)?.update?.callback_query?.data?.split(' ')
    const wish = await this.wishEntity.get(id)

    await ctx.scene.enter(WISH_SCENE_EDIT_NAME_SCENE, { wish, messageId: ctx?.msgId })
  }

  @Action(new RegExp(WISH_CALLBACK_DATA.editWishItemLink))
  async editWishItemLink(@Ctx() ctx: SceneContext) {
    const [, id] = (ctx as any)?.update?.callback_query?.data?.split(' ')
    const wish = await this.wishEntity.get(id)

    await ctx.scene.enter(WISH_SCENE_EDIT_LINK_SCENE, { wish, messageId: ctx?.msgId })
  }

  @Action(new RegExp(WISH_CALLBACK_DATA.editWishItemImageUrl))
  async editWishItemImageUrl(@Ctx() ctx: SceneContext) {
    const [, id] = (ctx as any)?.update?.callback_query?.data?.split(' ')
    const wish = await this.wishEntity.get(id)

    await ctx.scene.enter(WISH_SCENE_EDIT_IMAGE_URL_SCENE, { wish, messageId: ctx?.msgId })
  }

  @Action(new RegExp(WISH_CALLBACK_DATA.editWishItemDescription))
  async editWishItemDescription(@Ctx() ctx: SceneContext) {
    const [, id] = (ctx as any)?.update?.callback_query?.data?.split(' ')
    const wish = await this.wishEntity.get(id)

    await ctx.scene.enter(WISH_SCENE_EDIT_DESCRIPTION_SCENE, { wish, messageId: ctx?.msgId })
  }

  @Action(new RegExp(WISH_CALLBACK_DATA.editWishItem))
  async editWishItem(@Ctx() ctx: SceneContext) {
    const [, id] = (ctx as any)?.update?.callback_query?.data?.split(' ')

    await this.sharedService.showEditWishItem(ctx, { wishId: id, type: 'edit' })
  }

  @Action(new RegExp(WISH_CALLBACK_DATA.removeWishItem))
  async removeWishItem(@Ctx() ctx: SceneContext) {
    const [, id] = (ctx as any)?.update?.callback_query?.data?.split(' ')

    if (!id) {
      await ctx.editMessageText(`${ctx?.text}\n\nУдалить не удалось`, {
        reply_markup: {
          inline_keyboard: [[{ text: 'Добавить еще', callback_data: WISH_CALLBACK_DATA.addNewByLink }]],
        },
      })

      return
    }

    const wish = await this.wishEntity.get(id)
    await this.wishEntity.delete(id)

    await ctx.editMessageText(`${wish?.name}\nУспешно удален!`, {
      reply_markup: {
        inline_keyboard: [[{ text: 'Добавить еще', callback_data: WISH_CALLBACK_DATA.addNewByLink }]],
      },
    })
  }
}
