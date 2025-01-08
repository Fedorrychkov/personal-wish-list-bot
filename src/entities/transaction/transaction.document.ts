import { Timestamp } from '@google-cloud/firestore'
import { AnyCurrency } from 'src/types'

import { TransactionProvider, TransactionStatus, TransactionType } from './transaction.types'

/**
 * В моделях сущностей не может быть undefined полей, это ограничение firestore, разрешен только null или значения
 */
export class TransactionDocument {
  static collectionName = 'transaction'

  id: string
  /**
   * Пользователь, который нажал на Favorite
   */
  userId: string
  status: TransactionStatus
  type: TransactionType
  provider: TransactionProvider
  amount: string
  currency: AnyCurrency
  providerInvoiceId?: string
  comissionPercent?: number
  comissionAmount?: string
  comissionCurrency?: AnyCurrency
  /**
   * ID игры, к которой привязана транзакция, может быть пустой, еслли это например - поддержка разработчика
   */
  gameId?: string | null
  /**
   * Время до которого можно вернуть деньги
   */
  refundExpiredAt?: Timestamp | null
  /**
   * Время когда деньги были возвращены
   */
  refundedAt?: Timestamp | null
  /**
   * Время истечения срока транзакции
   */
  expiredAt?: Timestamp | null
  createdAt?: Timestamp | null
  updatedAt?: Timestamp | null
}
