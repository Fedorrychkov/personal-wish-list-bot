import { Injectable, Logger } from '@nestjs/common'
import { Ctx, Hears, Scene, SceneEnter } from 'nestjs-telegraf'
import { getMainKeyboards, getSceneNavigationKeyboard } from 'src/constants/keyboards'
import { UserEntity, WishEntity } from 'src/entities'
import { CustomConfigService } from 'src/modules'
import { SharedService } from 'src/scenes/shared'
import { SceneContext } from 'telegraf/typings/scenes'

import { WISH_SCENE_GET_WISH_LIST_BY_USERNAME_SCENE } from '../constants'

@Scene(WISH_SCENE_GET_WISH_LIST_BY_USERNAME_SCENE)
@Injectable()
export class GetAnotherWishListByUserNameceneService {
  private logger = new Logger(GetAnotherWishListByUserNameceneService.name)

  constructor(
    private readonly sharedService: SharedService,
    private readonly userEntity: UserEntity,
    private readonly wishEntity: WishEntity,
    private readonly customConfigService: CustomConfigService,
  ) {}

  @SceneEnter()
  async enter(@Ctx() ctx: SceneContext) {
    const state = (ctx.scene?.state || { wish: undefined }) as { messageId: number }
    const { messageId } = state || {}
    await ctx.telegram.editMessageText(ctx.chat.id, messageId, '0', 'Введите никнейм для поиска, например @muzltoff')
  }

  @Hears(/.*/)
  async getAnotherWishList(@Ctx() ctx: SceneContext) {
    const sharedUserName = (ctx?.text || '')?.trim?.()?.toLowerCase?.()?.replace?.('@', '') || ''

    if (!sharedUserName) {
      await ctx.reply('Произошла ошибка получения никнейма, попробуйте ввести еще раз, в формате @username', {
        reply_markup: {
          inline_keyboard: getSceneNavigationKeyboard({ webAppUrl: this.customConfigService.miniAppUrl }),
        },
      })

      return
    }

    if (sharedUserName.length > 600) {
      await ctx.reply('Никнейм не должен превышать 600 символов', {
        reply_markup: {
          inline_keyboard: getSceneNavigationKeyboard({ webAppUrl: this.customConfigService.miniAppUrl }),
        },
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

    const handleGetSharedUserWishList = async () => {
      const items = await this.wishEntity.findAll({ userId: sharedUser?.id })

      return items
    }

    if (sharedUser) {
      const items = await handleGetSharedUserWishList()

      if (!items?.length) {
        await ctx?.reply(`Список желаний пользователя с ником ${ctx?.text} пуст`, {
          reply_markup: {
            inline_keyboard: getMainKeyboards({ webAppUrl: this.customConfigService.miniAppUrl }),
          },
        })

        return
      }

      await this.sharedService.showWishList(ctx, items, sharedUser)

      return
    }

    await ctx.scene.leave()
  }
}
