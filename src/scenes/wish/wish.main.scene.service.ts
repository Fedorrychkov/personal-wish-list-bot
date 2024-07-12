import { Injectable, Logger } from '@nestjs/common'
import { Action, Command, Ctx, Hears, Update } from 'nestjs-telegraf'
import { AvailableChatTypes, UserTelegrafContext } from 'src/decorator'
import { UserDocument, UserEntity, WishEntity } from 'src/entities'
import { ChatTelegrafGuard, UserTelegrafGuard, UseSafeGuards } from 'src/guards'
import { tryToGetUrlOrEmptyString } from 'src/helpers/url'
import { SceneContext } from 'telegraf/typings/scenes'

import { SharedService } from '../shared'
import { WISH_CALLBACK_DATA, WISH_SCENE_BY_LINK_NAME, WISH_SCENE_GET_WISH_LIST_BY_USERNAME_SCENE } from './constants'

@Update()
@Injectable()
export class WishMainSceneService {
  private readonly logger = new Logger(WishMainSceneService.name)
  constructor(
    private readonly wishEntity: WishEntity,
    private readonly userEntity: UserEntity,
    private readonly sharedService: SharedService,
  ) {}

  @Command(WISH_CALLBACK_DATA.addNewByLink)
  @Action(WISH_CALLBACK_DATA.addNewByLink)
  async addNewByLink(@Ctx() ctx: SceneContext) {
    const text =
      'Пришлите в ответном сообщении ссылку на желание.\nПостараюсь добавить его в ваш список с автозаполнением (Название, Описание и картинка).\nЕсли что-то пойдет не так, вы всегда сможете отредактировать желание в ручную'
    const options = {
      reply_markup: {
        inline_keyboard: [[{ text: 'Назад', callback_data: WISH_CALLBACK_DATA.openWishScene }]],
      },
    }

    if ((ctx as any)?.update?.callback_query?.message?.from?.is_bot) {
      await ctx.editMessageText(text, options)
    } else {
      await ctx.reply(text, options)
    }

    await ctx.scene.enter(WISH_SCENE_BY_LINK_NAME)
  }

  @Action(new RegExp(WISH_CALLBACK_DATA.get_another_user_wish_list_by_nickname))
  async getAnotherUserWishListByNickname(@Ctx() ctx: SceneContext) {
    await ctx.scene.enter(WISH_SCENE_GET_WISH_LIST_BY_USERNAME_SCENE, { messageId: ctx?.msgId })
  }

  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard)
  @Command(WISH_CALLBACK_DATA.getAllWishList)
  @Action(WISH_CALLBACK_DATA.getAllWishList)
  async getAllWishList(@Ctx() ctx: SceneContext) {
    const userId = `${ctx.from.id}`

    const items = await this.wishEntity.findAll({ userId })

    await this.sharedService.showWishList(ctx, items)
  }

  @Command(new RegExp(WISH_CALLBACK_DATA.get_another_user_wish_list_by_id))
  @Action(new RegExp(WISH_CALLBACK_DATA.get_another_user_wish_list_by_id))
  async getAllUserWishList(@Ctx() ctx: SceneContext) {
    const [, id] = (ctx as any)?.update?.callback_query?.data?.split(' ')

    const [items, user] = await Promise.all([this.wishEntity.findAll({ userId: id }), this.userEntity.get(id)])

    await this.sharedService.showWishList(ctx, items, user)
  }

  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  @Hears(/.*/)
  async onAnyAnswer(@Ctx() ctx: SceneContext, @UserTelegrafContext() userContext: UserDocument) {
    const url = tryToGetUrlOrEmptyString(ctx?.text)

    ctx?.deleteMessage(ctx?.msgId)?.catch()

    if (!url) {
      await ctx
        .reply('Команда не распознана, чтобы добавить новое желание, пришлите ссылку или нажмите на кнопку или /menu', {
          reply_markup: {
            inline_keyboard: [[{ text: 'Желания', callback_data: WISH_CALLBACK_DATA.openWishScene }]],
          },
        })
        .then((response) => {
          setTimeout(() => {
            ctx?.deleteMessage(response?.message_id)?.catch()
          }, 1000)
        })

      return
    }

    try {
      await this.sharedService.addWishItemByLink(ctx, { url }, userContext)
    } catch (error) {
      this.logger.error('[onAddByUrl]', error, { data: error?.response?.data })
      await ctx.reply('Желание не удалось добавить, попробуйте другую ссылку')?.then((response) => {
        setTimeout(() => {
          ctx?.deleteMessage(response?.message_id)?.catch()
        }, 1000)
      })
    }
  }
}
