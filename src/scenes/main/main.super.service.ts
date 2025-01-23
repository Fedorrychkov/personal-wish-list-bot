import { Injectable, Logger } from '@nestjs/common'
import { Action, Command, Ctx, Update } from 'nestjs-telegraf'
import { AvailableChatTypes, UserTelegrafContext } from 'src/decorator'
import { UserDocument, UserEntity, UserRole, WishEntity, WishStatus } from 'src/entities'
import { ChatTelegrafGuard, UserTelegrafGuard, UseSafeGuards } from 'src/guards'
import { SceneContext } from 'telegraf/typings/scenes'

import { MAIN_CALLBACK_DATA, NEWS_SCENE_NAME } from './constants'

@Update()
@Injectable()
export class MainSuperService {
  private logger = new Logger(MainSuperService.name)
  constructor(private readonly userEntity: UserEntity, private readonly wishEntity: WishEntity) {}

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
}
