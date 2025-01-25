import { UserRole, validateGuardRole, WishDocument } from 'src/entities'
import { jsonStringify, time } from 'src/helpers'
import {
  MAIN_CALLBACK_DATA,
  PAYMENT_CALLBACK_DATA,
  SUPER_ADMIN_CALLBACK_DATA,
  WALLET_CALLBACK_DATA,
} from 'src/scenes/main/constants'
import { WISH_CALLBACK_DATA } from 'src/scenes/wish/constants'
import { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram'

import { KeyboardType, PaginatedKeyboardItem } from './types'

export const getMainOpenWebAppButton = (url: string, customText?: string) => ({
  text: customText || 'Mini-App (Веб версия)',
  web_app: { url },
})

export const getAnotherUserWishListById = (userId: string, username?: string) => [
  {
    text: `Посмотреть желания пользователя ${username ? `@${username}` : ''}`,
    callback_data: `${WISH_CALLBACK_DATA.get_another_user_wish_list_by_id} ${userId}`,
  },
]

export const getMainKeyboards = (options?: KeyboardType) => {
  const { webAppUrl, userRoles, wishPagination } = options || {}

  const btns: InlineKeyboardButton[][] = [
    [{ text: 'Меню желаний', callback_data: WISH_CALLBACK_DATA.openWishScene }],
    [{ text: 'Поделиться по ссылке', callback_data: WISH_CALLBACK_DATA.shareWishList }],
  ]

  if (webAppUrl) {
    btns.push([getMainOpenWebAppButton(webAppUrl)])
  }

  btns.push([{ text: 'Реферальная система', callback_data: MAIN_CALLBACK_DATA.refferalSystem }])
  btns.push([{ text: 'Управление кошельками', callback_data: WALLET_CALLBACK_DATA.wallets }])
  btns.push([{ text: 'Меню оплат', callback_data: PAYMENT_CALLBACK_DATA.paymentMenu }])

  if (userRoles && validateGuardRole(userRoles, [UserRole.ADMIN, UserRole.ANALYTIC])) {
    btns.push([{ text: 'Сервисные команды', callback_data: SUPER_ADMIN_CALLBACK_DATA.superMenu }])
  }

  if (wishPagination) {
    const { showed, total, sharedUserId, createdAt } = wishPagination

    const command: PaginatedKeyboardItem = {
      /**
       * Не важно, так как это пагинация с учетом userId
       * Название параметров такие, так как у ТГ есть ограничение в 76 байт на команду
       */
      c: WISH_CALLBACK_DATA.getAllWishListPaginatedVariant,
      p: {
        s: showed,
        t: total,
        i: sharedUserId,
        c: time(createdAt).unix(),
      },
    }

    if (showed < total) {
      const hasMany = total - showed > 5
      btns.push([
        {
          text: `Показать еще (${hasMany ? 5 : total - showed}${hasMany ? `/${total - showed}` : ''})`,
          callback_data: jsonStringify(command),
        },
      ])
    }
  }

  return btns
}

export const getSuperKeyboards = (options?: KeyboardType) => {
  const { userRoles } = options || {}

  const btns: InlineKeyboardButton[][] = []

  if (validateGuardRole(userRoles, [UserRole.ADMIN])) {
    btns.push([{ text: 'Update User Role To Admin', callback_data: SUPER_ADMIN_CALLBACK_DATA.updateUserRoleToUser }])
    btns.push([
      { text: 'Update Wish Status To Active', callback_data: SUPER_ADMIN_CALLBACK_DATA.updateWishStatusToActive },
    ])
    btns.push([
      {
        text: 'Send News Notification To All Users',
        callback_data: SUPER_ADMIN_CALLBACK_DATA.sendNewsNotificationToAllUsers,
      },
    ])
    btns.push([
      { text: 'User Current Balances List', callback_data: SUPER_ADMIN_CALLBACK_DATA.userCurrentBalancesList },
    ])
    btns.push([
      {
        text: 'Platform Balance By Comissions',
        callback_data: SUPER_ADMIN_CALLBACK_DATA.platformBalanceByComissions,
      },
    ])
    btns.push([{ text: 'Platform Donates Balance', callback_data: SUPER_ADMIN_CALLBACK_DATA.platformDonatesBalance }])
    btns.push([
      {
        text: 'Users Purchases Size And Balance',
        callback_data: SUPER_ADMIN_CALLBACK_DATA.usersPurchasesSizeAndBalance,
      },
    ])
  }

  if (validateGuardRole(userRoles, [UserRole.ANALYTIC, UserRole.ADMIN])) {
    btns.push([{ text: 'Maximum Username Length', callback_data: SUPER_ADMIN_CALLBACK_DATA.maximumUsernameLength }])
    btns.push([
      { text: 'Maximum Wishes In Category', callback_data: SUPER_ADMIN_CALLBACK_DATA.maximumWishesInCategory },
    ])
    btns.push([
      {
        text: 'Maximum Category Length By User',
        callback_data: SUPER_ADMIN_CALLBACK_DATA.maximumCategoriesListLengthByUser,
      },
    ])

    btns.push([{ text: 'Users Has Wishes In Bot', callback_data: SUPER_ADMIN_CALLBACK_DATA.usersHasWishesInBot }])
    btns.push([
      { text: 'Users who created any Santa Game', callback_data: SUPER_ADMIN_CALLBACK_DATA.usersCreatedSantaGame },
    ])
  }

  btns.push([{ text: 'Меню', callback_data: MAIN_CALLBACK_DATA.menu }])

  return btns
}

export const getWishSceneKeyboards = () => [
  [{ text: 'Добавить по ссылке', callback_data: WISH_CALLBACK_DATA.addNewByLink }],
  [{ text: 'Добавить и заполнить позже', callback_data: WISH_CALLBACK_DATA.addNewEmptyWish }],
  [{ text: 'Список моих желаний', callback_data: WISH_CALLBACK_DATA.getAllWishList }],
  [{ text: 'Поделиться желаниями', callback_data: WISH_CALLBACK_DATA.shareWishList }],
  [
    {
      text: 'Найти желания по нику (@username)',
      callback_data: WISH_CALLBACK_DATA.get_another_user_wish_list_by_nickname,
    },
  ],
  [
    {
      text: 'Меню',
      callback_data: MAIN_CALLBACK_DATA.menu,
    },
  ],
]

export const getStartupMainSceneKeyboard = (webAppUrl: string) => [
  [{ text: 'Добавить по ссылке', callback_data: WISH_CALLBACK_DATA.addNewByLink }],
  [{ text: 'Добавить и заполнить позже', callback_data: WISH_CALLBACK_DATA.addNewEmptyWish }],
  [
    {
      text: 'Найти желания по нику (@username)',
      callback_data: WISH_CALLBACK_DATA.get_another_user_wish_list_by_nickname,
    },
  ],
  [getMainOpenWebAppButton(webAppUrl)],
]

export const getWishItemKeyboard = (id: string, webAppUrl: string) => [
  [
    { text: 'Редактировать', callback_data: `${WISH_CALLBACK_DATA.editWishItem} ${id}` },
    { text: 'Удалить', callback_data: `${WISH_CALLBACK_DATA.removeWishItem} ${id}` },
  ],
  [{ text: 'Добавить еще', callback_data: WISH_CALLBACK_DATA.addNewByLink }],
  ...getMainKeyboards({ webAppUrl: `${webAppUrl}/wish/${id}` }),
]

export const getEditWishItemKeyboard = (id: string) => [
  [
    { text: 'Название', callback_data: `${WISH_CALLBACK_DATA.editWishItemName} ${id}` },
    { text: 'Описание', callback_data: `${WISH_CALLBACK_DATA.editWishItemDescription} ${id}` },
  ],
  [
    { text: 'Ссылка', callback_data: `${WISH_CALLBACK_DATA.editWishItemLink} ${id}` },
    { text: 'Изображение', callback_data: `${WISH_CALLBACK_DATA.editWishItemImageUrl} ${id}` },
  ],
  [
    { text: 'Удалить', callback_data: `${WISH_CALLBACK_DATA.removeWishItem} ${id}` },
    { text: 'Добавить еще', callback_data: WISH_CALLBACK_DATA.addNewByLink },
    { text: 'Назад', callback_data: `${WISH_CALLBACK_DATA.back} ${id}` },
  ],
]

export const backBtn = { text: 'Назад', callback_data: WISH_CALLBACK_DATA.back }

export const getSceneNavigationKeyboard = (props: KeyboardType) => [...getMainKeyboards(props), [backBtn]]

export const getOwnerWishItemKeyboard = ({
  id,
  wish,
  senderUserId,
  webAppUrl,
}: {
  id: string
  wish?: WishDocument
  senderUserId?: string
  webAppUrl?: string
}) => {
  const defaultCommands = [
    { text: 'Редактировать', callback_data: `${WISH_CALLBACK_DATA.editWishItem} ${id}` },
    { text: 'Удалить', callback_data: `${WISH_CALLBACK_DATA.removeWishItem} ${id}` },
  ]

  if (webAppUrl) {
    defaultCommands.push(getMainOpenWebAppButton(`${webAppUrl}/wish/${id}`) as any)
  }

  if (!wish) {
    return [defaultCommands, [{ text: 'Забронировать', callback_data: `${WISH_CALLBACK_DATA.bookWishItem} ${id}` }]]
  }

  if (wish.isBooked && wish.bookedUserId === senderUserId) {
    return [defaultCommands, [{ text: 'Снять бронь', callback_data: `${WISH_CALLBACK_DATA.unbookWishItem} ${id}` }]]
  }

  if (!wish.bookedUserId) {
    return [defaultCommands, [{ text: 'Забронировать', callback_data: `${WISH_CALLBACK_DATA.bookWishItem} ${id}` }]]
  }

  return [defaultCommands]
}

export const getWishFavoriteKeyboard = ({
  id,
  wishlistNotifyEnabled,
  webAppUrl,
}: {
  id: string
  wishlistNotifyEnabled: boolean
  webAppUrl?: string
}) => {
  const defaultCommands = []

  if (webAppUrl) {
    defaultCommands.push(getMainOpenWebAppButton(webAppUrl))
  }

  if (!wishlistNotifyEnabled) {
    return [
      defaultCommands,
      [
        {
          text: 'Включить уведомления',
          callback_data: `${WISH_CALLBACK_DATA.enableFavoriteNotification} ${id}`,
        },
      ],
    ]
  }

  if (wishlistNotifyEnabled) {
    return [
      defaultCommands,
      [
        {
          text: 'Отключить уведомления',
          callback_data: `${WISH_CALLBACK_DATA.disableFavoriteNotification} ${id}`,
        },
      ],
    ]
  }

  return [defaultCommands]
}

export const getSharedWishItemKeyboard = ({
  id,
  wish,
  senderUserId,
  webAppUrl,
}: {
  id: string
  wish?: WishDocument
  senderUserId?: string
  webAppUrl?: string
}) => {
  const defaultCommands = [
    {
      text: 'Хочу себе',
      callback_data: `${WISH_CALLBACK_DATA.copy_wish_item} ${id}`,
    },
  ]

  if (webAppUrl) {
    defaultCommands.push(getMainOpenWebAppButton(`${webAppUrl}/wish/${id}`, 'Web App') as any)
  }

  if (!wish) {
    return [defaultCommands]
  }

  if (wish.isBooked && wish.bookedUserId === senderUserId) {
    return [defaultCommands, [{ text: 'Не хочу дарить', callback_data: `${WISH_CALLBACK_DATA.unbookWishItem} ${id}` }]]
  }

  if (!wish.bookedUserId) {
    return [defaultCommands, [{ text: 'Хочу подарить!', callback_data: `${WISH_CALLBACK_DATA.bookWishItem} ${id}` }]]
  }

  return [defaultCommands]
}

export const showAvailableWalletsBtn = (text = 'Список доступных кошельков') => ({
  text,
  callback_data: jsonStringify({ method: WALLET_CALLBACK_DATA.walletList }),
})

export const showConnectedWalletBtn = {
  text: 'Мой кошелек',
  callback_data: jsonStringify({ method: WALLET_CALLBACK_DATA.connectedWallet }),
}

export const disconnectWalletBtn = {
  text: 'Отключить кошелек',
  callback_data: jsonStringify({ method: WALLET_CALLBACK_DATA.disconnectWallet }),
}

export const getWalletMainKeyboard = () => [
  [showAvailableWalletsBtn()],
  [showConnectedWalletBtn],
  [{ text: 'Меню', callback_data: MAIN_CALLBACK_DATA.menu }],
]
