import { Timestamp } from '@google-cloud/firestore'
import { AnyCurrency } from 'src/types'

import {
  TransactionBlockchainProvider,
  TransactionProvider,
  TransactionStatus,
  TransactionType,
} from './transaction.types'

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
  blockchainProvider?: TransactionBlockchainProvider
  actionAddress?: string | null
  chain?: string
  blockchain?: string | null
  amount: string
  currency: AnyCurrency
  providerInvoiceId?: string
  comissionPercent?: number
  comissionAmount?: string
  comissionCurrency?: AnyCurrency
  wishId?: string | null
  santaGameId?: string | null
  /**
   * Параметр включает в себя полезную нагрузку, например текстовую информацию.
   */
  payload?: string | null
  /**
   * Данный параметр указывает на то, что существует транзакция, с которой можно что-то сделать
   */
  parentTransactionId?: string
  /**
   * Данный параметр указывает на то, что существует транзакция, которая зависит от текущей транзакции, и с ней можно что-то сделать
   */
  childrenTransactionId?: string
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
  statusMessage?: string | null
  expiredAt?: Timestamp | null
  createdAt?: Timestamp | null
  updatedAt?: Timestamp | null
}
