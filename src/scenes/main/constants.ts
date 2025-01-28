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
  refferalSystem: 'refferal_system',
  myPlatformBalance: 'my_platform_balance',
}

export const SUPER_ADMIN_CALLBACK_DATA = {
  updateUserRoleToUser: 'update_user_role_to_user',
  updateWishStatusToActive: 'update_wish_status_to_active',
  sendNewsNotificationToAllUsers: 'send_news_notification_to_all_users',
  userCurrentBalancesList: 'user_current_balances_list',
  platformDonatesBalance: 'platform_donates_balance',
  platformBalanceByComissions: 'platform_balance_by_comissions',
  maximumUsernameLength: 'maximum_username_length',
  maximumWishesInCategory: 'maximum_wishes_in_category',
  maximumCategoriesListLengthByUser: 'maximum_categories_list_length_by_user',
  usersHasWishesInBot: 'users_has_wishes_in_bot',
  usersCreatedSantaGame: 'users_created_santa_game',
  usersPurchasesSizeAndBalance: 'users_purchases_size_and_balance',
  superMenu: 'super_menu',
}

export const PAYMENT_CALLBACK_DATA = {
  paymentMenu: 'payment_menu',
  paySupport: 'paysupport',
  donates: 'donates',
  topupBalance: 'topup_balance',
  supportXtr: 'support_xtr',
  supportTon: 'support_ton',
  userTopupXtr: 'user_topup_xtr',
  userTopupTon: 'user_topup_ton',
  supportWithXtr: 'support_with_xtr',
  supportWithTon: 'support_with_ton',
  userTopupWithXtr: 'user_topup_with_xtr',
  userTopupWithTon: 'user_topup_with_ton',
  refundTransaction: 'refund_transaction',
}

export const WITHDRAWAL_CALLBACK_DATA = {
  runWithdrawal: 'run_withdrawal',
  userWithdrawWithTon: 'user_withdraw_with_ton',
  userWithdrawWithTonApprove: 'user_withdraw_with_ton_approve',
  rates: 'rates',
}

export const WALLET_CALLBACK_DATA = {
  connectWallet: 'connect_new_wallet',
  walletList: 'wallets_list',
  wallets: 'menuWallets',
  connectedWallet: 'my_connected_wallet',
  disconnectWallet: 'disconnect_my_wallet',
}

export const NEWS_SCENE_NAME = 'newsScene'
