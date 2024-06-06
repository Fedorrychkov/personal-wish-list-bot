import { Injectable, Logger } from '@nestjs/common'
import { Ctx } from 'nestjs-telegraf'
import { MAIN_SCENE_KEYBOARDS } from 'src/constants/keyboards'
import { UserDocument, WishDocument, WishEntity } from 'src/entities'
import { SceneContext } from 'telegraf/typings/scenes'

import { WISH_CALLBACK_DATA } from '../wish/constants'
import { getUrlMetadata } from '../wish/utils/getUrlMetadata'

@Injectable()
export class SharedService {
  private logger = new Logger(SharedService.name)
  constructor(private readonly wishEntity: WishEntity) {}

  async enterWishScene(@Ctx() ctx: SceneContext) {
    await ctx.reply('Управляйте своим списком желаний', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Добавить в список по ссылке', callback_data: WISH_CALLBACK_DATA.addNewByLink }],
          [{ text: 'Получить весь список желаний', callback_data: WISH_CALLBACK_DATA.getAllWishList }],
          [{ text: 'Поделиться списком желаний', callback_data: WISH_CALLBACK_DATA.shareWishList }],
          [
            {
              text: 'Посмотреть чужой список желаний по никнейму',
              callback_data: WISH_CALLBACK_DATA.get_another_user_wish_list_by_nickname,
            },
          ],
        ],
      },
    })
  }

  async showWishList(@Ctx() ctx: SceneContext, wishList: WishDocument[], sharedUser?: UserDocument) {
    const userId = `${ctx.from.id}`

    await ctx.reply(
      sharedUser?.id
        ? `Список желаний @${sharedUser.username} (Вы так же можете добавить понравившееся желание в свой список):`
        : 'Текущий список ваших желаний:',
    )

    for await (const wish of wishList) {
      await ctx.replyWithHTML(
        `${wish.name}`,
        wish.userId === userId
          ? {
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: 'Редактировать', callback_data: `${WISH_CALLBACK_DATA.editWishItem} ${wish?.id}` },
                    { text: 'Удалить', callback_data: `${WISH_CALLBACK_DATA.removeWishItem} ${wish?.id}` },
                  ],
                ],
              },
            }
          : {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: 'Добавить в свой список',
                      callback_data: `${WISH_CALLBACK_DATA.copy_wish_item} ${wish?.id}`,
                    },
                  ],
                ],
              },
            },
      )
    }

    await ctx?.reply('Не теряйтесь, дублирую основные команды', {
      reply_markup: {
        inline_keyboard: MAIN_SCENE_KEYBOARDS,
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
