import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { getMainOpenWebAppButton } from 'src/constants'
import { TelegrafCustomService } from 'src/services'
import { TgInitUser } from 'src/types'

import { CustomConfigService } from '../config'
import { GameFilters, ShareGameWithParticipantDto, UpdateGameDto } from './dto'
import { GameParticipant, GameResponse, GameType } from './game.types'
import { SantaService } from './santa'
import { CreateSantaGameDto } from './santa/santa.types'

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name)

  constructor(
    private readonly santaService: SantaService,
    private readonly telegrafCustomService: TelegrafCustomService,
    private readonly customConfigService: CustomConfigService,
  ) {}

  async createGame(type: GameType, dto: CreateSantaGameDto, userContext: TgInitUser) {
    if (type === GameType.SANTA) {
      const santa = await this.santaService.createGame(dto, userContext)

      await this.telegrafCustomService.telegraf.telegram.sendMessage(
        userContext.id,
        `
Вы только что создали игру "Тайный Санта".
Название: <b>${santa.name}</b>

Вы можете пригласить других пользователей в игру, отправив им эту ссылку:
<a href="https://t.me/${this.customConfigService.tgBotUsername}?start=santa_${santa.id}">https://t.me/${this.customConfigService.tgBotUsername}?start=santa_${santa.id}</a>
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

      return santa
    }

    throw new BadRequestException('Invalid game type')
  }

  async getParticipants(type: GameType, id: string): Promise<GameParticipant[]> {
    if (type === GameType.SANTA) {
      return this.santaService.getGameParticipants(id)
    }

    throw new BadRequestException('Invalid game type')
  }

  async getMyParticipant(type: GameType, id: string, user: TgInitUser): Promise<GameParticipant> {
    if (type === GameType.SANTA) {
      return this.santaService.getMyParticipant(id, user)
    }

    throw new BadRequestException('Invalid game type')
  }

  async getMySantaParticipant(type: GameType, id: string, user: TgInitUser): Promise<GameParticipant> {
    if (type === GameType.SANTA) {
      return this.santaService.getMySantaParticipant(id, user)
    }

    throw new BadRequestException('Invalid game type')
  }

  async getMySanta(type: GameType, id: string, user: TgInitUser): Promise<GameParticipant> {
    if (type === GameType.SANTA) {
      return this.santaService.getMySanta(id, user)
    }

    throw new BadRequestException('Invalid game type')
  }

  async getGame(type: GameType, id: string): Promise<GameResponse> {
    if (type === GameType.SANTA) {
      return this.santaService.getGame(id)
    }

    throw new BadRequestException('Invalid game type')
  }

  async mutateGame(type: GameType, id: string, user: TgInitUser, dto: UpdateGameDto): Promise<GameResponse> {
    if (type === GameType.SANTA) {
      return this.santaService.mutateGame(id, user, dto)
    }

    throw new BadRequestException('Invalid game type')
  }

  async getGames(type: GameType, filter: GameFilters): Promise<GameResponse[]> {
    if (type === GameType.SANTA) {
      return this.santaService.getGames(filter)
    }

    throw new BadRequestException('Invalid game type')
  }

  async getGamesByParticipant(type: GameType, filter: GameFilters): Promise<GameResponse[]> {
    if (type === GameType.SANTA) {
      return this.santaService.getGamesByParticipant(filter)
    }

    throw new BadRequestException('Invalid game type')
  }

  async addParticipant(type: GameType, userId: string, gameId: string): Promise<GameParticipant> {
    if (type === GameType.SANTA) {
      return this.santaService.addParticipant(userId, gameId)
    }

    throw new BadRequestException('Invalid game type')
  }

  async shareGameWithParticipant(
    type: GameType,
    id: string,
    dto: ShareGameWithParticipantDto,
  ): Promise<GameParticipant> {
    if (type === GameType.SANTA) {
      return this.santaService.shareGameWithParticipant(id, dto)
    }

    throw new BadRequestException('Invalid game type')
  }
}
