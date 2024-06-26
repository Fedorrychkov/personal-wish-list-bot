import { Timestamp } from '@google-cloud/firestore'
import { Injectable, Logger } from '@nestjs/common'
import { Action, Ctx, Hears, On, Scene, SceneEnter } from 'nestjs-telegraf'
import { backBtn, getSceneNavigationKeyboard } from 'src/constants'
import { WishDocument, WishEntity } from 'src/entities'
import { time } from 'src/helpers'
import { tryToGetUrlOrEmptyString } from 'src/helpers/url'
import { CustomConfigService } from 'src/modules'
import { FileService } from 'src/modules/file'
import { SceneContext } from 'telegraf/typings/scenes'

import { SharedService } from '../../shared/shared.scene.service'
import { WISH_CALLBACK_DATA, WISH_SCENE_EDIT_IMAGE_URL_SCENE } from '../constants'

@Scene(WISH_SCENE_EDIT_IMAGE_URL_SCENE)
@Injectable()
export class WishImageUrlEditSceneService {
  private logger = new Logger(WishImageUrlEditSceneService.name)

  constructor(
    private readonly wishEntity: WishEntity,
    private readonly sharedService: SharedService,
    private readonly fileService: FileService,
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
      '*Отправьте новую фотографию на желание в ответном сообщении*',
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

  @On('photo')
  async onLoadPhoto(@Ctx() ctx: SceneContext) {
    const state = (ctx.scene?.state || { wish: undefined }) as { wish: WishDocument | undefined; messageId: number }
    const { wish, messageId } = state || {}

    const imageId = (ctx.message as any).photo?.pop?.()?.file_id

    const imageUrl = await ctx.telegram.getFileLink(imageId)

    const handleUpdateLastMessage = async (text: string) => {
      const chat = await ctx.getChat()
      const isPrivate = chat?.type === 'private'

      await ctx.telegram.editMessageText(ctx.chat.id, messageId, '0', text, {
        reply_markup: {
          inline_keyboard: getSceneNavigationKeyboard(
            isPrivate ? { webAppUrl: this.customConfigService.miniAppUrl } : undefined,
          ),
        },
        parse_mode: 'MarkdownV2',
      })
    }

    if (!imageUrl) {
      await handleUpdateLastMessage('Произошла ошибка загрузки фото, попробуйте отправить другое')

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

    const file = await this.fileService.createFile(imageUrl?.href)

    await doc.update({ ...data, imageUrl: file?.aliasUrl, updatedAt })

    await this.sharedService.showEditWishItem(ctx, { wishId: wish.id, type: 'edit', messageId })

    await ctx.scene.leave()
  }

  @Hears(/.*/)
  async editImageUrl(@Ctx() ctx: SceneContext) {
    const state = (ctx.scene?.state || { wish: undefined }) as { wish: WishDocument | undefined; messageId: number }
    const { wish, messageId } = state || {}

    const handleUpdateLastMessage = async (text: string) => {
      await ctx.deleteMessage(ctx?.msgId).catch()
      await ctx.telegram.editMessageText(ctx.chat.id, messageId, '0', text)
    }

    if (!wish) {
      await handleUpdateLastMessage('Произошла ошибка получения состояния, попробуйте еще раз')

      await ctx.scene.leave()

      return
    }

    const imageUrlText = (ctx?.text || '')?.trim?.() || ''
    const imageUrl = tryToGetUrlOrEmptyString(imageUrlText)

    if (!imageUrl) {
      await handleUpdateLastMessage('Произошла ошибка получения ссылки, попробуйте ввести еще раз или отправьте фото')

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

    await doc.update({ ...data, imageUrl, updatedAt })

    await this.sharedService.showEditWishItem(ctx, { wishId: wish.id, type: 'edit', messageId })
    await ctx.deleteMessage(ctx?.msgId).catch()

    await ctx.scene.leave()
  }
}
