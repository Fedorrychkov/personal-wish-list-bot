import { Injectable, Logger } from '@nestjs/common'
import { Action, Ctx, Hears, On, Scene, SceneEnter } from 'nestjs-telegraf'
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
  private photoCache: Map<string, any[]> = new Map()

  constructor(private readonly userEntity: UserEntity, private readonly customConfigService: CustomConfigService) {}

  @SceneEnter()
  async enter(@Ctx() ctx: SceneContext) {
    await ctx.reply('Введите текст новости, так же можно прикрепить фотографии', {
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

  @On('photo')
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async sendNewsNotificationToAllUsersWithPhotos(
    @Ctx() ctx: SceneContext,
    @UserTelegrafContext() userContext: UserDocument,
  ) {
    const isAdmin = userContext.role.includes(UserRole.ADMIN)

    if (!isAdmin) {
      await ctx.reply('У вас нет прав на это действие')

      await ctx.scene.leave()

      return
    }

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
        await ctx.reply('Введите текст новости')

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
        await ctx.reply('Введите текст новости')

        return
      }

      // Если одиночное фото, отправляем сразу
      await this.sendNewsToUsers(ctx, [largestPhoto], newsText)
    }
  }

  private async sendNewsToUsers(ctx: SceneContext, photos: any[], newsText?: string) {
    if (!newsText) {
      await ctx.reply('Введите текст новости')

      return
    }

    const users = await this.userEntity.findAll({})

    await Promise.all(
      users.map(async (user) => {
        try {
          if (photos.length > 0) {
            await ctx.telegram.sendMediaGroup(
              user.chatId,
              photos.map((photo) => ({
                type: 'photo',
                media: photo.file_id as string,
              })),
            )
          }

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
