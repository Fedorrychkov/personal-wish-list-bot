import { Injectable, Logger } from '@nestjs/common'
import { Action, Ctx, Hears, Scene } from 'nestjs-telegraf'
import { backBtn, getMainKeyboards } from 'src/constants'
import { AvailableChatTypes } from 'src/decorator'
import { ChatTelegrafGuard, UseSafeGuards } from 'src/guards'
import { tryToGetUrlOrEmptyString } from 'src/helpers/url'
import { CustomConfigService } from 'src/modules'
import { SharedService } from 'src/scenes/shared'
import { SceneContext } from 'telegraf/typings/scenes'

import { WISH_CALLBACK_DATA, WISH_SCENE_BY_LINK_NAME } from '../constants'

@Scene(WISH_SCENE_BY_LINK_NAME)
@Injectable()
export class WishByLinkSceneService {
  private logger = new Logger(WishByLinkSceneService.name)

  constructor(
    private readonly sharedService: SharedService,
    private readonly customConfigService: CustomConfigService,
  ) {}

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

  /**
   * При получении сообщения в сцене, не подходящего ни под один формат, начинаем процесс с начала
   */
  @Hears(/.*/)
  async onAddByUrl(@Ctx() ctx: SceneContext) {
    const url = tryToGetUrlOrEmptyString(ctx?.text)

    if (!url) {
      await ctx.deleteMessage(ctx?.msgId).catch()
      await ctx
        .reply('Ссылка не распознана, формат домена должен быть вида https://google.com\nПопробуйте другую ссылку', {
          reply_markup: {
            inline_keyboard: [[backBtn]],
          },
        })
        .then((response) => {
          setTimeout(() => {
            ctx?.deleteMessage(response?.message_id).catch()
          }, 1000)
        })

      return
    }

    try {
      await this.sharedService.addWishItemByLink(ctx, { url })
      await ctx.deleteMessage(ctx?.msgId).catch()

      // TODO: Придумать шаг пустой, без сообщений, куда идет продолжение работы с виш листами и без лишних сообщений!
      await ctx.scene.leave()
    } catch (error) {
      this.logger.error('[onAddByUrl]', error, { data: error?.response?.data })
      await ctx.deleteMessage(ctx?.msgId).catch()
      await ctx.reply('Желание не удалось добавить, попробуйте другую ссылку')
    } finally {
      if (!(ctx?.update as any)?.callback_query) {
        await ctx.deleteMessage(ctx?.msgId).catch()
      }
    }
  }
}
