export const codes = {
  TRANSACTION_NOT_FOUND: 'TRANSACTION_NOT_FOUND',
  TRANSACTION_REFUNDABLE_EXPIRAED: 'TRANSACTION_REFUNDABLE_EXPIRAED',
  TRANSACTION_BALANCE_NOT_AVAILABLE: 'TRANSACTION_BALANCE_NOT_AVAILABLE',
  TRANSACTION_NOT_REFUNDABLE: 'TRANSACTION_NOT_REFUNDABLE',
  TRANSACTION_NOT_CONFIRMED: 'TRANSACTION_NOT_CONFIRMED',
  TRANSACTION_SUPPORT_CURRENCY_ONLY_XTR: 'TRANSACTION_SUPPORT_CURRENCY_ONLY_XTR',
  TRANSACTION_NOT_SUPPORT_CURRENCY: 'TRANSACTION_NOT_SUPPORT_CURRENCY',
  TRANSACTION_ALREADY_REFUNDED: 'TRANSACTION_ALREADY_REFUNDED',
}

export const errors = {
  codes,
  messages: {
    [codes.TRANSACTION_NOT_FOUND]: 'Транзакция не найдена, обратитесь к администратору бота',
    [codes.TRANSACTION_REFUNDABLE_EXPIRAED]: 'Транзакция не может быть возвращена, так как прошло больше 21 дня',
    [codes.TRANSACTION_NOT_REFUNDABLE]: 'Транзакция не может быть возвращена',
    [codes.TRANSACTION_NOT_CONFIRMED]:
      'Транзакция не может быть возвращена, так как не находится в статусе подтвержденной',
    [codes.TRANSACTION_SUPPORT_CURRENCY_ONLY_XTR]: 'Поддержка разработки возможна только в XTR',
    [codes.TRANSACTION_NOT_SUPPORT_CURRENCY]: 'Валюта не поддерживается для данного типа транзакции',
    [codes.TRANSACTION_BALANCE_NOT_AVAILABLE]: 'Недостаточно средств на балансе для возврата платежа',
    [codes.TRANSACTION_ALREADY_REFUNDED]: 'Транзакция уже возвращена',
  },
}
