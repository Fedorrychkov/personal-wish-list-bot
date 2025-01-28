import { TransactionStatus } from 'src/entities'

export type GetTransactionOptions = {
  chain?: string
  address?: string
  limit?: number
  transactionAmount?: string
  logKey?: string
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

export type TransferFromWithdrawalWalletToTargetWalletOptions = {
  targetWalletAddress: string
  amount: string
  currency: string
  comment?: string
  logKey?: string
}

export type TxSendedResponse = { hash: string; scanUrl: string }

export interface IPaymentProviderService {
  healthcheck(): Promise<boolean>
  getBalance(address: string): Promise<{ amount: string; currency: string }>
  getTransaction(txHash: string, options?: GetTransactionOptions): Promise<BlockchainTxResponse>
  getMsgHashAndScan(value: string): Promise<TxSendedResponse>
  trasferFromWithdrawalWalletToTargetWallet(
    options: TransferFromWithdrawalWalletToTargetWalletOptions,
  ): Promise<TxSendedResponse>
}
