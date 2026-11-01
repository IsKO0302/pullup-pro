# База данных

PostgreSQL 14+ (проверено на PostgreSQL 16). Используется только встроенная функция `gen_random_uuid()`, расширения не нужны.

## Миграции

- Файлы: `database/migrations/NNN_*.sql`, применяются по порядку имён, каждая в своей транзакции.
- Учёт: таблица `schema_migrations (name, applied_at)`.
- Параллельный запуск API и бота безопасен: миграции выполняются под session-level advisory lock `pg_advisory_lock(727001)`.
- Запуск: автоматически при старте API и бота (`MIGRATE_ON_START=true`, по умолчанию) или вручную `npm run db:migrate` (читает `DATABASE_URL` из окружения или `.env`). Каталог миграций можно переопределить `MIGRATIONS_DIR`.
- Новые изменения схемы — только новым файлом `003_*.sql`; применённые файлы не редактируются.

## Модель данных

Источник истины для пользовательских данных — local-first хранилище синхронизации: таблица `records` (одна строка на запись клиента, last-writer-wins по `u`, удаления — «надгробия» `del = true`). Сущности модели данных доступны как SQL-представления поверх `records` (миграция `002_entities.sql`). Каталог упражнений и программ поставляется с приложением (`packages/shared`) и зеркалируется в таблицы `exercises` и `workout_programs` при каждом старте API (`syncCatalog`: upsert + удаление устаревших строк).

### Таблицы (`001_init.sql`)

| Таблица | Ключ | Назначение |
|---|---|---|
| `users` | `id uuid` | Пользователь: `telegram_id` (unique), имя и язык из Telegram, согласие на облачные фото (`photos_consent`, `photos_consent_at`), счётчик ревизий `rev`, `bot_started_at`, `bot_blocked_at` (бот заблокирован → напоминания на паузе), `last_seen_at`. |
| `auth_sessions` | `token_hash bytea` | Сессии: хранится только SHA-256 токена; `via` = `telegram` \| `link`, `device_id`, `expires_at`, `last_used_at`. Удаляются каскадно с пользователем. |
| `link_codes` | `code` | Одноразовые коды входа из браузера через бота: `secret_hash`, `status` = `pending` → `claimed` → `used`, профиль Telegram после подтверждения, `expires_at` (10 минут). |
| `records` | `(user_id, c, id)` | Синхронизируемые записи: коллекция `c`, id записи, `u` — время изменения на устройстве (мс), `rev` — ревизия сервера, `del`, данные `d jsonb`, `device_id`. Индексы `(user_id, rev)` для инкрементального pull и частичный индекс активных напоминаний. |
| `photos` | `(user_id, id)` | Фото прогресса (только после согласия): `mime`, `size`, `sha256`, `data bytea`. Удаляются при удалении записи фото и при отзыве согласия. |
| `reminder_log` | `(user_id, reminder_id, local_day)` | Дедупликация напоминаний: не больше одного сообщения на напоминание в локальный день пользователя. |
| `schema_migrations` | `name` | Применённые миграции. |

Коллекции `records.c`: `profile`, `settings`, `mu`, `nutrition`, `engine` (одна запись на пользователя); `sessions`, `tests`, `custom`, `body`, `bodyFields`, `photos`, `foods`, `products`, `reminders` (списки); `plan`, `ach`, `daily`, `progress` (словари по ключу, например день).

### Каталог (`002_entities.sql`)

| Таблица | Поля |
|---|---|
| `exercises` (85 строк) | `id`, `name`, `name_en`, `body_group`, `category`, `type` (`reps` \| `time`), `level`, `difficulty` (1–5), `weighted`, `primary_muscles[]`, `secondary_muscles[]`, `equipment[]`, `easier`, `harder`, `data jsonb` (полная карточка: техника, ошибки, дозы) |
| `workout_programs` (10 строк) | `id`, `generation` (1 — программы подтягиваний 1.0, 2 — движок 2.0), `name`, `kind`, `level`, `days_per_week`, `frequency`, `duration`, `goal`, `workouts_count`, `data jsonb` (тренировки, упражнения, дозы) |

### Представления сущностей (`002_entities.sql`)

Все представления исключают удалённые записи. Значения неожиданного типа становятся `NULL` и не ломают запросы (функции `pp_num`, `pp_bool`, `pp_arr`, `pp_day`, `pp_ts`).

| Сущность | Представление | Колонки |
|---|---|---|
| Profiles | `v_profiles` | `user_id`, `name`, `bodyweight_kg`, `height_cm`, `level`, `pullup_program`, `split`, `training_format`, `experience`, `timezone`, `max_pullups`, `onboarded`, `updated_at` |
| UserGoals | `v_user_goals` | `user_id`, `goal`, `workouts_per_week`, `daily_pullups` |
| WorkoutSessions | `v_workout_sessions` | `user_id`, `id`, `day`, `started_at`, `title`, `source`, `duration_sec`, `feel`, `rpe`, `pain`, `completed`, `notes`, `sets_total`, `sets_done`, `updated_at` |
| WorkoutSets | `v_workout_sets` | `user_id`, `session_id`, `day`, `exercise_no`, `exercise_id`, `set_no`, `reps`, `time_sec`, `extra_weight_kg`, `rir`, `done` |
| PersonalRecords | `v_personal_records` | `user_id`, `exercise_id`, `metric` (`reps`, `time_sec`, `extra_weight_kg`, `test_max_reps`), `value`, `day`, `session_id` — лучший результат по упражнению и метрике |
| BodyMeasurements | `v_body_measurements` | `user_id`, `id`, `day`, `weight_kg`, `chest_cm`, `waist_cm`, `shoulders_cm`, `biceps_cm`, `forearm_cm`, `thigh_cm`, `custom`, `note`, `updated_at` |
| ProgressPhotos | `v_progress_photos` | `user_id`, `id`, `day`, `pose`, `width`, `height`, `size_bytes`, `mime`, `stored_on_server` (без согласия — только метаданные) |
| Achievements | `v_achievements` | `user_id`, `achievement_id`, `earned_on` |
| CalendarPlans | `v_calendar_plans` | `user_id`, `day`, `position`, `plan_id`, `kind`, `title`, `done` |
| CustomWorkouts | `v_custom_workouts` | `user_id`, `id`, `name`, `focus`, `exercises_count`, `items`, `updated_at` |
| Reminders | `v_reminders` | `user_id`, `id`, `kind`, `local_time`, `weekdays int[]` (0 — понедельник … 6 — воскресенье), `enabled` |
| Users | таблица `users` | см. выше |
| Exercises, WorkoutPrograms | таблицы каталога | см. выше |

Соответствие представлений данным приложения проверяется тестом `tests/integration/db-entities.test.ts`.

## Примеры запросов

```sql
-- тренировки и выполненные подходы за последние 30 дней
SELECT day, title, sets_done, duration_sec FROM v_workout_sessions
WHERE user_id = $1 AND day >= current_date - 30 ORDER BY day DESC;

-- лучший результат в подтягиваниях
SELECT metric, max(value) FROM v_personal_records
WHERE user_id = $1 AND exercise_id = 'pullup' GROUP BY metric;

-- динамика веса
SELECT day, weight_kg FROM v_body_measurements WHERE user_id = $1 AND weight_kg IS NOT NULL ORDER BY day;
```

## Резервное копирование и удаление данных

- Резервная копия: `pg_dump --format=custom --file=pullup-$(date +%F).dump "$DATABASE_URL"`; восстановление: `pg_restore --clean --if-exists --dbname="$DATABASE_URL" pullup-YYYY-MM-DD.dump`. Подробнее — [DEPLOYMENT.md](DEPLOYMENT.md).
- Фото хранятся в `photos.data` (bytea) и входят в дамп.
- `DELETE /api/account` удаляет пользователя; сессии, записи, фото и журнал напоминаний удаляются каскадно (`ON DELETE CASCADE`).
- Истёкшие сессии и старые коды входа API удаляет каждые 6 часов (`purgeExpired`).
