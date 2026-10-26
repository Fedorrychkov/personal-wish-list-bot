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

## Production: automatic HTTPS

Production uses `docker-compose.prod.yml`, `scripts/deploy-production.sh` and the GitHub
`Production Deploy` workflow. Local/stage Compose and Certbot files are not the production path.

- Application images are built in GitHub Actions and pushed to private GHCR with a commit SHA tag.
- Runtime env and service-account files are uploaded separately with mode 600, outside the image.
- The server directory is `~/services/personal-wish-list-bot` and the Compose project is `personal-wish-list-bot`.
- No global Docker prune, shared directory swaps or `compose down` run during deployment.
- Requires Docker Engine, Compose v2, Bash, `flock`, curl, outbound HTTPS and GitHub Packages access.
- Existing SSH secrets `PROD_API_HOST`, `PROD_API_USERNAME`, `PROD_API_PASSWORD`
  are reused; optional `PROD_SSH_KEY` selects SSH key authentication.
- Runtime/build settings come from the existing `ENV_PROD` secret.
- Existing `SERVICE_ACCOUNT_JSON` is mounted as `service-account.prod.json`; `SA_KEY` is set accordingly.

Caddy obtains publicly trusted Let's Encrypt certificates and renews them automatically.
External Docker volumes `personal-wish-list-bot-caddy-data` and `personal-wish-list-bot-caddy-config`
survive app/image updates. Do not delete these volumes. Old certificate GitHub secrets are unused.
Public DNS for `wish-bot-api.dev-api-services.com` must point to this server; inbound TCP 80/443 must be open.
The deploy checks public HTTPS with normal certificate verification, without `curl -k`.

On the first migration only, the script stops this project's named legacy containers, retains
those containers for rollback, and copies their uploads/session file into persistent server
folders. Review server backups before the first production migration. API TLS terminates at
Caddy; the application serves HTTP only on the private Docker network. No app port is public.
If the first deployment fails, the script stops the new app/gateway and restarts legacy containers.
Subsequent app uploads and bot sessions persist in `uploads/` and `runtime/`.

Validation: `bash -n scripts/deploy-production.sh`, `shellcheck scripts/deploy-production.sh`,
`actionlint .github/workflows/production-deploy.yml`, `node --test scripts/production-deploy.test.mjs`.
Do not trigger the production workflow until the server migration and DNS are ready.

Production deployment is manual only: GitHub → Actions → Production Deploy → Run workflow
(select `main` after merging the PR). Merging or pushing a commit does not deploy.

Pull requests run `Deployment Checks` automatically without production secrets.
These checks never connect to the VPS or start a production deployment.

The WishList servers currently have only Compose v1. If `docker compose` is missing,
the first manual deployment installs Ubuntu's `docker-compose-v2` package before
stopping any application containers. A failed installation aborts the deployment.

Config upload and deployment now share one SSH connection. This avoids UFW's SSH
connection-rate limit, which blocked the old multi-connection SCP cleanup step.
The compressed config packet is base64-encoded, registered with GitHub add-mask
before export, and limited to 60 KiB encoded. Images remain in GHCR; no image
bytes are sent through this environment variable. Password and optional key
authentication keep their existing secret names. No firewall changes are required.
