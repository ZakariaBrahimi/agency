// TikTok for a client: "Log in with TikTok" (Login Kit, user.info.basic) and Direct Post (Content
// Posting API, video.publish). The connection is kept sealed on the client row, in
// clients.platforms.tiktok.conn ({ access, refresh, exp, rexp, open_id }), with the account's display
// name and avatar beside it for the portal. Access tokens last a day and are refreshed on demand.
//
// Publishing a video: creator_info (required before every post: privacy options, interaction
// settings, max duration) -> init with FILE_UPLOAD -> the file is sent in chunks, read from the
// client's storage with Range -> TikTok processes it; the publish id is kept as the platform's
// container and checked on the next scheduler runs until PUBLISH_COMPLETE or FAILED.
//
// The browser comes back to /tiktok/callback, outside the portal cookie's path, so the request is
// tied to the browser with a sealed state plus a short-lived cookie holding its nonce.
import crypto from 'node:crypto';
import { env, siteUrl } from './http.js';
import { seal, unseal } from './seal.js';
import { sb } from './supabase.js';

const AUTH = () => env('TIKTOK_MOCK_BASE') || 'https://www.tiktok.com';
const API = () => env('TIKTOK_MOCK_BASE') || 'https://open.tiktokapis.com';
const KEY = () => env('TIKTOK_CLIENT_KEY');
const SECRET = () => env('TIKTOK_CLIENT_SECRET');
export const SCOPES = 'user.info.basic,video.publish';
export const PRIVACY = ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'];
const CONN = 'nawa-tiktok-conn', STATE = 'nawa-tiktok-state', COOKIE = 'nawa_tt';
const enc = encodeURIComponent;

export const ttConfigured = () => Boolean(KEY() && SECRET());
export const redirectUri = () => `${siteUrl()}/tiktok/callback`;

export class TikTokError extends Error {
  constructor(code, message, extra = {}) { super(message || code); this.code = code; this.tt = true; Object.assign(this, extra); }
}

// ---------- connection on the client row ----------
export const ttOf = (client) => client?.platforms?.tiktok || {};
export const connOf = (client) => (ttOf(client).conn ? unseal(CONN, ttOf(client).conn) : null);
export const ttConnected = (client) => Boolean(connOf(client));

async function saveTikTok(client, patch) {
  const platforms = { ...(client.platforms || {}), tiktok: { ...ttOf(client), ...patch } };
  for (const [k, v] of Object.entries(platforms.tiktok)) if (v === undefined) delete platforms.tiktok[k];
  await sb.update('clients', `id=eq.${enc(client.id)}`, { platforms, updated_at: new Date().toISOString() });
  client.platforms = platforms;
}

// ---------- sign-in ----------
/** The TikTok authorization URL for this client; sets the nonce cookie on res. */
export function authUrl(res, client, user) {
  const n = crypto.randomBytes(16).toString('hex');
  const state = seal(STATE, { c: client.id, u: user.id, n, e: Date.now() + 15 * 60e3 });
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [...(prev ? [].concat(prev) : []), `${COOKIE}=${n}; Path=/tiktok; HttpOnly; Secure; SameSite=Lax; Max-Age=900`]);
  const q = new URLSearchParams({ client_key: KEY(), scope: SCOPES, response_type: 'code', redirect_uri: redirectUri(), state });
  return `${AUTH()}/v2/auth/authorize/?${q}`;
}

async function tokenCall(params) {
  const r = await fetch(`${API()}/v2/oauth/token/`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body: new URLSearchParams({ client_key: KEY(), client_secret: SECRET(), ...params }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error || !d.access_token) throw new TikTokError(d.error || 'token_failed', d.error_description || `token ${r.status}`);
  const now = Date.now();
  return { access: d.access_token, refresh: d.refresh_token, exp: now + Number(d.expires_in || 86400) * 1000, rexp: now + Number(d.refresh_expires_in || 31536000) * 1000, open_id: d.open_id, scope: d.scope || '' };
}

/**
 * GET /tiktok/callback: checks the state against the browser's nonce, exchanges the code, reads the
 * account's name and avatar, and stores the connection. Returns the hash for /portal.
 */
export async function handleCallback(req, url, getClient) {
  const raw = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
  const st = unseal(STATE, url.searchParams.get('state') || '');
  if (!st || st.e < Date.now() || !raw || raw.slice(COOKIE.length + 1) !== st.n) return 'tiktok-failed';
  if (url.searchParams.get('error') || !url.searchParams.get('code')) return 'tiktok-denied';
  const client = await getClient(st.c);
  if (!client || !client.active) return 'tiktok-failed';
  const conn = await tokenCall({ code: url.searchParams.get('code'), grant_type: 'authorization_code', redirect_uri: redirectUri() });
  if (!conn.scope.split(',').includes('video.publish')) {
    // the person unticked publishing: nothing could be posted, so don't keep a half connection
    await revokeToken(conn.access);
    return 'tiktok-scope';
  }
  const info = await api(conn.access, 'GET', '/v2/user/info/?fields=open_id,display_name,avatar_url').catch(() => null);
  const u = info?.user || {};
  await saveTikTok(client, {
    conn: seal(CONN, conn), status: 'active', open_id: conn.open_id,
    name: String(u.display_name || '').slice(0, 120), avatar: String(u.avatar_url || '').slice(0, 1000),
    connected_at: new Date().toISOString(), connected_by: st.u, client_done_at: undefined,
  });
  return 'tiktok-connected';
}
export const clearNonce = (res) => res.setHeader('Set-Cookie', `${COOKIE}=; Path=/tiktok; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);

async function revokeToken(token) {
  await fetch(`${API()}/v2/oauth/revoke/`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: KEY(), client_secret: SECRET(), token }),
  }).catch(() => {});
}

/** Disconnects: revokes the access at TikTok and forgets it. */
export async function disconnect(client) {
  const conn = connOf(client);
  if (conn) await revokeToken(conn.access);
  await saveTikTok(client, { conn: undefined, status: 'not_started', name: undefined, avatar: undefined, open_id: undefined, connected_at: undefined, connected_by: undefined, username: undefined });
}

/** A valid access token for the client (refreshed when it is about to expire). */
async function accessToken(client) {
  const conn = connOf(client);
  if (!conn) throw new TikTokError('tiktok_not_connected', 'تيك توك غير مربوط. اربطه من «المنصات».');
  if (conn.exp - Date.now() > 5 * 60e3) return conn.access;
  if (conn.rexp < Date.now()) { await saveTikTok(client, { status: 'issue' }); throw new TikTokError('tiktok_expired', 'انتهى ربط تيك توك. أعد ربطه من «المنصات».'); }
  let next;
  try { next = await tokenCall({ grant_type: 'refresh_token', refresh_token: conn.refresh }); }
  catch (e) {
    if (/invalid_grant/.test(e.code)) { await saveTikTok(client, { status: 'issue' }); throw new TikTokError('tiktok_expired', 'انتهى ربط تيك توك. أعد ربطه من «المنصات».'); }
    throw e;
  }
  await saveTikTok(client, { conn: seal(CONN, { ...conn, ...next, open_id: next.open_id || conn.open_id }), status: 'active' });
  return next.access;
}

// ---------- API ----------
const MESSAGES = {
  spam_risk_too_many_posts: 'بلغ حساب تيك توك الحد اليومي للنشر. سيُعاد المحاولة لاحقًا.',
  spam_risk_user_banned_from_posting: 'تيك توك يمنع هذا الحساب من النشر حاليًا.',
  reached_active_user_cap: 'بلغ تطبيق نواة حد الاستخدام اليومي على تيك توك. حاول لاحقًا.',
  unaudited_client_can_only_post_to_private_accounts: 'تطبيق نواة قيد المراجعة لدى تيك توك: يمكنه النشر فقط على حساب خاص (Private). اجعل الحساب خاصًا مؤقتًا أو انتظر الموافقة.',
  privacy_level_option_mismatch: 'خيار الخصوصية المختار لم يعد متاحًا لهذا الحساب. اختره من جديد.',
  access_token_invalid: 'انتهى ربط تيك توك. أعد ربطه من «المنصات».',
  scope_not_authorized: 'لم يُمنح إذن النشر على تيك توك. أعد الربط ووافق على كل الأذونات.',
  url_ownership_unverified: 'رابط الملف غير موثَّق لدى تيك توك.',
  file_format_check_failed: 'صيغة الفيديو غير مقبولة لدى تيك توك (MP4 أو MOV أو WebM).',
  duration_check_failed: 'مدة الفيديو غير مقبولة لدى تيك توك.',
  frame_rate_check_failed: 'معدل إطارات الفيديو غير مقبول لدى تيك توك.',
  picture_size_check_failed: 'أبعاد الفيديو غير مقبولة لدى تيك توك (360 بكسل على الأقل).',
};
export const explain = (code, fallback) => MESSAGES[code] || fallback || `تعذّر النشر على تيك توك (${code}).`;

async function api(token, method, path, body) {
  const r = await fetch(API() + path, {
    method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json; charset=UTF-8' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  // post ids are 19-digit numbers, past what a JS number holds exactly: read them as text
  const text = await r.text().catch(() => '');
  let d = {};
  try { d = JSON.parse(text.replace(/("publicaly_available_post_id"\s*:\s*\[)([^\]]*)\]/g, (m, a, b) => a + b.replace(/\d{12,}/g, '"$&"') + ']')); } catch {}
  const code = d.error?.code;
  if (!r.ok || (code && code !== 'ok')) throw new TikTokError(code || `http_${r.status}`, explain(code, d.error?.message), { status: r.status });
  return d.data || {};
}

/** What the account allows right now (TikTok requires asking before each post). */
export async function creatorInfo(client) {
  const d = await api(await accessToken(client), 'POST', '/v2/post/publish/creator_info/query/');
  if (d.creator_username && d.creator_username !== ttOf(client).username) await saveTikTok(client, { username: d.creator_username }).catch(() => {});
  return {
    nickname: d.creator_nickname || '', username: d.creator_username || '', avatar: d.creator_avatar_url || '',
    privacy: (d.privacy_level_options || []).filter((x) => PRIVACY.includes(x)),
    comment_disabled: Boolean(d.comment_disabled), duet_disabled: Boolean(d.duet_disabled), stitch_disabled: Boolean(d.stitch_disabled),
    max_duration: Number(d.max_video_post_duration_sec || 0),
  };
}

/**
 * The post's TikTok settings, checked: { privacy, comment, duet, stitch, brand_own, brand_paid }.
 * Returns an error code or null.
 */
export function checkSettings(t) {
  if (!t || !PRIVACY.includes(t.privacy)) return 'tiktok_privacy';
  if (t.commercial && !t.brand_own && !t.brand_paid) return 'tiktok_brand';
  if (t.brand_paid && t.privacy === 'SELF_ONLY') return 'tiktok_brand_private';
  return null;
}
export function cleanSettings(b = {}) {
  return {
    privacy: PRIVACY.includes(b.privacy) ? b.privacy : '',
    comment: Boolean(b.comment), duet: Boolean(b.duet), stitch: Boolean(b.stitch),
    commercial: Boolean(b.commercial), brand_own: Boolean(b.commercial && b.brand_own), brand_paid: Boolean(b.commercial && b.brand_paid),
  };
}

const MB = 1024 * 1024;
/** Chunks as TikTok wants them: one up to 64 MB, else 32 MB chunks with the rest in the last one. */
export function chunksFor(size) {
  if (size <= 64 * MB) return { chunk: size, count: 1 };
  const chunk = 32 * MB;
  return { chunk, count: Math.floor(size / chunk) };
}

/**
 * Starts a Direct Post of a video. read(start, end) returns the file's bytes [start, end].
 * Returns { publishId }.
 */
export async function postVideo(client, { caption, settings, size, mimeType, read, deadline = Date.now() + 45e3 }) {
  const info = await creatorInfo(client);
  const t = settings;
  if (!info.privacy.includes(t.privacy)) throw new TikTokError('privacy_level_option_mismatch', explain('privacy_level_option_mismatch'));
  const token = await accessToken(client);
  const { chunk, count } = chunksFor(size);
  const init = await api(token, 'POST', '/v2/post/publish/video/init/', {
    post_info: {
      title: String(caption || '').slice(0, 2200), privacy_level: t.privacy,
      disable_comment: info.comment_disabled || !t.comment, disable_duet: info.duet_disabled || !t.duet, disable_stitch: info.stitch_disabled || !t.stitch,
      brand_content_toggle: Boolean(t.brand_paid), brand_organic_toggle: Boolean(t.brand_own),
    },
    source_info: { source: 'FILE_UPLOAD', video_size: size, chunk_size: chunk, total_chunk_count: count },
  });
  if (!init.publish_id || !init.upload_url) throw new TikTokError('init_failed', 'تعذّر بدء النشر على تيك توك.');
  for (let i = 0; i < count; i++) {
    // the server has about a minute per run: a file too big to send in time is said so, not retried forever
    if (i && Date.now() > deadline - 8e3) throw new TikTokError('too_big', 'الفيديو أكبر من أن يُرسل إلى تيك توك في دفعة واحدة. صغّر حجمه (حتى 300 ميغابايت تقريبًا) ثم أعد رفعه.');
    const start = i * chunk, end = i === count - 1 ? size - 1 : start + chunk - 1;
    const body = await read(start, end);
    if (body.length !== end - start + 1) throw new TikTokError('read_failed', 'تعذّر قراءة ملف الفيديو من التخزين.');
    const r = await fetch(init.upload_url, { method: 'PUT', body, headers: { 'Content-Type': /^video\/(mp4|quicktime|webm)$/.test(mimeType) ? mimeType : 'video/mp4', 'Content-Length': String(body.length), 'Content-Range': `bytes ${start}-${end}/${size}` } });
    if (![200, 201, 206].includes(r.status)) throw new TikTokError('upload_failed', `تعذّر رفع الفيديو إلى تيك توك (${r.status}).`);
  }
  return { publishId: init.publish_id };
}

/** Where a post is: { done, url?, id? } | { pending } ; throws TikTokError when TikTok gave up. */
export async function postStatus(client, publishId) {
  const d = await api(await accessToken(client), 'POST', '/v2/post/publish/status/fetch/', { publish_id: publishId });
  if (d.status === 'FAILED') throw new TikTokError(d.fail_reason || 'failed', explain(d.fail_reason, 'رفض تيك توك الفيديو.'), { container: true });
  if (d.status !== 'PUBLISH_COMPLETE') return { pending: true };
  const id = [].concat(d.publicaly_available_post_id || d.publicly_available_post_id || [])[0];
  const user = ttOf(client).username;
  return { done: true, id: id ? String(id) : publishId, url: id && user ? `https://www.tiktok.com/@${user}/video/${id}` : '' };
}

/** For the portal and the admin: the account as shown (never the tokens). */
export function ttPublic(client) {
  const t = ttOf(client);
  return ttConnected(client) ? { connected: true, name: t.name || '', avatar: t.avatar || '', username: t.username || '', at: t.connected_at || '' } : { connected: false };
}
