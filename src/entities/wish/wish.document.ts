import { Timestamp } from '@google-cloud/firestore'

import { WishStatus } from './wish.types'

/**
 * В моделях сущностей не может быть undefined полей, это ограничение firestore, разрешен только null или значения
 */
export class WishDocument {
  static collectionName = 'wish'

  id: string
  userId: string
  /**
   * Max length - 300
   */
  name: string
  isBooked?: boolean | null
  bookedUserId?: string | null
  /**
   * Max length - 1000
   */
  description?: string
  link?: string | null
  categoryId?: string | null
  imageUrl?: string
  status?: WishStatus | null
  createdAt?: Timestamp | null
  updatedAt?: Timestamp | null
}
