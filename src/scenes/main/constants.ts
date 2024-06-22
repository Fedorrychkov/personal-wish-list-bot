export const botWelcomeCommandsText = `
Данный бот умеет:
- Добавлять желание по ссылке (Пока только по ссылке, достаточно отправить ее в чат)
- Редактирование значений списка желаний (Название, изображение, ссылка, описание)
- Получение своего списка желаний
- Бронирование желаний (своих/чужих)
- Возможность поделиться своим списком желаний
- Возможность увидеть чужой виш лист по ссылке или никнейму
- Просмотр и управление из Web App
`

export const botWelcomeUserNameText = `
_____
Кажется у вас не установлен username, для корректной работы бота необходимо настроить имя пользователя в настройках вашего аккаунта.
Пожалуйста, настройте имя пользователя и наберите команду /start еще раз!
`

export const START_PAYLOAD_KEYS = {
  shareByUserName: 'share_by_username_',
  shareById: 'share_by_id_',
}

export const MAIN_CALLBACK_DATA = {
  openWebApp: 'open_web_app',
  getReleaseNotes: 'get_release_notes',
}
