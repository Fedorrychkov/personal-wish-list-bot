import { Timestamp } from '@google-cloud/firestore'

import { GameStatus } from './santa.types'

/**
 * В моделях сущностей не может быть undefined полей, это ограничение firestore, разрешен только null или значения
 */
export class SantaDocument {
  static collectionName = 'santa'

  /**
   * Game id
   */
  id: string
  /**
   * Game owner id
   */
  userId: string
  /**
   * Max length - 1000, game name
   */
  name?: string
  /**
   * Game status
   */
  status?: GameStatus
  /**
   * Created at
   */
  chatId?: number | string
  topicId?: number | string
  createdAt?: Timestamp | null
  /**
   * Updated at
   */
  updatedAt?: Timestamp | null
}
