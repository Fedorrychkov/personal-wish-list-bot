import { AnyCurrency } from 'src/types'

import { TransactionDocument } from './transaction.document'
import { TransactionPayloadType, TransactionType } from './transaction.types'

export type TransactionResponse = Omit<
  TransactionDocument,
  'createdAt' | 'updatedAt' | 'refundedAt' | 'refundExpiredAt' | 'expiredAt'
> & {
  createdAt?: string
  updatedAt?: string | null
  refundedAt?: string | null
  refundExpiredAt?: string | null
  expiredAt?: string | null
}

export type TransactionBalanceItem = {
  amount?: string
  currency?: AnyCurrency
}

export type TransactionBalanceTopup = {
  amount?: string
  currency?: AnyCurrency
  type?: TransactionType
}

export type BalanceTransfer = {
  amount: string
  currency: AnyCurrency
  targetUserId: string
  isAnonymous?: boolean
}

export type TransactionBalanceTopupResponse = {
  invoiceLink: string
}

export type TransactionPayload = {
  type: TransactionPayloadType
  message: string
  userId?: string
  isAnonymous?: boolean
}

export type Purchase = {
  amount: string
  currency: AnyCurrency
  payload: TransactionPayload
  wishId?: string
}

export type PurchaseFilter = {
  wishId?: string
}
