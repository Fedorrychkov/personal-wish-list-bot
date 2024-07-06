import { ExecutionContext, Inject, Logger } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { TelegrafExecutionContext } from 'nestjs-telegraf'
import { botWelcomeCommandsText } from 'src/scenes/main/constants'
import { ChatTelegrafContextType, TelegrafUpdateType } from 'src/types'
import { Context } from 'telegraf'

import { SafeGuardInterceptor } from './safe.guard.interceptor'

export class ChatTelegrafGuard extends SafeGuardInterceptor {
  private readonly logger = new Logger(ChatTelegrafGuard.name)

  constructor(@Inject(Reflector) private reflector: Reflector) {
    super()
  }

  canActivate(context: ExecutionContext): boolean {
    const ctx = TelegrafExecutionContext.create(context)
    const telegrafCtx = ctx.getContext<Context>()
    const update = ((telegrafCtx as any)?.update?.callback_query || telegrafCtx?.update) as TelegrafUpdateType

    const isEditableAvailable = !!(telegrafCtx as any)?.update?.callback_query

    const chatType = update?.message?.chat?.type || ''

    const chatTypes = this.reflector?.get<string[]>('chatTypes', context.getHandler())

    if (chatTypes && !chatTypes.includes(chatType)) {
      telegrafCtx
        .reply(`Эта команда не работает в данном типе чата, разрешено использование в ${chatTypes?.join(', ')}`)
        .then((response) => {
          setTimeout(() => {
            telegrafCtx?.deleteMessage(response?.message_id)
          }, 5000)
        })

      this.logger.error(`Chat type is forbidden, available ${chatTypes?.join(', ')}`)

      return false
    }

    if (!['private'].includes(chatType)) {
      telegrafCtx
        .reply(
          `
Извините, но бот пока умеет работать только в режиме личной переписки
${botWelcomeCommandsText}\nДля корректной работы перейдите в личку бота`,
        )
        .then((response) => {
          setTimeout(() => {
            telegrafCtx?.deleteMessage(response?.message_id)
          }, 5000)
        })

      this.logger.error('Chat type is forbidden')

      return false
    }

    const request = context.switchToHttp().getRequest()

    const chat = update?.message?.chat
    const replyMessage = update?.message?.reply_to_message

    const from = update?.from || update?.message?.from

    request.chatContext = {
      type: chat?.type,
      isChatWithTopics: chat?.is_forum || replyMessage?.is_topic_message,
      threadMessageId: replyMessage?.message_thread_id,
      currentMessageId: replyMessage?.message_id,
      from: from,
      chat: update?.message?.chat,
      isEditableAvailable,
    } as ChatTelegrafContextType

    return true
  }
}
