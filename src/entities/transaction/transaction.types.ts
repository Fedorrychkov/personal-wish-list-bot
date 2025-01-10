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
  INTERNAL = 'INTERNAL',
}

export enum TransactionPayloadType {
  TRANSFER = 'transfer',
  SHOW_WISH_BOOKED_USER = 'show_wish_booked_user',
  SHOW_SECRET_SANTA_USER = 'show_secret_santa_user',
  INVITED_NEW_USER = 'invited_new_user',
  INVITEE_BONUS = 'invitee_bonus',
  WITH_REFFERAL_COMISSION = 'with_refferal_comission',
  REFFERAL_BONUS = 'refferal_bonus',
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
   * Оплата в приложении
   */
  PURCHASE = 'PURCHASE',
  /**
   * Вознаграждение рефереру при приглашении нового пользователя или приглашенному по реф системе
   */
  REFFERAL = 'REFFERAL',
  /**
   * Бонусы, например за вступление в бота или другие внутренние действия
   */
  BONUS = 'BONUS',
}

export type TransactionFilter = {
  id?: string
  userId?: string
  type?: TransactionType
  types?: TransactionType[]
  gameId?: string
  wishId?: string
  santaGameId?: string
  status?: TransactionStatus
  limit?: number
  createdAt?: string
}
