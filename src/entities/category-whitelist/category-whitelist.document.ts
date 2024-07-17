import { Timestamp } from '@google-cloud/firestore'

/**
 * В моделях сущностей не может быть undefined полей, это ограничение firestore, разрешен только null или значения
 */
export class CategoryWhitelistDocument {
  static collectionName = 'category-whitelist'

  id: string
  /**
   * Пользователь, который добавил вайтлист запись
   */
  userId: string
  /**
   * Пользователь, которого добавили в вайтлист запись
   */
  whitelistedUserId: string
  categoryId: string
  createdAt?: Timestamp | null
  updatedAt?: Timestamp | null
}
