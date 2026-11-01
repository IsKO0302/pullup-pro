-- PULLUP PRO 2.0 — initial schema (PostgreSQL 14+; uses built-in gen_random_uuid()).
-- Data model: the client state is stored as records (collection, id) with last-writer-wins by `u`
-- (client updatedAt, ms) and a per-user server revision `rev` for incremental pulls.

CREATE TABLE users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id       bigint UNIQUE,
  username          text,
  first_name        text,
  last_name         text,
  language_code     text,
  photos_consent    boolean NOT NULL DEFAULT false,
  photos_consent_at timestamptz,
  rev               bigint NOT NULL DEFAULT 0,          -- last assigned record revision
  bot_started_at    timestamptz,                        -- user pressed /start in the bot
  bot_blocked_at    timestamptz,                        -- bot got 403 (blocked) — reminders paused
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  last_seen_at      timestamptz
);

-- bearer sessions; only sha256(token) is stored
CREATE TABLE auth_sessions (
  token_hash   bytea PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  via          text NOT NULL CHECK (via IN ('telegram', 'link')),
  device_id    text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  last_used_at timestamptz
);
CREATE INDEX auth_sessions_user_idx ON auth_sessions (user_id);
CREATE INDEX auth_sessions_expires_idx ON auth_sessions (expires_at);

-- one-time codes that link a browser / PWA to a Telegram account through the bot (/start link_<code>)
CREATE TABLE link_codes (
  code        text PRIMARY KEY,
  secret_hash bytea NOT NULL,
  device_id   text,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'used')),
  telegram_id bigint,
  tg_profile  jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  claimed_at  timestamptz
);
CREATE INDEX link_codes_expires_idx ON link_codes (expires_at);

-- synced client records (sessions, body entries, settings, reminders, ...); deletions are kept as tombstones
CREATE TABLE records (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  c          text NOT NULL,
  id         text NOT NULL,
  u          bigint NOT NULL,
  rev        bigint NOT NULL,
  del        boolean NOT NULL DEFAULT false,
  d          jsonb,
  device_id  text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, c, id)
);
CREATE INDEX records_user_rev_idx ON records (user_id, rev);
CREATE INDEX records_reminders_idx ON records (user_id) WHERE c = 'reminders' AND NOT del;

-- progress photos: stored ONLY after explicit consent (users.photos_consent); deleted when consent is revoked
CREATE TABLE photos (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id         text NOT NULL,
  mime       text NOT NULL,
  size       integer NOT NULL,
  sha256     bytea NOT NULL,
  data       bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

-- de-duplication of Telegram reminders: one message per reminder per local day
CREATE TABLE reminder_log (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reminder_id text NOT NULL,
  local_day   date NOT NULL,
  sent_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, reminder_id, local_day)
);
