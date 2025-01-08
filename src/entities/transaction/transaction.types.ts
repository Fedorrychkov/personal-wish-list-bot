export enum TransactionStatus {
  CREATED = 'CREATED',
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum TransactionProvider {
  TELEGRAM = 'TELEGRAM',
  BLOCKCHAIN = 'BLOCKCHAIN',
}

export enum TransactionType {
  /**
   * Когда производится выплата пользователю, конвертация в TON или что-то еще
   */
  USER_WITHDRAW = 'USER_WITHDRAW',
  /**
   * Пополнение баланса, извне или при выигрыше в игре
   */
  USER_TOPUP = 'USER_TOPUP',
  /**
   * Оплата участия в игре, призовой фонд, например
   */
  GAME_TOPUP = 'GAME_TOPUP',
  /**
   * Поддержка разработчика
   */
  SUPPORT = 'SUPPORT',
  /**
   * Возврат денег
   */
  REFUND = 'REFUND',
}

export type TransactionFilter = {
  id?: string
  userId?: string
  type?: TransactionType
  types?: TransactionType[]
  gameId?: string
}
