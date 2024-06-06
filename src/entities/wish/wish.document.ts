import { Timestamp } from '@google-cloud/firestore'

/**
 * В моделях сущностей не может быть undefined полей, это ограничение firestore, разрешен только null или значения
 */
export class WishDocument {
  static collectionName = 'wish'

  id: string
  userId: string
  isBooked?: boolean | null
  /**
   * Max length - 300
   */
  name: string
  /**
   * Max length - 1000
   */
  description?: string
  link?: string
  imageUrl?: string
  createdAt?: Timestamp | null
  updatedAt?: Timestamp | null
}
