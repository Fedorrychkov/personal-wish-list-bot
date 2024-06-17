import { Injectable } from '@nestjs/common'
import { Action, Ctx, Update } from 'nestjs-telegraf'
import { getMainKeyboards } from 'src/constants'
import { WishEntity } from 'src/entities'
import { CustomConfigService } from 'src/modules'
import { SceneContext } from 'telegraf/typings/scenes'

import { SharedService } from '../shared'
import {
  WISH_CALLBACK_DATA,
  WISH_SCENE_BY_LINK_NAME,
  WISH_SCENE_EDIT_DESCRIPTION_SCENE,
  WISH_SCENE_EDIT_IMAGE_URL_SCENE,
  WISH_SCENE_EDIT_LINK_SCENE,
  WISH_SCENE_EDIT_NAME_SCENE,
  WISH_SCENE_GET_WISH_LIST_BY_USERNAME_SCENE,
} from './constants'

@Update()
@Injectable()
export class WishMainService {
  constructor(
    private readonly wishEntity: WishEntity,
    private readonly sharedService: SharedService,
    private readonly customConfigService: CustomConfigService,
  ) {}

  @Action(WISH_CALLBACK_DATA.addNewByLink)
  async editItemName(@Ctx() ctx: SceneContext) {
    await ctx.editMessageText(
      'Пришлите в ответном сообщении ссылку на желание.\nПостараюсь добавить его в ваш список с автозаполнением (Название, Описание и картинка).\nЕсли что-то пойдет не так, вы всегда сможете отредактировать желание в ручную',
      {
        reply_markup: {
          inline_keyboard: [[{ text: 'Назад', callback_data: WISH_CALLBACK_DATA.openWishScene }]],
        },
      },
    )

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

  @Action(new RegExp(WISH_CALLBACK_DATA.get_another_user_wish_list_by_nickname))
  async getAnotherUserWishListByNickname(@Ctx() ctx: SceneContext) {
    await ctx.scene.enter(WISH_SCENE_GET_WISH_LIST_BY_USERNAME_SCENE, { messageId: ctx?.msgId })
  }

  @Action(new RegExp(WISH_CALLBACK_DATA.editWishItem))
  async editWishItem(@Ctx() ctx: SceneContext) {
    const [, id] = (ctx as any)?.update?.callback_query?.data?.split(' ')

    await this.sharedService.showEditWishItem(ctx, { wishId: id, type: 'edit' })
  }

  @Action(new RegExp(WISH_CALLBACK_DATA.getAllWishList))
  async getAllWishList(@Ctx() ctx: SceneContext) {
    const userId = `${ctx.from.id}`

    const items = await this.wishEntity.findAll({ userId })

    await this.sharedService.showWishList(ctx, items)
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

  @Action(new RegExp(WISH_CALLBACK_DATA.bookWishItem))
  async bookWishItem(@Ctx() ctx: SceneContext) {
    const [, id] = (ctx as any)?.update?.callback_query?.data?.split(' ')
    const userId = `${ctx.from.id}`

    const defaultErrorOptions = {
      chatId: ctx.chat.id,
      msgId: ctx?.msgId,
      inlineMsgId: '0',
      text: 'Забронировать не удалось, желание не найдено, попробуйте другое желание или начните с начала',
      replyMarkup: {
        reply_markup: {
          inline_keyboard: getMainKeyboards({ webAppUrl: this.customConfigService.miniAppUrl }),
        },
      },
    }

    if (!id) {
      await ctx.telegram.editMessageText(
        defaultErrorOptions.chatId,
        defaultErrorOptions.msgId,
        defaultErrorOptions.inlineMsgId,
        defaultErrorOptions.text,
        defaultErrorOptions.replyMarkup,
      )

      return
    }

    const { doc, data } = await this.wishEntity.getUpdate(id)

    if (!doc) {
      await ctx.telegram.editMessageText(
        defaultErrorOptions.chatId,
        defaultErrorOptions.msgId,
        defaultErrorOptions.inlineMsgId,
        defaultErrorOptions.text,
        defaultErrorOptions.replyMarkup,
      )

      return
    }

    if (data?.isBooked) {
      await ctx.telegram.editMessageText(
        defaultErrorOptions.chatId,
        defaultErrorOptions.msgId,
        defaultErrorOptions.inlineMsgId,
        data.bookedUserId === userId
          ? 'Желание уже забронировано вами, попробуйте забронировать другое желание'
          : 'Желание уже кем-то забронировано',
        defaultErrorOptions.replyMarkup,
      )

      return
    }

    const payload = this.wishEntity.getValidProperties({ ...data, isBooked: true, bookedUserId: userId })
    await doc.update(payload)

    await this.sharedService.showWishItem(ctx, {
      wish: payload,
      type: 'edit',
      messageId: ctx?.msgId,
      appendedText: '\nВы успешно забронировали желание',
    })

    return
  }

  @Action(new RegExp(WISH_CALLBACK_DATA.unbookWishItem))
  async unbookWishItem(@Ctx() ctx: SceneContext) {
    const [, id] = (ctx as any)?.update?.callback_query?.data?.split(' ')
    const userId = `${ctx.from.id}`

    const defaultErrorOptions = {
      chatId: ctx.chat.id,
      msgId: ctx?.msgId,
      inlineMsgId: '0',
      text: 'Отменить бронь не удалось, желание не найдено, начните с начала',
      replyMarkup: {
        reply_markup: {
          inline_keyboard: getMainKeyboards({ webAppUrl: this.customConfigService.miniAppUrl }),
        },
      },
    }

    if (!id) {
      await ctx.telegram.editMessageText(
        defaultErrorOptions.chatId,
        defaultErrorOptions.msgId,
        defaultErrorOptions.inlineMsgId,
        defaultErrorOptions.text,
        defaultErrorOptions.replyMarkup,
      )

      return
    }

    const { doc, data } = await this.wishEntity.getUpdate(id)

    if (!doc) {
      await ctx.telegram.editMessageText(
        defaultErrorOptions.chatId,
        defaultErrorOptions.msgId,
        defaultErrorOptions.inlineMsgId,
        defaultErrorOptions.text,
        defaultErrorOptions.replyMarkup,
      )

      return
    }

    if (!data?.isBooked || (data?.isBooked && data?.bookedUserId !== userId)) {
      await ctx.telegram.editMessageText(
        defaultErrorOptions.chatId,
        defaultErrorOptions.msgId,
        defaultErrorOptions.inlineMsgId,
        data?.isBooked
          ? 'Отменить бронь не удалось. Желание никем не забронировано'
          : 'Вы не можете отменить чужую бронь',
        defaultErrorOptions.replyMarkup,
      )

      return
    }

    const payload = this.wishEntity.getValidProperties({ ...data, isBooked: false, bookedUserId: null })
    await doc.update(payload)

    await this.sharedService.showWishItem(ctx, {
      wish: payload,
      type: 'edit',
      messageId: ctx?.msgId,
      appendedText: 'Вы успешно отменили бронирование желания',
    })

    return
  }

  @Action(new RegExp(WISH_CALLBACK_DATA.copy_wish_item))
  async copyWishItem(@Ctx() ctx: SceneContext) {
    const [, id] = (ctx as any)?.update?.callback_query?.data?.split(' ')

    if (!id) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        ctx?.msgId,
        '0',
        `${ctx?.text}\n\nОшибка копирования, попробуйте еще раз`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Попробовать еще раз', callback_data: `${WISH_CALLBACK_DATA.copy_wish_item} ${id}` }],
            ],
          },
        },
      )

      return
    }

    const wish = await this.wishEntity.get(id)

    const userId = `${ctx.from.id}`

    const payload = this.wishEntity.getValidProperties({
      ...wish,
      id: null,
      userId,
      isBooked: false,
      updatedAt: null,
    })

    const response = await this.wishEntity.createOrUpdate(payload)

    await this.sharedService.showWishItem(ctx, {
      wish: response,
      type: 'edit',
      appendedText: '\nУспешно добавлено в ваш список желаний',
      messageId: ctx?.msgId,
    })
  }
}
