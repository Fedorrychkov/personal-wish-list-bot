import { Inject, Injectable, Logger } from '@nestjs/common'
import * as fs from 'fs'
import { Action, Command, Ctx, Help, On, Start, Update } from 'nestjs-telegraf'
import { getMainKeyboards, getMainOpenWebAppButton } from 'src/constants/keyboards'
import { UserEntity, WishEntity } from 'src/entities'
import { getImageBuffer } from 'src/helpers'
import { CustomConfigService } from 'src/modules'
import { BucketProvider, BucketSharedService, DefaultBucketProvider } from 'src/services/bucket'
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
  async startCommand(@Ctx() ctx: SceneContext) {
    const chat = await ctx.getChat()

    console.log(ctx, chat, 'ctx')

    if (chat?.type !== 'private') {
      await ctx.reply('Извините, но бот пока умеет работать только в режиме личной переписки')

      await ctx.reply(`${botWelcomeCommandsText}\nДля корректной работы перейдите в личку бота`)

      return
    }

    const id = `${ctx.from.id}`

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
        `@${
          ctx?.from?.username
        }, добро пожаловать в бот для хранения и шейринга своего списка желаний${botWelcomeCommandsText}${
          payload?.username ? '' : botWelcomeUserNameText
        }`,
      )

      if (sharedUser && isDifferentUsers) {
        const items = await handleGetSharedUserWishList()

        await this.sharedService.showWishList(ctx, items, sharedUser)

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

  @Command(WISH_CALLBACK_DATA.openWishScene)
  @Action(WISH_CALLBACK_DATA.openWishScene)
  async openWishScene(@Ctx() ctx: SceneContext) {
    await this.sharedService.enterWishScene(ctx)
  }

  @Command(MAIN_CALLBACK_DATA.openWebApp)
  @Action(MAIN_CALLBACK_DATA.openWebApp)
  async openWebApp(@Ctx() ctx: SceneContext) {
    const chat = await ctx.getChat()
    const isPrivate = chat?.type === 'private'

    if (!isPrivate) {
      await ctx?.reply('Веб приложение можно открыть только в личной переписке', {
        reply_markup: {
          inline_keyboard: [[getMainOpenWebAppButton(this.customConfigService.miniAppUrl)]],
        },
      })

      ctx?.deleteMessage(ctx?.msgId)
    }

    await ctx?.reply('Чтобы открыть веб приложение, нажмите кнопку ниже', {
      reply_markup: {
        inline_keyboard: [[getMainOpenWebAppButton(this.customConfigService.miniAppUrl)]],
      },
    })
  }

  @Command(MAIN_CALLBACK_DATA.getReleaseNotes)
  @Action(MAIN_CALLBACK_DATA.getReleaseNotes)
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

    const chat = await ctx.getChat()
    const isPrivate = chat?.type === 'private'

    await ctx?.reply(text, {
      reply_markup: isPrivate
        ? {
            inline_keyboard: getMainKeyboards({ webAppUrl: this.customConfigService.miniAppUrl }),
          }
        : undefined,
      parse_mode: 'Markdown',
    })
  }

  @Command(WISH_CALLBACK_DATA.shareWishList)
  @Action(WISH_CALLBACK_DATA.shareWishList)
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
  async onLoadPhoto(@Ctx() ctx: SceneContext) {
    ctx.reply('Чтобы установить фото, создайте новое желание или ортедактируйте существующее')
  }
}
