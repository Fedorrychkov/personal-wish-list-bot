import { WishDocument } from 'src/entities'
import { WISH_CALLBACK_DATA } from 'src/scenes/wish/constants'

export const MAIN_SCENE_KEYBOARDS = [
  [{ text: 'Желания', callback_data: WISH_CALLBACK_DATA.openWishScene }],
  [{ text: 'Поделиться по ссылке', callback_data: WISH_CALLBACK_DATA.shareWishList }],
  [
    {
      text: 'Посмотреть чужие желания по никнейму',
      callback_data: WISH_CALLBACK_DATA.get_another_user_wish_list_by_nickname,
    },
  ],
]

export const SCENE_NAVIGATION_KEYBOARDS = [
  ...MAIN_SCENE_KEYBOARDS,
  [{ text: 'Назад', callback_data: WISH_CALLBACK_DATA.back }],
]

export const getOwnerWishItemKeyboard = (id: string, wish?: WishDocument, senderUserId?: string) => {
  const defaultCommands = [
    { text: 'Редактировать', callback_data: `${WISH_CALLBACK_DATA.editWishItem} ${id}` },
    { text: 'Удалить', callback_data: `${WISH_CALLBACK_DATA.removeWishItem} ${id}` },
  ]

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

export const getSharedWishItemKeyboard = (id: string, wish?: WishDocument, senderUserId?: string) => {
  const defaultCommands = [
    {
      text: 'Хочу себе',
      callback_data: `${WISH_CALLBACK_DATA.copy_wish_item} ${id}`,
    },
  ]

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
