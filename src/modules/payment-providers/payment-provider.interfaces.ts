import { TransactionStatus } from 'src/entities'

export type GetTransactionOptions = {
  chain?: string
  address?: string
  limit?: number
  transactionAmount?: string
}

export type BlockchainTxResponse = {
  fees?: {
    total?: string
  }
  status: TransactionStatus
  isValidAmount?: boolean
  finalAmount?: string
  statusMessage?: string
}

export interface IPaymentProviderService {
  healthcheck(): Promise<boolean>
  getBalance(address: string): Promise<{ amount: string; currency: string }>
  getTransaction(txHash: string, options?: GetTransactionOptions): Promise<BlockchainTxResponse>
}
