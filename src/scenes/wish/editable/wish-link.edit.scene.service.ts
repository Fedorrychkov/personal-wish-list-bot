import { Timestamp } from '@google-cloud/firestore'
import { Injectable, Logger } from '@nestjs/common'
import { Action, Ctx, Hears, Scene, SceneEnter } from 'nestjs-telegraf'
import { backBtn, getSceneNavigationKeyboard } from 'src/constants'
import { WishDocument, WishEntity } from 'src/entities'
import { time } from 'src/helpers'
import { tryToGetUrlOrEmptyString } from 'src/helpers/url'
import { CustomConfigService } from 'src/modules'
import { SceneContext } from 'telegraf/typings/scenes'

import { SharedService } from '../../shared/shared.scene.service'
import { WISH_CALLBACK_DATA, WISH_SCENE_EDIT_LINK_SCENE } from '../constants'

@Scene(WISH_SCENE_EDIT_LINK_SCENE)
@Injectable()
export class WishLinkEditSceneService {
  private logger = new Logger(WishLinkEditSceneService.name)

  constructor(
    private readonly wishEntity: WishEntity,
    private readonly sharedService: SharedService,
    private readonly customConfigService: CustomConfigService,
  ) {}

  @SceneEnter()
  async enter(@Ctx() ctx: SceneContext) {
    const state = (ctx.scene?.state || { wish: undefined }) as { wish: WishDocument | undefined; messageId: number }
    const { messageId } = state || {}

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      messageId,
      '0',
      '*Отправьте новую ссылку на товар в ответном сообщении*',
      {
        reply_markup: {
          inline_keyboard: [[backBtn]],
        },
        parse_mode: 'MarkdownV2',
      },
    )
  }

  @Action(WISH_CALLBACK_DATA.back)
  async back(@Ctx() ctx: SceneContext) {
    const state = (ctx.scene?.state || { wish: undefined }) as { wish: WishDocument | undefined; messageId: number }
    const { wish, messageId } = state || {}

    await this.sharedService.showEditWishItem(ctx, { wishId: wish.id, type: 'edit', messageId })
    await ctx.scene.leave()
  }

  @Hears(/.*/)
  async editLink(@Ctx() ctx: SceneContext) {
    const state = (ctx.scene?.state || { wish: undefined }) as { wish: WishDocument | undefined; messageId: number }
    const { wish, messageId } = state || {}

    const handleUpdateLastMessage = async (text: string) => {
      const chat = await ctx.getChat()
      const isPrivate = chat?.type === 'private'

      await ctx.deleteMessage(ctx?.msgId).catch()
      await ctx.telegram.editMessageText(ctx.chat.id, messageId, '0', text, {
        reply_markup: {
          inline_keyboard: getSceneNavigationKeyboard(
            isPrivate ? { webAppUrl: this.customConfigService.miniAppUrl } : undefined,
          ),
        },
        parse_mode: 'MarkdownV2',
      })
    }

    if (!wish) {
      await handleUpdateLastMessage('Произошла ошибка получения состояния, попробуйте еще раз')

      await ctx.scene.leave()

      return
    }

    const linkText = (ctx?.text || '')?.trim?.() || ''
    const link = tryToGetUrlOrEmptyString(linkText)

    if (!link) {
      await handleUpdateLastMessage('Произошла ошибка получения ссылки, попробуйте ввести еще раз')

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

    await doc.update({ ...data, link, updatedAt })

    await this.sharedService.showEditWishItem(ctx, { wishId: wish.id, type: 'edit', messageId })
    await ctx.deleteMessage(ctx?.msgId).catch()

    await ctx.scene.leave()
  }
}
