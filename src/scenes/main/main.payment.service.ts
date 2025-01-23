import { Injectable, Logger } from '@nestjs/common'
import { Action, Command, Ctx, On, Update } from 'nestjs-telegraf'
import { TRANSACTION_DEPOSIT_COMISSION, TRANSACTION_DEPOSIT_COMISSION_NUMBER } from 'src/constants'
import { getMainOpenWebAppButton } from 'src/constants/keyboards'
import { AvailableChatTypes } from 'src/decorator'
import {
  TransactionBlockchainProvider,
  TransactionProvider,
  TransactionStatus,
  TransactionType,
  UserEntity,
} from 'src/entities'
import { ChatTelegrafGuard, UserTelegrafGuard, UseSafeGuards } from 'src/guards'
import { CustomConfigService, TransactionService } from 'src/modules'
import { WalletService } from 'src/modules/wallet'
import { SuccessfulPaymentType } from 'src/types'
import { SceneContext } from 'telegraf/typings/scenes'

import { SharedService } from '../shared'
import { MAIN_CALLBACK_DATA, PAYMENT_CALLBACK_DATA, WALLET_CALLBACK_DATA } from './constants'

@Update()
@Injectable()
export class MainPaymentService {
  private logger = new Logger(MainPaymentService.name)
  constructor(
    private readonly userEntity: UserEntity,
    private readonly customConfigService: CustomConfigService,
    private readonly transactionService: TransactionService,
    private readonly sharedService: SharedService,
    private readonly walletService: WalletService,
  ) {}

  @Command(PAYMENT_CALLBACK_DATA.paySupport)
  @Action(PAYMENT_CALLBACK_DATA.paySupport)
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async paySupport(@Ctx() ctx: SceneContext) {
    await ctx.reply(`
В боте желаний есть возможность оплатить что либо при помощи Telegram Stars и криптовалютой TON.

Однако не все оплаты подразумевают возврат средств, но если вы очень хотите вернуть средства - свяжитесь с разработчиком бота.
`)
  }

  @Command(PAYMENT_CALLBACK_DATA.supportXtr)
  @Action(PAYMENT_CALLBACK_DATA.supportXtr)
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async supportXtr(@Ctx() ctx: SceneContext) {
    await this.sharedService.tryToMutateOrReplyNewContent(ctx, {
      message: 'Выберите сумму пожертвования. Средства можно вернуть в течении 21 дня',
      keyboard: [
        [{ text: '50 ⭐️', callback_data: `${PAYMENT_CALLBACK_DATA.supportWithXtr} 50` }],
        [{ text: '100 ⭐️', callback_data: `${PAYMENT_CALLBACK_DATA.supportWithXtr} 100` }],
        [{ text: '200 ⭐️', callback_data: `${PAYMENT_CALLBACK_DATA.supportWithXtr} 200` }],
        [{ text: '500 ⭐️', callback_data: `${PAYMENT_CALLBACK_DATA.supportWithXtr} 500` }],
        [{ text: '1000 ⭐️', callback_data: `${PAYMENT_CALLBACK_DATA.supportWithXtr} 1000` }],
        [{ text: 'Способы оплат', callback_data: PAYMENT_CALLBACK_DATA.donates }],
      ],
    })
  }

  @Command(PAYMENT_CALLBACK_DATA.supportTon)
  @Action(PAYMENT_CALLBACK_DATA.supportTon)
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async supportTon(@Ctx() ctx: SceneContext) {
    await this.sharedService.tryToMutateOrReplyNewContent(ctx, {
      message: 'Выберите сумму пожертвования. Средства нельзя вернуть',
      keyboard: [
        [{ text: '0.05 TON', callback_data: `${PAYMENT_CALLBACK_DATA.supportWithTon} 0.05` }],
        [{ text: '0.1 TON', callback_data: `${PAYMENT_CALLBACK_DATA.supportWithTon} 0.1` }],
        [{ text: '0.5 TON', callback_data: `${PAYMENT_CALLBACK_DATA.supportWithTon} 0.5` }],
        [{ text: '1 TON', callback_data: `${PAYMENT_CALLBACK_DATA.supportWithTon} 1` }],
        [{ text: '5 TON', callback_data: `${PAYMENT_CALLBACK_DATA.supportWithTon} 5` }],
        [{ text: 'Способы оплат', callback_data: PAYMENT_CALLBACK_DATA.donates }],
      ],
    })
  }

  @Command(PAYMENT_CALLBACK_DATA.userTopupTon)
  @Action(PAYMENT_CALLBACK_DATA.userTopupTon)
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async userTopupTon(@Ctx() ctx: SceneContext) {
    await this.sharedService.tryToMutateOrReplyNewContent(ctx, {
      message: 'Выберите сумму пополнения баланса. Средства нельзя вернуть',
      keyboard: [
        [{ text: '0.05 TON', callback_data: `${PAYMENT_CALLBACK_DATA.userTopupWithTon} 0.05` }],
        [{ text: '0.1 TON', callback_data: `${PAYMENT_CALLBACK_DATA.userTopupWithTon} 0.1` }],
        [{ text: '0.5 TON', callback_data: `${PAYMENT_CALLBACK_DATA.userTopupWithTon} 0.5` }],
        [{ text: '1 TON', callback_data: `${PAYMENT_CALLBACK_DATA.userTopupWithTon} 1` }],
        [{ text: '5 TON', callback_data: `${PAYMENT_CALLBACK_DATA.userTopupWithTon} 5` }],
        [{ text: 'Способы оплат', callback_data: PAYMENT_CALLBACK_DATA.topupBalance }],
      ],
    })
  }

  @Command(PAYMENT_CALLBACK_DATA.paymentMenu)
  @Action(PAYMENT_CALLBACK_DATA.paymentMenu)
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async paymentsMenu(@Ctx() ctx: SceneContext) {
    await this.sharedService.tryToMutateOrReplyNewContent(ctx, {
      message:
        '<b>Меню платежей</b>\n\nВы можете оплатить что либо предпочтительным Вами способом\n\nУчтите важный момент: можно вернуть только оплату в Telegram Stars',
      keyboard: [
        [{ text: 'Донаты', callback_data: PAYMENT_CALLBACK_DATA.donates }],
        [{ text: 'Пополнение баланса', callback_data: PAYMENT_CALLBACK_DATA.topupBalance }],
        [{ text: 'Меню', callback_data: MAIN_CALLBACK_DATA.menu }],
      ],
    })
  }

  @Command(PAYMENT_CALLBACK_DATA.topupBalance)
  @Action(PAYMENT_CALLBACK_DATA.topupBalance)
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async topupBalanceMenu(@Ctx() ctx: SceneContext) {
    await this.sharedService.tryToMutateOrReplyNewContent(ctx, {
      message: '<b>Выберите способ оплаты</b>',
      keyboard: [
        [{ text: 'Пополнить баланс при помощи ⭐️', callback_data: PAYMENT_CALLBACK_DATA.userTopupXtr }],
        [{ text: 'Пополнить баланс при помощи TON', callback_data: PAYMENT_CALLBACK_DATA.userTopupTon }],
        [{ text: 'Меню оплат', callback_data: PAYMENT_CALLBACK_DATA.paymentMenu }],
      ],
    })
  }

  @Command(PAYMENT_CALLBACK_DATA.donates)
  @Action(PAYMENT_CALLBACK_DATA.donates)
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async donatesMenu(@Ctx() ctx: SceneContext) {
    await this.sharedService.tryToMutateOrReplyNewContent(ctx, {
      message: '<b>Выберите способ оплаты</b>',
      keyboard: [
        [{ text: 'Донат при помощи ⭐️', callback_data: PAYMENT_CALLBACK_DATA.supportXtr }],
        [{ text: 'Донат при помощи TON', callback_data: PAYMENT_CALLBACK_DATA.supportTon }],
        [{ text: 'Меню оплат', callback_data: PAYMENT_CALLBACK_DATA.paymentMenu }],
      ],
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

  @Command(PAYMENT_CALLBACK_DATA.supportWithTon)
  @Action(new RegExp(PAYMENT_CALLBACK_DATA.supportWithTon))
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async supportWithTon(@Ctx() ctx: SceneContext) {
    const [, amount] = (ctx as any)?.update?.callback_query?.data?.split(' ')

    try {
      if (!amount) {
        await ctx.reply('Не удалось получить сумму оплаты, попробуйте еще раз или обратитесь к разработчику')

        return
      }

      this.walletService
        .sendTonTransaction(
          ctx?.chat?.id,
          amount,
          'deposit',
          'donate to developer by user',
          async (walletInfo, address, isTestnet) => {
            let link = ''

            if ('universalLink' in walletInfo) {
              link = walletInfo.universalLink
            } else if ('deepLink' in walletInfo) {
              link = walletInfo.deepLink as string
            }

            await this.sharedService.tryToMutateOrReplyNewContent(ctx, {
              message: `Транзакция отправлена на подписание. Можно подписать в течении 15 минут\n\nВаш адрес: ${address} ${
                isTestnet ? '(TESTNET)' : ''
              }`,
              keyboard: link
                ? [
                    [
                      {
                        text: `Подписать транзакцию в ${walletInfo.name}`,
                        url: link,
                      },
                    ],
                  ]
                : undefined,
            })
          },
        )
        .then(async (response) => {
          if (response.isError) {
            await this.sharedService.tryToMutateOrReplyNewContent(ctx, {
              message: response.message,
              keyboard: [
                [{ text: 'Попробовать еще раз', callback_data: PAYMENT_CALLBACK_DATA.supportTon }],
                [{ text: 'Кошельки', callback_data: WALLET_CALLBACK_DATA.wallets }],
                [{ text: 'Меню', callback_data: MAIN_CALLBACK_DATA.menu }],
              ],
            })

            return
          }

          await this.transactionService.createWithPartialDto({
            userId: ctx?.from?.id?.toString(),
            currency: 'TON',
            status: TransactionStatus.PENDING,
            provider: TransactionProvider.BLOCKCHAIN,
            type: TransactionType.SUPPORT,
            chain: response.transaction.chain,
            blockchainProvider: TransactionBlockchainProvider.TON,
            actionAddress: response.transaction.walletAddress,
            amount: amount,
            providerInvoiceId: response.transaction.hash,
          })

          return this.sharedService.tryToMutateOrReplyNewContent(ctx, {
            message:
              '<b>Транзакция успешно отправлена</b>\n\nПожалуйста, дождитесь подтверждения сети, детали по операции вы сможете узнать в TonScan',
            keyboard: [
              [{ text: 'Открыть TonScan', url: response.transaction.scanUrl }],
              [
                getMainOpenWebAppButton(
                  `${this.customConfigService.miniAppUrl}/transaction`,
                  'Открыть список транзакций',
                ),
              ],
              [{ text: 'К меню оплат', callback_data: PAYMENT_CALLBACK_DATA.paymentMenu }],
            ],
          })
        })
        .catch(async (error) => {
          this.logger.error('Error with support with ton', error)

          const isRejected = error.message.indexOf('UserRejectsError:') > -1

          await this.sharedService.tryToMutateOrReplyNewContent(ctx, {
            message: isRejected ? 'Транзакция отменена' : 'Ошибка при отправке транзакции, попробуйте позже',
            keyboard: [
              [{ text: 'Попробовать еще раз', callback_data: PAYMENT_CALLBACK_DATA.supportTon }],
              [{ text: 'Кошельки', callback_data: WALLET_CALLBACK_DATA.wallets }],
              [{ text: 'Меню', callback_data: MAIN_CALLBACK_DATA.menu }],
            ],
          })
        })

      return
    } catch (error) {
      this.logger.error('Error with support with ton', error)

      await this.sharedService.tryToMutateOrReplyNewContent(ctx, {
        message: 'Ошибка при отправке транзакции, попробуйте позже',
        keyboard: [
          [{ text: 'Попробовать еще раз', callback_data: PAYMENT_CALLBACK_DATA.supportTon }],
          [{ text: 'Кошельки', callback_data: WALLET_CALLBACK_DATA.wallets }],
          [{ text: 'Меню', callback_data: MAIN_CALLBACK_DATA.menu }],
        ],
      })
    }
  }

  @Command(PAYMENT_CALLBACK_DATA.userTopupWithTon)
  @Action(new RegExp(PAYMENT_CALLBACK_DATA.userTopupWithTon))
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async userTopupWithTon(@Ctx() ctx: SceneContext) {
    const [, amount] = (ctx as any)?.update?.callback_query?.data?.split(' ')

    try {
      if (!amount) {
        await ctx.reply('Не удалось получить сумму оплаты, попробуйте еще раз или обратитесь к разработчику')

        return
      }

      this.walletService
        .sendTonTransaction(
          ctx?.chat?.id,
          amount,
          'deposit',
          'user topup balance',
          async (walletInfo, address, isTestnet) => {
            let link = ''

            if ('universalLink' in walletInfo) {
              link = walletInfo.universalLink
            } else if ('deepLink' in walletInfo) {
              link = walletInfo.deepLink as string
            }

            await this.sharedService.tryToMutateOrReplyNewContent(ctx, {
              message: `Транзакция отправлена на подписание. Можно подписать в течении 15 минут\n\nВаш адрес: ${address} ${
                isTestnet ? '(TESTNET)' : ''
              }`,
              keyboard: link
                ? [
                    [
                      {
                        text: `Подписать транзакцию в ${walletInfo.name}`,
                        url: link,
                      },
                    ],
                  ]
                : undefined,
            })
          },
        )
        .then(async (response) => {
          if (response.isError) {
            await this.sharedService.tryToMutateOrReplyNewContent(ctx, {
              message: response.message,
              keyboard: [
                [{ text: 'Попробовать еще раз', callback_data: PAYMENT_CALLBACK_DATA.userTopupTon }],
                [{ text: 'Кошельки', callback_data: WALLET_CALLBACK_DATA.wallets }],
                [{ text: 'Меню', callback_data: MAIN_CALLBACK_DATA.menu }],
              ],
            })

            return
          }

          await this.transactionService.createWithPartialDto({
            userId: ctx?.from?.id?.toString(),
            currency: 'TON',
            status: TransactionStatus.PENDING,
            provider: TransactionProvider.BLOCKCHAIN,
            type: TransactionType.USER_TOPUP,
            chain: response.transaction.chain,
            blockchainProvider: TransactionBlockchainProvider.TON,
            actionAddress: response.transaction.walletAddress,
            amount: amount,
            providerInvoiceId: response.transaction.hash,
          })

          return this.sharedService.tryToMutateOrReplyNewContent(ctx, {
            message:
              '<b>Транзакция успешно отправлена</b>\n\nПожалуйста, дождитесь подтверждения сети, детали по операции вы сможете узнать в TonScan',
            keyboard: [
              [{ text: 'Открыть TonScan', url: response.transaction.scanUrl }],
              [
                getMainOpenWebAppButton(
                  `${this.customConfigService.miniAppUrl}/transaction`,
                  'Открыть список транзакций',
                ),
              ],
              [{ text: 'К меню оплат', callback_data: PAYMENT_CALLBACK_DATA.paymentMenu }],
            ],
          })
        })
        .catch(async (error) => {
          this.logger.error('Error with support with ton', error)

          const isRejected = error.message.indexOf('UserRejectsError:') > -1

          await this.sharedService.tryToMutateOrReplyNewContent(ctx, {
            message: isRejected ? 'Транзакция отменена' : 'Ошибка при отправке транзакции, попробуйте позже',
            keyboard: [
              [{ text: 'Попробовать еще раз', callback_data: PAYMENT_CALLBACK_DATA.supportTon }],
              [{ text: 'Кошельки', callback_data: WALLET_CALLBACK_DATA.wallets }],
              [{ text: 'Меню', callback_data: MAIN_CALLBACK_DATA.menu }],
            ],
          })
        })

      return
    } catch (error) {
      this.logger.error('Error with support with ton', error)

      await this.sharedService.tryToMutateOrReplyNewContent(ctx, {
        message: 'Ошибка при отправке транзакции, попробуйте позже',
        keyboard: [
          [{ text: 'Попробовать еще раз', callback_data: PAYMENT_CALLBACK_DATA.supportTon }],
          [{ text: 'Кошельки', callback_data: WALLET_CALLBACK_DATA.wallets }],
          [{ text: 'Меню', callback_data: MAIN_CALLBACK_DATA.menu }],
        ],
      })
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
