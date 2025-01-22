import { Injectable, Logger } from '@nestjs/common'
import { Action, Command, Ctx, On, Update } from 'nestjs-telegraf'
import { TRANSACTION_DEPOSIT_COMISSION, TRANSACTION_DEPOSIT_COMISSION_NUMBER } from 'src/constants'
import { getMainOpenWebAppButton } from 'src/constants/keyboards'
import { AvailableChatTypes } from 'src/decorator'
import { TransactionProvider, TransactionStatus, TransactionType, UserEntity } from 'src/entities'
import { ChatTelegrafGuard, UserTelegrafGuard, UseSafeGuards } from 'src/guards'
import { CustomConfigService, TransactionService } from 'src/modules'
import { SuccessfulPaymentType } from 'src/types'
import { SceneContext } from 'telegraf/typings/scenes'

import { PAYMENT_CALLBACK_DATA } from './constants'

@Update()
@Injectable()
export class MainPaymentService {
  private logger = new Logger(MainPaymentService.name)
  constructor(
    private readonly userEntity: UserEntity,
    private readonly customConfigService: CustomConfigService,
    private readonly transactionService: TransactionService,
  ) {}

  @Command(PAYMENT_CALLBACK_DATA.paySupport)
  @Action(PAYMENT_CALLBACK_DATA.paySupport)
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async paySupport(@Ctx() ctx: SceneContext) {
    await ctx.reply(`
В боте желаний есть возможность оплатить что либо при помощи Telegram Stars.

Однако не все оплаты подразумевают возврат средств, но если вы очень хотите вернуть средства - свяжитесь с разработчиком бота.
`)
  }

  @Command(PAYMENT_CALLBACK_DATA.supportXtr)
  @Action(PAYMENT_CALLBACK_DATA.supportXtr)
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async supportXtr(@Ctx() ctx: SceneContext) {
    await ctx.reply('Выберите сумму пожертвования. Средства можно вернуть в течении 21 дня', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '50 ⭐️', callback_data: `${PAYMENT_CALLBACK_DATA.supportWithXtr} 50` }],
          [{ text: '100 ⭐️', callback_data: `${PAYMENT_CALLBACK_DATA.supportWithXtr} 100` }],
          [{ text: '200 ⭐️', callback_data: `${PAYMENT_CALLBACK_DATA.supportWithXtr} 200` }],
          [{ text: '500 ⭐️', callback_data: `${PAYMENT_CALLBACK_DATA.supportWithXtr} 500` }],
          [{ text: '1000 ⭐️', callback_data: `${PAYMENT_CALLBACK_DATA.supportWithXtr} 1000` }],
        ],
      },
    })
  }

  @Command(PAYMENT_CALLBACK_DATA.userTopupXtr)
  @Action(PAYMENT_CALLBACK_DATA.userTopupXtr)
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async userTopupXtr(@Ctx() ctx: SceneContext) {
    await ctx.reply(
      `Выберите сумму пополнения баланса. Средства можно вернуть в течении 21 дня (вместе с комиссией). При оплате, будет удержана комиссия в размере ${TRANSACTION_DEPOSIT_COMISSION}%`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '50 ⭐️', callback_data: `${PAYMENT_CALLBACK_DATA.userTopupWithXtr} 50` }],
            [{ text: '100 ⭐️', callback_data: `${PAYMENT_CALLBACK_DATA.userTopupWithXtr} 100` }],
            [{ text: '200 ⭐️', callback_data: `${PAYMENT_CALLBACK_DATA.userTopupWithXtr} 200` }],
            [{ text: '500 ⭐️', callback_data: `${PAYMENT_CALLBACK_DATA.userTopupWithXtr} 500` }],
            [{ text: '1000 ⭐️', callback_data: `${PAYMENT_CALLBACK_DATA.userTopupWithXtr} 1000` }],
          ],
        },
      },
    )
  }

  @Command(PAYMENT_CALLBACK_DATA.supportWithXtr)
  @Action(new RegExp(PAYMENT_CALLBACK_DATA.supportWithXtr))
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async supportWithXtr(@Ctx() ctx: SceneContext) {
    const [, amount] = (ctx as any)?.update?.callback_query?.data?.split(' ')

    try {
      if (!amount) {
        await ctx.reply('Не удалось получить сумму оплаты, попробуйте еще раз или обратитесь к разработчику')

        return
      }

      await ctx.replyWithInvoice({
        title: 'Поддержка разработчика',
        description: 'Ваш вклад в развитие бота и на хлеб разработчику. Средства можно вернуть в течении 21 дня',
        payload: 'support_with_xtr',
        provider_token: '',
        prices: [{ label: `Оплатить ${amount} ⭐️`, amount: Number(amount) }],
        currency: 'XTR',
      })
    } catch (error) {
      this.logger.error('Error with support with xtr', error)
      await ctx.reply('Ошибка при обработке оплаты, попробуйте позже')
    }
  }

  @Command(PAYMENT_CALLBACK_DATA.userTopupWithXtr)
  @Action(new RegExp(PAYMENT_CALLBACK_DATA.userTopupWithXtr))
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async userTopupWithXtr(@Ctx() ctx: SceneContext) {
    const [, amount] = (ctx as any)?.update?.callback_query?.data?.split(' ')

    try {
      if (!amount) {
        await ctx.reply('Не удалось получить сумму оплаты, попробуйте еще раз или обратитесь к разработчику')

        return
      }

      await ctx.replyWithInvoice({
        title: 'Пополнение баланса',
        description: `Пополнение баланса для использования в боте. К зачислению: ${
          Number(amount) - Number(amount) * TRANSACTION_DEPOSIT_COMISSION_NUMBER
        } ⭐️`,
        payload: 'user_topup_with_xtr',
        provider_token: '',
        prices: [{ label: `Оплатить ${amount} ⭐️`, amount: Number(amount) }],
        currency: 'XTR',
      })
    } catch (error) {
      this.logger.error('Error with support with xtr', error)
      await ctx.reply('Ошибка при обработке оплаты, попробуйте позже')
    }
  }

  @On('pre_checkout_query')
  async preCheckoutQuery(@Ctx() ctx: SceneContext) {
    try {
      const user = await this.userEntity.get(ctx?.from?.id?.toString())
      this.logger.log(ctx?.preCheckoutQuery)

      await ctx
        .answerPreCheckoutQuery(!!user, user ? 'Оплата поддерживается' : 'Оплата не поддерживается')
        .catch((errorData) => {
          this.logger.error('Error with pre checkout query', errorData)
        })
    } catch (error) {
      this.logger.error('Error with pre checkout query', error)
    }
  }

  @On('successful_payment')
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async successfulPayment(@Ctx() ctx: SceneContext) {
    const successfulPayment: SuccessfulPaymentType = (ctx?.message as any)?.successful_payment
    this.logger.log(ctx?.from, ctx?.message, ctx?.update, successfulPayment)

    let type: TransactionType

    if (successfulPayment?.invoice_payload?.indexOf('support_with_xtr') > -1) {
      type = TransactionType.SUPPORT
    }

    if (successfulPayment?.invoice_payload?.indexOf('user_topup_with_xtr') > -1) {
      type = TransactionType.USER_TOPUP
    }

    const response = await this.transactionService.createWithPartialDto({
      userId: ctx?.from?.id?.toString(),
      currency: successfulPayment?.currency,
      status: TransactionStatus.CONFIRMED,
      provider: TransactionProvider.TELEGRAM,
      type,
      amount: successfulPayment?.total_amount?.toString(),
      providerInvoiceId: successfulPayment?.telegram_payment_charge_id,
    })

    try {
      await this.transactionService.canRefund(response.id, response)

      await ctx.reply(
        `
Оплата подтверждена, спасибо за Вашу поддержку!

Вы можете вернуть средства в течении 21 дня после оплаты
`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                getMainOpenWebAppButton(
                  `${this.customConfigService.miniAppUrl}/transaction`,
                  'Открыть список транзакций',
                ),
              ],
              [
                {
                  text: 'Вернуть средства',
                  callback_data: `${PAYMENT_CALLBACK_DATA.refundTransaction} ${response.id}`,
                },
              ],
            ],
          },
        },
      )
    } catch (error) {
      this.logger.error('Error with successful payment', error)
      await ctx.reply(
        `
Оплата подтверждена, спасибо за Вашу поддержку!

Данную оплату невозможно вернуть, обратитесь к разработчику бота.
`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                getMainOpenWebAppButton(
                  `${this.customConfigService.miniAppUrl}/transaction`,
                  'Открыть список транзакций',
                ),
              ],
            ],
          },
        },
      )
    }
  }
}
