import { Injectable, Logger } from '@nestjs/common'
import { Ctx } from 'nestjs-telegraf'
import { WishEntity } from 'src/entities'
import { SceneContext } from 'telegraf/typings/scenes'

import { WISH_CALLBACK_DATA } from '../wish/constants'
import { getUrlMetadata } from '../wish/utils/getUrlMetadata'

@Injectable()
export class SharedService {
  private logger = new Logger(SharedService.name)
  constructor(private readonly wishEntity: WishEntity) {}

  // @SceneEnter()
  async enterWishScene(@Ctx() ctx: SceneContext) {
    // TODO: Надо разобраться с навигацией в боте
    await ctx.reply('Управляйте своим списком желаний', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Добавить в список по ссылке', callback_data: WISH_CALLBACK_DATA.addNewByLink }]],
      },
    })
    // await ctx.editMessageText('Управляйте своим списком желаний', {
    //   reply_markup: {
    //     inline_keyboard: [[{ text: 'Добавить в список по ссылке', callback_data: WISH_CALLBACK_DATA.addNewByLink }]],
    //   },
    // })
  }

  async addWishItemByLink(@Ctx() ctx: SceneContext, options: { url: string }) {
    const { url } = options || {}
    const openGraph = await getUrlMetadata(url)
    this.logger.log('[onAddByUrl.OpenGraph.payload]', { openGraph, url })

    const payload = this.wishEntity.getValidProperties({
      userId: `${ctx?.from?.id}`,
      name: openGraph?.title,
      description: openGraph?.description,
      imageUrl: openGraph?.imageUrl,
      link: openGraph?.wishUrl,
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
Ссылка на изображение: ${wish.imageUrl}

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
