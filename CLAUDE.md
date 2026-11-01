# CLAUDE.md — PULLUP PRO 2.0 (ISA PERSONAL)

Контекст для продолжения разработки в новых сессиях. Сначала прочитайте этот файл, затем [PROJECT_STATUS.md](PROJECT_STATUS.md) (что готово и что проверено) и [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md) (что дальше).

## Продукт

PULLUP PRO — персональная спортивная экосистема (тренировки с собственным весом, Muscle-Up, тело, питание). Профиль владельца — **ISA PERSONAL**; система поддерживает отдельные аккаунты, имя «ISA» не прописано всем пользователям. Слоган: **POWER. DISCIPLINE. PROGRESS.** Палитра: чёрный, графит, белый, Orange Fire, Red Power. Язык интерфейса — русский; архитектура готовится к турецкому и английскому (см. PROJECT_ROADMAP, раздел i18n).

## Правила работы (не нарушать)

1. **Local-first.** Приложение должно работать без сервера и интернета. Сервер — необязательная синхронизация.
2. **Не терять данные пользователя.** Ключ `pullup.pro.v1` (версия 1.0) только читается; миграция идёт в `pullup.pro.v2`. Перед импортом/сбросом/демо создаётся снимок.
3. **Токен бота — только на сервере.** Никогда в `apps/web`, в Git, в чате. `.env` в `.gitignore`.
4. **Личность — только из проверенного `initData`.** Никогда из `initDataUnsafe` и тела запроса. Каждый запрос к данным фильтруется по `user_id` из сессии.
5. **Фото приватны** и хранятся на устройстве; облако только с отдельным согласием.
6. **Без выдуманных данных:** демо-данные помечены и не синхронизируются; расчёты питания — «приблизительно»; приложение не ставит медицинских диагнозов и не определяет % жира по фото; «Coach» — набор правил, не «ИИ».
7. **Не публиковать, не покупать, не удалять исходники** без согласия владельца. Оригиналы лежат в `D:\ISA_SPORT\zip\*.zip` (контрольные суммы в `SHA256SUMS`) и `legacy/v1/`.
8. Не вводить React/Vue «ради моды»: web — TypeScript + Vite без фреймворка.

## Карта репозитория

```
apps/web            веб / PWA / Telegram Mini App (Vite, TypeScript, без фреймворка)
  src/core          router, state, events, theme, icons
  src/features/*    экраны (home, train, plan, programs, mu, library, journal, stats, body, nutrition,
                    calendar, builder, profile, achievements, settings, report, workout, onboarding)
  src/services      idb, sync, pwa, telegram, api, logic, snapshots
  src/styles        app.css + v2.css
  sw/sw-template.js шаблон Service Worker (версия кеша = хэш содержимого)
apps/api            Fastify 5 + PostgreSQL: Telegram-вход, синхронизация, фото, раздача web
apps/telegram-bot   grammY: команды, вход через бота, напоминания
packages/shared     общая логика: каталог (85 упражнений), программы, движок прогрессии, статистика,
                    coach, миграция 1.0→2.0, схемы валидации, синхронизация
packages/db         миграции и репозитории PostgreSQL
database/migrations SQL (001_init, 002_entities)
tests               unit (vitest), integration (vitest + PostgreSQL), e2e (Playwright), qa-скрипты
docs                ARCHITECTURE, DATABASE, DEPLOYMENT, PWA_SETUP, TELEGRAM_SETUP, TESTING, SECURITY, AUDIT
legacy/v1           неизменяемая копия 1.0 (SHA-256 в SHA256SUMS)
```

## Команды

```bash
npm ci
npm run dev                  # веб: http://localhost:5173 (работает без сервера; есть dev-хук window.__pullup)
npm run typecheck            # все пакеты и тесты
npm run test:unit            # без БД
npm run build                # web + api + bot
# PostgreSQL нужен для интеграционных и e2e тестов:
TEST_DATABASE_URL=postgres://…/pullup_test npm run test:integration
E2E_DATABASE_URL=postgres://…/pullup_e2e CHROMIUM_PATH=<chrome> npm run test:e2e
```

Windows (PowerShell): `$env:TEST_DATABASE_URL='…'; npm run test:integration`. Docker на машине разработки не установлен; для локальной БД использовался npm-пакет `embedded-postgres` (вне репозитория) — см. docs/TESTING.md.

## Соглашения кода

- TypeScript строгий в `packages/*`, `apps/api`, `apps/telegram-bot`; в `apps/web` перенесённые экраны 1.0 содержат явные `any` (см. docs/AUDIT.md) — новый код пишите с типами.
- Чистую логику добавляйте в `packages/shared` с юнит-тестом; экраны — в `apps/web/src/features/<имя>/`; зарегистрируйте `ROUTES.<имя>` и пункт `NAV` (`core/router.ts`).
- После изменения общего состояния вызывайте `save()`; действия регистрируйте через `ACT.*`.
- Тексты бота — `apps/telegram-bot/src/texts.ts`; команды — `bot.ts` (`COMMANDS_RU/EN`) и тесты в `tests/unit/bot.test.ts`.
- Коммиты: `feat|fix|refactor|docs|test|chore|perf|ci: описание`.

## Рабочий процесс на каждом этапе

1. Проверить работу (`typecheck`, тесты, сборка, при UI — скриншоты в `docs/screenshots/`).
2. Обновить документацию, `PROJECT_STATUS.md`, `CHANGELOG.md`.
3. Закоммитить (Git) и поставить тег-контрольную точку.
4. Записать в `PROJECT_STATUS.md`: что выполнено и что осталось.

## Известные ловушки

- Windows: `scripts/bundle.mjs` раньше помечал абсолютный путь точки входа как внешний пакет — исправлено проверкой `isAbsolute`/`entry-point`.
- Драйвер `pg` превращает тип `DATE` в локальную полночь `Date`; читайте `day::text`.
- Кластер PostgreSQL на русской Windows создаётся в кодировке WIN1251 — базы создавайте `ENCODING 'UTF8' TEMPLATE template0`.
- Реальный Telegram, Docker, Caddy/Let's Encrypt и установка PWA на телефон в этой среде не проверялись — см. PROJECT_STATUS.md.
