import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { UserContext } from 'src/decorator'
import { TgDataGuard } from 'src/guards'
import { TgInitUser } from 'src/types'

import { GameFilters, ShareGameWithParticipantDto, UpdateGameDto } from './dto'
import { GameService } from './game.service'
import { GameParticipant, GameResponse, GameType } from './game.types'
import { CreateSantaGameDto } from './santa/santa.types'

@Controller('v1/game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @UseGuards(TgDataGuard)
  @Post('/')
  async create(@UserContext() user: TgInitUser, @Body() dto: CreateSantaGameDto): Promise<GameResponse> {
    return this.gameService.createGame(GameType.SANTA, dto, user)
  }

  @UseGuards(TgDataGuard)
  @Get('/:id/participant')
  async getParticipants(@Param('id') id: string): Promise<GameParticipant[]> {
    return this.gameService.getParticipants(GameType.SANTA, id)
  }

  @UseGuards(TgDataGuard)
  @Get('/:id/participant/my')
  async getMyParticipant(@Param('id') id: string, @UserContext() user: TgInitUser): Promise<GameParticipant> {
    return this.gameService.getMyParticipant(GameType.SANTA, id, user)
  }

  @UseGuards(TgDataGuard)
  @Get('/:id/participant/my/santa')
  async getMySantaParticipant(@Param('id') id: string, @UserContext() user: TgInitUser): Promise<GameParticipant> {
    return this.gameService.getMySantaParticipant(GameType.SANTA, id, user)
  }

  @UseGuards(TgDataGuard)
  @Get('/my')
  async getMyGames(@UserContext() user: TgInitUser, @Query() filter: GameFilters): Promise<GameResponse[]> {
    return this.gameService.getGames(GameType.SANTA, { ...filter, userId: user.id?.toString() })
  }

  @UseGuards(TgDataGuard)
  @Get('/by-participant')
  async getGamesWhenUserIsParticipant(
    @UserContext() user: TgInitUser,
    @Query() filter: GameFilters,
  ): Promise<GameResponse[]> {
    return this.gameService.getGamesByParticipant(GameType.SANTA, { ...filter, userId: user.id?.toString() })
  }

  @UseGuards(TgDataGuard)
  @Get('/:id')
  async getGame(@Param('id') id: string): Promise<GameResponse> {
    return this.gameService.getGame(GameType.SANTA, id)
  }

  @UseGuards(TgDataGuard)
  @Patch('/:id')
  async mutateGame(
    @UserContext() user: TgInitUser,
    @Param('id') id: string,
    @Body() dto: UpdateGameDto,
  ): Promise<GameResponse> {
    return this.gameService.mutateGame(GameType.SANTA, id, user, dto)
  }

  @UseGuards(TgDataGuard)
  @Post('/:id/participant')
  async shareGameWithParticipant(
    @Param('id') id: string,
    @Body() dto: ShareGameWithParticipantDto,
  ): Promise<GameParticipant> {
    return this.gameService.shareGameWithParticipant(GameType.SANTA, id, dto)
  }

  @UseGuards(TgDataGuard)
  @Patch('/:id/participant')
  async approveMeAsParticipant(@Param('id') id: string, @UserContext() user: TgInitUser): Promise<GameParticipant> {
    return this.gameService.addParticipant(GameType.SANTA, user.id?.toString(), id)
  }
}
