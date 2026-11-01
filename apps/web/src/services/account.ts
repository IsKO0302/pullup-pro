import { S, save } from '../core/state';
import { api, auth, type AuthInfo } from './api';
import { resetSyncState, setCloud } from './sync';
import { TG } from './telegram';

/* ================= Account: Telegram sign-in (Mini App initData or one-time link code via the bot) ================= */
export interface ServerConfig { botUsername: string | null; webAppUrl: string | null; photos: boolean; version?: string }
let cfgP: Promise<ServerConfig | null> | null = null;
export function serverConfig(force = false): Promise<ServerConfig | null> {
  if (!cfgP || force) cfgP = api<ServerConfig>('/config', { noAuth: true, timeout: 6000 }).catch(() => { cfgP = null; return null; });
  return cfgP;
}
/** inside the Telegram Mini App: the server validates initData (HMAC-SHA256 with the bot token) and issues a session */
export async function telegramSignIn(): Promise<AuthInfo> {
  if (!TG.active || !TG.initData) throw new Error('Откройте приложение из Telegram-бота');
  const r = await api<AuthInfo>('/auth/telegram', { body: { initData: TG.initData, deviceId: S.meta.deviceId }, noAuth: true });
  auth.set({ ...r, via: 'telegram' }); return r;
}
export interface LinkStart { code: string; secret: string; botUrl: string | null; expiresAt: number }
export const linkStart = () => api<LinkStart>('/auth/link/start', { body: { deviceId: S.meta.deviceId }, noAuth: true });
export async function linkPoll(code: string, secret: string): Promise<'pending' | 'expired' | 'ok'> {
  const r = await api<{ status: 'pending' | 'expired' | 'ok'; token?: string; user?: AuthInfo['user']; exp?: number }>('/auth/link/poll', { body: { code, secret }, noAuth: true });
  if (r.status === 'ok' && r.token && r.user) auth.set({ token: r.token, user: r.user, exp: r.exp, via: 'link' });
  return r.status;
}
export async function signOut(): Promise<void> {
  try { await api('/auth/logout', { method: 'POST', body: {} }); } catch (e) { /* the token is dropped locally anyway */ }
  auth.clear(); setCloud(false); resetSyncState();
}
export async function deleteCloudAccount(): Promise<void> {
  await api('/account', { method: 'DELETE' });
  auth.clear(); setCloud(false); resetSyncState();
  for (const p of S.photos) delete p.cloud; save();
}
export async function setPhotoConsent(on: boolean): Promise<void> {
  const r = await api<{ user: AuthInfo['user'] }>('/account/consent', { body: { photos: on } });
  const a = auth.get(); if (a) auth.set({ ...a, user: { ...a.user, ...r.user } });
  S.settings.cloud.photos = on; S.settings.cloud.consentAt = on ? Date.now() : undefined; save();
}
