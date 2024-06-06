import { Timestamp } from '@google-cloud/firestore'

/**
 * В моделях сущностей не может быть undefined полей, это ограничение firestore, разрешен только null или значения
 */
export class UserDocument {
  static collectionName = 'user'

  id: string
  chatId: string
  firstName?: string | null
  lastName?: string | null
  username?: string | null
  isPremium?: boolean | null
  isBot?: boolean | null
  phone?: string | null
  createdAt?: Timestamp | null
  updatedAt?: Timestamp | null
}
