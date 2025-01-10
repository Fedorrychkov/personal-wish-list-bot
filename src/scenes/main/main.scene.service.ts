import { Timestamp } from '@google-cloud/firestore'
import { Inject, Injectable, Logger } from '@nestjs/common'
import * as fs from 'fs'
import { Action, Command, Ctx, Help, On, Start, Update } from 'nestjs-telegraf'
import {
  TRANSACTION_DEPOSIT_COMISSION,
  TRANSACTION_DEPOSIT_COMISSION_NUMBER,
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
import {
  transactionCurrencyLabels,
  TransactionProvider,
  TransactionStatus,
  TransactionType,
  UserDocument,
  UserEntity,
  UserRole,
  WishEntity,
  WishStatus,
} from 'src/entities'
import { GameStatus } from 'src/entities/santa/santa.types'
import { ChatTelegrafGuard, UserTelegrafGuard, UseSafeGuards } from 'src/guards'
import { getImageBuffer, jsonParse, safeAtob, time } from 'src/helpers'
import { CustomConfigService, TransactionService, WishService } from 'src/modules'
import { CategoryService } from 'src/modules'
import { GameService } from 'src/modules/games'
import { GameType } from 'src/modules/games/game.types'
import { BucketProvider, BucketSharedService, DefaultBucketProvider } from 'src/services/bucket'
import { ChatTelegrafContextType, SuccessfulPaymentType } from 'src/types'
import { Context } from 'telegraf'
import { SceneContext } from 'telegraf/typings/scenes'

import { SharedService } from '../shared'
import { WISH_CALLBACK_DATA } from './../wish/constants'
import {
  botWelcomeCommandsText,
  botWelcomeUserNameText,
  MAIN_CALLBACK_DATA,
  NEWS_SCENE_NAME,
  START_PAYLOAD_KEYS,
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
        }, добро пожаловать в бот списка желайни, введите или выберите команду /help, для знакомства с функционалом бота ${
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
          inline_keyboard: getMainKeyboards({ webAppUrl: this.customConfigService.miniAppUrl }),
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
    await ctx.reply(
      `
<b>Реферальная система</b>

Вы можете зарабатывать внутри бота, приглашая новых пользователей.

<b>Условия реферальной системы</b>:
- Если кто-то запустит бота по вашей ссылке, вы получите ${TRANSACTION_NEW_USER_REFFERER_XTR_AMOUNT} ${
        transactionCurrencyLabels['XTR']
      } за каждого пользователя
- При пополнении баланса пользователем, вы получите ${TRANSACTION_USER_REFFERER_XTR_COMISSION}% от суммы пополнения, однако, если пользователь отменит оплату, ваша комиссия так же будет отменена
- Приглашенный пользователь получает на баланс ${TRANSACTION_NEW_USER_XTR_AMOUNT} ${transactionCurrencyLabels['XTR']}

<b>Вывод средств</b>:
- На данный момент, автоматический вывод средств не поддерживается, однако, вы можете вывести средства вручную, обратившись к разработчику бота
- Так как депозиты можно возвращать в течении <b>21 дня</b>, то и вывод реферальных средств можно будет осуществить лишь после прохождения этого срока

<i>Условия реферальной системы могут быть изменены в любой момент, без предварительного уведомления. Следите за обновлениями в боте.</i>

<i>Так же прорабатывается реферальный заработок при выполнении доп условий внутри бота.</i>

<b>Альтернативная реферальная система</b>
Бот так же участвует в реферальной системе Telegram, которая позволяет зарабатывать на пополнениях пользователей звездами в любом виде.

<b>Ваша реферальная ссылка на бот</b>: https://t.me/${this.customConfigService.tgBotUsername}?start=${
        START_PAYLOAD_KEYS.refferalSystem
      }${Buffer.from(ctx?.from?.id?.toString() || '').toString('base64')}
`,
      {
        reply_markup: {
          inline_keyboard: getMainKeyboards({ webAppUrl: this.customConfigService.miniAppUrl }),
        },
        parse_mode: 'HTML',
      },
    )
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

  @Command(MAIN_CALLBACK_DATA.updateUserRoleToUser)
  @Action(MAIN_CALLBACK_DATA.updateUserRoleToUser)
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async updateUserRolesToUser(@Ctx() ctx: SceneContext, @UserTelegrafContext() userContext: UserDocument) {
    const isAdmin = userContext.role.includes(UserRole.ADMIN)

    if (!isAdmin) {
      await ctx.reply('У вас нет прав на это действие')

      return
    }

    const users = await this.userEntity.findAll({})

    await Promise.all(
      users.map(async (user) => {
        try {
          if (!user.role.includes(UserRole.ADMIN) || !user?.role?.length) {
            const payload = this.userEntity.getValidProperties(
              {
                ...user,
                role: [UserRole.USER],
              },
              true,
            )

            await this.userEntity.createOrUpdate(payload)
          }
        } catch (error) {
          this.logger.error(error)
        }
      }),
    )

    await ctx.reply('Роли пользователей обновлены до роли USER')
  }

  @Command(MAIN_CALLBACK_DATA.sendNewsNotificationToAllUsers)
  @Action(MAIN_CALLBACK_DATA.sendNewsNotificationToAllUsers)
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async sendNewsNotificationToAllUsers(@Ctx() ctx: SceneContext, @UserTelegrafContext() userContext: UserDocument) {
    const isAdmin = userContext.role.includes(UserRole.ADMIN)

    if (!isAdmin) {
      await ctx.reply('У вас нет прав на это действие')

      return
    }

    await ctx.scene.enter(NEWS_SCENE_NAME)
  }

  @Command(MAIN_CALLBACK_DATA.updateWishStatusToActive)
  @Action(MAIN_CALLBACK_DATA.updateWishStatusToActive)
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async updateWishStatusToActive(@Ctx() ctx: SceneContext, @UserTelegrafContext() userContext: UserDocument) {
    const isAdmin = userContext.role.includes(UserRole.ADMIN)

    if (!isAdmin) {
      await ctx.reply('У вас нет прав на это действие')

      return
    }

    const wishes = await this.wishEntity.findAll({})

    await Promise.all(
      wishes.map(async (wish) => {
        try {
          if (!wish.status) {
            const payload = this.wishEntity.getValidProperties(
              {
                ...wish,
                status: WishStatus.ACTIVE,
              },
              true,
            )

            await this.wishEntity.createOrUpdate(payload)
          }
        } catch (error) {
          this.logger.error(error)
        }
      }),
    )

    await ctx.reply('Статусы желаний обновлены до ACTIVE')
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

  @Command(MAIN_CALLBACK_DATA.paySupport)
  @Action(MAIN_CALLBACK_DATA.paySupport)
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async paySupport(@Ctx() ctx: SceneContext) {
    await ctx.reply(`
В боте желаний есть возможность оплатить что либо при помощи Telegram Stars.

Однако не все оплаты подразумевают возврат средств, но если вы очень хотите вернуть средства - свяжитесь с разработчиком бота.
`)
  }

  @Command(MAIN_CALLBACK_DATA.supportXtr)
  @Action(MAIN_CALLBACK_DATA.supportXtr)
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async supportXtr(@Ctx() ctx: SceneContext) {
    await ctx.reply('Выберите сумму пожертвования. Средства можно вернуть в течении 21 дня', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '50 ⭐️', callback_data: `${MAIN_CALLBACK_DATA.supportWithXtr} 50` }],
          [{ text: '100 ⭐️', callback_data: `${MAIN_CALLBACK_DATA.supportWithXtr} 100` }],
          [{ text: '200 ⭐️', callback_data: `${MAIN_CALLBACK_DATA.supportWithXtr} 200` }],
          [{ text: '500 ⭐️', callback_data: `${MAIN_CALLBACK_DATA.supportWithXtr} 500` }],
          [{ text: '1000 ⭐️', callback_data: `${MAIN_CALLBACK_DATA.supportWithXtr} 1000` }],
        ],
      },
    })
  }

  @Command(MAIN_CALLBACK_DATA.userTopupXtr)
  @Action(MAIN_CALLBACK_DATA.userTopupXtr)
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async userTopupXtr(@Ctx() ctx: SceneContext) {
    await ctx.reply(
      `Выберите сумму пополнения баланса. Средства можно вернуть в течении 21 дня (вместе с комиссией). При оплате, будет удержана комиссия в размере ${TRANSACTION_DEPOSIT_COMISSION}%`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '50 ⭐️', callback_data: `${MAIN_CALLBACK_DATA.userTopupWithXtr} 50` }],
            [{ text: '100 ⭐️', callback_data: `${MAIN_CALLBACK_DATA.userTopupWithXtr} 100` }],
            [{ text: '200 ⭐️', callback_data: `${MAIN_CALLBACK_DATA.userTopupWithXtr} 200` }],
            [{ text: '500 ⭐️', callback_data: `${MAIN_CALLBACK_DATA.userTopupWithXtr} 500` }],
            [{ text: '1000 ⭐️', callback_data: `${MAIN_CALLBACK_DATA.userTopupWithXtr} 1000` }],
          ],
        },
      },
    )
  }

  @Command(MAIN_CALLBACK_DATA.supportWithXtr)
  @Action(new RegExp(MAIN_CALLBACK_DATA.supportWithXtr))
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async supportWithXtr(@Ctx() ctx: SceneContext) {
    const [, amount] = (ctx as any)?.update?.callback_query?.data?.split(' ')

    try {
      if (!amount) {
        await ctx.reply('Не удалось получить сумму оплаты, попробуйте еще раз или обратитесь к разработчику')

        return
      }

      await ctx.replyWithInvoice({
        title: 'Поддержка разработчика',
        description: 'Ваш вклад в развитие бота и на хлеб разработчику. Средства можно вернуть в течении 21 дня',
        payload: 'support_with_xtr',
        provider_token: '',
        prices: [{ label: `Оплатить ${amount} ⭐️`, amount: Number(amount) }],
        currency: 'XTR',
      })
    } catch (error) {
      this.logger.error('Error with support with xtr', error)
      await ctx.reply('Ошибка при обработке оплаты, попробуйте позже')
    }
  }

  @Command(MAIN_CALLBACK_DATA.userTopupWithXtr)
  @Action(new RegExp(MAIN_CALLBACK_DATA.userTopupWithXtr))
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async userTopupWithXtr(@Ctx() ctx: SceneContext) {
    const [, amount] = (ctx as any)?.update?.callback_query?.data?.split(' ')

    try {
      if (!amount) {
        await ctx.reply('Не удалось получить сумму оплаты, попробуйте еще раз или обратитесь к разработчику')

        return
      }

      await ctx.replyWithInvoice({
        title: 'Пополнение баланса',
        description: `Пополнение баланса для использования в боте. К зачислению: ${
          Number(amount) - Number(amount) * TRANSACTION_DEPOSIT_COMISSION_NUMBER
        } ⭐️`,
        payload: 'user_topup_with_xtr',
        provider_token: '',
        prices: [{ label: `Оплатить ${amount} ⭐️`, amount: Number(amount) }],
        currency: 'XTR',
      })
    } catch (error) {
      this.logger.error('Error with support with xtr', error)
      await ctx.reply('Ошибка при обработке оплаты, попробуйте позже')
    }
  }

  @On('pre_checkout_query')
  async preCheckoutQuery(@Ctx() ctx: SceneContext) {
    try {
      const user = await this.userEntity.get(ctx?.from?.id?.toString())
      this.logger.log(ctx?.preCheckoutQuery)

      await ctx
        .answerPreCheckoutQuery(!!user, user ? 'Оплата поддерживается' : 'Оплата не поддерживается')
        .catch((errorData) => {
          this.logger.error('Error with pre checkout query', errorData)
        })
    } catch (error) {
      this.logger.error('Error with pre checkout query', error)
    }
  }

  @On('successful_payment')
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async successfulPayment(@Ctx() ctx: SceneContext) {
    const successfulPayment: SuccessfulPaymentType = (ctx?.message as any)?.successful_payment
    this.logger.log(ctx?.from, ctx?.message, ctx?.update, successfulPayment)

    let type: TransactionType

    if (successfulPayment?.invoice_payload?.indexOf('support_with_xtr') > -1) {
      type = TransactionType.SUPPORT
    }

    if (successfulPayment?.invoice_payload?.indexOf('user_topup_with_xtr') > -1) {
      type = TransactionType.USER_TOPUP
    }

    const response = await this.transactionService.createWithPartialDto({
      userId: ctx?.from?.id?.toString(),
      currency: successfulPayment?.currency,
      status: TransactionStatus.CONFIRMED,
      provider: TransactionProvider.TELEGRAM,
      type,
      amount: successfulPayment?.total_amount?.toString(),
      providerInvoiceId: successfulPayment?.telegram_payment_charge_id,
    })

    try {
      await this.transactionService.canRefund(response.id, response)

      await ctx.reply(
        `
Оплата подтверждена, спасибо за Вашу поддержку!

Вы можете вернуть средства в течении 21 дня после оплаты
`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                getMainOpenWebAppButton(
                  `${this.customConfigService.miniAppUrl}/transaction`,
                  'Открыть список транзакций',
                ),
              ],
              [
                {
                  text: 'Вернуть средства',
                  callback_data: `${MAIN_CALLBACK_DATA.refundTransaction} ${response.id}`,
                },
              ],
            ],
          },
        },
      )
    } catch (error) {
      this.logger.error('Error with successful payment', error)
      await ctx.reply(
        `
Оплата подтверждена, спасибо за Вашу поддержку!

Данную оплату невозможно вернуть, обратитесь к разработчику бота.
`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                getMainOpenWebAppButton(
                  `${this.customConfigService.miniAppUrl}/transaction`,
                  'Открыть список транзакций',
                ),
              ],
            ],
          },
        },
      )
    }
  }

  @Command(MAIN_CALLBACK_DATA.refundTransaction)
  @Action(new RegExp(MAIN_CALLBACK_DATA.refundTransaction))
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async refundTransaction(@Ctx() ctx: SceneContext) {
    const [, id] = (ctx as any)?.update?.callback_query?.data?.split(' ')

    try {
      const refundableInfo = await this.transactionService.canRefund(id)

      await ctx.telegram
        .callApi('refundStarPayment' as any, {
          user_id: Number(ctx?.from?.id),
          telegram_payment_charge_id: refundableInfo?.providerInvoiceId,
        })
        .then(async (response) => {
          this.logger.log('Refund transaction success', {
            response,
            userId: ctx?.from?.id,
            providerInvoiceId: refundableInfo?.providerInvoiceId,
          })

          await this.transactionService.update(id, refundableInfo, {
            status: TransactionStatus.REFUNDED,
            refundedAt: Timestamp.fromDate(time().toDate()),
          })
        })
        .catch((error) => {
          this.logger.error('Error with refund transaction', error, {
            userId: ctx?.from?.id,
            providerInvoiceId: refundableInfo?.providerInvoiceId,
          })

          throw error
        })

      await ctx.reply(
        `
Запрос на возврат средств принят, ожидайте уведомления о результате в боте.

Обычно уведомление приходит моментально и появляется до текущего сообщения.
`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                getMainOpenWebAppButton(
                  `${this.customConfigService.miniAppUrl}/transaction`,
                  'Открыть список транзакций',
                ),
              ],
            ],
          },
        },
      )
    } catch (error) {
      this.logger.error('Error with refund transaction', error)
      await ctx.reply(
        `
Данную оплату невозможно вернуть, обратитесь к разработчику бота, если Вам потребуется возврат средств.

Причина: ${error?.message || 'Внутренняя ошибка сервиса'}
Идентификатор транзакции: ${id}
`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                getMainOpenWebAppButton(
                  `${this.customConfigService.miniAppUrl}/transactions`,
                  'Открыть список транзакций',
                ),
              ],
            ],
          },
        },
      )
    }
  }
}
