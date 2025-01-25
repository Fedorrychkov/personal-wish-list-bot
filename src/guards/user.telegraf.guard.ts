import { ExecutionContext, Inject, Logger } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { TelegrafExecutionContext } from 'nestjs-telegraf'
import { UserEntity, UserRole } from 'src/entities'
import { TelegrafUpdateType } from 'src/types'
import { Context } from 'telegraf'

import { SafeGuardInterceptor } from './safe.guard.interceptor'

/**
 * Гвард нужен для:
 * - Вытаскивание пользователя из контекста из базы данных или телеграм
 * - Проверяет роль пользователя
 */
export class UserTelegrafGuard extends SafeGuardInterceptor {
  private readonly logger = new Logger(UserTelegrafGuard.name)

  constructor(@Inject(Reflector) private reflector: Reflector, @Inject(UserEntity) private userEntity: UserEntity) {
    super()
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const ctx = TelegrafExecutionContext.create(context)
      const telegrafCtx = ctx.getContext<Context>()
      const update = ((telegrafCtx as any)?.update?.callback_query || telegrafCtx?.update) as TelegrafUpdateType

      const request = context.switchToHttp().getRequest()

      let user = await this.userEntity.get(update?.from?.id?.toString() || update?.message?.from?.id?.toString())

      /**
       * При любом взаимодействии с ботом, если юзернейм пользователя не совпадает с юзернеймом в базе данных, то обновляем юзернейм в базе данных
       */
      if (user) {
        if (!!update?.from?.username && user?.username?.toLowerCase() !== update?.from?.username?.toLowerCase()) {
          const message = `changed username: from: ${user.username} to: ${update?.from?.username?.toLowerCase()}`
          const statusMessage = user.statusMessage ? `${user.statusMessage} => ${message}` : message

          const newPayload = this.userEntity.getValidProperties(
            {
              ...user,
              username: update?.from?.username?.toLowerCase(),
              statusMessage,
            },
            true,
          )

          this.userEntity.createOrUpdate(newPayload)

          user = newPayload
        }

        /**
         * Если сменился статус премиума
         */
        if (user?.isPremium !== update?.from?.is_premium) {
          const message = `changed isPremium: from: ${user.isPremium} to: ${update?.from?.is_premium}`
          const statusMessage = user.statusMessage ? `${user.statusMessage} => ${message}` : message

          const newPayload = this.userEntity.getValidProperties(
            {
              ...user,
              isPremium: update?.from?.is_premium,
              statusMessage,
            },
            true,
          )

          this.userEntity.createOrUpdate(newPayload)

          user = newPayload
        }

        /**
         * Если сменился язык пользователя
         */
        if (update?.from?.language_code && user?.languageCode !== update?.from?.language_code) {
          const message = `changed languageCode: from: ${user.languageCode} to: ${update?.from?.language_code}`
          const statusMessage = user.statusMessage ? `${user.statusMessage} => ${message}` : message

          const newPayload = this.userEntity.getValidProperties(
            {
              ...user,
              languageCode: update?.from?.language_code,
              statusMessage,
            },
            true,
          )

          this.userEntity.createOrUpdate(newPayload)

          user = newPayload
        }
      }

      const from = update?.from || update?.message?.from

      const validContextUser = this.userEntity.getValidProperties({
        id: from?.id?.toString(),
        firstName: from?.first_name,
        lastName: from?.last_name,
        username: from?.username?.toLowerCase(),
        isPremium: from?.is_premium,
        chatId: from?.id?.toString(),
        role: [UserRole.USER],
      })

      request.userContext = user ? user : validContextUser

      return true
    } catch (error) {
      this.logger.error(error)

      return false
    }
  }
}
