---
name: pullup-safe-workflow
description: How to make changes to the PULLUP PRO repository safely - branches, commands, tests, screenshots, secrets, GitHub Pages deployment, and what never to do. Use at the start of any coding task in this project and before committing or publishing.
---

# PULLUP PRO — safe working procedure

## Repository (npm workspaces, TypeScript, no UI framework)
```
apps/web            web / PWA / Telegram Mini App (Vite)
apps/api            Fastify + PostgreSQL (sync, Telegram sign-in, photos)
apps/telegram-bot   grammY bot
packages/shared     catalog (85 exercises), programs, engine, stats, coach, i18n, validation, sync
packages/db         migrations + repositories
tests/              unit (vitest), integration (needs PostgreSQL), e2e (Playwright), qa scripts
docs/               ARCHITECTURE, DATABASE, DEPLOYMENT, PWA_SETUP, TELEGRAM_SETUP, TESTING, SECURITY
```
Read `CLAUDE.md`, `PROJECT_STATUS.md` and `PROJECT_ROADMAP.md` first.

## Procedure for every task
1. `git switch -c <topic>` (never work on `main` for experiments such as a redesign).
2. Plan, change, then verify - not just compile:
   ```
   npm run typecheck
   npm run test:unit
   TEST_DATABASE_URL=postgres://.../pullup_test npm run test:integration   # needs PostgreSQL
   E2E_DATABASE_URL=postgres://.../pullup_e2e CHROMIUM_PATH=<chrome> npm run test:e2e
   npm run build
   ```
3. UI change: run `npm run dev`, then `node tests/qa/gallery.mjs http://localhost:5173/ docs/screenshots`, open the screenshots and check them.
4. Update `docs/`, `CHANGELOG.md`, `PROJECT_STATUS.md` when behaviour changes. Commit with `feat|fix|refactor|docs|test|chore: ...`.
5. Merge to `main` only when everything is green. Pushing `main` redeploys the site on GitHub Pages (`.github/workflows/pages.yml`: typecheck + unit tests, build, deploy).

## Hard rules
- **No secrets in the repository.** The Telegram bot token lives only in a local `.env` (git-ignored) or in the hosting secrets. Never print it, commit it, put it in client code or paste it into chats. If it leaked, revoke it in @BotFather (`/revoke`).
- The old data key `pullup.pro.v1` is only read, never changed or deleted; user data must survive every update, including service worker updates.
- Identity comes only from server-validated Telegram `initData` (HMAC-SHA-256 + `auth_date`); never trust `initDataUnsafe` or a user id sent by the client. Every data query is filtered by the session's `user_id`.
- Do not publish, buy or enable paid services, and do not delete original files, without the owner's explicit consent.
- Do not report something as done that was not run; say what was verified and what was not (real Telegram client, Docker and phone installation have not been tested on the dev machine).
- Windows notes: `docker` is not installed; the pg driver turns `DATE` into a local-midnight `Date` (select `day::text`); create PostgreSQL databases as `ENCODING 'UTF8' TEMPLATE template0` (Russian Windows defaults to WIN1251).

## Where things are documented
Security: `docs/SECURITY.md`. Telegram setup: `docs/TELEGRAM_SETUP.md`. Deployment, GitHub Pages and what works without a server: `docs/DEPLOYMENT.md`. Tests: `docs/TESTING.md`.
