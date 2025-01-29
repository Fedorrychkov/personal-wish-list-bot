import { TransactionBalanceItem, TransactionDocument, TransactionType } from 'src/entities'
import { time, truncate } from 'src/helpers'

export const computedBalance = (
  acc: TransactionBalanceItem[],
  transaction: TransactionDocument,
  options: {
    isAvailableTopup?: boolean
    isAvailableWithdraw?: boolean
    currencyPropertyName?: 'currency' | 'comissionCurrency'
    amountPropertyName?: 'amount' | 'comissionAmount'
  },
) => {
  const {
    isAvailableTopup,
    isAvailableWithdraw,
    currencyPropertyName = 'currency',
    amountPropertyName = 'amount',
  } = options || {}
  const balanceCurrency = transaction?.[currencyPropertyName]
  const balanceAmount = transaction?.[amountPropertyName] || '0'

  const isAvailableAfterRefundableDateLimit = transaction?.refundExpiredAt
    ? time().isAfter(transaction?.refundExpiredAt?.toDate())
    : true

  if (isAvailableTopup && !isAvailableAfterRefundableDateLimit && transaction?.type === TransactionType.REFFERAL) {
    return acc
  }

  /**
   * На первом шаге формируем первую запись баланса, или оставляем пустой массив
   */
  if (!acc?.length && (isAvailableTopup || isAvailableWithdraw)) {
    if (isAvailableTopup) {
      acc.push({ amount: balanceAmount, currency: balanceCurrency })
    }

    if (isAvailableWithdraw) {
      acc.push({ amount: String(truncate(Number(balanceAmount) * 1, 6)), currency: balanceCurrency })
    }

    return acc
  }

  const balanceByCurrency = acc.find((item) => item?.currency === balanceCurrency) || {
    amount: '0',
    currency: balanceCurrency,
  }
  const filteredBalances = acc.filter((item) => item?.currency !== balanceCurrency)

  if (isAvailableTopup || isAvailableWithdraw) {
    const newAcc = [...(filteredBalances || [])]

    if (isAvailableTopup) {
      newAcc.push({
        amount: String(
          truncate(truncate(Number(balanceByCurrency?.amount || 0), 6) + truncate(Number(balanceAmount || 0), 6), 6),
        ),
        currency: balanceByCurrency.currency,
      })
    }

    if (isAvailableWithdraw) {
      newAcc.push({
        /**
         * Для вывода, мы делаем сумму позитивной и отнимаем от нее сумму из транзакции вывода и снова делаем отрицательной
         */
        amount: String(
          truncate(truncate(Number(balanceByCurrency?.amount || 0), 6) - truncate(Number(balanceAmount || 0), 6), 6),
        ),
        currency: balanceByCurrency.currency || '',
      })
    }

    return newAcc
  }

  return acc
}
