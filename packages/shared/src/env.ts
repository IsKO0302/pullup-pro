/* ================= Environment variable aliases =================
 * The code reads BOT_TOKEN / BOT_USERNAME / WEBAPP_URL. The longer, self-explanatory names used in the project
 * documentation (TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, TELEGRAM_WEBAPP_URL, APP_BASE_URL) work as well.
 * An explicitly set short name always wins; blank values are ignored. Returns a copy — the input is never mutated. */
const ALIASES: Readonly<Record<string, readonly string[]>> = {
  BOT_TOKEN: ['TELEGRAM_BOT_TOKEN'],
  BOT_USERNAME: ['TELEGRAM_BOT_USERNAME'],
  WEBAPP_URL: ['TELEGRAM_WEBAPP_URL', 'APP_BASE_URL']
};

export function withEnvAliases(env: Readonly<Record<string, string | undefined>>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = { ...env };
  for (const [name, alternatives] of Object.entries(ALIASES)) {
    if ((out[name] ?? '').trim()) continue;
    const found = alternatives.map(a => (env[a] ?? '').trim()).find(Boolean);
    if (found) out[name] = found;
  }
  return out;
}
