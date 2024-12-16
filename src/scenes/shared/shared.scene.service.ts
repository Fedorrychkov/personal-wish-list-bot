import { Injectable, Logger } from '@nestjs/common'
import { Ctx } from 'nestjs-telegraf'
import { getWishItemText } from 'src/constants'
import {
  getEditWishItemKeyboard,
  getMainKeyboards,
  getOwnerWishItemKeyboard,
  getSharedWishItemKeyboard,
  getWishItemKeyboard,
  getWishSceneKeyboards,
} from 'src/constants/keyboards'
import { UserDocument, WishDocument, WishEntity, WishStatus } from 'src/entities'
import { tryToGetUrlOrEmptyString } from 'src/helpers/url'
import { CustomConfigService, WishService } from 'src/modules'
import { SceneContext } from 'telegraf/typings/scenes'

import { getUrlMetadata } from '../wish/utils/getUrlMetadata'

@Injectable()
export class SharedService {
  private logger = new Logger(SharedService.name)
  constructor(
    private readonly wishEntity: WishEntity,
    private readonly customConfigService: CustomConfigService,
    private readonly wishService: WishService,
  ) {}

  async enterWishScene(@Ctx() ctx: SceneContext) {
    await ctx?.scene?.leave?.()

    if ((ctx as any)?.update?.callback_query?.message?.from?.is_bot) {
      await ctx.editMessageText('Управление желаниями', {
        reply_markup: {
          inline_keyboard: getWishSceneKeyboards(),
        },
      })
    } else {
      await ctx.reply('Управление желаниями', {
        reply_markup: {
          inline_keyboard: getWishSceneKeyboards(),
        },
      })
    }
  }

  async showWishItem(
    @Ctx() ctx: SceneContext,
    options: {
      wish: WishDocument
      type: 'reply' | 'edit'
      messageId?: number
      appendedText?: string
    },
  ) {
    const { type = 'reply', wish, messageId, appendedText = '' } = options
    const userId = `${ctx.from.id}`

    const props = {
      reply_markup: {
        inline_keyboard:
          wish.userId === userId
            ? getOwnerWishItemKeyboard({
                id: wish.id,
                wish,
                senderUserId: userId,
                webAppUrl: this.customConfigService.miniAppUrl,
              })
            : getSharedWishItemKeyboard({
                id: wish.id,
                wish,
                senderUserId: userId,
                webAppUrl: this.customConfigService.miniAppUrl,
              }),
      },
    }

    const descriptionText = wish?.description ? `<b>Описание: </b>${wish?.description?.slice(0, 50)}...` : ''
    const linkText = wish.link
      ? `<a href="${wish.link}">${wish.name || '<i>Название не установлено</i>'}</a>`
      : `Ссылка на желание ${wish.name || '<i>без названия</<i>'} не установлена`
    const messageText = `<b>Название: </b>${wish?.link ? linkText : wish.name}\n${descriptionText}${
      wish?.isBooked ? `\n<b>забронировано${wish.bookedUserId === userId ? ' вами' : ''}</b>` : ''
    }${appendedText}`

    if (type === 'edit') {
      if (messageId) {
        await ctx.telegram.editMessageText(ctx.chat.id, messageId, '0', messageText, { ...props, parse_mode: 'HTML' })

        return
      }
    }

    await ctx.replyWithHTML(messageText, props)

    return
  }

  async showWishList(@Ctx() ctx: SceneContext, wishList: WishDocument[], sharedUser?: UserDocument) {
    if (!wishList?.length) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        ctx?.msgId,
        '0',
        'Список желаний пуст, ловите доступные команды:',
        {
          reply_markup: {
            inline_keyboard: getMainKeyboards({ webAppUrl: this.customConfigService.miniAppUrl }),
          },
        },
      )

      return
    }

    await ctx.replyWithHTML(
      sharedUser?.id
        ? `Желания @${sharedUser.username} (Вы так же можете добавить понравившееся себе или забронировать):`
        : '<b>Ваши желания:</b>',
    )

    for await (const wish of wishList) {
      await this.showWishItem(ctx, { wish, type: 'reply' })
    }

    const chat = await ctx.getChat()
    const isPrivate = chat?.type === 'private'

    await ctx?.replyWithHTML('<b>Не теряйтесь, дублирую основные команды</b>', {
      reply_markup: {
        inline_keyboard: getMainKeyboards(isPrivate ? { webAppUrl: this.customConfigService.miniAppUrl } : undefined),
      },
    })
  }

  async addWishItemByLink(
    @Ctx() ctx: SceneContext,
    options: { url: string; title?: string },
    userContext?: UserDocument,
  ) {
    try {
      const { url, title } = options || {}
      const message = await ctx.reply('Пробуем загрузить информацию о желании по ссылке, пожалуйста, подождите!')
      const openGraph = await getUrlMetadata(url)
      this.logger.log('[onAddByUrl.OpenGraph.payload]', { openGraph, url })

      await ctx.deleteMessage(message.message_id)

      const payload = this.wishEntity.getValidProperties({
        userId: `${ctx?.from?.id}`,
        name: title || openGraph?.title || '',
        description: openGraph?.description || '',
        imageUrl: tryToGetUrlOrEmptyString(openGraph?.imageUrl) || '',
        status: WishStatus.ACTIVE,
        link: url || '',
      })

      const response = await this.wishService.createAndNotifySubscribers(
        { ...userContext, id: Number(userContext?.id) },
        payload,
      )

      this.logger.log('[onAddByUrl.response]', { response })

      const statusMessage = openGraph.title
        ? 'Информация успешно загружена и добавлена в список желаний!'
        : 'Не удалось выгрузить информацию по ссылке, но желание добавлено с пустыми полями, кроме самой ссылки :('

      await ctx.replyWithHTML(
        `${statusMessage}\n\n${response.name || 'Без названия'}\nС изображением: ${
          response?.imageUrl || 'Без изображения'
        }`,
        {
          reply_markup: {
            inline_keyboard: getWishItemKeyboard(response.id, this.customConfigService.miniAppUrl),
          },
        },
      )
    } catch (error) {
      this.logger.error('[onAddByUrl]', error, { data: error?.response?.data })
      await ctx.reply('Что то пошло не так, попробуйте еще раз')
    }
  }

  async showEditWishItem(
    @Ctx() ctx: SceneContext,
    options: { wishId: string; type: 'reply' | 'edit' | 'deleteAndReply'; messageId?: number },
  ) {
    const { wishId: id, type = 'edit', messageId } = options || {}

    const wish = await this.wishEntity.get(id)

    if (!wish) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        messageId,
        '0',
        'Желание невозможно отредактировать, так как оно уже удалено',
        {
          reply_markup: {
            inline_keyboard: getMainKeyboards({ webAppUrl: this.customConfigService.miniAppUrl }),
          },
        },
      )
    }

    const text = getWishItemText(wish, { apiUrl: this.customConfigService.apiUrl })

    const props = {
      reply_markup: {
        inline_keyboard: getEditWishItemKeyboard(id),
      },
      parse_mode: 'HTML' as const,
    }

    if (type === 'edit') {
      if (messageId) {
        await ctx.telegram.editMessageText(ctx.chat.id, messageId, '0', text, props)

        return
      }

      await ctx.editMessageText(text, props)

      return
    } else if (type === 'reply') {
      await ctx.replyWithHTML(text, props)

      return
    } else if (type === 'deleteAndReply') {
      await ctx.telegram.deleteMessage(ctx.chat.id, messageId).catch()

      await ctx.replyWithHTML(text, props)
    }
  }
}
