import { Injectable } from '@nestjs/common'
import { Action, Ctx, Update } from 'nestjs-telegraf'
import { getMainKeyboards, getOwnerWishItemKeyboard } from 'src/constants'
import { AvailableChatTypes, UserTelegrafContext } from 'src/decorator'
import { UserDocument, WishEntity, WishStatus } from 'src/entities'
import { ChatTelegrafGuard, UserTelegrafGuard, UseSafeGuards } from 'src/guards'
import { CustomConfigService, WishService } from 'src/modules'
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
    private readonly wishService: WishService,
  ) {}

  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  @Action(new RegExp(WISH_CALLBACK_DATA.bookWishItem))
  async bookWishItem(@Ctx() ctx: SceneContext, @UserTelegrafContext() userContext: UserDocument) {
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

    const updatedWish = { ...data, isBooked: true, bookedUserId: userId }
    const payload = this.wishEntity.getValidProperties(updatedWish)
    await doc.update(payload)

    await this.sharedService.showWishItem(ctx, {
      wish: payload,
      type: 'edit',
      messageId: ctx?.msgId,
      appendedText: '\nВы успешно забронировали желание',
    })

    if (updatedWish.userId !== userContext.id) {
      await ctx.telegram.sendMessage(
        data?.userId,
        `Ваше желание: ${data?.name || 'Без названия'}, кто-то <b>Забронировал</b>`,
        {
          reply_markup: {
            inline_keyboard: getOwnerWishItemKeyboard({
              id: updatedWish.id,
              wish: updatedWish,
              senderUserId: userId,
              webAppUrl: this.customConfigService.miniAppUrl,
            }),
          },
          parse_mode: 'HTML',
        },
      )
    }

    return
  }

  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  @Action(new RegExp(WISH_CALLBACK_DATA.unbookWishItem))
  async unbookWishItem(@Ctx() ctx: SceneContext, @UserTelegrafContext() userContext: UserDocument) {
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

    const updatedWish = { ...data, isBooked: false, bookedUserId: null }
    const payload = this.wishEntity.getValidProperties(updatedWish)
    await doc.update(payload)

    await this.sharedService.showWishItem(ctx, {
      wish: payload,
      type: 'edit',
      messageId: ctx?.msgId,
      appendedText: 'Вы успешно отменили бронирование желания',
    })

    if (updatedWish.userId !== userContext.id) {
      await ctx.telegram.sendMessage(
        data?.userId,
        `Ваше желание: ${data?.name || 'Без названия'}, больше не забронировано`,
        {
          reply_markup: {
            inline_keyboard: getOwnerWishItemKeyboard({
              id: updatedWish.id,
              wish: updatedWish,
              senderUserId: userId,
              webAppUrl: this.customConfigService.miniAppUrl,
            }),
          },
          parse_mode: 'HTML',
        },
      )
    }

    return
  }

  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  @Action(new RegExp(WISH_CALLBACK_DATA.copy_wish_item))
  async copyWishItem(@Ctx() ctx: SceneContext, @UserTelegrafContext() userContext: UserDocument) {
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
      bookedUserId: null,
      status: WishStatus.ACTIVE,
      updatedAt: null,
    })

    const response = await this.wishService.create({ ...userContext, id: Number(userContext?.id) }, payload)

    await this.sharedService.showWishItem(ctx, {
      wish: response,
      type: 'edit',
      appendedText: '\nУспешно добавлено в ваш список желаний',
      messageId: ctx?.msgId,
    })
  }
}
