import { Timestamp } from '@google-cloud/firestore'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { Action, Ctx, Hears, On, Scene, SceneEnter } from 'nestjs-telegraf'
import { backBtn, getSceneNavigationKeyboard } from 'src/constants'
import { AvailableChatTypes } from 'src/decorator'
import { WishDocument, WishEntity } from 'src/entities'
import { ChatTelegrafGuard, UseSafeGuards } from 'src/guards'
import { getImageBuffer, time } from 'src/helpers'
import { tryToGetUrlOrEmptyString } from 'src/helpers/url'
import { CustomConfigService } from 'src/modules'
import { BucketProvider, BucketSharedService, DefaultBucketProvider } from 'src/services/bucket'
import { SceneContext } from 'telegraf/typings/scenes'

import { SharedService } from '../../shared/shared.scene.service'
import { WISH_CALLBACK_DATA, WISH_SCENE_EDIT_IMAGE_URL_SCENE } from '../constants'

@Scene(WISH_SCENE_EDIT_IMAGE_URL_SCENE)
@Injectable()
export class WishImageUrlEditSceneService {
  private bucketService: BucketSharedService
  private logger = new Logger(WishImageUrlEditSceneService.name)

  constructor(
    private readonly wishEntity: WishEntity,
    private readonly sharedService: SharedService,
    private readonly customConfigService: CustomConfigService,

    @Inject(DefaultBucketProvider.bucketName)
    private readonly bucketProvider: BucketProvider,
  ) {
    this.bucketService = new BucketSharedService(this.bucketProvider.bucket, WishImageUrlEditSceneService.name)
  }

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

  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard)
  @Action(WISH_CALLBACK_DATA.back)
  async back(@Ctx() ctx: SceneContext) {
    const state = (ctx.scene?.state || { wish: undefined }) as { wish: WishDocument | undefined; messageId: number }
    const { wish, messageId } = state || {}

    await this.sharedService.showEditWishItem(ctx, { wishId: wish.id, type: 'edit', messageId })
    await ctx.scene.leave()
  }

  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard)
  @On('photo')
  async onLoadPhoto(@Ctx() ctx: SceneContext) {
    const state = (ctx.scene?.state || { wish: undefined }) as { wish: WishDocument | undefined; messageId: number }
    const { wish, messageId } = state || {}

    const imageId = (ctx.message as any).photo?.pop?.()?.file_id

    const imageUrl = await ctx.telegram.getFileLink(imageId)

    const handleUpdateLastMessage = async (text: string) => {
      await ctx.telegram.editMessageText(ctx.chat.id, messageId, '0', text, {
        reply_markup: {
          inline_keyboard: getSceneNavigationKeyboard({ webAppUrl: this.customConfigService.miniAppUrl }),
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

    const { buffer } = await getImageBuffer(imageUrl?.href)
    const relativePath = await this.bucketService.saveFileByUrl(imageUrl?.href, `wish/${data?.id}`, buffer)

    if (!relativePath) {
      await handleUpdateLastMessage('Произошла ошибка загрузки фото, попробуйте отправить другое')

      return
    }

    try {
      await this.bucketService.deleteFileByName(data?.imageUrl, `wish/${data?.id}`)
    } catch (error) {
      this.logger.error(error)
    }

    await doc.update({ ...data, imageUrl: relativePath, updatedAt })

    await this.sharedService.showEditWishItem(ctx, { wishId: wish.id, type: 'edit', messageId })

    if (!(ctx?.update as any)?.callback_query) {
      await ctx.deleteMessage(ctx?.msgId).catch()
    }

    await ctx.scene.leave()
  }

  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard)
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
