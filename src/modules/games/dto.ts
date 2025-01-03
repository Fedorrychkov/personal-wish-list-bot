import { GameStatus, SantaFilter } from 'src/entities/santa/santa.types'

export type GameFilters = Pick<SantaFilter, 'userId' | 'status'>

export type ShareGameWithParticipantDto = {
  userId: string
}

export type UpdateGameDto = {
  status: GameStatus
}
