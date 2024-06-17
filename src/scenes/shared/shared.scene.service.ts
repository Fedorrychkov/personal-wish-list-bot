import { Injectable, Logger } from '@nestjs/common'
import { Ctx } from 'nestjs-telegraf'
import { getMainKeyboards, getOwnerWishItemKeyboard, getSharedWishItemKeyboard } from 'src/constants/keyboards'
import { UserDocument, WishDocument, WishEntity } from 'src/entities'
import { CustomConfigService } from 'src/modules'
import { SceneContext } from 'telegraf/typings/scenes'

import { WISH_CALLBACK_DATA } from '../wish/constants'
import { getUrlMetadata } from '../wish/utils/getUrlMetadata'

@Injectable()
export class SharedService {
  private logger = new Logger(SharedService.name)
  constructor(private readonly wishEntity: WishEntity, private readonly customConfigService: CustomConfigService) {}

  async enterWishScene(@Ctx() ctx: SceneContext) {
    await ctx.reply('Управление желаниями', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Добавить по ссылке', callback_data: WISH_CALLBACK_DATA.addNewByLink }],
          [{ text: 'Мои желания', callback_data: WISH_CALLBACK_DATA.getAllWishList }],
          [{ text: 'Поделиться желаниями', callback_data: WISH_CALLBACK_DATA.shareWishList }],
          [
            {
              text: 'Найти желания по никнейму',
              callback_data: WISH_CALLBACK_DATA.get_another_user_wish_list_by_nickname,
            },
          ],
        ],
      },
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
            ? getOwnerWishItemKeyboard(wish.id, wish, userId)
            : getSharedWishItemKeyboard(wish.id, wish, userId),
      },
    }

    if (type === 'edit') {
      if (messageId) {
        const link = `[${wish.name}](${wish.link})`
        const text = `
${wish?.link ? link : wish.name}
${wish?.isBooked ? '\n*забронировано*' : ''}${wish?.isBooked && wish?.bookedUserId === userId ? ' *вами*' : ''}
${appendedText}
`

        await ctx.telegram.editMessageText(ctx.chat.id, messageId, '0', text, { ...props, parse_mode: 'MarkdownV2' })

        return
      }
    }

    const link = `<a href="${wish.link}">${wish.name}</a>`
    const text = `${wish?.link ? link : wish.name}${
      wish?.isBooked ? `\n<b>забронировано${wish.bookedUserId === userId ? ' вами' : ''}</b>` : ''
    }${appendedText}`

    await ctx.replyWithHTML(text, props)

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

    await ctx.reply(
      sharedUser?.id
        ? `Желания @${sharedUser.username} (Вы так же можете добавить понравившееся себе или забронировать):`
        : 'Ваши желания:',
    )

    for await (const wish of wishList) {
      await this.showWishItem(ctx, { wish, type: 'reply' })
    }

    await ctx?.reply('Не теряйтесь, дублирую основные команды', {
      reply_markup: {
        inline_keyboard: getMainKeyboards({ webAppUrl: this.customConfigService.miniAppUrl }),
      },
    })
  }

  async addWishItemByLink(@Ctx() ctx: SceneContext, options: { url: string }) {
    try {
      const { url } = options || {}
      const openGraph = await getUrlMetadata(url)
      this.logger.log('[onAddByUrl.OpenGraph.payload]', { openGraph, url })

      const payload = this.wishEntity.getValidProperties({
        userId: `${ctx?.from?.id}`,
        name: openGraph?.title || 'Не удалось получить название',
        description: openGraph?.description || 'Не удалось получить описание',
        imageUrl: openGraph?.imageUrl || 'Не удалось получить изображение',
        link: openGraph?.wishUrl || url,
      })

      const response = await this.wishEntity.createOrUpdate(payload)

      await ctx.replyWithHTML(
        `${response.name}\nС изображением: ${response?.imageUrl}\n\nдобавлен в ваш список желаний!`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: 'Редактировать', callback_data: `${WISH_CALLBACK_DATA.editWishItem} ${response?.id}` },
                { text: 'Удалить', callback_data: `${WISH_CALLBACK_DATA.removeWishItem} ${response?.id}` },
              ],
              [{ text: 'Добавить еще', callback_data: WISH_CALLBACK_DATA.addNewByLink }],
            ],
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

    const text = `
Название: ${wish.name}
Описание: ${wish.description}
Ссылка: ${wish.link}
Ссылка на изображение: ${
      wish.imageUrl?.includes('/v1/file') && !wish.imageUrl?.includes('http')
        ? `${this.customConfigService.apiUrl}${wish.imageUrl}`
        : wish.imageUrl
    }

Выберите действие
`

    const props = {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Название', callback_data: `${WISH_CALLBACK_DATA.editWishItemName} ${id}` }],
          [{ text: 'Описание', callback_data: `${WISH_CALLBACK_DATA.editWishItemDescription} ${id}` }],
          [{ text: 'Ссылка', callback_data: `${WISH_CALLBACK_DATA.editWishItemLink} ${id}` }],
          [{ text: 'Изображение', callback_data: `${WISH_CALLBACK_DATA.editWishItemImageUrl} ${id}` }],
          [
            { text: 'Удалить', callback_data: `${WISH_CALLBACK_DATA.removeWishItem} ${id}` },
            { text: 'Добавить еще', callback_data: WISH_CALLBACK_DATA.addNewByLink },
          ],
        ],
      },
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
      await ctx.telegram.deleteMessage(ctx.chat.id, messageId)

      await ctx.replyWithHTML(text, props)
    }
  }
}
