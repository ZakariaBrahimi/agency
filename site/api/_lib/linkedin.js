// LinkedIn for a client: the client signs in with LinkedIn (Community Management API) and picks the
// company Page they administer; Nawa then publishes their scheduled posts to that Page (text, one
// image, 2-20 images, or a video with its cover as thumbnail).
//
// Stored on the client row, clients.platforms.linkedin: { conn (sealed { access, refresh, exp, rexp }),
// status, pages: [{ id, name, vanity }], page: { id, name, vanity }, connected_at }. Access tokens last
// about 60 days; refreshed when LinkedIn gave a refresh token, else the client reconnects.
//
// Posting goes through the versioned REST API (/rest/posts, /rest/images, /rest/videos). A video is
// uploaded in LinkedIn's parts, finalized, and posted once LinkedIn says it is AVAILABLE; until then
// its URN is kept as the platform's container and checked on the next scheduler runs.
//
// Like TikTok, the browser comes back to /linkedin/callback, outside the portal cookie's path: the
// request is tied to the browser with a sealed state plus a short-lived cookie holding its nonce.
import crypto from 'node:crypto';
import { env, siteUrl } from './http.js';
import { seal, unseal } from './seal.js';
import { sb } from './supabase.js';

const AUTH = () => env('LINKEDIN_MOCK_BASE') || 'https://www.linkedin.com';
const API = () => env('LINKEDIN_MOCK_BASE') || 'https://api.linkedin.com';
const ID = () => env('LINKEDIN_CLIENT_ID');
const SECRET = () => env('LINKEDIN_CLIENT_SECRET');
const VERSION = () => env('LINKEDIN_VERSION') || '202510';
// posting as a Page, and listing the Pages the person administers
export const SCOPES = () => env('LINKEDIN_SCOPES') || 'w_organization_social rw_organization_admin';
const POSTERS = ['ADMINISTRATOR', 'CONTENT_ADMINISTRATOR', 'DIRECT_SPONSORED_CONTENT_POSTER'];
const CONN = 'nawa-linkedin-conn', STATE = 'nawa-linkedin-state', COOKIE = 'nawa_li';
const enc = encodeURIComponent;

export const liConfigured = () => Boolean(ID() && SECRET());
export const redirectUri = () => `${siteUrl()}/linkedin/callback`;

export class LinkedInError extends Error {
  constructor(code, message, extra = {}) { super(message || code); this.code = code; this.tt = true; Object.assign(this, extra); }
}

// ---------- connection on the client row ----------
export const liOf = (client) => client?.platforms?.linkedin || {};
export const connOf = (client) => (liOf(client).conn ? unseal(CONN, liOf(client).conn) : null);
export const liConnected = (client) => Boolean(connOf(client));
/** Connected and a Page chosen: posts can go out. */
export const liReady = (client) => Boolean(connOf(client) && liOf(client).page?.id);

async function saveLinkedIn(client, patch) {
  const platforms = { ...(client.platforms || {}), linkedin: { ...liOf(client), ...patch } };
  for (const [k, v] of Object.entries(platforms.linkedin)) if (v === undefined) delete platforms.linkedin[k];
  await sb.update('clients', `id=eq.${enc(client.id)}`, { platforms, updated_at: new Date().toISOString() });
  client.platforms = platforms;
}

// ---------- sign-in ----------
/** The LinkedIn authorization URL for this client; sets the nonce cookie on res. */
export function authUrl(res, client, user) {
  const n = crypto.randomBytes(16).toString('hex');
  const state = seal(STATE, { c: client.id, u: user.id, n, e: Date.now() + 15 * 60e3 });
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [...(prev ? [].concat(prev) : []), `${COOKIE}=${n}; Path=/linkedin; HttpOnly; Secure; SameSite=Lax; Max-Age=900`]);
  const q = new URLSearchParams({ response_type: 'code', client_id: ID(), redirect_uri: redirectUri(), state, scope: SCOPES() });
  return `${AUTH()}/oauth/v2/authorization?${q}`;
}
export const clearNonce = (res) => res.setHeader('Set-Cookie', `${COOKIE}=; Path=/linkedin; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);

async function tokenCall(params) {
  const r = await fetch(`${AUTH()}/oauth/v2/accessToken`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: ID(), client_secret: SECRET(), ...params }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw new LinkedInError(d.error || 'token_failed', d.error_description || `token ${r.status}`);
  const now = Date.now();
  return {
    access: d.access_token, exp: now + Number(d.expires_in || 5184000) * 1000,
    ...(d.refresh_token ? { refresh: d.refresh_token, rexp: now + Number(d.refresh_token_expires_in || 31536000) * 1000 } : {}),
    scope: d.scope || '',
  };
}

/**
 * GET /linkedin/callback: checks the state against the browser's nonce, exchanges the code, lists the
 * Pages the person can post to, and stores the connection (the Page is chosen at once when there is
 * only one). Returns the hash for /portal.
 */
export async function handleCallback(req, url, getClient) {
  const raw = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
  const st = unseal(STATE, url.searchParams.get('state') || '');
  if (!st || st.e < Date.now() || !raw || raw.slice(COOKIE.length + 1) !== st.n) return 'linkedin-failed';
  if (url.searchParams.get('error') || !url.searchParams.get('code')) return 'linkedin-denied';
  const client = await getClient(st.c);
  if (!client || !client.active) return 'linkedin-failed';
  const conn = await tokenCall({ grant_type: 'authorization_code', code: url.searchParams.get('code'), redirect_uri: redirectUri() });
  if (conn.scope && !conn.scope.split(/[ ,]/).includes('w_organization_social')) return 'linkedin-scope';
  const pages = await adminPages(conn.access);
  // nothing to post to: don't keep a connection that can't be used
  if (!pages.length) { if (!liConnected(client)) await saveLinkedIn(client, { status: 'not_started' }); return 'linkedin-nopage'; }
  const keep = liOf(client).page && pages.find((p) => p.id === liOf(client).page.id);
  const page = keep || (pages.length === 1 ? pages[0] : undefined);
  await saveLinkedIn(client, {
    conn: seal(CONN, conn), pages, page, status: page ? 'active' : 'waiting_client',
    connected_at: new Date().toISOString(), connected_by: st.u, client_done_at: undefined,
  });
  return 'linkedin-connected';
}

/** The client picks which of their Pages Nawa posts to. */
export async function choosePage(client, id) {
  const page = (liOf(client).pages || []).find((p) => p.id === String(id));
  if (!page || !liConnected(client)) return false;
  await saveLinkedIn(client, { page, status: 'active' });
  return true;
}

/** Disconnects: forgets the access (LinkedIn has no revoke call; the member can remove the app in their settings). */
export async function disconnect(client) {
  await saveLinkedIn(client, { conn: undefined, pages: undefined, page: undefined, status: 'not_started', connected_at: undefined, connected_by: undefined });
}

/** A valid access token (refreshed when LinkedIn gave a refresh token). */
async function accessToken(client) {
  const conn = connOf(client);
  if (!conn) throw new LinkedInError('linkedin_not_connected', 'لينكدإن غير مربوط. اربطه من «المنصات».');
  if (conn.exp - Date.now() > 5 * 60e3) return conn.access;
  if (!conn.refresh || conn.rexp < Date.now()) { await saveLinkedIn(client, { status: 'issue' }); throw new LinkedInError('linkedin_expired', 'انتهى ربط لينكدإن. أعد ربطه من «المنصات».'); }
  let next;
  try { next = await tokenCall({ grant_type: 'refresh_token', refresh_token: conn.refresh }); }
  catch (e) { await saveLinkedIn(client, { status: 'issue' }); throw new LinkedInError('linkedin_expired', 'انتهى ربط لينكدإن. أعد ربطه من «المنصات».'); }
  await saveLinkedIn(client, { conn: seal(CONN, { ...conn, ...next }), status: liOf(client).page ? 'active' : 'waiting_client' });
  return next.access;
}

// ---------- API ----------
const MESSAGES = {
  401: 'انتهى ربط لينكدإن. أعد ربطه من «المنصات».',
  403: 'لينكدإن رفض النشر: تأكد أنك ما زلت مسؤولًا عن الصفحة، أو أعد الربط.',
  429: 'بلغ لينكدإن حد النشر مؤقتًا. سيُعاد المحاولة لاحقًا.',
};
async function api(token, method, path, body, { raw = false } = {}) {
  const r = await fetch(API() + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'LinkedIn-Version': VERSION(), 'X-Restli-Protocol-Version': '2.0.0', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw && r.ok) return r;
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = String(d.message || '');
    const text = /duplicate/i.test(msg) ? 'لينكدإن رفض المنشور لأنه مطابق لمنشور سابق. عدّل النص قليلًا ثم أعد المحاولة.'
      : MESSAGES[r.status] || `تعذّر النشر على لينكدإن (${r.status}${msg ? ': ' + msg.slice(0, 160) : ''}).`;
    throw new LinkedInError(d.code || `http_${r.status}`, text, { status: r.status });
  }
  return d;
}

/** The Pages this person can post to: [{ id, name, vanity }]. */
async function adminPages(token) {
  const d = await api(token, 'GET', '/rest/organizationAcls?q=roleAssignee&state=APPROVED&count=100');
  const ids = [...new Set((d.elements || []).filter((e) => POSTERS.includes(e.role)).map((e) => String(e.organization || '').split(':').pop()).filter((x) => /^\d+$/.test(x)))];
  const out = [];
  for (const id of ids.slice(0, 50)) {
    const o = await api(token, 'GET', `/rest/organizations/${id}`).catch(() => null);
    out.push({ id, name: String(o?.localizedName || `Page ${id}`).slice(0, 120), vanity: String(o?.vanityName || '').slice(0, 120) });
  }
  return out;
}

/**
 * LinkedIn's "little text": reserved characters are escaped, and #hashtags become hashtag templates
 * so they stay links.
 */
export function littleText(s) {
  const escape = (x) => x.replace(/[\\|{}@[\]()<>#*_~]/g, '\\$&');
  let out = '', last = 0;
  for (const m of String(s || '').matchAll(/#([\p{L}\p{N}_]+)/gu)) {
    out += escape(m.input.slice(last, m.index)) + `{hashtag|\\#|${escape(m[1])}}`;
    last = m.index + m[0].length;
  }
  return out + escape(String(s || '').slice(last));
}

const urnId = (urn) => String(urn || '');
async function uploadImage(token, owner, jpeg) {
  const d = await api(token, 'POST', '/rest/images?action=initializeUpload', { initializeUploadRequest: { owner } });
  const v = d.value || {};
  const r = await fetch(v.uploadUrl, { method: 'PUT', body: jpeg, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' } });
  if (!r.ok) throw new LinkedInError('upload_failed', `تعذّر رفع الصورة إلى لينكدإن (${r.status}).`);
  return v.image;
}

/** Uploads a video in LinkedIn's parts and finalizes it. Returns its URN. */
async function uploadVideo(token, owner, { size, read, thumb, deadline }) {
  const d = await api(token, 'POST', '/rest/videos?action=initializeUpload', { initializeUploadRequest: { owner, fileSizeBytes: size, uploadCaptions: false, uploadThumbnail: Boolean(thumb) } });
  const v = d.value || {};
  const etags = [];
  for (const [i, part] of (v.uploadInstructions || []).entries()) {
    if (i && Date.now() > deadline - 8e3) throw new LinkedInError('too_big', 'الفيديو أكبر من أن يُرسل إلى لينكدإن في دفعة واحدة. صغّر حجمه (حتى 300 ميغابايت تقريبًا) ثم أعد رفعه.');
    const body = await read(part.firstByte, part.lastByte);
    const r = await fetch(part.uploadUrl, { method: 'PUT', body, headers: { 'Content-Type': 'application/octet-stream' } });
    if (!r.ok) throw new LinkedInError('upload_failed', `تعذّر رفع الفيديو إلى لينكدإن (${r.status}).`);
    etags.push(r.headers.get('etag'));
  }
  if (thumb && v.thumbnailUploadUrl) {
    await fetch(v.thumbnailUploadUrl, { method: 'PUT', body: thumb, headers: { 'Content-Type': 'application/octet-stream' } }).catch(() => {});
  }
  await api(token, 'POST', '/rest/videos?action=finalizeUpload', { finalizeUploadRequest: { video: v.video, uploadToken: v.uploadToken || '', uploadedPartIds: etags } });
  return v.video;
}

async function videoStatus(token, urn) {
  const d = await api(token, 'GET', `/rest/videos/${enc(urn)}`);
  if (d.status === 'PROCESSING_FAILED') throw new LinkedInError('video_failed', 'لينكدإن لم يستطع معالجة الفيديو. جرّب ملف MP4 آخر.', { container: true });
  return d.status;
}

async function createPost(token, author, commentary, content) {
  const r = await api(token, 'POST', '/rest/posts', {
    author, commentary: littleText(commentary).slice(0, 3000), visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: 'PUBLISHED', isReshareDisabledByAuthor: false, ...(content ? { content } : {}),
  }, { raw: true });
  const id = r.headers.get('x-restli-id') || r.headers.get('x-linkedin-id') || '';
  return { id, url: id ? `https://www.linkedin.com/feed/update/${id}/` : '' };
}

/**
 * Publishes a post to the client's Page. items: [{ m, video }] in order; read(m, a, b) gives a
 * file's bytes; jpeg(buf) converts an image; cover: a video's cover file (or null).
 * container: a video already uploaded and still processing. Returns { id, url } or { pending }.
 */
export async function publish(client, { caption, items, read, jpeg, cover, container, deadline }) {
  const token = await accessToken(client);
  const page = liOf(client).page;
  if (!page?.id) throw new LinkedInError('linkedin_no_page', 'اختر صفحة لينكدإن من «المنصات».');
  const owner = `urn:li:organization:${page.id}`;
  const videos = items.filter((x) => x.video), images = items.filter((x) => !x.video);
  if (videos.length && (videos.length > 1 || images.length)) throw new LinkedInError('linkedin_mixed', 'لينكدإن يقبل فيديو واحدًا بلا صور في المنشور الواحد.');
  if (images.length > 20) throw new LinkedInError('linkedin_too_many', 'لينكدإن يقبل 20 صورة على الأكثر في المنشور.');

  let content = null;
  if (videos.length) {
    let urn = container;
    if (!urn) {
      const m = videos[0].m;
      if (!m.size) throw new LinkedInError('linkedin_size', 'تعذّر معرفة حجم الفيديو. أعد رفعه.');
      const thumb = cover ? await read(cover, 0, Number(cover.size) - 1).then(jpeg).catch(() => null) : null;
      urn = await uploadVideo(token, owner, { size: Number(m.size), read: (a, b) => read(m, a, b), thumb, deadline });
    }
    // LinkedIn processes the video: post once it is available, else check again on the next runs
    let st = await videoStatus(token, urn);
    for (let i = 0; st !== 'AVAILABLE' && i < 3 && Date.now() < deadline - 10e3; i++) {
      await new Promise((ok) => setTimeout(ok, Number(process.env.LINKEDIN_POLL_MS || 3000)));
      st = await videoStatus(token, urn);
    }
    if (st !== 'AVAILABLE') return { pending: urn };
    content = { media: { id: urn } };
  } else if (images.length) {
    const urns = [];
    for (const x of images) urns.push(await uploadImage(token, owner, await jpeg(await read(x.m, 0, Number(x.m.size) - 1))));
    content = urns.length === 1 ? { media: { id: urns[0] } } : { multiImage: { images: urns.map((id) => ({ id })) } };
  }
  return createPost(token, owner, caption, content);
}

/** For the portal and the admin: the connection as shown (never the tokens). */
export function liPublic(client) {
  const l = liOf(client);
  return liConnected(client) ? { connected: true, ready: Boolean(l.page?.id), page: l.page || null, pages: l.pages || [] } : { connected: false };
}
export const pageUrl = (p) => (p?.vanity ? `https://www.linkedin.com/company/${p.vanity}/` : p?.id ? `https://www.linkedin.com/company/${p.id}/` : '');
