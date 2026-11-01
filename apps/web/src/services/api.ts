/* ================= API client (sync server). The app is fully functional without it. ================= */
export const API_BASE: string = ((import.meta.env.VITE_API_URL as string) || '').replace(/\/$/, '') + '/api';
const AUTH_KEY = 'pullup.pro.auth';
export interface AuthUser { id: string; name?: string; telegramId?: number | null; username?: string | null; photosConsent?: boolean }
export interface AuthInfo { token: string; user: AuthUser; exp?: number; via?: 'telegram' | 'link' }
export const auth = {
  get(): AuthInfo | null { try { const r = localStorage.getItem(AUTH_KEY); const a = r ? JSON.parse(r) : null; return a && a.token && (!a.exp || a.exp > Date.now()) ? a : null; } catch (e) { return null; } },
  set(a: AuthInfo) { try { localStorage.setItem(AUTH_KEY, JSON.stringify(a)); } catch (e) { /* quota */ } },
  clear() { try { localStorage.removeItem(AUTH_KEY); } catch (e) { /* ignore */ } }
};
export class ApiError extends Error { status: number; code?: string; constructor(status: number, message: string, code?: string) { super(message); this.status = status; this.code = code; } }
export async function api<T = any>(path: string, o: { method?: string; body?: unknown; raw?: Blob; headers?: Record<string, string>; timeout?: number; noAuth?: boolean } = {}): Promise<T> {
  const a = o.noAuth ? null : auth.get(), ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), o.timeout || 20000);
  const headers: Record<string, string> = { ...(o.headers || {}) };
  if (a) headers.authorization = 'Bearer ' + a.token;
  let body: BodyInit | undefined;
  if (o.raw) { body = o.raw; headers['content-type'] = o.raw.type || 'application/octet-stream'; }
  else if (o.body !== undefined) { body = JSON.stringify(o.body); headers['content-type'] = 'application/json'; }
  try {
    const r = await fetch(API_BASE + path, { method: o.method || (body ? 'POST' : 'GET'), headers, body, signal: ctl.signal, credentials: 'omit' });
    const ct = r.headers.get('content-type') || '';
    if (!r.ok) {
      let msg = r.statusText || 'Ошибка сервера', code;
      if (ct.includes('json')) { try { const j = await r.json(); msg = j.message || j.error || msg; code = j.code; } catch (e) { /* ignore */ } }
      if (r.status === 401) auth.clear();
      throw new ApiError(r.status, msg, code);
    }
    if (ct.includes('json')) return await r.json();
    return (await r.blob()) as any;
  } catch (e: any) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, e && e.name === 'AbortError' ? 'Сервер не отвечает' : 'Нет соединения с сервером');
  } finally { clearTimeout(tm); }
}
export async function apiAvailable(): Promise<boolean> { try { const h = await api<{ ok: boolean }>('/health', { noAuth: true, timeout: 5000 }); return !!(h && h.ok); } catch (e) { return false; } }
