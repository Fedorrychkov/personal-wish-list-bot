import { Injectable, Logger } from '@nestjs/common'
import { Action, Ctx, Update } from 'nestjs-telegraf'
import { getMainOpenWebAppButton } from 'src/constants'
import { AvailableChatTypes, UserTelegrafContext } from 'src/decorator'
import { UserDocument, UserEntity } from 'src/entities'
import { GameStatus } from 'src/entities/santa/santa.types'
import { ChatTelegrafGuard, UserTelegrafGuard, UseSafeGuards } from 'src/guards'
import { CustomConfigService } from 'src/modules'
import { GameService } from 'src/modules/games'
import { GameType } from 'src/modules/games/game.types'
import { SceneContext } from 'telegraf/typings/scenes'

import { GAMES_CALLBACK_DATA, SANTA_MESSAGE_SCENE_NAME } from './constants'

@Update()
@Injectable()
export class GamesSceneService {
  private logger = new Logger(GamesSceneService.name)

  constructor(
    private readonly gameService: GameService,
    private readonly customConfigService: CustomConfigService,
    private readonly userEntity: UserEntity,
  ) {}

  @Action(new RegExp(GAMES_CALLBACK_DATA.writeToSantaParticipant))
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async writeToSantaParticipant(@Ctx() ctx: SceneContext, @UserTelegrafContext() userContext: UserDocument) {
    const [, id] = (ctx as any)?.update?.callback_query?.data?.split(' ')

    const game = await this.gameService.getGame(GameType.SANTA, id)

    try {
      if (!game) {
        await ctx.reply('Игра "Секретный Санта" не найдена, обратитесь к создателю игры или администратору бота')

        return
      }

      if ([GameStatus.CANCELLED, GameStatus.FINISHED].includes(game.status)) {
        await ctx.reply('Игра "Секретный Санта" уже завершена, обратитесь к создателю игры, если произошла ошибка')

        return
      }

      const myParticipant = await this.gameService.getMyParticipant(GameType.SANTA, game.id, {
        id: Number(userContext.id),
      })

      if (!myParticipant) {
        await ctx.reply('Мы не смогли найти в этой игре Вашего подопечного, попробуйте обратиться к создателю игры', {
          reply_markup: {
            inline_keyboard: [
              [getMainOpenWebAppButton(`${this.customConfigService.miniAppUrl}/game/${game.id}`, 'Посмотреть')],
            ],
          },
        })

        return
      }

      const user = await this.userEntity.get(myParticipant.recipientUserId)

      await ctx.scene.enter(SANTA_MESSAGE_SCENE_NAME, {
        game,
        chatId: user.chatId,
        startText: '<b>Вам написал Санта!</b>',
        type: 'from-santa',
      })
    } catch (error) {
      this.logger.error('Error with write to santa participant', error)

      if (error.response?.code) {
        await ctx.reply(error.response.message || 'Произошла ошибка при попытке написать подопечному', {
          reply_markup: {
            inline_keyboard: [
              [getMainOpenWebAppButton(`${this.customConfigService.miniAppUrl}/game/${game.id}`, 'Посмотреть')],
            ],
          },
        })

        return
      }

      await ctx.reply('Произошла ошибка при добавлении вас в игру "Секретный Санта", обратитесь к создателю игры')
    }
  }

  @Action(new RegExp(GAMES_CALLBACK_DATA.writeToSanta))
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async writeToSanta(@Ctx() ctx: SceneContext, @UserTelegrafContext() userContext: UserDocument) {
    const [, id] = (ctx as any)?.update?.callback_query?.data?.split(' ')

    const game = await this.gameService.getGame(GameType.SANTA, id)

    try {
      if (!game) {
        await ctx.reply('Игра "Секретный Санта" не найдена, обратитесь к создателю игры или администратору бота')

        return
      }

      if ([GameStatus.CANCELLED, GameStatus.FINISHED].includes(game.status)) {
        await ctx.reply('Игра "Секретный Санта" уже завершена, обратитесь к создателю игры, если произошла ошибка')

        return
      }

      const mySanta = await this.gameService.getMySanta(GameType.SANTA, game.id, {
        id: Number(userContext.id),
      })

      if (!mySanta) {
        await ctx.reply('Мы не смогли найти в этой игре Вашего Санту, попробуйте обратиться к создателю игры', {
          reply_markup: {
            inline_keyboard: [
              [getMainOpenWebAppButton(`${this.customConfigService.miniAppUrl}/game/${game.id}`, 'Посмотреть')],
            ],
          },
        })

        return
      }

      const user = await this.userEntity.get(mySanta.userId)

      await ctx.scene.enter(SANTA_MESSAGE_SCENE_NAME, {
        game,
        chatId: user.chatId,
        startText: '<b>Ваш подопечный ответил!</b>',
        type: 'from-participant',
      })
    } catch (error) {
      this.logger.error('Error with write to santa participant', error)

      if (error.response?.code) {
        await ctx.reply(error.response.message || 'Произошла ошибка при попытке написать подопечному', {
          reply_markup: {
            inline_keyboard: [
              [getMainOpenWebAppButton(`${this.customConfigService.miniAppUrl}/game/${game.id}`, 'Посмотреть')],
            ],
          },
        })

        return
      }

      await ctx.reply('Произошла ошибка при добавлении вас в игру "Секретный Санта", обратитесь к создателю игры')
    }
  }

  @Action(new RegExp(GAMES_CALLBACK_DATA.approveSanta))
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async approveSantaGame(@Ctx() ctx: SceneContext, @UserTelegrafContext() userContext: UserDocument) {
    const [, id] = (ctx as any)?.update?.callback_query?.data?.split(' ')

    const game = await this.gameService.getGame(GameType.SANTA, id)

    try {
      if (!game) {
        await ctx.reply('Игра "Секретный Санта" не найдена, обратитесь к создателю игры или администратору бота')

        return
      }

      if ([GameStatus.CANCELLED, GameStatus.FINISHED].includes(game.status)) {
        await ctx.reply('Игра "Секретный Санта" уже завершена, обратитесь к создателю игры, если произошла ошибка')

        return
      }

      await this.gameService.addParticipant(GameType.SANTA, userContext.id, game.id)

      await ctx.reply(`Вы успешно добавлены в игру "Секретный Санта", название игры: ${game.name}`, {
        reply_markup: {
          inline_keyboard: [
            [getMainOpenWebAppButton(`${this.customConfigService.miniAppUrl}/game/${game.id}`, 'Посмотреть')],
          ],
        },
      })
    } catch (error) {
      this.logger.error('Error with add participant to santa game', error)

      if (error.response?.code) {
        await ctx.reply(error.response.message || 'Произошла ошибка при добавлении вас в игру "Секретный Санта"', {
          reply_markup: {
            inline_keyboard: [
              [getMainOpenWebAppButton(`${this.customConfigService.miniAppUrl}/game/${game.id}`, 'Посмотреть')],
            ],
          },
        })

        return
      }

      await ctx.reply('Произошла ошибка при добавлении вас в игру "Секретный Санта", обратитесь к создателю игры')
    }
  }
}
