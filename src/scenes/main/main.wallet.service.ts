import { Injectable, Logger } from '@nestjs/common'
import { Wallet } from '@tonconnect/sdk'
import * as fs from 'fs'
import { Action, Ctx, Update } from 'nestjs-telegraf'
import { join } from 'path'
import * as QRCode from 'qrcode'
import { disconnectWalletBtn, getWalletMainKeyboard, showAvailableWalletsBtn } from 'src/constants'
import { AvailableChatTypes } from 'src/decorator'
import { ChatTelegrafGuard, UserTelegrafGuard, UseSafeGuards } from 'src/guards'
import { jsonParse, jsonStringify } from 'src/helpers'
import { WalletService } from 'src/modules/wallet'
import { TonConnectWallets } from 'src/services'
import { SceneContext } from 'telegraf/typings/scenes'

import { WALLET_CALLBACK_DATA } from './constants'

@Update()
@Injectable()
export class MainWalletService {
  private logger = new Logger(MainWalletService.name)
  constructor(private readonly walletService: WalletService, private readonly tonConnectWallets: TonConnectWallets) {}

  private async editMedia(ctx: SceneContext, messageId: number, chatId: number, link: string, caption?: string) {
    const fileName = 'QR-code-' + Math.round(Math.random() * 10000000000)

    try {
      await QRCode.toFile(join(__dirname, `./qrcodes/${fileName}`), link)
      await ctx.telegram.editMessageMedia(chatId, messageId, '0', {
        type: 'photo',
        media: `attach://${fileName}`,
        caption,
      })
    } catch (error) {
      this.logger.error('Error editing media', error)
    } finally {
      await new Promise((r) => fs.rm(join(__dirname, `./qrcodes/${fileName}`), r))
    }
  }

  @Action(new RegExp(WALLET_CALLBACK_DATA.wallets))
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async walletsMenu(@Ctx() ctx: SceneContext) {
    if (ctx.callbackQuery?.message && !(ctx.callbackQuery?.message as any).photo?.length) {
      await ctx
        .editMessageText('Внешние криптокошельки предназначены для работы с выводами внутреннего баланса в TON Coin')
        .catch()

      await ctx
        .editMessageReplyMarkup({
          inline_keyboard: getWalletMainKeyboard(),
        })
        .catch()
    } else {
      await ctx.reply('Внешние криптокошельки предназначены для работы с выводами внутреннего баланса в TON Coin', {
        reply_markup: {
          inline_keyboard: getWalletMainKeyboard(),
        },
      })
    }
  }

  @Action(new RegExp(WALLET_CALLBACK_DATA.connectedWallet))
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async connectedWallet(@Ctx() ctx: SceneContext) {
    const handleShowMessage = async (message: string, isError = false) => {
      const isCaption = !!ctx.callbackQuery?.message && !!(ctx.callbackQuery?.message as any).photo?.length

      const keyboard = isError
        ? [[showAvailableWalletsBtn()], [{ text: 'Назад', callback_data: WALLET_CALLBACK_DATA.wallets }]]
        : [[disconnectWalletBtn], [{ text: 'Назад', callback_data: WALLET_CALLBACK_DATA.wallets }]]

      if (!isCaption && !!ctx.callbackQuery?.message) {
        await ctx.editMessageText(message, {
          reply_markup: {
            inline_keyboard: keyboard,
          },
        })

        return
      }

      if (isCaption && !!ctx.callbackQuery?.message) {
        await ctx.editMessageCaption(message)

        await ctx.editMessageReplyMarkup({
          inline_keyboard: keyboard,
        })

        return
      }

      await ctx.reply(message, {
        reply_markup: {
          inline_keyboard: keyboard,
        },
      })
    }

    const handleSuccess = async (address: string, walletName: string, balance: string, isTestnet: boolean) => {
      await handleShowMessage(
        `Подключен кошелек ${walletName}\nВаш адрес: ${address} \nБаланс кошелька: ${balance} \n${
          isTestnet ? '(TESTNET)' : ''
        }`,
        false,
      )
    }

    const handleError = async () => {
      await handleShowMessage(
        'Нет подключенных кошельков, для совершения транзакций, попробуйте подключить один из вариантов',
        true,
      )
    }

    const { isError, address, walletName, balance, isTestnet } = await this.walletService.showConnectedWallet(
      ctx.chat.id,
    )

    if (isError) {
      await handleError()

      return
    }

    await handleSuccess(address, walletName, `${balance.amount} ${balance.currency}`, isTestnet)
  }

  @Action(new RegExp(WALLET_CALLBACK_DATA.disconnectWallet))
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async disconnectWallet(@Ctx() ctx: SceneContext) {
    const isConnected = await this.checkConnectedWallet(ctx, false)

    if (!isConnected) {
      await ctx.reply('У вас нет подключенного кошелька', {
        reply_markup: {
          inline_keyboard: [[{ text: 'Назад', callback_data: WALLET_CALLBACK_DATA.wallets }]],
        },
      })

      return
    }

    const handleShowMessage = async (message: string, isError = false) => {
      const isCaption = !!ctx.callbackQuery?.message && !!(ctx.callbackQuery?.message as any).photo?.length

      const keyboard = isError
        ? [
            [showAvailableWalletsBtn('Подключить другой кошелек')],
            [{ text: 'Назад', callback_data: WALLET_CALLBACK_DATA.wallets }],
          ]
        : [[showAvailableWalletsBtn()], [{ text: 'Назад', callback_data: WALLET_CALLBACK_DATA.wallets }]]

      if (!isCaption && !!ctx.callbackQuery?.message) {
        await ctx.editMessageText(message, {
          reply_markup: {
            inline_keyboard: keyboard,
          },
        })

        return
      }

      if (isCaption && !!ctx.callbackQuery?.message) {
        await ctx.editMessageCaption(message)

        await ctx.editMessageReplyMarkup({
          inline_keyboard: keyboard,
        })

        return
      }

      await ctx.reply(message, {
        reply_markup: {
          inline_keyboard: keyboard,
        },
      })
    }

    const handleSuccess = async (address: string, walletName: string) => {
      await handleShowMessage(`Кошелек ${walletName} отключен\nАдрес отключенного кошелька: ${address}`, false)
    }

    const handleError = async () => {
      await handleShowMessage(
        'Нет подключенных кошельков, для совершения транзакций, попробуйте подключить один из вариантов',
        true,
      )
    }

    const { isError, address, walletName } = await this.walletService.disconnectWallet(ctx.chat.id)

    if (isError) {
      await handleError()

      return
    }

    await handleSuccess(address, walletName)
  }

  private async checkConnectedWallet(ctx: SceneContext, throwError = true) {
    const { isError, walletName, address } = await this.walletService.showConnectedWallet(ctx.chat.id)

    if (!isError && throwError) {
      await ctx.reply(
        `У вас уже подключен ${walletName}\nС адресом: ${address}\nЧтобы подключить новый кошелек, отключите старый`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Отключить кошелек', callback_data: WALLET_CALLBACK_DATA.disconnectWallet }],
              [{ text: 'Назад', callback_data: WALLET_CALLBACK_DATA.wallets }],
            ],
          },
        },
      )

      return true
    }

    if (!isError && !throwError) {
      return true
    }

    return false
  }

  @Action(new RegExp(WALLET_CALLBACK_DATA.connectWallet))
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async connectWallet(@Ctx() ctx: SceneContext) {
    const isConnected = await this.checkConnectedWallet(ctx)

    if (isConnected) {
      return
    }

    const command = jsonParse<{ method: string; data: string }>((ctx?.callbackQuery as { data: string })?.data)

    if (!command || !command.data) {
      await ctx.reply('Произошла ошибка, не удается получить данные из запроса')

      return
    }

    const handler = async (wallet: Wallet) => {
      const walletName =
        (await this.tonConnectWallets.getWalletInfo(wallet.device.appName))?.name || wallet.device.appName

      await ctx.reply(`Кошелек ${walletName} подключен!`, {
        reply_markup: {
          inline_keyboard: getWalletMainKeyboard(),
        },
      })
    }

    const errorHandler = async (error: Error) => {
      await ctx.reply(`Произошла ошибка при подключении кошелька: ${error.message}`)
    }

    const { link } = await this.walletService.tryToConnectToWallet(ctx.chat.id, command.data, handler, errorHandler)

    await this.editMedia(ctx, ctx.callbackQuery?.message?.message_id, ctx.callbackQuery?.message?.chat.id, link)

    await ctx
      ?.editMessageCaption('Откройте ссылку, если QR не открывается или это не удобный для вас способ подключения')
      .catch()

    await ctx.editMessageReplyMarkup({
      inline_keyboard: [
        [
          {
            text: 'Открыть ссылку',
            url: `https://ton-connect.github.io/open-tc?connect=${encodeURIComponent(link)}`,
          },
        ],
        [
          {
            text: 'Список доступных кошельков',
            callback_data: jsonStringify({ method: WALLET_CALLBACK_DATA.walletList }),
          },
        ],
      ],
    })
  }

  @Action(new RegExp(WALLET_CALLBACK_DATA.walletList))
  @AvailableChatTypes('private')
  @UseSafeGuards(ChatTelegrafGuard, UserTelegrafGuard)
  async walletList(@Ctx() ctx: SceneContext) {
    const isConnected = await this.checkConnectedWallet(ctx)

    if (isConnected) {
      return
    }

    const command = jsonParse<{ method: string; data: string }>((ctx?.callbackQuery as { data: string })?.data)

    const { data } = command

    const handler = async (wallet: Wallet) => {
      const walletName =
        (await this.tonConnectWallets.getWalletInfo(wallet.device.appName))?.name || wallet.device.appName

      await ctx.reply(`Кошелек ${walletName} подключен!`, {
        reply_markup: {
          inline_keyboard: getWalletMainKeyboard(),
        },
      })
    }

    const errorHandler = async (error: Error) => {
      await ctx.reply(`Произошла ошибка при подключении кошелька: ${error.message}`)
    }

    const { link, wallets, image } = await this.walletService.getWalletListWithLink(
      ctx.chat.id,
      undefined,
      handler,
      errorHandler,
    )

    if (!wallets.length) {
      await ctx.sendMessage('Произошла ошибка, не удается получить список доступных для пользователя кошельков')

      return
    }

    const [start, end] = !data ? [0, 4] : data?.split('_').map(Number)

    const isPaginatedScenario = start && end

    const onlyFourWallets = [...wallets]
      .map((wallet) => ({
        text: wallet.name,
        callback_data: JSON.stringify({ method: WALLET_CALLBACK_DATA.connectWallet, data: wallet.appName }),
      }))
      .slice(start, end)
    const hasLastPage = wallets.length > end
    const isFirstPage = start === 0

    const messageText =
      'Выберите кошелек для подключения или воспользуйтесь универсальным способом (рекомендуется выбрать конкретный кошелек)'

    const keyboard = [
      onlyFourWallets?.slice(0, 2),
      onlyFourWallets?.slice(2, 4),
      [
        ...(isFirstPage
          ? []
          : [
              {
                text: 'Предыдущая страница',
                callback_data: jsonStringify({
                  method: WALLET_CALLBACK_DATA.walletList,
                  data: `${start ? start - 4 : 0}_${end ? end - 4 : 4}`,
                }),
              },
            ]),
        ...(!hasLastPage
          ? []
          : [
              {
                text: 'Следующая страница',
                callback_data: jsonStringify({
                  method: WALLET_CALLBACK_DATA.walletList,
                  data: `${start ? start + 4 : 4}_${end ? end + 4 : 8}`,
                }),
              },
            ]),
      ],
      [
        {
          text: 'Подключить универсальным способом',
          url: `https://ton-connect.github.io/open-tc?connect=${encodeURIComponent(link)}`,
        },
      ],
      [{ text: 'Назад', callback_data: WALLET_CALLBACK_DATA.wallets }],
    ]

    if ((ctx?.callbackQuery?.message as any)?.photo) {
      if (!isPaginatedScenario) {
        await this.editMedia(ctx, ctx.callbackQuery?.message?.message_id, ctx.callbackQuery?.message?.chat.id, link)
      }

      try {
        await ctx?.editMessageCaption(messageText).catch()
      } catch (error) {
        this.logger.error('Error editing media', error)
      }

      await ctx.editMessageReplyMarkup({
        inline_keyboard: keyboard,
      })
    } else {
      await ctx?.replyWithPhoto(
        { source: image },
        { caption: messageText, reply_markup: { inline_keyboard: keyboard } },
      )
    }
  }
}
