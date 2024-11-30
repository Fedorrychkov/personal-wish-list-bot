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

      const user = await this.userEntity.get(update?.from?.id?.toString() || update?.message?.from?.id?.toString())

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
