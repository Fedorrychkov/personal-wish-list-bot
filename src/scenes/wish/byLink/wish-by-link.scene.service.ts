import { Injectable, Logger } from '@nestjs/common'
import { Ctx, Hears, Scene } from 'nestjs-telegraf'
import { tryToGetUrlOrEmptyString } from 'src/helpers/url'
import { SharedService } from 'src/scenes/shared'
import { SceneContext } from 'telegraf/typings/scenes'

import { WISH_SCENE_BY_LINK_NAME } from '../constants'

@Scene(WISH_SCENE_BY_LINK_NAME)
@Injectable()
export class WishByLinkSceneService {
  private logger = new Logger(WishByLinkSceneService.name)

  constructor(private readonly sharedService: SharedService) {}

  /**
   * При получении сообщения в сцене, не подходящего ни под один формат, начинаем процесс с начала
   */
  @Hears(/.*/)
  async onAddByUrl(@Ctx() ctx: SceneContext) {
    const url = tryToGetUrlOrEmptyString(ctx?.text)

    // this.logger.log({ ctx })

    if (!url) {
      await ctx.reply(
        'Ссылка не распознана, формат домена должен быть вида https://google.com\nПопробуйте другую ссылку',
      )

      return
    }

    try {
      // TODO: Сделать разную логику парсинга тайтла и описания для разных сайтов (например у вайлбериса брать текст из описания для тайтла)
      await this.sharedService.addWishItemByLink(ctx, { url })

      // TODO: Придумать шаг пустой, без сообщений, куда идет продолжение работы с виш листами и без лишних сообщений!
      await ctx.scene.leave()
    } catch (error) {
      this.logger.error('[onAddByUrl]', error, { data: error?.response?.data })
      await ctx.reply('Элемент не удалось добавить, попробуйте другую ссылку')
    }
  }
}
