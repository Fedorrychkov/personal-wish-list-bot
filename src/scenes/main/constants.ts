export const botWelcomeCommandsText = `
<b>Бот умеет:</b>

⭐️ Принимать оплаты в Telegram Stars (пожертвования и пополнение баланса)
🥳 Добавление желание по ссылке и без
👀 Просмотр своих и чужих списков желаний
📦 Бронирование желаний
🔎 Поиск пользователей по никнейму командой в боте или Mini-App
🕸 Работа с желаниями и пользователями из Mini-App
🥷 Создание публичных и приватных списков желаний
🧡 Приглашение пользователей в приватные списки желаний (пользователь получает уведомления) (Mini-App only)
↗️ Возможность делиться своей страницей желаний, категориями, конкретным желанием из Mini-App
📖 Любое желание можно открыть и работать через WebApp, там же можно увидеть чужие желания

Введите или нажмите на /menu, чтобы увидеть доступные команды
`

export const botWelcomeUserNameText = `
_____
Кажется у вас не установлен username, для корректной работы бота необходимо настроить имя пользователя в настройках вашего аккаунта.
Пожалуйста, настройте имя пользователя и наберите команду /start еще раз!
`

export const START_PAYLOAD_KEYS = {
  shareByUserName: 'share_by_username_',
  shareById: 'share_by_id_',
  santaGame: 'santa_',
  refferalSystem: '_irf_',
  tgReferralSystem: '_tgr_',
}

export const MAIN_CALLBACK_DATA = {
  openWebApp: 'open_web_app',
  getReleaseNotes: 'get_release_notes',
  menu: 'menu',
  help: 'help',
  updateUserRoleToUser: 'update_user_role_to_user',
  updateWishStatusToActive: 'update_wish_status_to_active',
  sendNewsNotificationToAllUsers: 'send_news_notification_to_all_users',
  refferalSystem: 'refferal_system',
}

export const PAYMENT_CALLBACK_DATA = {
  paySupport: 'paysupport',
  supportXtr: 'support_xtr',
  userTopupXtr: 'user_topup_xtr',
  supportWithXtr: 'support_with_xtr',
  userTopupWithXtr: 'user_topup_with_xtr',
  refundTransaction: 'refund_transaction',
}

export const WALLET_CALLBACK_DATA = {
  connectWallet: 'connect_new_wallet',
  walletList: 'wallets_list',
  wallets: 'menuWallets',
  connectedWallet: 'my_connected_wallet',
  disconnectWallet: 'disconnect_my_wallet',
}

export const NEWS_SCENE_NAME = 'newsScene'
