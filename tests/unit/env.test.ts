import { describe, expect, it } from 'vitest';
import { withEnvAliases } from '@pullup/shared/env';
import { loadConfig } from '../../apps/api/src/config';
import { loadBotConfig } from '../../apps/telegram-bot/src/config';

const TOKEN = '123456789:AAtest_token_for_unit_tests_only_000000';

describe('environment variable aliases', () => {
  it('maps the documented TELEGRAM_* / APP_BASE_URL names onto the names used by the code', () => {
    const e = withEnvAliases({ TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_BOT_USERNAME: 'my_bot', TELEGRAM_WEBAPP_URL: 'https://a.example/' });
    expect(e).toMatchObject({ BOT_TOKEN: TOKEN, BOT_USERNAME: 'my_bot', WEBAPP_URL: 'https://a.example/' });
  });
  it('APP_BASE_URL is the fallback for WEBAPP_URL; TELEGRAM_WEBAPP_URL wins over it', () => {
    expect(withEnvAliases({ APP_BASE_URL: 'https://base.example/' }).WEBAPP_URL).toBe('https://base.example/');
    expect(withEnvAliases({ APP_BASE_URL: 'https://base.example/', TELEGRAM_WEBAPP_URL: 'https://tg.example/' }).WEBAPP_URL).toBe('https://tg.example/');
  });
  it('an explicit short name always wins, blank values are ignored, the input is not mutated', () => {
    const input = { BOT_TOKEN: TOKEN, TELEGRAM_BOT_TOKEN: '999999:other_token_value_that_is_long_enough_00', WEBAPP_URL: '  ', APP_BASE_URL: 'https://x.example/' };
    const out = withEnvAliases(input);
    expect(out.BOT_TOKEN).toBe(TOKEN); expect(out.WEBAPP_URL).toBe('https://x.example/');
    expect(input.WEBAPP_URL).toBe('  ');
  });
  it('the API and the bot read the aliased names', () => {
    const env = { DATABASE_URL: 'postgres://u:p@localhost:5432/x', TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_BOT_USERNAME: 'my_bot', TELEGRAM_WEBAPP_URL: 'https://a.example/' };
    expect(loadConfig(env)).toMatchObject({ botToken: TOKEN, botUsername: 'my_bot', webAppUrl: 'https://a.example/' });
    expect(loadBotConfig(env)).toMatchObject({ botToken: TOKEN, webAppUrl: 'https://a.example/' });
  });
  it('a missing token still fails with a clear message', () => {
    expect(() => loadBotConfig({ DATABASE_URL: 'postgres://x' })).toThrow(/BOT_TOKEN/);
  });
});
