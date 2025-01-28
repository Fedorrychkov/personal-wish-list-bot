export const codes = {
  NOT_ENOUGH_BALANCE: 'NOT_ENOUGH_BALANCE',
  NOT_ENOUGH_BALANCE_FOR_WITHDRAWAL: 'NOT_ENOUGH_BALANCE_FOR_WITHDRAWAL',
  WITHDRAWAL_CREATED_BUT_PENDING_OR_NEED_CONFIRMATION_BY_ADMIN:
    'WITHDRAWAL_CREATED_BUT_PENDING_OR_NEED_CONFIRMATION_BY_ADMIN',
  WALLET_NOT_INITIALIZED: 'WALLET_NOT_INITIALIZED',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
}

export const errors = {
  codes,
  messages: {
    [codes.NOT_ENOUGH_BALANCE]: 'Недостаточно средств ',
    [codes.NOT_ENOUGH_BALANCE_FOR_WITHDRAWAL]: 'Вывод на данный момент невозможен',
    [codes.WITHDRAWAL_CREATED_BUT_PENDING_OR_NEED_CONFIRMATION_BY_ADMIN]:
      'Вывод создан, но его невозможно провести в ближайшее время, обработка транзакции может занять до 24 часов. Пожалуйста, свяжитесь с поддержкой, если прошло уже больше 24 часов после создания вывода.',
    [codes.WALLET_NOT_INITIALIZED]: 'Кошелек не инициализирован',
    [codes.NOT_IMPLEMENTED]: 'Метод не реализован',
  },
}
