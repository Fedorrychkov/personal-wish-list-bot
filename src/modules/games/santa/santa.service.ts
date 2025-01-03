import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { isNil } from 'lodash'
import { getMainOpenWebAppButton } from 'src/constants'
import { SantaEntity, SantaPlayerEntity, UserEntity } from 'src/entities'
import { GameStatus, SantaFilter } from 'src/entities/santa/santa.types'
import { ERROR_CODES } from 'src/errors'
import { CustomConfigService } from 'src/modules/config'
import { GAMES_CALLBACK_DATA } from 'src/scenes/games/constants'
import { TelegrafCustomService } from 'src/services'
import { TgInitUser } from 'src/types'

import { ShareGameWithParticipantDto, UpdateGameDto } from '../dto'
import { GameParticipant, GameResponse, GameType } from '../game.types'
import { CreateSantaGameDto } from './santa.types'

@Injectable()
export class SantaService {
  private readonly logger = new Logger(SantaService.name)

  constructor(
    private readonly santaEntity: SantaEntity,
    private readonly santaPlayerEntity: SantaPlayerEntity,
    private readonly telegrafCustomService: TelegrafCustomService,
    private readonly userEntity: UserEntity,
    private readonly customConfigService: CustomConfigService,
  ) {}

  async createGame(params: CreateSantaGameDto, userContext: TgInitUser): Promise<GameResponse> {
    const { name } = params

    const gameList = await this.santaEntity.findAll({
      userId: userContext.id?.toString(),
    })

    const gameName = name || `Тайный санта #${gameList?.length + 1}`

    const santa = await this.santaEntity.createOrUpdate(
      this.santaEntity.getValidProperties({
        userId: userContext.id?.toString(),
        name: gameName,
      }),
    )

    await this.santaPlayerEntity.createOrUpdate(
      this.santaPlayerEntity.getValidProperties({
        userId: userContext.id?.toString(),
        santaGameId: santa.id,
        isSantaConfirmed: true,
      }),
    )

    return Object.assign(santa, { type: GameType.SANTA, name: gameName })
  }

  async getGameParticipants(id: string): Promise<GameParticipant[]> {
    const participants = await this.santaPlayerEntity.findAll({
      santaGameId: id,
    })

    return participants.map((participant) => ({
      id: participant.id,
      userId: participant.userId,
      gameId: participant.santaGameId,
      type: GameType.SANTA,
      isGameConfirmed: participant.isSantaConfirmed,
      isGameFinished: participant.isGameFinished,
      createdAt: participant.createdAt,
      updatedAt: participant.updatedAt,
    }))
  }

  async getMyParticipant(id: string, user: TgInitUser): Promise<GameParticipant> {
    const participants = await this.santaPlayerEntity.findAll({
      santaGameId: id,
    })

    return participants
      .map((participant) => ({
        id: participant.id,
        userId: participant.userId,
        gameId: participant.santaGameId,
        type: GameType.SANTA,
        isGameConfirmed: participant.isSantaConfirmed,
        isGameFinished: participant.isGameFinished,
        recipientUserId: participant.santaRecipientUserId,
        createdAt: participant.createdAt,
        updatedAt: participant.updatedAt,
      }))
      .find((participant) => participant.userId === user.id?.toString())
  }

  async getMySanta(id: string, user: TgInitUser): Promise<GameParticipant> {
    const participants = await this.santaPlayerEntity.findAll({
      santaGameId: id,
    })

    return participants
      .map((participant) => ({
        id: participant.id,
        userId: participant.userId,
        gameId: participant.santaGameId,
        type: GameType.SANTA,
        isGameConfirmed: participant.isSantaConfirmed,
        isGameFinished: participant.isGameFinished,
        recipientUserId: participant.santaRecipientUserId,
        createdAt: participant.createdAt,
        updatedAt: participant.updatedAt,
      }))
      .find((participant) => participant.recipientUserId === user.id?.toString())
  }

  async getGame(id: string): Promise<GameResponse> {
    const santa = await this.santaEntity.get(id)

    if (!santa) {
      throw new NotFoundException({
        code: ERROR_CODES.game.codes.GAME_NOT_FOUND,
        message: ERROR_CODES.game.messages.GAME_NOT_FOUND,
      })
    }

    return Object.assign(santa, { type: GameType.SANTA, name: santa.name })
  }

  async mutateGame(id: string, user: TgInitUser, dto: UpdateGameDto): Promise<GameResponse> {
    const { data: santa, doc } = await this.santaEntity.getUpdate(id)

    if (!santa) {
      throw new NotFoundException({
        code: ERROR_CODES.game.codes.GAME_NOT_FOUND,
        message: ERROR_CODES.game.messages.GAME_NOT_FOUND,
      })
    }

    if (santa.userId !== user.id?.toString()) {
      throw new ForbiddenException({
        code: ERROR_CODES.game.codes.GAME_YOU_CANT_MUTATE,
        message: ERROR_CODES.game.messages.GAME_YOU_CANT_MUTATE,
      })
    }

    if (dto.status === GameStatus.FINISHED) {
      const participants = await this.santaPlayerEntity.findAll({
        santaGameId: id,
      })
      const santaPayload = this.santaEntity.getValidProperties(
        { ...santa, name: `${santa.name} - (завершена)`, status: GameStatus.FINISHED },
        true,
      )
      await doc.update(santaPayload)

      await Promise.all(
        participants.map(async (participant) => {
          const payload = this.santaPlayerEntity.getValidProperties({ ...participant, isGameFinished: true }, true)
          await this.santaPlayerEntity.createOrUpdate(payload)

          if (participant.userId !== santa.userId) {
            await this.telegrafCustomService.telegraf.telegram.sendMessage(
              participant.userId,
              `
Игра "Тайный Санта", под названием <b>${santa.name}</b> - завершена.
      `,
              {
                reply_markup: {
                  inline_keyboard: [
                    [getMainOpenWebAppButton(`${this.customConfigService.miniAppUrl}/game/${santa.id}`, 'Посмотреть')],
                  ],
                },
                parse_mode: 'HTML',
              },
            )
          }
        }),
      )

      return Object.assign(santaPayload, { type: GameType.SANTA, name: santaPayload.name })
    }

    if (dto.status === GameStatus.ACTIVE) {
      const participants = await this.santaPlayerEntity.findAll({
        santaGameId: id,
      })

      const approvedParticipants = participants.filter((participant) => participant.isSantaConfirmed)

      if (approvedParticipants.length < 2) {
        throw new BadRequestException({
          code: ERROR_CODES.game.codes.GAME_NOT_ENOUGH_PARTICIPANTS,
          message: ERROR_CODES.game.messages.GAME_NOT_ENOUGH_PARTICIPANTS,
        })
      }

      const randomSortedParticipants = approvedParticipants.sort(() => Math.random() - 0.5)

      const computedSantas = randomSortedParticipants.map((participant, index) => {
        const nextParticipant =
          randomSortedParticipants?.length > index + 1
            ? randomSortedParticipants[index + 1]
            : randomSortedParticipants[0]

        const payload = this.santaPlayerEntity.getValidProperties(
          { ...participant, santaRecipientUserId: nextParticipant?.userId },
          true,
        )

        return payload
      })

      const santaPayload = this.santaEntity.getValidProperties({ ...santa, status: GameStatus.ACTIVE }, true)
      await doc.update(santaPayload)

      await Promise.allSettled(
        computedSantas.map(async (participant) => {
          const payload = this.santaPlayerEntity.getValidProperties({ ...participant, isGameFinished: true }, true)
          await this.santaPlayerEntity.createOrUpdate(payload)

          const user = await this.userEntity.get(participant.santaRecipientUserId)

          await this.telegrafCustomService.telegraf.telegram.sendMessage(
            participant.userId,
            `
Игра "Тайный Санта", под названием <b>${santa.name}</b> началась, ваш подопечный - <b>${
              user.username ? `@${user.username}` : `${user.firstName || ''} ${user.lastName || ''}`
            }</b> будет ждать от вас подарок.
Если вы хотите что-то уточнить, то напишите Вашего подопечному. Общение с Сантой возможно лишь в том случае, когда Вы пишите ему первым.
    `,
            {
              reply_markup: {
                inline_keyboard: [
                  [getMainOpenWebAppButton(`${this.customConfigService.miniAppUrl}/game/${santa.id}`, 'Игра')],
                  [
                    getMainOpenWebAppButton(
                      `${this.customConfigService.miniAppUrl}/user/${user.id}`,
                      'Посмотреть желания подопечного',
                    ),
                  ],
                  [
                    {
                      text: 'Написать подопечному',
                      callback_data: `${GAMES_CALLBACK_DATA.writeToSantaParticipant} ${santa.id}`,
                    },
                  ],
                ],
              },
              parse_mode: 'HTML',
            },
          )
        }),
      )

      return Object.assign(santaPayload, { type: GameType.SANTA, name: santa.name })
    }

    if (dto.status === GameStatus.CANCELLED) {
      const payload = this.santaEntity.getValidProperties(
        { ...santa, name: `${santa.name} - (отменена)`, status: GameStatus.CANCELLED },
        true,
      )
      await doc.update(payload)

      const participants = await this.santaPlayerEntity.findAll({
        santaGameId: id,
      })

      await Promise.all(
        participants.map(async (participant) => {
          const payload = this.santaPlayerEntity.getValidProperties({ ...participant, isGameFinished: true }, true)
          await this.santaPlayerEntity.createOrUpdate(payload)

          if (participant.userId !== santa.userId) {
            await this.telegrafCustomService.telegraf.telegram.sendMessage(
              participant.userId,
              `
Игра "Тайный Санта", под названием <b>${santa.name}</b> была отменена владельцем.
      `,
              {
                reply_markup: {
                  inline_keyboard: [
                    [getMainOpenWebAppButton(`${this.customConfigService.miniAppUrl}/game/${santa.id}`, 'Посмотреть')],
                  ],
                },
                parse_mode: 'HTML',
              },
            )
          }
        }),
      )

      return Object.assign(payload, { type: GameType.SANTA, name: santa.name })
    }

    return Object.assign(santa, { type: GameType.SANTA, name: santa.name })
  }

  async getGames(filter: SantaFilter): Promise<GameResponse[]> {
    const games = await this.santaEntity.findAll(
      { ...filter, statuses: filter?.status ? [] : [GameStatus.ACTIVE, GameStatus.CREATED] },
      true,
    )

    return games.map((game) => Object.assign(game, { type: GameType.SANTA, name: game.name }))
  }

  async getGamesByParticipant(filter: SantaFilter): Promise<GameResponse[]> {
    const gamesParticipants = await this.santaPlayerEntity.findAll(filter)

    const gameFilter = {
      ...filter,
      statuses: filter?.status ? [] : [GameStatus.ACTIVE, GameStatus.CREATED],
    }

    const games = await Promise.all(
      gamesParticipants.map(async (gameParticipant) => {
        const game = await this.santaEntity.get(gameParticipant.santaGameId)

        if (!game) {
          return null
        }

        if (game.userId === gameParticipant.userId) {
          return null
        }

        if (!isNil(gameFilter.status) && game.status !== filter.status) {
          return null
        }

        if (!isNil(gameFilter.statuses) && !gameFilter.statuses.includes(game.status)) {
          return null
        }

        return game
      }),
    )

    const filteredGames = games
      .filter((game) => !isNil(game))
      .map((game) => Object.assign(game, { type: GameType.SANTA, name: game.name }))

    const uniqGames = new Map()

    filteredGames.forEach((game) => {
      uniqGames.set(game.id, game)
    })

    return Array.from(uniqGames.values())
  }

  async addParticipant(participantUserId: string, gameId: string): Promise<GameParticipant> {
    const santa = await this.santaEntity.get(gameId)

    if (!santa) {
      throw new NotFoundException({
        code: ERROR_CODES.game.codes.GAME_NOT_FOUND,
        message: ERROR_CODES.game.messages.GAME_NOT_FOUND,
      })
    }

    if ([GameStatus.CANCELLED, GameStatus.FINISHED].includes(santa.status)) {
      throw new BadRequestException({
        code: ERROR_CODES.game.codes.GAME_FINISHED,
        message: ERROR_CODES.game.messages.GAME_FINISHED,
      })
    }

    if (santa.userId === participantUserId) {
      throw new BadRequestException({
        code: ERROR_CODES.game.codes.GAME_YOU_CANT_ADD_YOURSELF,
        message: ERROR_CODES.game.messages.GAME_YOU_CANT_ADD_YOURSELF,
      })
    }

    if (santa.userId === participantUserId) {
      throw new BadRequestException({
        code: ERROR_CODES.game.codes.GAME_YOU_CANT_ADD_YOURSELF,
        message: ERROR_CODES.game.messages.GAME_YOU_CANT_ADD_YOURSELF,
      })
    }

    const participants = await this.santaPlayerEntity.findAll({
      santaGameId: gameId,
    })

    const participantRecord = participants.find((participant) => participant.userId === participantUserId)

    /**
     * Если запись участника есть, то проверяем, принял ли он участие в игре
     * Если уже принял участие, то выбрасываем ошибку
     * Если не принял участие, то обновляем запись и возвращаем игру
     */
    if (!!participantRecord) {
      if (participantRecord.isSantaConfirmed) {
        throw new BadRequestException({
          code: ERROR_CODES.game.codes.GAME_ALREADY_PARTICIPANT,
          message: ERROR_CODES.game.messages.GAME_ALREADY_PARTICIPANT,
        })
      } else {
        const { data, doc } = await this.santaPlayerEntity.getUpdate(participantRecord.id)

        const participant = this.santaPlayerEntity.getValidProperties({ ...data, isSantaConfirmed: true }, true)
        await doc.update(participant)

        const response = {
          id: participant.id,
          userId: participant.userId,
          gameId: participant.santaGameId,
          type: GameType.SANTA,
          isGameConfirmed: participant.isSantaConfirmed,
          isGameFinished: participant.isGameFinished,
          createdAt: participant.createdAt,
          updatedAt: participant.updatedAt,
        }

        return Object.assign(response, { type: GameType.SANTA, name: santa.name })
      }
    }

    const participant = await this.santaPlayerEntity.createOrUpdate(
      this.santaPlayerEntity.getValidProperties({
        userId: participantUserId,
        santaGameId: gameId,
        isSantaConfirmed: true,
      }),
    )

    const response = {
      id: participant.id,
      userId: participant.userId,
      gameId: participant.santaGameId,
      type: GameType.SANTA,
      isGameConfirmed: participant.isSantaConfirmed,
      isGameFinished: participant.isGameFinished,
      createdAt: participant.createdAt,
      updatedAt: participant.updatedAt,
    }

    return Object.assign(response, { type: GameType.SANTA, name: santa.name })
  }

  async shareGameWithParticipant(gameId: string, dto: ShareGameWithParticipantDto): Promise<GameResponse> {
    const santa = await this.santaEntity.get(gameId)

    const { userId: participantUserId } = dto

    if (!santa) {
      throw new NotFoundException({
        code: ERROR_CODES.game.codes.GAME_NOT_FOUND,
        message: ERROR_CODES.game.messages.GAME_NOT_FOUND,
      })
    }

    if ([GameStatus.CANCELLED, GameStatus.FINISHED].includes(santa.status)) {
      throw new BadRequestException({
        code: ERROR_CODES.game.codes.GAME_FINISHED,
        message: ERROR_CODES.game.messages.GAME_FINISHED,
      })
    }

    const user = await this.userEntity.get(participantUserId)

    if (!user) {
      throw new NotFoundException({
        code: ERROR_CODES.user.codes.USER_NOT_FOUND,
        message: ERROR_CODES.user.messages.USER_NOT_FOUND,
      })
    }

    const participants = await this.santaPlayerEntity.findAll({
      santaGameId: gameId,
    })

    const participantRecord = participants.find((participant) => participant.userId === participantUserId)

    /**
     * Если запись участника есть, то выбрасываем ошибку, что он уже приглашен
     * Иначе, делаем запись участия и отправляем приглашение
     */
    if (!!participantRecord) {
      throw new BadRequestException({
        code: ERROR_CODES.game.codes.GAME_ALREADY_PARTICIPANT,
        message: ERROR_CODES.game.messages.GAME_ALREADY_PARTICIPANT,
      })
    }

    const participant = await this.santaPlayerEntity.createOrUpdate(
      this.santaPlayerEntity.getValidProperties({
        userId: participantUserId,
        santaGameId: gameId,
        isSantaConfirmed: false,
      }),
    )

    await this.telegrafCustomService.telegraf.telegram.sendMessage(
      user.chatId,
      `
Вас пригласили в игру "Тайный Санта".
Название: <b>${santa.name}</b>

Вы можете принять участие в игре, нажав на кнопку ниже:
`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Принять участие', callback_data: `${GAMES_CALLBACK_DATA.approveSanta} ${santa.id}` }],
            [getMainOpenWebAppButton(`${this.customConfigService.miniAppUrl}/game/${santa.id}`, 'Посмотреть')],
          ],
        },
        parse_mode: 'HTML',
      },
    )

    const response = {
      id: participant.id,
      userId: participant.userId,
      gameId: participant.santaGameId,
      type: GameType.SANTA,
      isGameConfirmed: participant.isSantaConfirmed,
      isGameFinished: participant.isGameFinished,
      createdAt: participant.createdAt,
      updatedAt: participant.updatedAt,
    }

    return Object.assign(response, { type: GameType.SANTA, name: santa.name })
  }
}
