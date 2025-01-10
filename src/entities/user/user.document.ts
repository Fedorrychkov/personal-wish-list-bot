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
  /**
   * Хэш реферальной системы, может быть как внутренняя, так и внешняя
   */
  refferalHash?: string | null
  /**
   * ID пользователя, который пригласил текущего пользователя
   */
  refferrerUserId?: string | null
  /**
   * Комиссия реферальной системы за приглашенного пользователя
   */
  refferalCommission?: number | null
  role?: UserRole[] | null
  createdAt?: Timestamp | null
  updatedAt?: Timestamp | null
}
