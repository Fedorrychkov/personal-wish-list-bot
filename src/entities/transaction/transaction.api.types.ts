import { AnyCurrency } from 'src/types'

import { TransactionDocument } from './transaction.document'
import { TransactionType } from './transaction.types'

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

export type TransactionBalanceTopupResponse = {
  invoiceLink: string
}
