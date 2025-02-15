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
import { time } from 'src/helpers'
import { tryToGetUrlOrEmptyString } from 'src/helpers/url'
import { CustomConfigService, WishService } from 'src/modules'
import { PaginationResponse } from 'src/types'
import { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram'
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

    await this.tryToMutateOrReplyNewContent(ctx, {
      message: '<b>Меню желаний</b>',
      keyboard: getWishSceneKeyboards(),
    })
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

  async showWishList(
    @Ctx() ctx: SceneContext,
    paginated: PaginationResponse<WishDocument> & { showed?: number },
    sharedUser?: UserDocument,
  ) {
    if (!paginated.list?.length) {
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

    const { list, total = 0, showed = 0 } = paginated

    const message = `${showed + list.length || list.length} из ${total} желаний`

    await ctx.replyWithHTML(
      sharedUser?.id
        ? `Желания @${sharedUser.username} ${message} (Вы так же можете добавить понравившееся себе или забронировать):`
        : `<b>Ваши желания:</b> ${message}`,
    )

    for await (const wish of list) {
      await this.showWishItem(ctx, { wish, type: 'reply' })
    }

    const chat = await ctx.getChat()
    const isPrivate = chat?.type === 'private'

    const last = list?.[list.length - 1]

    await ctx?.replyWithHTML(
      `<b>Не теряйтесь, дублирую основные команды</b>${total > 0 ? `\n\nВыше показано ${message}` : ''}`,
      {
        reply_markup: {
          inline_keyboard: getMainKeyboards(
            isPrivate
              ? {
                  webAppUrl: this.customConfigService.miniAppUrl,
                  wishPagination: {
                    showed: showed + list?.length,
                    total,
                    sharedUserId: sharedUser?.id,
                    createdAt: time(last?.createdAt?.toDate()).toISOString(),
                  },
                }
              : undefined,
          ),
        },
      },
    )
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

  async tryToMutateOrReplyNewContent(
    ctx: SceneContext,
    options: { message: string; keyboard?: InlineKeyboardButton[][] },
  ) {
    const { keyboard, message } = options || {}
    const isCaption = !!ctx.callbackQuery?.message && !!(ctx.callbackQuery?.message as any).photo?.length

    if (!isCaption && !!ctx.callbackQuery?.message) {
      await ctx.editMessageText(message, {
        reply_markup: {
          inline_keyboard: keyboard ? keyboard : undefined,
        },
        parse_mode: 'HTML',
      })

      return
    }

    if (isCaption && !!ctx.callbackQuery?.message) {
      await ctx.editMessageCaption(message, {
        parse_mode: 'HTML',
      })

      await ctx.editMessageReplyMarkup({
        inline_keyboard: keyboard ? keyboard : undefined,
      })

      return
    }

    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: keyboard ? keyboard : undefined,
      },
      parse_mode: 'HTML',
    })
  }

  public async generateCsvFile<T>(
    data: T[],
    definedKeys?: string[],
    options?: {
      ctx?: SceneContext
      filename?: string
      caption?: string
    },
  ) {
    if (!data?.length) {
      return
    }

    const keys = definedKeys || Object.keys(data[0])

    let csvContent = ''
    const head = keys.join(',')
    csvContent += `${head}\r\n`

    data?.forEach((item: T) => {
      const rowArray = keys?.map((key) => item?.[key])
      const row = rowArray.join(',')
      csvContent += `${row}\r\n`
    })

    const buffer = Buffer.from(csvContent, 'utf-8')

    const { ctx, filename, caption } = options || {}

    if (ctx) {
      await ctx.replyWithDocument(
        {
          source: buffer,
          filename: `${filename}.csv`,
        },
        {
          caption,
        },
      )
    }

    return buffer
  }
}
