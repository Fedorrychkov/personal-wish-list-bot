import { Inject, Injectable, Logger } from '@nestjs/common'
import * as fs from 'fs'
import { Action, Command, Ctx, Help, On, Start, Update } from 'nestjs-telegraf'
import { getMainKeyboards, getMainOpenWebAppButton, getWishItemKeyboard } from 'src/constants/keyboards'
import { AvailableChatTypes, ChatTelegrafContext, UserTelegrafContext } from 'src/decorator'
import { UserDocument, UserEntity, WishEntity } from 'src/entities'
import { ChatTelegrafGuard, UserTelegrafGuard, UseSafeGuards } from 'src/guards'
import { getImageBuffer } from 'src/helpers'
import { CustomConfigService } from 'src/modules'
import { BucketProvider, BucketSharedService, DefaultBucketProvider } from 'src/services/bucket'
import { ChatTelegrafContextType } from 'src/types'
import { Context } from 'telegraf'
import { SceneContext } from 'telegraf/typings/scenes'

import { SharedService } from '../shared'
import { WISH_CALLBACK_DATA } from './../wish/constants'
import { botWelcomeCommandsText, botWelcomeUserNameText, MAIN_CALLBACK_DATA, START_PAYLOAD_KEYS } from './constants'

@Update()
@Injectable()
export class MainSceneService {
  private bucketService: BucketSharedService

  private logger = new Logger(MainSceneService.name)
  constructor(
    private readonly userEntity: UserEntity,
    private readonly wishEntity: WishEntity,
    private readonly sharedService: SharedService,
    private readonly customConfigService: CustomConfigService,
    @Inject(DefaultBucketProvider.bucketName)
    private readonly bucketProvider: BucketProvider,
  ) {
    this.bucketService = new BucketSharedService(this.bucketProvider.bucket, MainSceneService.name)
  }

  @Start()
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async startCommand(
    @Ctx() ctx: SceneContext,
    @UserTelegrafContext() userContext: UserDocument,
    @ChatTelegrafContext() chatContext: ChatTelegrafContextType,
  ) {
    const startPayload = (ctx as any)?.startPayload?.toLowerCase?.() || ''
    const isShareWishListById = startPayload.includes(START_PAYLOAD_KEYS.shareById)
    const isSharedWishListByUsername = startPayload.includes(START_PAYLOAD_KEYS.shareByUserName)
    const sharedUserName = isSharedWishListByUsername
      ? startPayload?.replace(START_PAYLOAD_KEYS.shareByUserName, '')
      : ''
    const sharedUserId = isShareWishListById ? startPayload?.replace(START_PAYLOAD_KEYS.shareById, '') : ''

    const [sharedUserByUserName] = sharedUserName ? await this.userEntity?.findAll({ username: sharedUserName }) : []
    const sharedUserById = sharedUserId ? await this.userEntity?.get(sharedUserId) : null

    const sharedUser = sharedUserByUserName || sharedUserById

    const isDifferentUsers = sharedUser?.id && sharedUser?.id !== userContext?.id

    const user = await this.userEntity.get(userContext?.id)

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

    const handleTryToCheckUserAvatar = async () => {
      const { doc, data } = await this.userEntity.getUpdate(user.id)
      const avatarUrl = await handleGetUserPhoto()

      if (!avatarUrl) {
        return
      }

      try {
        const { buffer } = await getImageBuffer(avatarUrl)
        const relativePath = await this.bucketService.saveFileByUrl(avatarUrl, `avatar/${data?.id}`, buffer)

        try {
          await this.bucketService.deleteFileByName(data?.avatarUrl, `avatar/${data?.id}`)
        } catch (error) {
          this.logger.error(error)
        }

        const payload = this.userEntity.getValidProperties({ ...data, avatarUrl: relativePath })
        await doc.update(payload)
      } catch (error) {
        this.logger.error('Error with upload user avatar', avatarUrl)
      }
    }

    if (!!user && !user.avatarUrl) {
      handleTryToCheckUserAvatar()
    }

    if (!user && chatContext.chat.id && chatContext?.type === 'private') {
      const avatarUrl = await handleGetUserPhoto()
      const payload = this.userEntity.getValidProperties({
        ...userContext,
        avatarUrl,
      })

      await this.userEntity.createOrUpdate(payload)

      await ctx.reply(
        `@${
          ctx?.from?.username
        }, добро пожаловать в бот списка желайни, введите или выберите команду /help, для знакомства с функционалом бота ${
          payload?.username ? '' : botWelcomeUserNameText
        }`,
      )

      if (sharedUser && isDifferentUsers) {
        await ctx.reply(
          `Список желаний пользователя: @${sharedUser?.username || sharedUser?.id} можно посмотреть в WebApp`,
          {
            reply_markup: {
              inline_keyboard: [
                [getMainOpenWebAppButton(`${this.customConfigService.miniAppUrl}/user/${sharedUser?.id}`)],
                [{ callback_data: MAIN_CALLBACK_DATA.menu, text: 'Меню' }],
              ],
            },
            parse_mode: 'HTML',
          },
        )

        return
      }

      return
    }

    if (!user?.username && !!ctx?.from?.username?.toLowerCase()) {
      const payload = this.userEntity.getValidProperties({
        ...user,
        username: ctx?.from?.username?.toLowerCase(),
      })

      this.userEntity.createOrUpdate(payload)
    }

    if (!sharedUser) {
      await ctx.reply('С возвращением! Чтобы посмотреть возможности бота, можете ввести или выбрать команду /help', {
        reply_markup: {
          inline_keyboard: getMainKeyboards({ webAppUrl: this.customConfigService.miniAppUrl }),
        },
      })
    }

    if (sharedUser && isDifferentUsers) {
      await ctx.reply(
        `Список желаний пользователя: @${sharedUser?.username || sharedUser?.id} можно посмотреть в WebApp`,
        {
          reply_markup: {
            inline_keyboard: [
              [getMainOpenWebAppButton(`${this.customConfigService.miniAppUrl}/user/${sharedUser?.id}`)],
              [{ callback_data: MAIN_CALLBACK_DATA.menu, text: 'Меню' }],
            ],
          },
          parse_mode: 'HTML',
        },
      )

      return
    }
  }

  @Command(MAIN_CALLBACK_DATA.menu)
  @Action(MAIN_CALLBACK_DATA.menu)
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async menu(@Ctx() ctx: SceneContext) {
    await ctx.reply('<b>Доступные команды</b>', {
      reply_markup: {
        inline_keyboard: getMainKeyboards({ webAppUrl: this.customConfigService.miniAppUrl }),
      },
      parse_mode: 'HTML',
    })
  }

  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  @Help()
  async helpCommand(ctx: Context) {
    await ctx.reply(botWelcomeCommandsText)
  }

  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  @Command(WISH_CALLBACK_DATA.openWishScene)
  @Action(WISH_CALLBACK_DATA.openWishScene)
  async openWishScene(@Ctx() ctx: SceneContext) {
    await this.sharedService.enterWishScene(ctx)
  }

  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  @Command(WISH_CALLBACK_DATA.addNewEmptyWish)
  @Action(WISH_CALLBACK_DATA.addNewEmptyWish)
  async addNewEmptyWish(@Ctx() ctx: SceneContext, @UserTelegrafContext() userContext: UserDocument) {
    const payload = this.wishEntity.getValidProperties({
      userId: userContext.id,
      name: '',
      description: '',
      imageUrl: null,
      link: '',
    })

    const response = await this.wishEntity.createOrUpdate(payload)

    if ((ctx?.update as any)?.callback_query) {
      await ctx.deleteMessage(ctx?.msgId).catch()
    }

    await ctx.replyWithHTML('Новое желание добавлено, давайте его отредактируем?', {
      reply_markup: {
        inline_keyboard: getWishItemKeyboard(response.id, this.customConfigService.miniAppUrl),
      },
    })
  }

  @Command(MAIN_CALLBACK_DATA.openWebApp)
  @Action(MAIN_CALLBACK_DATA.openWebApp)
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard)
  async openWebApp(@Ctx() ctx: SceneContext) {
    await ctx?.reply('Чтобы открыть веб приложение, нажмите кнопку ниже', {
      reply_markup: {
        inline_keyboard: [[getMainOpenWebAppButton(this.customConfigService.miniAppUrl)]],
      },
    })
  }

  @Command(MAIN_CALLBACK_DATA.getReleaseNotes)
  @Action(MAIN_CALLBACK_DATA.getReleaseNotes)
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard)
  async getReleaseNotes(@Ctx() ctx: SceneContext) {
    const promise = async () =>
      new Promise((resolve) => {
        fs.readFile('./CHANGELOG.md', 'utf8', (err, data) => {
          if (err) {
            resolve('')
          }

          resolve(data)
        })
      })

    const content = await promise()

    const text = content
      ? `
Список обновлений бота
______
${content}
`
      : 'Не удалось найти CHANGELOG'

    await ctx?.reply(text, {
      reply_markup: {
        inline_keyboard: getMainKeyboards({ webAppUrl: this.customConfigService.miniAppUrl }),
      },
      parse_mode: 'Markdown',
    })
  }

  @Command(WISH_CALLBACK_DATA.shareWishList)
  @Action(WISH_CALLBACK_DATA.shareWishList)
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard)
  async shareSelfWishListByUsername(@Ctx() ctx: SceneContext) {
    const username = ctx?.from?.username
    const id = ctx?.from?.id

    const shareUserNameText = username ? `${START_PAYLOAD_KEYS.shareByUserName}${username}` : ''
    const shareByIdText = id ? `${START_PAYLOAD_KEYS.shareById}${id}` : ''
    const shareText = shareUserNameText || shareByIdText

    ctx.reply(`
Отправьте ссылку на свой вишлист, чтобы поделиться им:
https://t.me/personal_wish_list_bot?start=${shareText}
`)
  }

  @On('photo')
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard)
  async onLoadPhoto(@Ctx() ctx: SceneContext) {
    ctx.reply('Чтобы установить фото, создайте новое желание или ортедактируйте существующее')
  }
}
