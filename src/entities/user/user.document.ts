import { Timestamp } from '@google-cloud/firestore'

import { UserRole } from './user.types'

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
  avatarUrl?: string | null
  isBot?: boolean | null
  phone?: string | null
  appOnboardingKey?: string
  role?: UserRole[] | null
  createdAt?: Timestamp | null
  updatedAt?: Timestamp | null
}
