// Google (Drive + Calendar) for the content dashboard, without SDKs.
//
// Sign-in: the owner connects the Nawa Google account once per device. Google's refresh token is
// kept AES-GCM encrypted in an HttpOnly cookie (no database needed); each request trades it for a
// short-lived access token.
//
// Storage in Drive:  "Nawa Content/"                folder (appProperties nawa=root)
//                      nawa-content.json             index of every post + settings
//                      <date> · <title>/             one folder per post, holding its media
// Calendar: a separate "Nawa · Content" calendar; one event per scheduled time of a post.
import crypto from 'node:crypto';
import { env, siteUrl } from './http.js';

const MOCK = env('GOOGLE_MOCK_BASE'); // local tests only: points every Google host at a fake server
const OAUTH = MOCK || 'https://oauth2.googleapis.com';
const ACCOUNTS = MOCK || 'https://accounts.google.com';
const API = MOCK || 'https://www.googleapis.com';
export const DRIVE_BASE = API;

export const SCOPES = [
  'openid', 'email',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/calendar',
];
export const TZ = 'Africa/Algiers';
export const ROOT_NAME = 'Nawa Content';
export const INDEX_NAME = 'nawa-content.json';
export const CALENDAR_NAME = 'Nawa · Content';

export const googleConfigured = () => Boolean(env('GOOGLE_CLIENT_ID') && env('GOOGLE_CLIENT_SECRET'));
export const redirectUri = () => `${siteUrl()}/api/admin/google/callback`;

// ---------- cookies ----------
const G_COOKIE = 'nawa_g';
const STATE_COOKIE = 'nawa_gstate';
const key = () => crypto.createHash('sha256').update(`${env('ADMIN_PASSWORD')}|${env('GOOGLE_CLIENT_SECRET')}|nawa-google`).digest();

function seal(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64url');
}
function open(s) {
  try {
    const b = Buffer.from(s, 'base64url');
    const d = crypto.createDecipheriv('aes-256-gcm', key(), b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'));
  } catch { return null; }
}
const cookie = (req, name) => {
  const raw = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(name + '='));
  return raw ? decodeURIComponent(raw.slice(name.length + 1)) : '';
};
function addCookie(res, value) {
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [...(prev ? [].concat(prev) : []), value]);
}

/** The connected account on this device: { refresh, email } or null. */
export const connection = (req) => (cookie(req, G_COOKIE) ? open(cookie(req, G_COOKIE)) : null);
export function saveConnection(res, conn) {
  addCookie(res, `${G_COOKIE}=${seal(conn)}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${400 * 86400}`);
}
export function clearConnection(res) {
  addCookie(res, `${G_COOKIE}=; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
}

// ---------- sign-in ----------
/** Starts the Google sign-in; the state ties the callback to this browser. */
export function authUrl(res) {
  const nonce = crypto.randomBytes(16).toString('base64url');
  const state = seal({ nonce, exp: Date.now() + 10 * 60e3 });
  // Lax so the cookie survives the redirect back from accounts.google.com.
  addCookie(res, `${STATE_COOKIE}=${nonce}; Path=/api/admin/google; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  const q = new URLSearchParams({
    client_id: env('GOOGLE_CLIENT_ID'), redirect_uri: redirectUri(), response_type: 'code',
    scope: SCOPES.join(' '), access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state,
  });
  return `${ACCOUNTS}/o/oauth2/v2/auth?${q}`;
}

export function checkState(req, state) {
  const s = open(state || '');
  const nonce = cookie(req, STATE_COOKIE);
  return Boolean(s && nonce && s.nonce === nonce && s.exp > Date.now());
}
export const clearState = (res) => addCookie(res, `${STATE_COOKIE}=; Path=/api/admin/google; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);

export async function exchangeCode(code) {
  const r = await fetch(`${OAUTH}/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'), redirect_uri: redirectUri(), grant_type: 'authorization_code' }),
  });
  const d = await r.json();
  if (!r.ok || !d.refresh_token) throw new Error(`token exchange failed: ${d.error || r.status}`);
  let email = '';
  try { email = JSON.parse(Buffer.from(d.id_token.split('.')[1], 'base64url').toString()).email || ''; } catch {}
  return { refresh: d.refresh_token, email, access: d.access_token, exp: Date.now() + (d.expires_in - 60) * 1000 };
}

export async function revoke(refresh) {
  await fetch(`${OAUTH}/revoke?token=${encodeURIComponent(refresh)}`, { method: 'POST' }).catch(() => {});
}

// ---------- API client ----------
const tokenCache = new Map(); // refresh-token hash -> { access, exp }

export class GoogleError extends Error {
  constructor(status, body) { super(`google ${status}: ${String(body).slice(0, 300)}`); this.status = status; }
}

export function client(conn) {
  const id = crypto.createHash('sha256').update(conn.refresh).digest('hex');
  async function token(force) {
    const c = tokenCache.get(id);
    if (!force && c && c.exp > Date.now()) return c.access;
    const r = await fetch(`${OAUTH}/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ refresh_token: conn.refresh, client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'), grant_type: 'refresh_token' }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new GoogleError(r.status, JSON.stringify(d)), { reconnect: d.error === 'invalid_grant' });
    tokenCache.set(id, { access: d.access_token, exp: Date.now() + (d.expires_in - 60) * 1000 });
    return d.access_token;
  }
  async function call(path, { method = 'GET', body, headers = {}, raw = false, base = API } = {}) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const h = { Authorization: `Bearer ${await token(attempt > 0)}`, ...headers };
      let payload = body;
      if (body && typeof body === 'object' && !(body instanceof Buffer) && !(body instanceof Uint8Array) && !h['Content-Type']) {
        h['Content-Type'] = 'application/json'; payload = JSON.stringify(body);
      }
      const r = await fetch(base + path, { method, headers: h, body: payload });
      if (r.status === 401 && attempt === 0) continue;
      if (raw) return r;
      const text = await r.text();
      if (!r.ok) throw new GoogleError(r.status, text);
      return text ? JSON.parse(text) : null;
    }
  }
  return { call, token, cacheKey: id };
}

// ---------- Drive ----------
const FOLDER = 'application/vnd.google-apps.folder';
const q = (s) => encodeURIComponent(s);
const FILE_FIELDS = 'id,name,mimeType,size,thumbnailLink,webViewLink,imageMediaMetadata(width,height),videoMediaMetadata(width,height,durationMillis),createdTime';
const ids = new Map(); // cacheKey -> { root, index }

export async function findOrCreateRoot(g) {
  const cached = ids.get(g.cacheKey);
  if (cached?.root) return cached;
  const found = await g.call(`/drive/v3/files?q=${q(`mimeType='${FOLDER}' and trashed=false and appProperties has { key='nawa' and value='root' }`)}&fields=files(id)&pageSize=1`);
  let root = found.files[0]?.id;
  if (!root) root = (await g.call('/drive/v3/files?fields=id', { method: 'POST', body: { name: ROOT_NAME, mimeType: FOLDER, appProperties: { nawa: 'root' } } })).id;
  const idx = await g.call(`/drive/v3/files?q=${q(`name='${INDEX_NAME}' and '${root}' in parents and trashed=false`)}&fields=files(id)&pageSize=1`);
  const entry = { root, index: idx.files[0]?.id || null };
  ids.set(g.cacheKey, entry);
  return entry;
}

const EMPTY = () => ({ version: 1, settings: {}, posts: [] });

export async function readIndex(g) {
  const loc = await findOrCreateRoot(g);
  if (!loc.index) return { loc, data: EMPTY() };
  try {
    return { loc, data: { ...EMPTY(), ...(await g.call(`/drive/v3/files/${loc.index}?alt=media`)) } };
  } catch (e) {
    if (e.status === 404) { loc.index = null; return { loc, data: EMPTY() }; }
    throw e;
  }
}

export async function writeIndex(g, loc, data) {
  const body = JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 1);
  if (loc.index) {
    await g.call(`/upload/drive/v3/files/${loc.index}?uploadType=media`, { method: 'PATCH', body, headers: { 'Content-Type': 'application/json' } });
    return;
  }
  const boundary = 'nawa' + crypto.randomBytes(8).toString('hex');
  const meta = JSON.stringify({ name: INDEX_NAME, parents: [loc.root], mimeType: 'application/json', appProperties: { nawa: 'index' } });
  const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
  const r = await g.call('/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', body: multipart, headers: { 'Content-Type': `multipart/related; boundary=${boundary}` } });
  loc.index = r.id;
}

export async function createPostFolder(g, root, name) {
  return (await g.call('/drive/v3/files?fields=id,webViewLink', { method: 'POST', body: { name, mimeType: FOLDER, parents: [root], appProperties: { nawa: 'post' } } }));
}
export const renameFile = (g, id, name) => g.call(`/drive/v3/files/${id}?fields=id`, { method: 'PATCH', body: { name } });
export const trashFile = (g, id) => g.call(`/drive/v3/files/${id}?fields=id`, { method: 'PATCH', body: { trashed: true } });
export const fileMeta = (g, id) => g.call(`/drive/v3/files/${id}?fields=${FILE_FIELDS},parents`);

export async function listFolder(g, folder) {
  const r = await g.call(`/drive/v3/files?q=${q(`'${folder}' in parents and trashed=false and mimeType!='${FOLDER}'`)}&fields=files(${FILE_FIELDS})&orderBy=createdTime&pageSize=200`);
  return r.files.filter((f) => /^(image|video)\//.test(f.mimeType));
}

/** Starts a resumable upload; the browser then sends the bytes straight to Google. */
export async function startUpload(g, { folder, name, mimeType, size, origin }) {
  const r = await g.call('/upload/drive/v3/files?uploadType=resumable&fields=' + q(FILE_FIELDS), {
    method: 'POST', raw: true,
    body: { name, parents: [folder] },
    headers: { 'X-Upload-Content-Type': mimeType, ...(size ? { 'X-Upload-Content-Length': String(size) } : {}), ...(origin ? { Origin: origin } : {}) },
  });
  if (!r.ok) throw new GoogleError(r.status, await r.text());
  return r.headers.get('location');
}

// ---------- Calendar ----------
export async function ensureCalendar(g, settings) {
  if (settings.calendarId) {
    try { await g.call(`/calendar/v3/calendars/${encodeURIComponent(settings.calendarId)}`); return settings.calendarId; }
    catch (e) { if (e.status !== 404 && e.status !== 410) throw e; }
  }
  const cal = await g.call('/calendar/v3/calendars', { method: 'POST', body: { summary: CALENDAR_NAME, timeZone: TZ, description: 'منشورات نواة المعتمدة · Nawa approved posts' } });
  settings.calendarId = cal.id;
  return cal.id;
}

export async function createEvent(g, calendarId, ev) {
  return g.call(`/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, { method: 'POST', body: ev });
}
export async function deleteEvent(g, calendarId, eventId) {
  try { await g.call(`/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, { method: 'DELETE' }); }
  catch (e) { if (e.status !== 404 && e.status !== 410) throw e; }
}
