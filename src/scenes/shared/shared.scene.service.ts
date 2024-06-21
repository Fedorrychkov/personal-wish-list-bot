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
import { UserDocument, WishDocument, WishEntity } from 'src/entities'
import { CustomConfigService } from 'src/modules'
import { SceneContext } from 'telegraf/typings/scenes'

import { getUrlMetadata } from '../wish/utils/getUrlMetadata'

@Injectable()
export class SharedService {
  private logger = new Logger(SharedService.name)
  constructor(private readonly wishEntity: WishEntity, private readonly customConfigService: CustomConfigService) {}

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
            ? getOwnerWishItemKeyboard(wish.id, wish, userId)
            : getSharedWishItemKeyboard(wish.id, wish, userId),
      },
    }

    if (type === 'edit') {
      if (messageId) {
        const link = wish.link
          ? `[${wish.name || 'Название не установлено'}](${wish.link})`
          : 'Ссылка и название не распознаны, попробуйте отредактировать или удалить желание начав сначала'
        const text = `
${wish?.link ? link : wish.name || 'Название не установлено'}
${wish?.isBooked ? '\n*забронировано*' : ''}${wish?.isBooked && wish?.bookedUserId === userId ? ' *вами*' : ''}
${appendedText}
`

        await ctx.telegram.editMessageText(ctx.chat.id, messageId, '0', text, { ...props, parse_mode: 'MarkdownV2' })

        return
      }
    }

    const link = wish.link
      ? `<a href="${wish.link}">${wish.name || 'Название не установлено'}</a>`
      : `Ссылка на желание ${wish.name || 'без названия'} не установлена`
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

    await ctx.replyWithHTML(
      sharedUser?.id
        ? `Желания @${sharedUser.username} (Вы так же можете добавить понравившееся себе или забронировать):`
        : '<b>Ваши желания:</b>',
    )

    for await (const wish of wishList) {
      await this.showWishItem(ctx, { wish, type: 'reply' })
    }

    await ctx?.replyWithHTML('<b>Не теряйтесь, дублирую основные команды</b>', {
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
        name: openGraph?.title || '',
        description: openGraph?.description || '',
        imageUrl: openGraph?.imageUrl || '',
        link: url || '',
      })

      const response = await this.wishEntity.createOrUpdate(payload)

      await ctx.replyWithHTML(
        `${response.name}\nС изображением: ${response?.imageUrl}\n\nдобавлен в ваш список желаний!`,
        {
          reply_markup: {
            inline_keyboard: getWishItemKeyboard(response.id),
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

    const text = getWishItemText(wish, { apiUrl: this.customConfigService.apiUrl })

    const props = {
      reply_markup: {
        inline_keyboard: getEditWishItemKeyboard(id),
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
