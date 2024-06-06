import { WISH_CALLBACK_DATA } from 'src/scenes/wish/constants'

export const MAIN_SCENE_KEYBOARDS = [
  [{ text: 'Список желаний', callback_data: WISH_CALLBACK_DATA.openWishScene }],
  [{ text: 'Поделиться списком желаний', callback_data: WISH_CALLBACK_DATA.shareWishList }],
  [
    {
      text: 'Посмотреть чужой список желаний по никнейму',
      callback_data: WISH_CALLBACK_DATA.get_another_user_wish_list_by_nickname,
    },
  ],
]

export const SCENE_NAVIGATION_KEYBOARDS = [
  ...MAIN_SCENE_KEYBOARDS,
  [{ text: 'Назад', callback_data: WISH_CALLBACK_DATA.back }],
]
