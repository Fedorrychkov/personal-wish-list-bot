import { Injectable, Logger } from '@nestjs/common'
import { Action, Command, Ctx, Update } from 'nestjs-telegraf'
import { getMainOpenWebAppButton, TRANSACTION_WITHDRAW_COMISSION } from 'src/constants'
import { AvailableChatTypes } from 'src/decorator'
import { transactionCurrencyLabels } from 'src/entities'
import { ERROR_CODES } from 'src/errors'
import { ChatTelegrafGuard, UserTelegrafGuard, UseSafeGuards } from 'src/guards'
import { jsonParse, jsonStringify, truncate } from 'src/helpers'
import { CustomConfigService, TransactionService } from 'src/modules'
import { CurrencyService } from 'src/modules/currency'
import { WalletService } from 'src/modules/wallet'
import { AnyCurrency } from 'src/types'
import { SceneContext } from 'telegraf/typings/scenes'

import { SharedService } from '../shared'
import { MAIN_CALLBACK_DATA, PAYMENT_CALLBACK_DATA, WALLET_CALLBACK_DATA, WITHDRAWAL_CALLBACK_DATA } from './constants'

const AMOUNT_TO_WITHDRAW = ''

@Update()
@Injectable()
export class MainWithdrawalService {
  private logger = new Logger(MainWithdrawalService.name)
  constructor(
    private readonly customConfigService: CustomConfigService,
    private readonly transactionService: TransactionService,
    private readonly sharedService: SharedService,
    private readonly walletService: WalletService,
    private readonly currencyService: CurrencyService,
  ) {}

  @Command(WITHDRAWAL_CALLBACK_DATA.rates)
  @Action(new RegExp(WITHDRAWAL_CALLBACK_DATA.rates))
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async rates(@Ctx() ctx: SceneContext) {
    try {
      const xtrRate = await this.currencyService.getRate('XTR', 'USD')
      const tonRate = await this.currencyService.getRate('TON', 'USD')
      const xtrTonRate = await this.currencyService.getRate('XTR', 'TON')

      const message = `
<b>Курсы валют</b>

<i>Курсы акутальны на момент запроса</i>:
${transactionCurrencyLabels['XTR']} / USD: <b>${transactionCurrencyLabels['USD']} ${xtrRate}</b>
${transactionCurrencyLabels['TON']} / USD: <b>${transactionCurrencyLabels['USD']} ${tonRate}</b>
${transactionCurrencyLabels['XTR']} / TON: <b>${xtrTonRate} ${transactionCurrencyLabels['TON']}</b>
`

      await this.sharedService.tryToMutateOrReplyNewContent(ctx, {
        message,
        keyboard: [
          [{ text: 'Меню оплат', callback_data: PAYMENT_CALLBACK_DATA.paymentMenu }],
          [{ text: 'Основное меню', callback_data: MAIN_CALLBACK_DATA.menu }],
          [{ text: 'Назад', callback_data: WITHDRAWAL_CALLBACK_DATA.runWithdrawal }],
        ],
      })
    } catch (error) {
      this.logger.error('Error with rates', error)
    }
  }

  @Command(WITHDRAWAL_CALLBACK_DATA.userWithdrawWithTonApprove)
  @Action(new RegExp(WITHDRAWAL_CALLBACK_DATA.userWithdrawWithTonApprove))
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async userWithdrawWithTonApprove(@Ctx() ctx: SceneContext) {
    const command = jsonParse<{ command: string; currency: AnyCurrency }>(
      (ctx?.callbackQuery as { data: string })?.data,
    )

    try {
      if (!command || !command.currency) {
        await ctx.reply('Произошла ошибка, не удается получить данные из запроса')

        return
      }

      const { isError, address, walletName, isTestnet } = await this.walletService.showConnectedWallet(ctx.chat.id)

      if (isTestnet && !this.customConfigService.testnetEnabled) {
        await this.sharedService.tryToMutateOrReplyNewContent(ctx, {
          message: 'Вы не можете выводить средства в тестовой сети',
          keyboard: [
            [{ text: 'Меню оплат', callback_data: PAYMENT_CALLBACK_DATA.paymentMenu }],
            [{ text: 'Основное меню', callback_data: MAIN_CALLBACK_DATA.menu }],
            [{ text: 'Назад', callback_data: WITHDRAWAL_CALLBACK_DATA.runWithdrawal }],
          ],
        })
      }

      if (isError) {
        await this.sharedService.tryToMutateOrReplyNewContent(ctx, {
          message: 'Произошла ошибка, попробуйте позже',
          keyboard: [
            [{ text: 'Меню оплат', callback_data: PAYMENT_CALLBACK_DATA.paymentMenu }],
            [{ text: 'Основное меню', callback_data: MAIN_CALLBACK_DATA.menu }],
            [{ text: 'Назад', callback_data: WITHDRAWAL_CALLBACK_DATA.runWithdrawal }],
          ],
        })
      }

      await this.sharedService.tryToMutateOrReplyNewContent(ctx, {
        message: `Средства будут выведены на ваш кошелек ${address} (${walletName}) ${
          isTestnet ? '(TESTNET)' : ''
        } в автоматическом режиме. В худшем случае, это может занять до 24 часов. Если по прошествии этого времени средства не будут выведены, пожалуйста, обратитесь в поддержку...`,
        keyboard: [
          [getMainOpenWebAppButton(`${this.customConfigService.miniAppUrl}/transaction`, 'Открыть список транзакций')],
          [{ text: 'К меню оплат', callback_data: PAYMENT_CALLBACK_DATA.paymentMenu }],
        ],
      })

      const response = await this.transactionService.withdrawal(ctx.from, {
        amount: AMOUNT_TO_WITHDRAW,
        currency: command.currency,
        targetWalletAddress: address,
      })

      const keyboard = []

      if (!response.isError && response.scanUrl) {
        keyboard.push([{ text: 'Открыть TonScan', url: response.scanUrl }])
      }

      keyboard.push([
        getMainOpenWebAppButton(`${this.customConfigService.miniAppUrl}/transaction`, 'Открыть список транзакций'),
      ])
      keyboard.push([{ text: 'К меню оплат', callback_data: PAYMENT_CALLBACK_DATA.paymentMenu }])

      const defaultMessage = `<b>Вывод</b> на сумму ${truncate(Number(response.finalAmountToGet.amount), 4)} ${
        transactionCurrencyLabels[response.conversionCurrency]
      } (${response.conversionCurrency})`

      const successMessage = `${defaultMessage} успешно создан и отправлен на ваш кошелек ${address} ${walletName}\n\nПожалуйста, дождитесь подтверждения сети, детали по операции вы сможете узнать в TonScan`

      const warningMessage = `${defaultMessage} создан в нашей системе, но пока не отправлен на Ваш кошелек ${address} ${walletName}. Обычно это занимает до 24 часов. Следите за обновлениями в списке транзакций. Если что-то идет не так, пожалуйста, обратитесь в поддержку...`

      await this.sharedService.tryToMutateOrReplyNewContent(ctx, {
        message: response.isError ? warningMessage : successMessage,
        keyboard,
      })
    } catch (error) {
      this.logger.error('Error with user withdraw with ton approve', error)

      if (!error.status) {
        await ctx.reply('Произошла ошибка, попробуйте позже', {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Меню оплат', callback_data: PAYMENT_CALLBACK_DATA.paymentMenu }],
              [{ text: 'Основное меню', callback_data: MAIN_CALLBACK_DATA.menu }],
              [{ text: 'Назад', callback_data: WITHDRAWAL_CALLBACK_DATA.runWithdrawal }],
            ],
          },
        })

        return
      }

      if (error?.response?.code === ERROR_CODES.transaction.codes.TRANSACTION_NOT_ENOUGH_BALANCE) {
        await this.sharedService.tryToMutateOrReplyNewContent(ctx, {
          message: `Не достаточно средств на балансе для вывода ${transactionCurrencyLabels[command.currency]} (${
            command.currency
          })`,
          keyboard: [
            [{ text: 'Меню оплат', callback_data: PAYMENT_CALLBACK_DATA.paymentMenu }],
            [{ text: 'Основное меню', callback_data: MAIN_CALLBACK_DATA.menu }],
            [{ text: 'Назад', callback_data: WITHDRAWAL_CALLBACK_DATA.runWithdrawal }],
          ],
        })

        return
      }

      if (
        error?.response?.code === ERROR_CODES.transaction.codes.TRANSACTION_NOT_ENOUGH_BALANCE_FOR_MINIMAL_WITHDRAWAL
      ) {
        await this.sharedService.tryToMutateOrReplyNewContent(ctx, {
          message: error.response.message,
          keyboard: [
            [{ text: 'Меню оплат', callback_data: PAYMENT_CALLBACK_DATA.paymentMenu }],
            [{ text: 'Основное меню', callback_data: MAIN_CALLBACK_DATA.menu }],
            [{ text: 'Назад', callback_data: WITHDRAWAL_CALLBACK_DATA.runWithdrawal }],
          ],
        })

        return
      }
    }
  }

  @Command(WITHDRAWAL_CALLBACK_DATA.userWithdrawWithTon)
  @Action(new RegExp(WITHDRAWAL_CALLBACK_DATA.userWithdrawWithTon))
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async userWithdrawWithTon(@Ctx() ctx: SceneContext) {
    const command = jsonParse<{ command: string; currency: AnyCurrency }>(
      (ctx?.callbackQuery as { data: string })?.data,
    )

    try {
      if (!command || !command.currency) {
        await ctx.reply('Произошла ошибка, не удается получить данные из запроса')

        return
      }

      const { amount, defaultTransferFee, currency, conversionAmount, conversionCurrency } =
        await this.transactionService.checkingWithdrawal(ctx.from, {
          currency: command.currency,
          amount: AMOUNT_TO_WITHDRAW,
        })

      const { finalAmountToGet, serviceFee } = await this.transactionService.getAmountWithFees(
        {
          currency: conversionCurrency,
          amount: conversionAmount,
        },
        { defaultTransferFee },
      )

      const comissionFeeCurrency = `${transactionCurrencyLabels[defaultTransferFee.currency]} (${
        defaultTransferFee.currency
      })`

      this.logger.debug({
        amount,
        defaultTransferFee,
        currency,
        conversionAmount,
        conversionCurrency,
        finalAmountToGet,
        serviceFee,
      })

      const receiptInfoText = `
<b>Комиссии</b>:
Комиссия сети: ${truncate(defaultTransferFee.totalFee, 6)} ${comissionFeeCurrency}
Комиссия бота: ${truncate(serviceFee, 6)} ${comissionFeeCurrency} (${TRANSACTION_WITHDRAW_COMISSION}%)
      `

      await this.sharedService.tryToMutateOrReplyNewContent(ctx, {
        message: `Вы хотите вывести ${truncate(Number(amount), 4)} ${
          transactionCurrencyLabels[currency]
        } (${currency})\nВы получите на свой кошелек ~ ${truncate(
          finalAmountToGet.amount,
          4,
        )} ${comissionFeeCurrency}\n${receiptInfoText}`,
        keyboard: [
          [{ text: 'Меню оплат', callback_data: PAYMENT_CALLBACK_DATA.paymentMenu }],
          [{ text: 'Основное меню', callback_data: MAIN_CALLBACK_DATA.menu }],
          [
            {
              text: 'Подтвердить вывод',
              callback_data: jsonStringify({
                command: WITHDRAWAL_CALLBACK_DATA.userWithdrawWithTonApprove,
                currency: currency,
              }),
            },
          ],
          [{ text: 'Назад', callback_data: WITHDRAWAL_CALLBACK_DATA.runWithdrawal }],
        ],
      })
    } catch (error) {
      this.logger.error('Error with user withdraw with ton', error)

      if (!error?.status) {
        await ctx.reply('Произошла ошибка, попробуйте позже', {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Меню оплат', callback_data: PAYMENT_CALLBACK_DATA.paymentMenu }],
              [{ text: 'Основное меню', callback_data: MAIN_CALLBACK_DATA.menu }],
              [{ text: 'Назад', callback_data: WITHDRAWAL_CALLBACK_DATA.runWithdrawal }],
            ],
          },
        })

        return
      }

      if (error?.response?.code === ERROR_CODES.transaction.codes.TRANSACTION_NOT_ENOUGH_BALANCE) {
        await this.sharedService.tryToMutateOrReplyNewContent(ctx, {
          message: `Не достаточно средств на балансе для вывода ${transactionCurrencyLabels[command.currency]} (${
            command.currency
          })`,
          keyboard: [
            [{ text: 'Меню оплат', callback_data: PAYMENT_CALLBACK_DATA.paymentMenu }],
            [{ text: 'Основное меню', callback_data: MAIN_CALLBACK_DATA.menu }],
            [{ text: 'Назад', callback_data: WITHDRAWAL_CALLBACK_DATA.runWithdrawal }],
          ],
        })

        return
      }

      if (
        error?.response?.code === ERROR_CODES.transaction.codes.TRANSACTION_NOT_ENOUGH_BALANCE_FOR_MINIMAL_WITHDRAWAL
      ) {
        await this.sharedService.tryToMutateOrReplyNewContent(ctx, {
          message: error.response.message,
          keyboard: [
            [{ text: 'Меню оплат', callback_data: PAYMENT_CALLBACK_DATA.paymentMenu }],
            [{ text: 'Основное меню', callback_data: MAIN_CALLBACK_DATA.menu }],
            [{ text: 'Назад', callback_data: WITHDRAWAL_CALLBACK_DATA.runWithdrawal }],
          ],
        })

        return
      }
    }
  }

  @Command(WITHDRAWAL_CALLBACK_DATA.runWithdrawal)
  @Action(WITHDRAWAL_CALLBACK_DATA.runWithdrawal)
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async runWithdrawal(@Ctx() ctx: SceneContext) {
    try {
      const { hasBalance, defaultTransferFee, balancesWithConversionInfo } =
        await this.transactionService.getWithdrawBalance(ctx.from)

      const message = balancesWithConversionInfo.map((item) => {
        let text = `
На балансе: <b>${item.amount} ${transactionCurrencyLabels[item.currency]} (${item.currency})</b>
`
        text +=
          item.conversionRate !== 1
            ? `Доступно для вывода: <b>${item.conversionAmount} ${transactionCurrencyLabels['TON']} (TON)</b> по курсу: ${item.conversionRate} ${transactionCurrencyLabels['TON']}/${transactionCurrencyLabels['XTR']}`
            : `Доступно для вывода: <b>${item.conversionAmount} ${transactionCurrencyLabels['TON']} (TON)</b>`

        if (defaultTransferFee.totalFee * 2 > item.conversionAmount) {
          text += `\n<b>Однако</b>: <i>минимальная сумма для вывода: ${truncate(defaultTransferFee.totalFee * 2, 4)} ${
            transactionCurrencyLabels['TON']
          } (TON)</i>`
        }

        return text
      })

      const keyboard = [
        [{ text: 'Меню оплат', callback_data: PAYMENT_CALLBACK_DATA.paymentMenu }],
        [{ text: 'Меню кошельков', callback_data: WALLET_CALLBACK_DATA.wallets }],
        [{ text: 'Курсы валют', callback_data: WITHDRAWAL_CALLBACK_DATA.rates }],
      ]

      balancesWithConversionInfo.forEach((item) => {
        if (defaultTransferFee.totalFee * 2 < item.conversionAmount) {
          const data = {
            command: WITHDRAWAL_CALLBACK_DATA.userWithdrawWithTon,
            currency: item.currency,
          }
          keyboard.push([
            {
              text: `Вывести ${item.amount} ${transactionCurrencyLabels[item.currency]} (${item.currency})`,
              callback_data: jsonStringify(data),
            },
          ])
        }
      })

      keyboard.push([{ text: 'Основное меню', callback_data: MAIN_CALLBACK_DATA.menu }])

      await this.sharedService.tryToMutateOrReplyNewContent(ctx, {
        message: hasBalance
          ? `<b>Ваш баланс</b>\n${message.join(
              '\n',
            )}\n\nВы можете вывести средства на свой TON кошелек. Вывод производится в эквиваленте в валюте ${
              transactionCurrencyLabels['TON']
            } (TON)\n\n<i>При совершении вывода, валюты отличающиеся от TON на балансе будут сконвертированы в TON по курсу.</i>\n<i>Пожалуйста, возьмите во внимание, что комиссия за вывод средств составляет ${TRANSACTION_WITHDRAW_COMISSION}% от суммы вывода + комиссия сети <b>(${
              defaultTransferFee.totalFee
            } ${defaultTransferFee.currency})</b>.</i>`
          : 'На вашем балансе не найдено средств для совершения вывода, попробуйте пополнить баланс доступными способами!',
        keyboard,
      })
    } catch (error) {
      this.logger.error('Error with run withdrawal', error)

      await ctx.reply('Произошла ошибка, попробуйте позже', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Меню оплат', callback_data: PAYMENT_CALLBACK_DATA.paymentMenu }],
            [{ text: 'Основное меню', callback_data: MAIN_CALLBACK_DATA.menu }],
          ],
        },
      })
    }
  }
}
