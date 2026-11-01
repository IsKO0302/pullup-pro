# Развёртывание

## Варианты

| Вариант | Что получаете | Статус проверки |
|---|---|---|
| **A. Docker Compose** (`docker-compose.yml`) | PostgreSQL + API с веб-приложением, по профилям — бот и Caddy с автоматическим HTTPS | Файлы готовы; `docker build` в рамках работы **не запускался** (в среде нет Docker). Раскладка образа (`npm ci --omit=dev`, бандлы, миграции, `WEB_DIST`) воспроизведена вручную и проверена: API отдал health, веб-приложение и манифест, применил миграции, зеркалировал каталог; бот корректно стартует и останавливается при неверном токене |
| **B. Node.js + PostgreSQL** без Docker | То же самое, процессы под systemd / pm2 | Проверено: сборка, `npm run start:api`, миграции, раздача клиента |
| **C. Только статический хостинг** `apps/web/dist` | PWA без входа, синхронизации и бота (данные только на устройстве) | Проверено e2e-тестами PWA на собранном клиенте |
| **D. Один HTML-файл** `dist-single/PULLUP-PRO-2.0.0.html` | Приложение без сервера: открывается двойным щелчком на компьютере, данные в этом браузере, перенос через экспорт/импорт JSON; без PWA, синхронизации и Telegram | Проверено e2e-тестом `single-file.spec.ts` (открытие с `file://`, ни одного сетевого запроса, данные сохраняются после повторного открытия) |

Telegram Mini App и установка PWA требуют **HTTPS** с действительным сертификатом.

## Требования

- Linux-сервер (достаточно 1 vCPU / 1 ГБ RAM), домен с A/AAAA-записью на сервер, открытые порты 80 и 443.
- Docker Engine с плагином Compose — для варианта A.
- Node.js **22.12+** и PostgreSQL **14+** — для варианта B.

## A. Docker Compose

```bash
cp .env.example .env
# обязательно: POSTGRES_PASSWORD (длинный случайный)
# для Telegram: BOT_TOKEN, BOT_USERNAME, WEBAPP_URL=https://<домен>/
# для HTTPS через Caddy: DOMAIN=<домен>, TRUST_PROXY=true

docker compose up -d --build                                 # PostgreSQL + API → http://<сервер>:8080
docker compose --profile https up -d --build                 # + Caddy: https://<домен>
docker compose --profile https --profile bot up -d --build   # + Telegram-бот
docker compose logs -f api bot
```

- Один `Dockerfile`, цели `api` и `bot` (`node:22-alpine`, процесс от пользователя `node`, healthcheck API).
- API и бот применяют миграции при старте (под advisory lock — одновременный старт безопасен), API зеркалирует каталог упражнений.
- Данные PostgreSQL — том `pgdata`, сертификаты Caddy — том `caddy_data`.
- `deploy/Caddyfile`: `/tg-webhook*` → бот (только для `BOT_MODE=webhook`), всё остальное → API.
- С Caddy порт API можно не публиковать наружу: задайте `API_PUBLISH=127.0.0.1:8080`.

## B. Node.js без Docker

```bash
npm ci
cp .env.example .env            # DATABASE_URL, BOT_TOKEN, BOT_USERNAME, WEBAPP_URL, …
npm run build                   # web → apps/web/dist, api → apps/api/dist, bot → apps/telegram-bot/dist
npm run db:migrate              # необязательно: API и бот мигрируют сами
npm run start:api               # :8080, раздаёт и API, и веб-приложение
npm run start:bot               # отдельный процесс
```

Сервисы читают `.env` из корня репозитория (`--env-file-if-exists`), переменные окружения процесса имеют приоритет.

Пример юнитов systemd (`/etc/systemd/system/pullup-api.service`, для бота — аналогично с `start:bot`):

```ini
[Unit]
Description=PULLUP PRO API
After=network-online.target postgresql.service

[Service]
WorkingDirectory=/opt/pullup-pro
ExecStart=/usr/bin/npm run start:api
Restart=always
User=pullup
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Обратный прокси с HTTPS — Caddy (`deploy/Caddyfile`, переменная `DOMAIN`) или nginx:

```nginx
server {
  listen 443 ssl http2;
  server_name fit.example.com;
  # ssl_certificate / ssl_certificate_key — например, от certbot
  client_max_body_size 20m;                       # фото прогресса до MAX_PHOTO_MB
  location /tg-webhook { proxy_pass http://127.0.0.1:8081; }
  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

За прокси включите `TRUST_PROXY=true`, иначе rate limit будет считать всех пользователей одним IP.

## C. Веб-приложение отдельно от API

```bash
VITE_API_URL=https://api.example.com npm run build:web   # адрес API без /api на конце
```

Залейте `apps/web/dist` на любой статический HTTPS-хостинг; на API задайте `CORS_ORIGINS=https://fit.example.com`. Не кэшируйте `index.html`, `sw.js`, `version.json`, `manifest.webmanifest` (см. [PWA_SETUP.md](PWA_SETUP.md)). Без `VITE_API_URL` и без API приложение работает полностью локально.

Папку `dist` нужно именно раздавать веб-сервером: `index.html`, открытый с диска двойным щелчком, покажет страницу без оформления (модульные скрипты на `file://` браузер не загружает).

## D. Один HTML-файл без сервера

```bash
npm run build:single      # → dist-single/PULLUP-PRO-2.0.0.html (≈0,8 МБ)
```

Файл можно передать как обычный документ и открыть двойным щелчком на компьютере — проверено в Chromium (Chrome, Edge); в Firefox и Safari не проверялось. Ограничения и хранение данных — в [PWA_SETUP.md](PWA_SETUP.md#версия-в-одном-файле-без-сервера).

## Проверка после запуска

```bash
curl -s https://<домен>/api/health      # {"ok":true,"db":"up","version":"2.0.0"}; 503 — нет связи с БД
curl -s https://<домен>/api/config      # botUsername, webAppUrl, photos, telegramAuth (без секретов)
curl -sI https://<домен>/ | grep -i content-security-policy
```

Бот в режиме webhook отвечает на `GET /health` на своём порту. Затем — шаги проверки из [TELEGRAM_SETUP.md](TELEGRAM_SETUP.md).

## Обновление

1. Сделайте резервную копию базы (ниже).
2. Обновите код и пересоберите: `docker compose … up -d --build` или `npm ci && npm run build` и перезапуск сервисов.
3. Новые миграции применятся при старте. У пользователей приложение покажет «Доступна новая версия» и обновится по кнопке, данные сохранятся.

## Резервное копирование

```bash
# Docker Compose
docker compose exec -T db pg_dump -U pullup -d pullup --format=custom > pullup-$(date +%F).dump
docker compose exec -T db pg_restore -U pullup -d pullup --clean --if-exists < pullup-YYYY-MM-DD.dump

# без Docker
pg_dump --format=custom --file=pullup-$(date +%F).dump "$DATABASE_URL"
pg_restore --clean --if-exists --dbname="$DATABASE_URL" pullup-YYYY-MM-DD.dump
```

- Ежедневная копия через cron и хранение нескольких копий вне сервера; периодически проверяйте восстановление на отдельной базе.
- Фото прогресса лежат в базе (`photos.data`) и попадают в дамп.
- Пользователи дополнительно могут выгружать свои данные: в приложении (Настройки → Данные → «Экспорт JSON», без фото) и через `GET /api/export`.

## Безопасность

- `.env` не коммитить (он в `.gitignore`); токен бота и пароль базы — только на сервере.
- PostgreSQL не публиковать в интернет (в compose у `db` нет `ports`).
- `ALLOW_PHOTOS=false` полностью отключает облачные фото; иначе каждый пользователь даёт отдельное согласие и может его отозвать — фото удаляются с сервера.
- Удаление аккаунта («Удалить облачный аккаунт» в настройках, `DELETE /api/account`) стирает все данные пользователя на сервере; данные на устройстве остаются.

## Масштабирование

- API не хранит состояние в памяти (сессии в PostgreSQL) и может работать в нескольких экземплярах за балансировщиком; лимиты запросов считаются в памяти каждого экземпляра.
- Бот — один экземпляр на токен (ограничение Telegram для polling и webhook). Повторная отправка напоминаний исключена записью в `reminder_log`.
