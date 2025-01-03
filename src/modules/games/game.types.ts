import { Timestamp } from '@google-cloud/firestore'
import { GameStatus } from 'src/entities/santa/santa.types'

export enum GameType {
  SANTA = 'SANTA',
}

export type GameResponse = {
  id: string
  type: GameType
  name: string
  userId: string

  status?: GameStatus
  /**
   * Created at
   */
  createdAt?: Timestamp | null
  /**
   * Updated at
   */
  updatedAt?: Timestamp | null
}

export type GameParticipant = {
  id: string
  userId: string
  gameId?: string
  type: GameType
  isGameConfirmed?: boolean
  isGameFinished?: boolean
  recipientUserId?: string
  /**
   * Created at
   */
  createdAt?: Timestamp | null
  /**
   * Updated at
   */
  updatedAt?: Timestamp | null
}
