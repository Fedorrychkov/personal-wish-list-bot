import { Timestamp } from '@google-cloud/firestore'

/**
 * В моделях сущностей не может быть undefined полей, это ограничение firestore, разрешен только null или значения
 */
export class SantaPlayerDocument {
  static collectionName = 'santa-player'

  /**
   * Record Id
   */
  id: string
  /**
   * Player id
   */
  userId: string
  /**
   * Game session id
   */
  santaGameId?: string
  /**
   * For whom gives a gift
   */
  santaRecipientUserId?: string
  /**
   * Статус подтверждения участия в игре
   */
  isSantaConfirmed?: boolean
  /**
   * Game finished flag
   */
  isGameFinished?: boolean
  /**
   * Created at
   */
  createdAt?: Timestamp | null
  /**
   * Updated at
   */
  updatedAt?: Timestamp | null
}
