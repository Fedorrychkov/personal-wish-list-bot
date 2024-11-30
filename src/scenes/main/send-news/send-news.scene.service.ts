import { Injectable, Logger } from '@nestjs/common'
import { Action, Ctx, Hears, Scene, SceneEnter } from 'nestjs-telegraf'
import { backBtn, getMainKeyboards } from 'src/constants/keyboards'
import { AvailableChatTypes, UserTelegrafContext } from 'src/decorator'
import { UserDocument, UserEntity, UserRole } from 'src/entities'
import { ChatTelegrafGuard, UserTelegrafGuard, UseSafeGuards } from 'src/guards'
import { CustomConfigService } from 'src/modules'
import { WISH_CALLBACK_DATA } from 'src/scenes/wish'
import { SceneContext } from 'telegraf/typings/scenes'

import { NEWS_SCENE_NAME } from '../constants'

@Scene(NEWS_SCENE_NAME)
@Injectable()
export class SendNewsSceneService {
  private logger = new Logger(SendNewsSceneService.name)

  constructor(private readonly userEntity: UserEntity, private readonly customConfigService: CustomConfigService) {}

  @SceneEnter()
  async enter(@Ctx() ctx: SceneContext) {
    await ctx.reply('Введите текст новости', {
      reply_markup: {
        inline_keyboard: [[backBtn]],
      },
    })
  }

  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard)
  @Action(WISH_CALLBACK_DATA.back)
  async back(@Ctx() ctx: SceneContext) {
    await ctx.reply('<b>Доступные команды</b>', {
      reply_markup: {
        inline_keyboard: getMainKeyboards({ webAppUrl: this.customConfigService.miniAppUrl }),
      },
      parse_mode: 'HTML',
    })

    await ctx.scene.leave()
  }

  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  @Hears(/.*/)
  async sendNewsNotificationToAllUsers(@Ctx() ctx: SceneContext, @UserTelegrafContext() userContext: UserDocument) {
    const isAdmin = userContext.role.includes(UserRole.ADMIN)

    if (!isAdmin) {
      await ctx.reply('У вас нет прав на это действие')

      await ctx.scene.leave()

      return
    }

    const newsText = (ctx?.message as { text?: string })?.text

    if (!newsText) {
      await ctx.reply('Введите текст новости')

      return
    }

    const users = await this.userEntity.findAll({})

    await Promise.all(
      users.map(async (user) => {
        try {
          await ctx.telegram.sendMessage(user.chatId, newsText, {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: getMainKeyboards({ webAppUrl: this.customConfigService.miniAppUrl }),
            },
          })
        } catch (error) {
          this.logger.error(error)
        }
      }),
    )

    await ctx.reply('Новость отправлена всем пользователям')

    await ctx.scene.leave()
  }
}
