# PULLUP PRO 2.0 — ISA PERSONAL

**POWER. DISCIPLINE. PROGRESS.**

PULLUP PRO — персональная спортивная экосистема для тренировок с собственным весом и на турнике: от первых подтягиваний до выхода силой (Muscle-Up) и развития всего тела. Одно приложение работает в браузере на компьютере и телефоне, устанавливается как PWA (офлайн) и открывается внутри Telegram как Mini App. Данные хранятся на устройстве (local-first) и по желанию синхронизируются между устройствами через собственный сервер; Telegram-бот показывает статистику и присылает напоминания.

Версия 2.0 выросла из PULLUP PRO 1.0 (один HTML-файл). Все данные 1.0 переносятся автоматически и без потерь; исходная версия сохранена в `legacy/v1/` (с контрольными суммами).

## Как открыть приложение

| Что | Как открыть | Что работает |
|---|---|---|
| **Один файл** `PULLUP-PRO-2.0.html` (`npm run build:single` → `dist-single/`) | Двойной щелчок — откроется в браузере (проверено в Chrome; Edge работает на том же движке). Сервер и интернет не нужны | Всё приложение: тренировки, план, журнал, статистика, тело, питание, календарь, достижения. Данные хранятся в этом браузере; перенос на другое устройство — «Экспорт JSON» / «Импорт» в «Настройки → Данные». Без синхронизации, Telegram и установки как PWA |
| **Сборка для хостинга** `apps/web/dist` (`npm run build:web`) | Только через веб-сервер: HTTPS-хостинг, `npm run preview` или API (`npm run start:api`) | Всё, плюс установка PWA, офлайн-обновления, синхронизация и Telegram Mini App (с API) |
| **Исходный код** (эта папка) | Не открывается напрямую — нужен Node.js (см. ниже) | Разработка, сборка, сервер, бот, тесты |

`index.html` из `apps/web/dist`, открытый двойным щелчком с диска, показывает только ссылки без оформления: браузеры не загружают модульные скрипты по адресу `file://`. Для запуска без сервера используйте файл из `dist-single/`.

## Основные возможности

- **Персонализация (ISA PERSONAL):** 7 шагов онбординга — уровень, результаты, оборудование, расписание, цели; профиль, уровни и XP.
- **Тренировки всего тела:** 85 упражнений (PULL, PUSH, SHOULDERS, CORE, LEGS, MOBILITY, MUSCLE-UP) с техникой, частыми ошибками, рабочими мышцами (карта мышц), упрощениями и усложнениями.
- **Программный движок:** 7 программ 2.0 (Full Body A/B/C, Push/Pull/Legs, Upper/Lower, фокус-программы, подготовка к Muscle-Up) + 3 программы подтягиваний из 1.0. Прогрессия только после 2 стабильных тренировок и только с согласия пользователя, разгрузочные недели, лёгкая версия при плохом самочувствии.
- **Режим тренировки 2.0:** чек-ин перед тренировкой, разминка под тренировку, подходы, таймер отдыха со звуком и вибрацией, удержания, пауза, замена упражнения, отметка боли, итог с RPE/RIR и рекордами. Незаконченная тренировка восстанавливается после закрытия вкладки.
- **Muscle-Up:** 6 этапов с критериями перехода, фазами движения, нагрузкой на суставы и разбором ошибок.
- **Прогресс:** журнал, статистика и графики, личные рекорды, отчёт недели, календарь с планированием и автопланом, достижения (16 наград 2.0 + 36 классических).
- **Тело:** вес и обхваты, свои поля замеров, фото прогресса с визуальным сравнением (фото хранятся на устройстве; в облако — только с отдельного согласия).
- **Питание:** дневник, продукты, вода, ориентиры белка и калорий (с источниками).
- **Конструктор тренировок**, свободная тренировка, быстрые записи подтягиваний.
- **Данные:** экспорт/импорт JSON (1.0 и 2.0), архив с фото, автоматические копии перед импортом/сбросом/демо, помеченный демо-режим (не синхронизируется).
- **PWA:** установка, работа без интернета, безопасные обновления (новая версия ждёт согласия и не прерывает тренировку).
- **Telegram:** Mini App (вход по проверенному initData, BackButton, MainButton, тема, safe area, полноэкранный режим на телефоне), бот с командами `/start /app /today /stats /progress /reminder /settings /privacy /help` и напоминаниями, вход в браузере через бота одноразовым кодом.
- **Языки:** русский, English, Türkçe (переключатель в Настройках; весь каталог упражнений переведён; остатки — в PROJECT_ROADMAP).
- **Синхронизация:** local-first, записи с last-writer-wins, офлайн-очередь и досинхронизация при появлении сети.

## Структура

```
apps/web            веб-приложение / PWA / Telegram Mini App (TypeScript, Vite, без фреймворка)
apps/api            REST API + раздача веб-приложения (Fastify, PostgreSQL)
apps/telegram-bot   Telegram-бот (grammY): команды, вход через бота, напоминания
packages/shared     общая логика: типы, каталог упражнений и программ, движок, статистика, миграция 1.0 → 2.0, валидация, синхронизация
packages/db         доступ к PostgreSQL: миграции, репозитории, синхронизация, каталог
database/migrations SQL-миграции
tests               unit, integration (PostgreSQL), e2e (Playwright)
docs                документация
scripts             сборка одного файла, иконки, список источников, фикстуры миграции
deploy              Caddyfile (HTTPS для docker-compose)
legacy/v1           исходная версия 1.0 (резервная копия)
dist-single         версия в одном HTML-файле (создаётся командой npm run build:single)
```

Подробнее: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Необходимые программы

- **Node.js 22.12+** (проверено на Node 24) и npm 10+.
- **PostgreSQL 14+** (проверено на 16) — только для backend, синхронизации и бота. Веб-приложение и PWA работают без сервера.
- **Docker + Docker Compose** — по желанию, для запуска всего одной командой.
- Для e2e-тестов — Chromium: `npx playwright install chromium` (или свой Chromium через `CHROMIUM_PATH`).
- Для Telegram — бот от @BotFather и публичный HTTPS-домен (см. [docs/TELEGRAM_SETUP.md](docs/TELEGRAM_SETUP.md)).

## Установка зависимостей

```bash
npm ci
cp .env.example .env        # и заполните нужные значения (секреты не коммитятся)
```

## Режим разработки

```bash
npm run dev                 # веб-приложение: http://localhost:5173 (работает без сервера)

# backend (нужен PostgreSQL и DATABASE_URL в .env)
npm run db:migrate          # применить миграции (API и бот также делают это при старте)
npm run dev:api             # API: http://localhost:8080
npm run dev:bot             # бот (нужен BOT_TOKEN), режим polling
```

Vite проксирует `/api` на `http://localhost:8080`, поэтому вход и синхронизация работают и в dev-режиме.

## Production-сборка

```bash
npm run build               # apps/web/dist + apps/api/dist/server.js + apps/telegram-bot/dist/bot.js
npm run build:single        # dist-single/PULLUP-PRO-2.0.0.html — всё приложение в одном файле, открывается без сервера
npm run typecheck           # строгая проверка TypeScript всех пакетов и тестов
```

## Запуск backend

```bash
npm run start:api           # API + веб-приложение из apps/web/dist на PORT (по умолчанию 8080)
```

Один процесс отдаёт и API (`/api/*`), и веб-приложение (PWA и Mini App). Проверка: `GET /api/health`.

Через Docker (PostgreSQL + API + веб):

```bash
docker compose up -d --build                  # http://localhost:8080
docker compose --profile bot up -d --build    # + Telegram-бот
docker compose --profile https up -d --build  # + Caddy с автоматическим HTTPS для DOMAIN
```

Подробнее: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), схема данных: [docs/DATABASE.md](docs/DATABASE.md).

## Запуск Telegram-бота

```bash
# в .env: BOT_TOKEN, BOT_USERNAME, WEBAPP_URL (https), DATABASE_URL
npm run start:bot           # или npm run dev:bot
```

При старте бот сам устанавливает команды, описания и кнопку меню «OPEN PULLUP PRO». Режимы: `polling` (по умолчанию) и `webhook`.

## Подключение PWA

PWA включается автоматически в production-сборке на HTTPS (или `localhost`): манифест, иконки, Service Worker с офлайн-кэшем оболочки. Установка — кнопка «INSTALL PULLUP PRO» на главной, в настройках или в меню браузера; на iOS — «Поделиться → На экран Домой». Подробнее: [docs/PWA_SETUP.md](docs/PWA_SETUP.md).

## Подключение Telegram Mini App

1. Создайте бота в @BotFather (`/newbot`), получите токен → `BOT_TOKEN`, имя бота → `BOT_USERNAME`.
2. Разместите API + веб на HTTPS-домене → `WEBAPP_URL` (например, `docker compose --profile https`).
3. В @BotFather: *Bot Settings → Configure Mini App* → включите и укажите `WEBAPP_URL` (главное Mini App бота).
4. Запустите бота — он сам установит команды, описание и кнопку меню «OPEN PULLUP PRO».
5. Откройте бота в Telegram → «OPEN PULLUP PRO»: вход выполняется автоматически по подписанным данным Telegram.

Пошагово: [docs/TELEGRAM_SETUP.md](docs/TELEGRAM_SETUP.md).

## Тесты

```bash
npm run test:unit                                                      # логика без БД
TEST_DATABASE_URL=postgres://…/pullup_test npm run test:integration    # API, бот, БД (отдельная БД!)
npm run test:e2e                                                       # браузер: сборка + реальный API + PostgreSQL
```

Что и как проверено, результаты последнего прогона: [docs/TESTING.md](docs/TESTING.md).

## Граница готовности

Проверено в этой сборке (автотестами и вручную): веб-приложение, версия в одном файле (открытие с диска, без сети), PWA (офлайн, обновление), миграция данных 1.0, API с PostgreSQL, синхронизация между устройствами, проверка подписи Telegram initData, логика бота и напоминаний (с записью вызовов Bot API), Mini App с имитацией Telegram SDK, адаптивность 320–1920 px.

Не проверено, потому что требует внешнего доступа: работа с настоящим Telegram (реальный токен бота, клиент Telegram на телефоне, домен с HTTPS), сборка Docker-образов (Docker недоступен в среде разработки; раскладка образа проверена вручную — тот же `npm ci --omit=dev` и запуск бандлов), Caddy/Let's Encrypt, установка PWA на реальные iOS/Android. Шаги для подключения описаны в документации. Синхронизация разрешает конфликты по принципу «последняя запись побеждает» по времени устройств — при сильно расходящихся часах на устройствах новее окажется запись с «более поздними» часами.

## Документация

[ARCHITECTURE](docs/ARCHITECTURE.md) · [DATABASE](docs/DATABASE.md) · [PWA_SETUP](docs/PWA_SETUP.md) · [TELEGRAM_SETUP](docs/TELEGRAM_SETUP.md) · [DEPLOYMENT](docs/DEPLOYMENT.md) · [TESTING](docs/TESTING.md) · [TRAINING_CONTENT_SOURCES](docs/TRAINING_CONTENT_SOURCES.md) · [CHANGELOG](CHANGELOG.md) · [AUDIT](docs/AUDIT.md) · [SECURITY](docs/SECURITY.md) · [PROJECT_STATUS](PROJECT_STATUS.md) · [PROJECT_ROADMAP](PROJECT_ROADMAP.md) · [CLAUDE](CLAUDE.md) · [Скриншоты](docs/screenshots/README.md)

Приложение не заменяет консультацию врача. При боли в суставах тренировку нужно остановить — для этого в режиме тренировки есть кнопка «Боль».
