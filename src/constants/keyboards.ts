import { WishDocument } from 'src/entities'
import { WISH_CALLBACK_DATA } from 'src/scenes/wish/constants'

import { KeyboardType } from './types'

export const getMainOpenWebAppButton = (url: string, customText?: string) => ({
  text: customText || 'Web App',
  web_app: { url },
})

export const getAnotherUserWishListById = (userId: string, username?: string) => [
  {
    text: `Посмотреть желания пользователя ${username ? `@${username}` : ''}`,
    callback_data: `${WISH_CALLBACK_DATA.get_another_user_wish_list_by_id} ${userId}`,
  },
]

export const getMainKeyboards = (options?: KeyboardType) => {
  const { webAppUrl } = options || {}

  const btns = [
    [{ text: 'Управление желаниями', callback_data: WISH_CALLBACK_DATA.openWishScene }],
    [{ text: 'Поделиться по ссылке', callback_data: WISH_CALLBACK_DATA.shareWishList }],
  ]

  if (webAppUrl) {
    return [...btns, [getMainOpenWebAppButton(webAppUrl)]]
  }

  return btns
}

export const getWishSceneKeyboards = () => [
  [{ text: 'Добавить по ссылке', callback_data: WISH_CALLBACK_DATA.addNewByLink }],
  [{ text: 'Список моих желания', callback_data: WISH_CALLBACK_DATA.getAllWishList }],
  [{ text: 'Поделиться желаниями', callback_data: WISH_CALLBACK_DATA.shareWishList }],
  [
    {
      text: 'Найти желания по нику (@username)',
      callback_data: WISH_CALLBACK_DATA.get_another_user_wish_list_by_nickname,
    },
  ],
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
