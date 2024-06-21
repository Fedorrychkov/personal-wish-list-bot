import { Injectable } from '@nestjs/common'
import { Action, Ctx, Update } from 'nestjs-telegraf'
import { getMainKeyboards } from 'src/constants'
import { WishEntity } from 'src/entities'
import { CustomConfigService } from 'src/modules'
import { SceneContext } from 'telegraf/typings/scenes'

import { SharedService } from '../shared'
import { WISH_CALLBACK_DATA } from './constants'

@Update()
@Injectable()
export class WishItemManipulationService {
  constructor(
    private readonly wishEntity: WishEntity,
    private readonly sharedService: SharedService,
    private readonly customConfigService: CustomConfigService,
  ) {}

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
