import { Inject, Injectable, Logger } from '@nestjs/common'
import * as fs from 'fs'
import { Action, Command, Ctx, Help, On, Start, Update } from 'nestjs-telegraf'
import {
  TRANSACTION_NEW_USER_REFFERER_XTR_AMOUNT,
  TRANSACTION_NEW_USER_XTR_AMOUNT,
  TRANSACTION_USER_REFFERER_XTR_COMISSION,
} from 'src/constants'
import {
  getMainKeyboards,
  getMainOpenWebAppButton,
  getStartupMainSceneKeyboard,
  getWishItemKeyboard,
} from 'src/constants/keyboards'
import { AvailableChatTypes, ChatTelegrafContext, UserTelegrafContext } from 'src/decorator'
import { transactionCurrencyLabels, UserDocument, UserEntity, WishEntity } from 'src/entities'
import { GameStatus } from 'src/entities/santa/santa.types'
import { ChatTelegrafGuard, UserTelegrafGuard, UseSafeGuards } from 'src/guards'
import { getImageBuffer, jsonParse, safeAtob } from 'src/helpers'
import { CustomConfigService, TransactionService, WishService } from 'src/modules'
import { CategoryService } from 'src/modules'
import { GameService } from 'src/modules/games'
import { GameType } from 'src/modules/games/game.types'
import { BucketProvider, BucketSharedService, DefaultBucketProvider } from 'src/services/bucket'
import { ChatTelegrafContextType } from 'src/types'
import { Context } from 'telegraf'
import { SceneContext } from 'telegraf/typings/scenes'

import { SharedService } from '../shared'
import { WISH_CALLBACK_DATA } from './../wish/constants'
import {
  botWelcomeCommandsText,
  botWelcomeUserNameText,
  MAIN_CALLBACK_DATA,
  START_PAYLOAD_KEYS,
  WITHDRAWAL_CALLBACK_DATA,
} from './constants'

@Update()
@Injectable()
export class MainSceneService {
  private bucketService: BucketSharedService

  private logger = new Logger(MainSceneService.name)
  constructor(
    private readonly userEntity: UserEntity,
    private readonly wishEntity: WishEntity,
    private readonly wishService: WishService,
    private readonly sharedService: SharedService,
    private readonly customConfigService: CustomConfigService,
    @Inject(DefaultBucketProvider.bucketName)
    private readonly bucketProvider: BucketProvider,
    private readonly categoryService: CategoryService,
    private readonly gameService: GameService,
    private readonly transactionService: TransactionService,
  ) {
    this.bucketService = new BucketSharedService(this.bucketProvider.bucket, MainSceneService.name)
  }

  private async shareByHash(startPayload: string, userContext: UserDocument) {
    const parsed = safeAtob(startPayload)

    /**
     * id: userId
     * cId: categoryId
     * wId: wishId
     */
    const object = jsonParse<{ id?: string; cId?: string; wId?: string }>(parsed)

    if (object?.id) {
      const sharedUser = await this.userEntity?.get(object.id)

      const isDifferentUsers = sharedUser?.id && sharedUser?.id !== userContext?.id

      return {
        sharedUser: sharedUser,
        isDifferentUsers,
      }
    }

    if (object?.cId) {
      const category = await this.categoryService.getItem(object?.cId)
      const sharedUser = await this.userEntity?.get(category.userId)

      const isDifferentUsers = sharedUser?.id && sharedUser?.id !== userContext?.id

      return {
        sharedUser: sharedUser,
        isDifferentUsers,
        category,
      }
    }

    if (object?.wId) {
      const wish = await this.wishService.getItem(object?.wId)
      const sharedUser = await this.userEntity?.get(wish.userId)

      const isDifferentUsers = sharedUser?.id && sharedUser?.id !== userContext?.id

      return {
        sharedUser: sharedUser,
        isDifferentUsers,
        wish,
      }
    }
  }

  private async checkShareGameAndUse(startPayload: string, userContext: UserDocument, ctx: SceneContext) {
    const isSantaGame = startPayload.includes(START_PAYLOAD_KEYS.santaGame)

    if (isSantaGame) {
      const gameId = startPayload.replace(START_PAYLOAD_KEYS.santaGame, '')
      const game = await this.gameService.getGame(GameType.SANTA, gameId)

      try {
        if (!game) {
          await ctx.reply('Игра "Секретный Санта" не найдена, обратитесь к создателю игры или администратору бота')

          return
        }

        if ([GameStatus.CANCELLED, GameStatus.FINISHED].includes(game.status)) {
          await ctx.reply('Игра "Секретный Санта" уже завершена, обратитесь к создателю игры, если произошла ошибка')

          return
        }

        await this.gameService.addParticipant(GameType.SANTA, userContext.id, game.id)

        await ctx.reply(`Вы успешно добавлены в игру "Секретный Санта", название игры: ${game.name}`, {
          reply_markup: {
            inline_keyboard: [
              [getMainOpenWebAppButton(`${this.customConfigService.miniAppUrl}/game/${game.id}`, 'Посмотреть')],
            ],
          },
        })

        return game
      } catch (error) {
        this.logger.error('Error with add participant to santa game', error)

        if (error.response?.code) {
          await ctx.reply(error.response.message || 'Произошла ошибка при добавлении вас в игру "Секретный Санта"', {
            reply_markup: {
              inline_keyboard: [
                [getMainOpenWebAppButton(`${this.customConfigService.miniAppUrl}/game/${game.id}`, 'Посмотреть')],
              ],
            },
          })

          return
        }

        await ctx.reply('Произошла ошибка при добавлении вас в игру "Секретный Санта", обратитесь к создателю игры')
      }
    }

    return undefined
  }

  private async checkReferralSystem(startPayload: string, userContext: UserDocument, ctx: SceneContext) {
    const user = await this.userEntity.get(userContext?.id)

    if (user?.refferalHash) {
      return
    }

    const isTgReferralSystem = startPayload.includes(START_PAYLOAD_KEYS.tgReferralSystem)

    if (isTgReferralSystem) {
      const referralHash = startPayload

      const payload = this.userEntity.getValidProperties(
        {
          ...userContext,
          refferalHash: referralHash,
        },
        true,
      )

      await this.userEntity.createOrUpdate(payload)

      return
    }

    const isInternalReferralSystem = startPayload.includes(START_PAYLOAD_KEYS.refferalSystem)

    if (isInternalReferralSystem) {
      const referralHash = startPayload
      const referralUserHash = startPayload?.replace(START_PAYLOAD_KEYS.refferalSystem, '')

      const referrerUserId = Buffer.from(referralUserHash, 'base64').toString('utf-8')

      const referrerUser = await this.userEntity.get(referrerUserId)

      if (!referrerUser || referrerUser?.id === userContext?.id) {
        return
      }

      const payload = this.userEntity.getValidProperties({
        ...userContext,
        refferalHash: referralHash,
        refferrerUserId: referrerUser?.id,
        refferalCommission: TRANSACTION_USER_REFFERER_XTR_COMISSION,
      })

      await this.userEntity.createOrUpdate(payload)

      await this.transactionService.sendRefferalSystemBonus(referrerUser, userContext).catch(() => {
        this.logger.error('Error with sendRefferalSystemBonus', {
          referrerUserId: referrerUser?.id,
          invitedUserId: userContext?.id,
        })

        ctx.reply('Произошла ошибка при начислении бонусов за вступление в бот, обратитесь к разработчику бота')
      })

      return
    }

    return
  }

  private async deprecatedSharePayload(startPayload: string, userContext: UserDocument) {
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

    return { isDifferentUsers, sharedUser }
  }

  @Start()
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async startCommand(
    @Ctx() ctx: SceneContext,
    @UserTelegrafContext() userContext: UserDocument,
    @ChatTelegrafContext() chatContext: ChatTelegrafContextType,
  ) {
    const startPayload = (ctx as any)?.startPayload || ''

    let { isDifferentUsers, sharedUser } = await this.deprecatedSharePayload(startPayload?.toLowerCase(), userContext)
    const response = await this.shareByHash(startPayload, userContext)
    isDifferentUsers = sharedUser ? isDifferentUsers : !!response?.isDifferentUsers
    sharedUser = sharedUser ? sharedUser : response?.sharedUser

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

    const sendSharedInfo = async () => {
      const categoryText = response?.category ? ` по категории ${response?.category?.name}` : ''
      const wishText = response?.wish ? `, желание: ${response?.wish?.name?.slice(0, 100)}...` : ''
      const customButtonName = `Открыть${categoryText ? ' список по категории' : ''} ${wishText ? ' желание' : ''}`

      const query = `${categoryText ? `categoryId=${response?.category.id}` : ''}`

      const defaultUrl = `${this.customConfigService.miniAppUrl}/user/${sharedUser?.id}${query ? `?${query}` : ''}`
      const wishUrl = `${this.customConfigService.miniAppUrl}/wish/${response?.wish?.id}${query ? `?${query}` : ''}`

      const finalUrl = response?.wish ? wishUrl : defaultUrl

      await ctx.reply(`Список желаний пользователя: @${sharedUser?.username || sharedUser?.id}${categoryText}`, {
        reply_markup: {
          inline_keyboard: [
            [getMainOpenWebAppButton(finalUrl, customButtonName)],
            [{ callback_data: MAIN_CALLBACK_DATA.menu, text: 'Меню' }],
          ],
        },
        parse_mode: 'HTML',
      })
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
        }, добро пожаловать в бот списка желаний, введите или выберите команду /help, для знакомства с функционалом бота ${
          payload?.username ? '' : botWelcomeUserNameText
        }`,
      )

      await ctx.reply('Давайте добавим новое желание?', {
        reply_markup: {
          inline_keyboard: getStartupMainSceneKeyboard(this.customConfigService.miniAppUrl),
        },
      })

      if (sharedUser && isDifferentUsers) {
        await sendSharedInfo()

        return
      }

      await this.checkShareGameAndUse(startPayload, userContext, ctx)
      await this.checkReferralSystem(startPayload, userContext, ctx)

      return
    }

    if (!user?.username && !!ctx?.from?.username?.toLowerCase()) {
      const payload = this.userEntity.getValidProperties({
        ...user,
        username: ctx?.from?.username?.toLowerCase(),
      })

      this.userEntity.createOrUpdate(payload)
    }

    if (!sharedUser || !isDifferentUsers) {
      await ctx.reply('С возвращением! Чтобы посмотреть возможности бота, можете ввести или выбрать команду /help', {
        reply_markup: {
          inline_keyboard: getMainKeyboards({
            webAppUrl: this.customConfigService.miniAppUrl,
            userRoles: userContext.role,
          }),
        },
      })
    }

    if (sharedUser && isDifferentUsers) {
      await sendSharedInfo()

      return
    }

    await this.checkShareGameAndUse(startPayload, userContext, ctx)
    await this.checkReferralSystem(startPayload, userContext, ctx)
  }

  @Command(MAIN_CALLBACK_DATA.menu)
  @Action(MAIN_CALLBACK_DATA.menu)
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async menu(@Ctx() ctx: SceneContext, @UserTelegrafContext() userContext: UserDocument) {
    await this.sharedService.tryToMutateOrReplyNewContent(ctx, {
      message: '<b>Доступные команды</b>',
      keyboard: getMainKeyboards({
        webAppUrl: this.customConfigService.miniAppUrl,
        userRoles: userContext.role,
      }),
    })
  }

  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  @Help()
  async helpCommand(ctx: Context) {
    await ctx.reply(botWelcomeCommandsText, { parse_mode: 'HTML' })
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
  @Command(MAIN_CALLBACK_DATA.refferalSystem)
  @Action(MAIN_CALLBACK_DATA.refferalSystem)
  async showRefferalSystem(@Ctx() ctx: SceneContext) {
    await this.sharedService.tryToMutateOrReplyNewContent(ctx, {
      message: `<b>Реферальная система</b>

Вы можете зарабатывать внутри бота приглашая новых пользователей!

<b>Условия реферальной системы</b>:
- Если кто-то запустит бота по вашей ссылке, вы получите ${TRANSACTION_NEW_USER_REFFERER_XTR_AMOUNT} ${
        transactionCurrencyLabels['XTR']
      } за каждого пользователя
- При пополнении баланса пользователем, вы получите ${TRANSACTION_USER_REFFERER_XTR_COMISSION}% от суммы пополнения, однако, если пользователь отменит оплату, ваша комиссия так же будет отменена
- Приглашенный пользователь получает на баланс ${TRANSACTION_NEW_USER_XTR_AMOUNT} ${transactionCurrencyLabels['XTR']}

<b>Вывод средств</b>:
- Выводы доступны в валюте ${transactionCurrencyLabels['TON']} (TON), вы всегда можете произвести вывод из бота /${
        WITHDRAWAL_CALLBACK_DATA.runWithdrawal
      }
- Так как депозиты можно возвращать в течении <b>21 дня</b>, то и вывод реферальных средств можно будет осуществить лишь после прохождения этого срока

<i>Условия реферальной системы могут быть изменены в любой момент, без предварительного уведомления. Следите за обновлениями в боте.</i>

<i>Так же прорабатывается реферальный заработок при выполнении доп условий внутри бота.</i>

<b>Альтернативная реферальная система</b>
Бот так же участвует в реферальной системе Telegram, которая позволяет зарабатывать на пополнениях пользователей звездами в любом виде.

<b>Ваша реферальная ссылка на бот</b>: https://t.me/${this.customConfigService.tgBotUsername}?start=${
        START_PAYLOAD_KEYS.refferalSystem
      }${Buffer.from(ctx?.from?.id?.toString() || '').toString('base64')}
`,
      keyboard: [[{ text: 'Меню', callback_data: MAIN_CALLBACK_DATA.menu }]],
    })
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

    const response = await this.wishService.createAndNotifySubscribers(
      { ...userContext, id: Number(userContext?.id) },
      payload,
    )

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
      new Promise<string>((resolve) => {
        fs.readFile('./CHANGELOG.md', 'utf8', (err, data) => {
          if (err) {
            resolve('')
          }

          resolve(data)
        })
      })

    const content = await promise()

    const updates = content.split('======').slice(0, 3)

    const updateText = updates.map((update) => update.replace('======', '').trim()).join('\n\n')

    const text = updateText
      ? `
Список последних трех обновлений бота
______
${updateText}
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
