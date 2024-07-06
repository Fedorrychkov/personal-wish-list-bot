import { Injectable } from '@nestjs/common'
import { Action, Ctx, Update } from 'nestjs-telegraf'
import { getAnotherUserWishListById, getDeleteMessageToSubscriber, getMainKeyboards } from 'src/constants'
import { AvailableChatTypes } from 'src/decorator'
import { UserEntity, WishDocument, WishEntity } from 'src/entities'
import { ChatTelegrafGuard, UseSafeGuards } from 'src/guards'
import { CustomConfigService } from 'src/modules'
import { SceneContext } from 'telegraf/typings/scenes'

import { SharedService } from '../shared'
import {
  WISH_CALLBACK_DATA,
  WISH_SCENE_EDIT_DESCRIPTION_SCENE,
  WISH_SCENE_EDIT_IMAGE_URL_SCENE,
  WISH_SCENE_EDIT_LINK_SCENE,
  WISH_SCENE_EDIT_NAME_SCENE,
} from './constants'

@Update()
@Injectable()
export class WishItemEditService {
  constructor(
    private readonly wishEntity: WishEntity,
    private readonly userEntity: UserEntity,
    private readonly sharedService: SharedService,
    private readonly customConfigService: CustomConfigService,
  ) {}

  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard)
  private async validateAvailabilityWishAndSendErrorMessage(@Ctx() ctx: SceneContext, wish: WishDocument) {
    const handleSendError = async () => {
      await ctx.editMessageText(`${ctx?.text}\n\nЖелание уже удалено`, {
        reply_markup: {
          inline_keyboard: getMainKeyboards({ webAppUrl: this.customConfigService.miniAppUrl }),
        },
      })
    }

    if (!wish) {
      await handleSendError()

      return false
    }

    if (wish.userId !== ctx?.from?.id?.toString()) {
      await ctx.editMessageText(
        `Желание: ${wish?.name}\nпринадлежит другому пользователю.\nДля просмотра своих желаний выберите команду:`,
        {
          reply_markup: {
            inline_keyboard: getMainKeyboards({ webAppUrl: this.customConfigService.miniAppUrl }),
          },
        },
      )

      return false
    }

    return true
  }

  @Action(new RegExp(WISH_CALLBACK_DATA.editWishItemName))
  async editWishItemName(@Ctx() ctx: SceneContext) {
    const [, id] = (ctx as any)?.update?.callback_query?.data?.split(' ')

    const wish = await this.wishEntity.get(id)

    const isAvailable = await this.validateAvailabilityWishAndSendErrorMessage(ctx, wish)

    if (!isAvailable) {
      return
    }

    await ctx.scene.enter(WISH_SCENE_EDIT_NAME_SCENE, { wish, messageId: ctx?.msgId })
  }

  @Action(new RegExp(WISH_CALLBACK_DATA.editWishItemLink))
  async editWishItemLink(@Ctx() ctx: SceneContext) {
    const [, id] = (ctx as any)?.update?.callback_query?.data?.split(' ')
    const wish = await this.wishEntity.get(id)

    const isAvailable = await this.validateAvailabilityWishAndSendErrorMessage(ctx, wish)

    if (!isAvailable) {
      return
    }

    await ctx.scene.enter(WISH_SCENE_EDIT_LINK_SCENE, { wish, messageId: ctx?.msgId })
  }

  @Action(new RegExp(WISH_CALLBACK_DATA.editWishItemImageUrl))
  async editWishItemImageUrl(@Ctx() ctx: SceneContext) {
    const [, id] = (ctx as any)?.update?.callback_query?.data?.split(' ')
    const wish = await this.wishEntity.get(id)

    const isAvailable = await this.validateAvailabilityWishAndSendErrorMessage(ctx, wish)

    if (!isAvailable) {
      return
    }

    await ctx.scene.enter(WISH_SCENE_EDIT_IMAGE_URL_SCENE, { wish, messageId: ctx?.msgId })
  }

  @Action(new RegExp(WISH_CALLBACK_DATA.editWishItemDescription))
  async editWishItemDescription(@Ctx() ctx: SceneContext) {
    const [, id] = (ctx as any)?.update?.callback_query?.data?.split(' ')
    const wish = await this.wishEntity.get(id)

    const isAvailable = await this.validateAvailabilityWishAndSendErrorMessage(ctx, wish)

    if (!isAvailable) {
      return
    }

    await ctx.scene.enter(WISH_SCENE_EDIT_DESCRIPTION_SCENE, { wish, messageId: ctx?.msgId })
  }

  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard)
  @Action(new RegExp(WISH_CALLBACK_DATA.removeWishItem))
  async removeWishItem(@Ctx() ctx: SceneContext) {
    const [, id] = (ctx as any)?.update?.callback_query?.data?.split(' ')

    if (!id) {
      await ctx.editMessageText(`${ctx?.text}\n\nУдалить не удалось`, {
        reply_markup: {
          inline_keyboard: getMainKeyboards({ webAppUrl: this.customConfigService.miniAppUrl }),
        },
      })

      return
    }

    const wish = await this.wishEntity.get(id)

    const isAvailable = await this.validateAvailabilityWishAndSendErrorMessage(ctx, wish)

    if (!isAvailable) {
      return
    }

    await this.wishEntity.delete(id)

    await ctx.editMessageText(`${wish?.name}\nУспешно удален!`, {
      reply_markup: {
        inline_keyboard: getMainKeyboards({ webAppUrl: this.customConfigService.miniAppUrl }),
      },
    })

    /**
     * При удалении желания, подписчку желания отправляется уведомление в чат
     */
    if (wish?.isBooked && wish.bookedUserId !== wish.userId) {
      const [user, subscribedUser] = await Promise.all([
        this.userEntity.get(wish.userId),
        this.userEntity.get(wish.bookedUserId),
      ])

      const text = getDeleteMessageToSubscriber(wish?.name, user?.username)

      await ctx.telegram.sendMessage(subscribedUser?.chatId, text, {
        reply_markup: {
          inline_keyboard: [
            ...getMainKeyboards({ webAppUrl: this.customConfigService.miniAppUrl }),
            getAnotherUserWishListById(user?.id, user?.username),
          ],
        },
      })
    }
  }

  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard)
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard)
  @Action(new RegExp(WISH_CALLBACK_DATA.back))
  async handleShowWishByBack(@Ctx() ctx: SceneContext) {
    const [, id] = (ctx as any)?.update?.callback_query?.data?.split(' ')

    if (!id) {
      await ctx.editMessageText(`${ctx?.text}\n\nВернуться назад не удалось, попробуйте сначала`, {
        reply_markup: {
          inline_keyboard: getMainKeyboards({ webAppUrl: this.customConfigService.miniAppUrl }),
        },
      })

      return
    }

    const wish = await this.wishEntity.get(id)

    const isAvailable = await this.validateAvailabilityWishAndSendErrorMessage(ctx, wish)

    if (!isAvailable) {
      return
    }

    await this.sharedService.showWishItem(ctx, { type: 'edit', wish, messageId: ctx?.msgId })
  }

  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard)
  @Action(new RegExp(WISH_CALLBACK_DATA.editWishItem))
  async editWishItem(@Ctx() ctx: SceneContext) {
    const [, id] = (ctx as any)?.update?.callback_query?.data?.split(' ')

    await this.sharedService.showEditWishItem(ctx, { wishId: id, type: 'edit' })
  }
}
