import { Injectable, Logger } from '@nestjs/common'
import { Action, Command, Ctx, Hears, Help, On, Start, Update } from 'nestjs-telegraf'
import { getMainKeyboards, getMainOpenWebAppButton } from 'src/constants/keyboards'
import { UserEntity, WishEntity } from 'src/entities'
import { tryToGetUrlOrEmptyString } from 'src/helpers/url'
import { CustomConfigService } from 'src/modules'
import { FileService } from 'src/modules/file'
import { Context } from 'telegraf'
import { SceneContext } from 'telegraf/typings/scenes'

import { SharedService } from '../shared'
import { WISH_CALLBACK_DATA } from './../wish/constants'
import { botWelcomeCommandsText, MAIN_CALLBACK_DATA, START_PAYLOAD_KEYS } from './constants'

@Update()
@Injectable()
export class MainSceneService {
  private logger = new Logger(MainSceneService.name)
  constructor(
    private readonly userEntity: UserEntity,
    private readonly wishEntity: WishEntity,
    private readonly sharedService: SharedService,
    private readonly fileService: FileService,
    private readonly customConfigService: CustomConfigService,
  ) {}

  @Start()
  async startCommand(@Ctx() ctx: SceneContext) {
    const chat = await ctx.getChat()

    if (chat?.type !== 'private') {
      await ctx.reply('Извините, но бот пока умеет работать только в режиме личной переписки')

      return
    }

    const id = `${ctx.from.id}`

    const startPayload = (ctx as any)?.startPayload?.toLowerCase?.() || ''
    const isSharedWishList = startPayload.includes(START_PAYLOAD_KEYS.shareByUserName)
    const sharedUserName = isSharedWishList ? startPayload?.replace(START_PAYLOAD_KEYS.shareByUserName, '') : ''

    const [sharedUser] = sharedUserName ? await this.userEntity?.findAll({ username: sharedUserName }) : []

    const isDifferentUsers = sharedUser?.id && sharedUser?.id !== id

    const handleGetSharedUserWishList = async () => {
      const items = await this.wishEntity.findAll({ userId: sharedUser?.id })

      return items
    }

    const user = await this.userEntity.get(id)

    const handleGetUserPhoto = async () => {
      if (!!user?.avatarUrl) {
        return user?.avatarUrl
      }

      try {
        const userProfile = await ctx?.telegram?.getUserProfilePhotos(ctx.from.id)
        const currentAvatarId = userProfile.photos?.[0]?.[0]?.file_id

        const avatarUrl = await ctx.telegram.getFileLink(currentAvatarId)

        return avatarUrl?.href
      } catch (error) {
        this.logger.error('handleGetUserPhoto', error)

        return null
      }
    }

    if (!!user && !user.avatarUrl) {
      const { doc, data } = await this.userEntity.getUpdate(user.id)
      const avatarUrl = await handleGetUserPhoto()

      const file = await this.fileService.createFile(avatarUrl)

      const payload = this.userEntity.getValidProperties({ ...data, avatarUrl: file?.aliasUrl })
      await doc.update(payload)
    }

    if (!user && chat.id && chat?.type === 'private') {
      const avatarUrl = await handleGetUserPhoto()
      const payload = this.userEntity.getValidProperties({
        id,
        username: ctx?.from?.username?.toLowerCase(),
        firstName: ctx?.from?.first_name,
        lastName: ctx?.from?.last_name,
        chatId: `${ctx?.from.id}`,
        isPremium: ctx?.from?.is_premium,
        isBot: ctx?.from?.is_bot,
        avatarUrl,
      })

      await this.userEntity.createOrUpdate(payload)

      await ctx.reply(
        `@${ctx?.from?.username}, добро пожаловать в бот для хранения и шейринга своего списка желаний${botWelcomeCommandsText}`,
      )

      if (sharedUser && isDifferentUsers) {
        const items = await handleGetSharedUserWishList()

        await this.sharedService.showWishList(ctx, items, sharedUser)

        return
      }

      return
    }

    await ctx.reply(`С возвращением! Напоминаем:${botWelcomeCommandsText}`, {
      reply_markup: {
        inline_keyboard: getMainKeyboards({ webAppUrl: this.customConfigService.miniAppUrl }),
      },
    })

    if (sharedUser && isDifferentUsers) {
      const items = await handleGetSharedUserWishList()

      await this.sharedService.showWishList(ctx, items, sharedUser)

      return
    }
  }

  @Help()
  async helpCommand(ctx: Context) {
    await ctx.reply(botWelcomeCommandsText)
  }

  @Action(WISH_CALLBACK_DATA.openWishScene)
  async openWishScene(@Ctx() ctx: SceneContext) {
    await this.sharedService.enterWishScene(ctx)
  }

  @Command(`${MAIN_CALLBACK_DATA.openWebApp}`)
  @Action(MAIN_CALLBACK_DATA.openWebApp)
  async openWebApp(@Ctx() ctx: SceneContext) {
    await ctx?.reply('Чтобы открыть веб приложение, нажмите кнопку ниже', {
      reply_markup: {
        inline_keyboard: [[getMainOpenWebAppButton(this.customConfigService.miniAppUrl)]],
      },
    })
  }

  @Command(`${WISH_CALLBACK_DATA.shareWishList}`)
  @Action(WISH_CALLBACK_DATA.shareWishList)
  async shareSelfWishListByUsername(@Ctx() ctx: SceneContext) {
    const username = ctx?.from?.username

    ctx.reply(`
Отправьте ссылку на свой вишлист, чтобы поделиться им:
https://t.me/personal_wish_list_bot?start=${START_PAYLOAD_KEYS.shareByUserName}${username}
`)
  }

  @On('photo')
  async onLoadPhoto(@Ctx() ctx: SceneContext) {
    ctx.reply('Чтобы установить фото, создайте новое желание или ортедактируйте существующее')
  }

  @Hears(/.*/)
  async onAnyAnswer(@Ctx() ctx: SceneContext) {
    const url = tryToGetUrlOrEmptyString(ctx?.text)

    if (!url) {
      await ctx.reply(
        'Команда не распознана, чтобы добавить новое желание, пришлите ссылку или нажмите на кнопку списка',
        {
          reply_markup: {
            inline_keyboard: [[{ text: 'Желания', callback_data: WISH_CALLBACK_DATA.openWishScene }]],
          },
        },
      )

      return
    }

    try {
      await this.sharedService.addWishItemByLink(ctx, { url })
    } catch (error) {
      this.logger.error('[onAddByUrl]', error, { data: error?.response?.data })
      await ctx.reply('Желание не удалось добавить, попробуйте другую ссылку')
    }
  }
}
