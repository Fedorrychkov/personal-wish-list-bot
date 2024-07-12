import { Injectable, Logger } from '@nestjs/common'
import { Action, Ctx, Update } from 'nestjs-telegraf'
import { AvailableChatTypes } from 'src/decorator'
import { FavoriteEntity } from 'src/entities'
import { ChatTelegrafGuard, UserTelegrafGuard, UseSafeGuards } from 'src/guards'
import { CustomConfigService } from 'src/modules'
import { SceneContext } from 'telegraf/typings/scenes'

import { WISH_CALLBACK_DATA } from '../wish'
import { getWishFavoriteKeyboard } from './../../constants/keyboards'

@Update()
@Injectable()
export class FavoriteMainSceneService {
  private readonly logger = new Logger(FavoriteMainSceneService.name)
  constructor(
    private readonly favoriteEntity: FavoriteEntity,
    private readonly customConfigService: CustomConfigService,
  ) {}

  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  @Action(new RegExp(WISH_CALLBACK_DATA.disableFavoriteNotification))
  async disableFavoriteNotifications(@Ctx() ctx: SceneContext) {
    const [, id] = (ctx as any)?.update?.callback_query?.data?.split(' ')

    const { doc, data } = await this.favoriteEntity.getUpdate(id)

    if (data) {
      await doc?.update({ wishlistNotifyEnabled: false })
    }

    const webAppUrl =
      (ctx.update as any).callback_query?.message?.reply_markup?.inline_keyboard?.[0]?.[0]?.web_app?.url ||
      this.customConfigService.miniAppUrl

    await ctx?.editMessageReplyMarkup({
      inline_keyboard: getWishFavoriteKeyboard({
        id: id,
        wishlistNotifyEnabled: false,
        webAppUrl: webAppUrl,
      }),
    })
  }

  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  @Action(new RegExp(WISH_CALLBACK_DATA.enableFavoriteNotification))
  async enableFavoriteNotifications(@Ctx() ctx: SceneContext) {
    const [, id] = (ctx as any)?.update?.callback_query?.data?.split(' ')

    const { doc, data } = await this.favoriteEntity.getUpdate(id)

    if (data) {
      await doc?.update({ wishlistNotifyEnabled: true })
    }

    const webAppUrl =
      (ctx.update as any).callback_query?.message?.reply_markup?.inline_keyboard?.[0]?.[0]?.web_app?.url ||
      this.customConfigService.miniAppUrl

    await ctx?.editMessageReplyMarkup({
      inline_keyboard: getWishFavoriteKeyboard({
        id: id,
        wishlistNotifyEnabled: true,
        webAppUrl: webAppUrl,
      }),
    })
  }
}
