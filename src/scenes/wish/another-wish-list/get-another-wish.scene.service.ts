import { Injectable, Logger } from '@nestjs/common'
import { Ctx, Hears, Scene, SceneEnter } from 'nestjs-telegraf'
import { getMainOpenWebAppButton, getSceneNavigationKeyboard } from 'src/constants/keyboards'
import { AvailableChatTypes } from 'src/decorator'
import { UserEntity } from 'src/entities'
import { ChatTelegrafGuard, UseSafeGuards } from 'src/guards'
import { CustomConfigService } from 'src/modules'
import { MAIN_CALLBACK_DATA } from 'src/scenes/main/constants'
import { SceneContext } from 'telegraf/typings/scenes'

import { WISH_SCENE_GET_WISH_LIST_BY_USERNAME_SCENE } from '../constants'

@Scene(WISH_SCENE_GET_WISH_LIST_BY_USERNAME_SCENE)
@Injectable()
export class GetAnotherWishListByUserNameceneService {
  private logger = new Logger(GetAnotherWishListByUserNameceneService.name)

  constructor(private readonly userEntity: UserEntity, private readonly customConfigService: CustomConfigService) {}

  @SceneEnter()
  async enter(@Ctx() ctx: SceneContext) {
    const state = (ctx.scene?.state || { wish: undefined }) as { messageId: number }
    const { messageId } = state || {}
    await ctx.telegram.editMessageText(ctx.chat.id, messageId, '0', 'Введите никнейм для поиска, например @muzltoff')
  }

  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard)
  @Hears(/.*/)
  async getAnotherWishList(@Ctx() ctx: SceneContext) {
    const sharedUserName = (ctx?.text || '')?.trim?.()?.toLowerCase?.()?.replace?.('@', '') || ''

    ctx?.deleteMessage(ctx?.msgId)?.catch()

    if (!sharedUserName) {
      await ctx
        .reply('Произошла ошибка получения никнейма, попробуйте ввести еще раз, в формате @username', {
          reply_markup: {
            inline_keyboard: getSceneNavigationKeyboard({ webAppUrl: this.customConfigService.miniAppUrl }),
          },
        })
        .then((response) => {
          setTimeout(() => {
            ctx?.deleteMessage(response?.message_id)?.catch()
          }, 1000)
        })

      return
    }

    if (sharedUserName.length > 600) {
      await ctx
        .reply('Никнейм не должен превышать 600 символов', {
          reply_markup: {
            inline_keyboard: getSceneNavigationKeyboard({ webAppUrl: this.customConfigService.miniAppUrl }),
          },
        })
        .then((response) => {
          setTimeout(() => {
            ctx?.deleteMessage(response?.message_id)?.catch()
          }, 1000)
        })

      return
    }

    const [sharedUser] = sharedUserName ? await this.userEntity?.findAll({ username: sharedUserName }) : []

    if (!sharedUser) {
      await ctx.reply(
        `Пользователя по никнейму: ${ctx?.text} нет в системе, попробуйте ввести другой никнейм, либо проверьте корректность никнейма`,
        {
          reply_markup: {
            inline_keyboard: getSceneNavigationKeyboard({ webAppUrl: this.customConfigService.miniAppUrl }),
          },
        },
      )

      return
    }

    if (sharedUser) {
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

      await ctx.scene.leave()

      return
    }

    await ctx.scene.leave()
  }
}
