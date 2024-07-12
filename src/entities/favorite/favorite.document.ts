import { Timestamp } from '@google-cloud/firestore'

/**
 * В моделях сущностей не может быть undefined полей, это ограничение firestore, разрешен только null или значения
 */
export class FavoriteDocument {
  static collectionName = 'favorite'

  id: string
  /**
   * Пользователь, который нажал на Favorite
   */
  userId: string
  /**
   * Пользователь, на котором нажали Favorite
   */
  favoriteUserId: string
  wishlistNotifyEnabled?: boolean | null
  createdAt?: Timestamp | null
  updatedAt?: Timestamp | null
}
