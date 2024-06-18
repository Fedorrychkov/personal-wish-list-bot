# Wish List
Бот для работы со списком желаний

## Mini App бота
[Tg Mini App](https://github.com/Fedorrychkov/personal-wish-mini-tg-app)
## Фукнцонал бота
- Приветствие
- Регистрация элементов в списке желаний
  - Возможность автоматического вытягивания названия и описания по переданной ссылке
- Получения актуального списка желаний
- Возможность делиться своим списком желаний с другими пользователями
- Возможность бронировать элемент из вишлиста (*как владельца, так и рандомного пользователя*)

### Безопасность
- Авторизация запросов из веб аппа
- Загрузка аватарки или фото для вишлиста с использованием алиаса изображения без шейринга api.telegram ссылки на файл, так как такой файл использует в публичном урл ТОКЕН бота
- Использование переменных окружения

___
#### Возможности в планах
- Mini App
- Дублирование функционала бота в мини аппе

## Setting up firebase
add package global `npm install -g firebase-tools` and use `firebase init` after it. Select => 1. Firestore; 2. Existing project; 3. Other steps use defaults. Or you can use command `firebase use your-project-name` for start using your firestore.

## Manage indexes
Your indexes saved in firebase.indexes.json and you can use command `firebase deploy --only firestore:indexes` for deploy it.

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Installation

```bash
$ pnpm install
```

## Running the app

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Test

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://kamilmysliwiec.com)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](LICENSE).
