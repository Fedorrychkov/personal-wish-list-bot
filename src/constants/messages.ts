import { WishDocument } from 'src/entities'
import { getValidFileUrl } from 'src/utils/getValidFileUrl'

export const getWishItemText = (wish: WishDocument, options?: { apiUrl?: string }) => {
  const imageUrl = getValidFileUrl(wish.imageUrl, options?.apiUrl)

  return `
<b>Название</b>: ${wish.name || '<i>Название не установлено</i>'}
<b>Описание</b>: ${wish.description || '<i>Описание не установлено</i>'}
<b>Ссылка</b>: ${wish.link || '<i>Ссылка на желание не установлена</i>'}
<b>Ссылка на изображение</b>: ${imageUrl || '<i>Ссылка на изображение не установлена</i>'}

<b>Выберите действие</b>
`
}

export const getDeleteMessageToSubscriber = (wishName: string, username: string) => {
  const text = `
Пользователь: @${username}, которому вы хотели подарить:
${wishName || 'Название не установлено'}
Только что удалил свое желание.
Проверьте актуальный список желаний пользователя!
`

  return text
}

export const getGivenMessageToSubscriber = (wishName: string, username: string) => {
  const text = `
Пользователь: @${username}, которому вы хотели подарить:
${wishName || 'Название не установлено'}
Только что перенес желание в исполненные.
Проверьте актуальный список желаний пользователя!
`

  return text
}
