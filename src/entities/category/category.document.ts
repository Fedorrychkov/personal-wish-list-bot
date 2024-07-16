import { Timestamp } from '@google-cloud/firestore'

/**
 * В моделях сущностей не может быть undefined полей, это ограничение firestore, разрешен только null или значения
 */
export class CategoryDocument {
  static collectionName = 'category'

  id: string
  userId: string
  /**
   * Max length - 200
   */
  name: string
  isPrivate?: boolean | null
  createdAt?: Timestamp | null
  updatedAt?: Timestamp | null
}
