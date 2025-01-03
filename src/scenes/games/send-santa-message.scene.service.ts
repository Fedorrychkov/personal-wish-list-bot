import { Injectable, Logger } from '@nestjs/common'
import { Action, Ctx, Hears, On, Scene, SceneEnter } from 'nestjs-telegraf'
import { backBtn, getMainKeyboards, getMainOpenWebAppButton } from 'src/constants/keyboards'
import { AvailableChatTypes } from 'src/decorator'
import { ChatTelegrafGuard, UserTelegrafGuard, UseSafeGuards } from 'src/guards'
import { CustomConfigService } from 'src/modules'
import { GameResponse } from 'src/modules/games/game.types'
import { WISH_CALLBACK_DATA } from 'src/scenes/wish'
import { SceneContext } from 'telegraf/typings/scenes'

import { GAMES_CALLBACK_DATA, SANTA_MESSAGE_SCENE_NAME } from './constants'

@Scene(SANTA_MESSAGE_SCENE_NAME)
@Injectable()
export class SendSantaMessageSceneService {
  private logger = new Logger(SendSantaMessageSceneService.name)
  private photoCache: Map<string, any[]> = new Map()

  constructor(private readonly customConfigService: CustomConfigService) {}

  @SceneEnter()
  async enter(@Ctx() ctx: SceneContext) {
    await ctx.reply('Введите текст сообщения, так же можно прикрепить фотографии', {
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
  async sendSantaMessage(@Ctx() ctx: SceneContext) {
    const state = ctx.scene?.state as {
      game: GameResponse | undefined
      chatId: number
      startText: string
      type: 'from-santa' | 'from-participant'
    }
    const { game, chatId, startText, type } = state || {}

    const newsText = (ctx?.message as { text?: string })?.text

    if (!newsText) {
      await ctx.reply('Введите текст')

      return
    }

    try {
      await ctx.telegram.sendMessage(chatId, `${startText}\n\n${newsText}`, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [getMainOpenWebAppButton(`${this.customConfigService.miniAppUrl}/game/${game.id}`, 'Игра')],
            [
              {
                text: 'Ответить',
                callback_data:
                  type === 'from-santa'
                    ? `${GAMES_CALLBACK_DATA.writeToSanta} ${game.id}`
                    : `${GAMES_CALLBACK_DATA.writeToSantaParticipant} ${game.id}`,
              },
            ],
          ],
        },
      })
    } catch (error) {
      this.logger.error(error)

      await ctx.reply('Произошла ошибка при отправке сообщения')
      await ctx.scene.leave()

      return
    }

    await ctx.reply('Сообщение успешно доставлено')

    await ctx.scene.leave()
  }

  @On('photo')
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async sendNewsNotificationToAllUsersWithPhotos(@Ctx() ctx: SceneContext) {
    const photos = (ctx?.message as { photo?: any[] })?.photo || []
    const mediaGroupId = (ctx?.message as { media_group_id?: string })?.media_group_id

    // Берем версию с максимальным размером файла
    const largestPhoto = photos.reduce((prev, current) => (prev.file_size > current.file_size ? prev : current))

    if (mediaGroupId) {
      // Если это группа фотографий, сохраняем в кеш
      const groupPhotos = this.photoCache.get(mediaGroupId) || []

      groupPhotos.push(largestPhoto)
      this.photoCache.set(mediaGroupId, groupPhotos)

      const newsText = (ctx?.message as { caption?: string })?.caption

      if (!newsText) {
        return
      }

      // Ждем небольшую паузу, чтобы собрать все фото из группы
      setTimeout(async () => {
        const photos = this.photoCache.get(mediaGroupId) || []

        await this.sendNewsToUsers(ctx, photos, newsText)
        this.photoCache.delete(mediaGroupId)
      }, 1000)
    } else {
      const newsText = (ctx?.message as { caption?: string })?.caption

      if (!newsText) {
        return
      }

      // Если одиночное фото, отправляем сразу
      await this.sendNewsToUsers(ctx, [largestPhoto], newsText)
    }
  }

  private async sendNewsToUsers(ctx: SceneContext, photos: any[], newsText?: string) {
    if (!newsText) {
      await ctx.reply('Введите текст')

      return
    }

    const state = ctx.scene?.state as {
      game: GameResponse | undefined
      chatId: number
      startText: string
      type: 'from-santa' | 'from-participant'
    }
    const { game, chatId, startText, type } = state || {}

    try {
      if (photos.length > 0) {
        await ctx.telegram.sendMediaGroup(
          chatId,
          photos.map((photo) => ({
            type: 'photo',
            media: photo.file_id as string,
          })),
        )
      }

      await ctx.telegram.sendMessage(chatId, `${startText}\n\n${newsText}`, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [getMainOpenWebAppButton(`${this.customConfigService.miniAppUrl}/game/${game.id}`, 'Игра')],
            [
              {
                text: 'Ответить',
                callback_data:
                  type === 'from-santa'
                    ? `${GAMES_CALLBACK_DATA.writeToSanta} ${game.id}`
                    : `${GAMES_CALLBACK_DATA.writeToSantaParticipant} ${game.id}`,
              },
            ],
          ],
        },
      })
    } catch (error) {
      this.logger.error(error)

      await ctx.reply('Произошла ошибка при отправке сообщения')
      await ctx.scene.leave()

      return
    }

    await ctx.reply('Сообщение успешно доставлено')

    await ctx.scene.leave()
  }
}
