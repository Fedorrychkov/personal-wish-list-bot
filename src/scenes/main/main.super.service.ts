import { Injectable, Logger } from '@nestjs/common'
import { Action, Command, Ctx, Update } from 'nestjs-telegraf'
import { AvailableChatTypes, UserTelegrafContext } from 'src/decorator'
import { CategroyEntity, UserDocument, UserEntity, UserRole, WishEntity, WishStatus } from 'src/entities'
import { ChatTelegrafGuard, UserTelegrafGuard, UseSafeGuards } from 'src/guards'
import { TransactionService } from 'src/modules'
import { SceneContext } from 'telegraf/typings/scenes'

import { SharedService } from '../shared'
import { NEWS_SCENE_NAME, SUPER_ADMIN_CALLBACK_DATA } from './constants'

@Update()
@Injectable()
export class MainSuperService {
  private logger = new Logger(MainSuperService.name)
  constructor(
    private readonly userEntity: UserEntity,
    private readonly wishEntity: WishEntity,
    private readonly sharedService: SharedService,
    private readonly transactionService: TransactionService,
    private readonly categoryEntity: CategroyEntity,
  ) {}

  @Command(SUPER_ADMIN_CALLBACK_DATA.superMenu)
  @Action(SUPER_ADMIN_CALLBACK_DATA.superMenu)
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async superMenu(@Ctx() ctx: SceneContext, @UserTelegrafContext() userContext: UserDocument) {
    const isAdmin = userContext.role.includes(UserRole.ADMIN)

    if (!isAdmin) {
      await this.sharedService.tryToMutateOrReplyNewContent(ctx, {
        message: 'У вас нет прав на это действие',
      })

      return
    }

    await this.sharedService.tryToMutateOrReplyNewContent(ctx, {
      message: '<b>Super Admin Menu</b>',
      keyboard: [
        [{ text: 'Update User Role To User', callback_data: SUPER_ADMIN_CALLBACK_DATA.updateUserRoleToUser }],
        [{ text: 'Update Wish Status To Active', callback_data: SUPER_ADMIN_CALLBACK_DATA.updateWishStatusToActive }],
        [
          {
            text: 'Send News Notification To All Users',
            callback_data: SUPER_ADMIN_CALLBACK_DATA.sendNewsNotificationToAllUsers,
          },
        ],
        [{ text: 'Maximum Username Length', callback_data: SUPER_ADMIN_CALLBACK_DATA.maximumUsernameLength }],
        [{ text: 'Maximum Wishes In Category', callback_data: SUPER_ADMIN_CALLBACK_DATA.maximumWishesInCategory }],
        [
          {
            text: 'Maximum Category Length By User',
            callback_data: SUPER_ADMIN_CALLBACK_DATA.maximumCategoriesListLengthByUser,
          },
        ],
        [{ text: 'User Current Balances List', callback_data: SUPER_ADMIN_CALLBACK_DATA.userCurrentBalancesList }],
        [
          {
            text: 'Platform Balance By Comissions',
            callback_data: SUPER_ADMIN_CALLBACK_DATA.platformBalanceByComissions,
          },
        ],
        [{ text: 'Platform Donates Balance', callback_data: SUPER_ADMIN_CALLBACK_DATA.platformDonatesBalance }],
      ],
    })
  }

  @Command(SUPER_ADMIN_CALLBACK_DATA.userCurrentBalancesList)
  @Action(SUPER_ADMIN_CALLBACK_DATA.userCurrentBalancesList)
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async userCurrentBalancesList(@Ctx() ctx: SceneContext, @UserTelegrafContext() userContext: UserDocument) {
    const isAdmin = userContext.role.includes(UserRole.ADMIN)

    if (!isAdmin) {
      await ctx.reply('У вас нет прав на это действие')

      return
    }

    const users = await this.userEntity.findAll({}, false)

    const txDataByUsers = await Promise.all(
      users.map(async (user) => {
        try {
          const balances = await this.transactionService.balance({ id: Number(user?.id) })

          return {
            ...user,
            balances,
          }
        } catch (error) {
          this.logger.error(error)

          return undefined
        }
      }),
    )

    const filteredUserBalances = txDataByUsers
      .filter(
        (user) =>
          !!user &&
          user?.balances?.some((balance) => !Number.isNaN(Number(balance?.amount)) && Number(balance?.amount) > 0),
      )
      .map((user) => ({
        userId: user?.id,
        userNickName: user?.username,
        userPhone: user?.phone,
        userChatId: user?.chatId,
        userBalances: user?.balances,
      }))
      .sort((a, b) => Number(b?.userBalances?.[0]?.amount || 0) - Number(a?.userBalances?.[0]?.amount || 0))

    const responseForCsv = filteredUserBalances.map((user) => ({
      userId: user?.userId,
      userNickName: user?.userNickName,
      userPhone: user?.userPhone,
      userChatId: user?.userChatId,
      userBalances: user?.userBalances?.map((balance) => `"\r\n${balance?.amount} ${balance?.currency}"`).join(''),
    }))

    await this.sharedService.generateCsvFile(responseForCsv, undefined, {
      ctx,
      filename: 'user_current_balances_list',
      caption: 'Список балансов пользователей',
    })
  }

  @Command(SUPER_ADMIN_CALLBACK_DATA.platformBalanceByComissions)
  @Action(SUPER_ADMIN_CALLBACK_DATA.platformBalanceByComissions)
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async platformBalanceByComissions(@Ctx() ctx: SceneContext, @UserTelegrafContext() userContext: UserDocument) {
    const isAdmin = userContext.role.includes(UserRole.ADMIN)

    if (!isAdmin) {
      await ctx.reply('У вас нет прав на это действие')

      return
    }

    const users = await this.userEntity.findAll({}, false)

    const txDataByUsers = await Promise.all(
      users.map(async (user) => {
        try {
          const balances = await this.transactionService.platformBalanceByComissions({ id: Number(user?.id) })

          return {
            ...user,
            balances,
          }
        } catch (error) {
          this.logger.error(error)

          return undefined
        }
      }),
    )

    const filteredUserBalances = txDataByUsers
      .filter(
        (user) =>
          !!user &&
          user?.balances?.some((balance) => !Number.isNaN(Number(balance?.amount)) && Number(balance?.amount) > 0),
      )
      .map((user) => ({
        userId: user?.id,
        userNickName: user?.username,
        userPhone: user?.phone,
        userChatId: user?.chatId,
        userBalances: user?.balances,
      }))
      .sort((a, b) => Number(b?.userBalances?.[0]?.amount || 0) - Number(a?.userBalances?.[0]?.amount || 0))

    const responseForCsv = filteredUserBalances.map((user) => ({
      userId: user?.userId,
      userNickName: user?.userNickName,
      userPhone: user?.userPhone,
      userChatId: user?.userChatId,
      userBalances: user?.userBalances?.map((balance) => `"\r\n${balance?.amount} ${balance?.currency}"`).join(''),
    }))

    await this.sharedService.generateCsvFile(responseForCsv, undefined, {
      ctx,
      filename: 'platform_balance_by_comissions',
      caption: 'Балансы платформы по комиссиям',
    })
  }

  @Command(SUPER_ADMIN_CALLBACK_DATA.platformDonatesBalance)
  @Action(SUPER_ADMIN_CALLBACK_DATA.platformDonatesBalance)
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async platformDonatesBalance(@Ctx() ctx: SceneContext, @UserTelegrafContext() userContext: UserDocument) {
    const isAdmin = userContext.role.includes(UserRole.ADMIN)

    if (!isAdmin) {
      await ctx.reply('У вас нет прав на это действие')

      return
    }

    const users = await this.userEntity.findAll({}, false)

    const txDataByUsers = await Promise.all(
      users.map(async (user) => {
        try {
          const balances = await this.transactionService.donatesBalance({ id: Number(user?.id) })

          return {
            ...user,
            balances,
          }
        } catch (error) {
          this.logger.error(error)

          return undefined
        }
      }),
    )

    const filteredUserBalances = txDataByUsers
      .filter(
        (user) =>
          !!user &&
          user?.balances?.some((balance) => !Number.isNaN(Number(balance?.amount)) && Number(balance?.amount) > 0),
      )
      .map((user) => ({
        userId: user?.id,
        userNickName: user?.username,
        userPhone: user?.phone,
        userChatId: user?.chatId,
        userBalances: user?.balances,
      }))
      .sort((a, b) => Number(b?.userBalances?.[0]?.amount || 0) - Number(a?.userBalances?.[0]?.amount || 0))

    const responseForCsv = filteredUserBalances.map((user) => ({
      userId: user?.userId,
      userNickName: user?.userNickName,
      userPhone: user?.userPhone,
      userChatId: user?.userChatId,
      userBalances: user?.userBalances?.map((balance) => `"\r\n${balance?.amount} ${balance?.currency}"`).join(''),
    }))

    await this.sharedService.generateCsvFile(responseForCsv, undefined, {
      ctx,
      filename: 'platform_donates_balance',
      caption: 'Балансы донатов платформы',
    })
  }

  @Command(SUPER_ADMIN_CALLBACK_DATA.maximumUsernameLength)
  @Action(SUPER_ADMIN_CALLBACK_DATA.maximumUsernameLength)
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async maximumUsernameLength(@Ctx() ctx: SceneContext, @UserTelegrafContext() userContext: UserDocument) {
    const isAdmin = userContext.role.includes(UserRole.ADMIN)

    if (!isAdmin) {
      await ctx.reply('У вас нет прав на это действие')

      return
    }

    const users = await this.userEntity.findAll({}, false)

    const responseForCsv = users
      .map((user) => ({
        userId: user?.id,
        userNickName: user?.username,
        userPhone: user?.phone,
        userChatId: user?.chatId,
        userNameLength: user?.username?.length || 0,
      }))
      .sort((a, b) => Number(b?.userNameLength || 0) - Number(a?.userNameLength || 0))

    await this.sharedService.generateCsvFile(responseForCsv, undefined, {
      ctx,
      filename: 'maximum_username_length',
      caption: 'Максимальная длина никнейма пользователя',
    })
  }

  @Command(SUPER_ADMIN_CALLBACK_DATA.maximumCategoriesListLengthByUser)
  @Action(SUPER_ADMIN_CALLBACK_DATA.maximumCategoriesListLengthByUser)
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async maximumCategoriesListLengthByUser(@Ctx() ctx: SceneContext, @UserTelegrafContext() userContext: UserDocument) {
    const isAdmin = userContext.role.includes(UserRole.ADMIN)

    if (!isAdmin) {
      await ctx.reply('У вас нет прав на это действие')

      return
    }

    const categories = await this.categoryEntity.findAll({}, false)
    const userIds = [...new Set(categories.map((category) => category?.userId)).values()]

    const users = await Promise.all(
      userIds.map(async (userId) => {
        const user = await this.userEntity.get(userId)

        return user
      }),
    )

    const responseForCsv = users
      ?.map((user) => {
        const userCategories = categories.filter((category) => category?.userId === user?.id)

        return {
          userId: user?.id,
          userNickName: user?.username,
          userPhone: user?.phone,
          userChatId: user?.chatId,
          userCategoriesLength: userCategories?.length || 0,
          privateCategoriesLength: userCategories?.filter((category) => category?.isPrivate)?.length || 0,
        }
      })
      .sort((a, b) => Number(b?.userCategoriesLength || 0) - Number(a?.userCategoriesLength || 0))

    await this.sharedService.generateCsvFile(responseForCsv, undefined, {
      ctx,
      filename: 'maximum_categories_list_length_by_user',
      caption: 'Максимальная длина списка категорий пользователя',
    })
  }

  @Command(SUPER_ADMIN_CALLBACK_DATA.maximumWishesInCategory)
  @Action(SUPER_ADMIN_CALLBACK_DATA.maximumWishesInCategory)
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async maximumWishesInCategory(@Ctx() ctx: SceneContext, @UserTelegrafContext() userContext: UserDocument) {
    const isAdmin = userContext.role.includes(UserRole.ADMIN)

    if (!isAdmin) {
      await ctx.reply('У вас нет прав на это действие')

      return
    }

    const categories = await this.categoryEntity.findAll({}, false)
    const userIds = [...new Set(categories.map((category) => category?.userId)).values()]

    const users = await Promise.all(
      userIds.map(async (userId) => {
        const user = await this.userEntity.get(userId)

        return user
      }),
    )

    const wishesResponse = await Promise.all(
      categories.map(async (category) => {
        const categoryWishes = await this.wishEntity.findAll({ categoryId: category?.id }, false)

        return categoryWishes
      }),
    )

    const filteredWishes = wishesResponse.filter((wishes) => wishes?.length)

    const responseForCsv = categories
      ?.map((category) => {
        const categoryWishes = filteredWishes.find((wishes) => wishes?.[0]?.categoryId === category?.id)
        const user = users.find((user) => user?.id === category?.userId)

        return {
          categoryId: category?.id,
          categoryName: category?.name,
          categoryWishesLength: categoryWishes?.length || 0,
          isPrivate: category?.isPrivate,
          userNickName: user?.username,
          userPhone: user?.phone,
          userChatId: user?.chatId,
        }
      })
      .sort((a, b) => Number(b?.categoryWishesLength || 0) - Number(a?.categoryWishesLength || 0))

    await this.sharedService.generateCsvFile(responseForCsv, undefined, {
      ctx,
      filename: 'maximum_wishes_in_category',
      caption: 'Максимальное количество желаний в категории',
    })
  }

  @Command(SUPER_ADMIN_CALLBACK_DATA.updateUserRoleToUser)
  @Action(SUPER_ADMIN_CALLBACK_DATA.updateUserRoleToUser)
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async updateUserRolesToUser(@Ctx() ctx: SceneContext, @UserTelegrafContext() userContext: UserDocument) {
    const isAdmin = userContext.role.includes(UserRole.ADMIN)

    if (!isAdmin) {
      await ctx.reply('У вас нет прав на это действие')

      return
    }

    const users = await this.userEntity.findAll({}, false)

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

  @Command(SUPER_ADMIN_CALLBACK_DATA.sendNewsNotificationToAllUsers)
  @Action(SUPER_ADMIN_CALLBACK_DATA.sendNewsNotificationToAllUsers)
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

  @Command(SUPER_ADMIN_CALLBACK_DATA.updateWishStatusToActive)
  @Action(SUPER_ADMIN_CALLBACK_DATA.updateWishStatusToActive)
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async updateWishStatusToActive(@Ctx() ctx: SceneContext, @UserTelegrafContext() userContext: UserDocument) {
    const isAdmin = userContext.role.includes(UserRole.ADMIN)

    if (!isAdmin) {
      await ctx.reply('У вас нет прав на это действие')

      return
    }

    const wishes = await this.wishEntity.findAll({}, false)

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
}
