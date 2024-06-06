import { Injectable, Logger } from '@nestjs/common'
import { Action, Ctx, Hears, Help, On, Start, Update } from 'nestjs-telegraf'
import { UserEntity } from 'src/entities'
import { tryToGetUrlOrEmptyString } from 'src/helpers/url'
import { Context } from 'telegraf'
import { SceneContext } from 'telegraf/typings/scenes'

import { SharedService } from '../shared'
import { WISH_CALLBACK_DATA } from '../wish'

@Update()
@Injectable()
export class MainSceneService {
  private logger = new Logger(MainSceneService.name)
  constructor(private readonly userEntity: UserEntity, private readonly sharedService: SharedService) {}

  @Start()
  async startCommand(ctx: Context) {
    const chat = await ctx.getChat()

    if (chat?.type !== 'private') {
      await ctx.reply('Извините, но бот пока умеет работать только в режиме личной переписки')

      return
    }

    const id = `${ctx.from.id}`

    const user = await this.userEntity.get(id)

    if (!user && chat.id && chat?.type === 'private') {
      const payload = this.userEntity.getValidProperties({
        id,
        username: ctx?.from?.username,
        firstName: ctx?.from?.first_name,
        lastName: ctx?.from?.last_name,
        chatId: `${ctx?.from.id}`,
        isPremium: ctx?.from?.is_premium,
        isBot: ctx?.from?.is_bot,
      })

      await this.userEntity.createOrUpdate(payload)

      await ctx.reply(`@${ctx?.from?.username}, добро пожаловать в бот для хранения и шейринга своего списка желаний`)

      return
    }

    await ctx.reply('С возвращением!', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Список желаний', callback_data: WISH_CALLBACK_DATA.openWishScene }]],
        // keyboard: [[{ text: 'test' }]], // стандартная кнопка под полем ввода
        // inline_keyboard: [[{ text: 'test', web_app: { url: 'https://google.com' } }]], // кнопка с сообщением
      },
    })
  }

  @Help()
  async helpCommand(ctx: Context) {
    await ctx.reply('Send me a sticker')
  }

  @Action(WISH_CALLBACK_DATA.openWishScene)
  async openWishScene(@Ctx() ctx: SceneContext) {
    await this.sharedService.enterWishScene(ctx)
  }

  @On('photo')
  async onLoadPhoto(@Ctx() ctx: SceneContext) {
    ctx.reply('Чтобы установить фото, создайте новое желание или ортедактируйте существущее')
  }

  @Hears(/.*/)
  async onAnyAnswer(@Ctx() ctx: SceneContext) {
    const url = tryToGetUrlOrEmptyString(ctx?.text)

    if (!url) {
      await ctx.reply('Команда не распознана, попробуйте еще раз или начните с начала', {
        reply_markup: {
          inline_keyboard: [[{ text: 'Список желаний', callback_data: WISH_CALLBACK_DATA.openWishScene }]],
        },
      })

      return
    }

    try {
      await this.sharedService.addWishItemByLink(ctx, { url })
    } catch (error) {
      this.logger.error('[onAddByUrl]', error, { data: error?.response?.data })
      await ctx.reply('Элемент не удалось добавить, попробуйте другую ссылку')
    }
  }
}
