import { WishDocument } from 'src/entities'
import { getValidFileUrl } from 'src/utils/getValidFileUrl'

export const getWishItemText = (wish: WishDocument, options?: { apiUrl?: string }) => {
  const imageUrl = getValidFileUrl(wish.imageUrl, options?.apiUrl)

  return `
Название: ${wish.name || 'Название не установлено'}
Описание: ${wish.description || 'Описание не установлено'}
Ссылка: ${wish.link || 'Ссылка на желание не установлена'}
Ссылка на изображение: ${imageUrl || 'Ссылка на изображение не установлена'}

Выберите действие
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
