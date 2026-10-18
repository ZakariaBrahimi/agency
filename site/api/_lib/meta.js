// Meta Graph API: publishing to the Nawa Facebook Page and the Instagram business account.
// One system-user key (META_ACCESS_TOKEN) with pages_manage_posts and instagram_content_publish.
// Media is never uploaded from here: Meta downloads each file from a short-lived signed link
// (see mediaUrl in publish.js), so large videos don't pass through this function's memory.
import { env } from './http.js';

const BASE = () => `${env('META_MOCK_BASE') || 'https://graph.facebook.com'}/${env('META_GRAPH_VERSION') || 'v26.0'}`;
const PAGE = () => env('META_PAGE_ID');
const IG = () => env('META_IG_USER_ID');

export const metaConfigured = () => Boolean(env('META_ACCESS_TOKEN') && PAGE() && IG());

export class MetaError extends Error {
  constructor(e = {}, status = 0) {
    super(e.error_user_msg || e.message || `meta ${status}`);
    this.code = e.code; this.subcode = e.error_subcode; this.status = status;
  }
}

async function graph(path, { method = 'GET', params = {}, token = env('META_ACCESS_TOKEN') } = {}) {
  const url = new URL(BASE() + path);
  let body;
  if (method === 'GET') {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set('access_token', token);
  } else {
    body = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)])), access_token: token });
  }
  const r = await fetch(url, { method, body });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new MetaError(d.error, r.status);
  return d;
}

// Facebook posts need the Page's own key, which the system user can read.
let pageCache = null;
async function pageToken() {
  if (pageCache && pageCache.exp > Date.now()) return pageCache.token;
  const d = await graph(`/${PAGE()}`, { params: { fields: 'access_token' } });
  if (!d.access_token) throw new MetaError({ code: 10, message: 'no page access' });
  pageCache = { token: d.access_token, exp: Date.now() + 30 * 60e3 };
  return d.access_token;
}

/** Names of the connected accounts, for the admin header. */
let accountCache = null;
export async function accounts() {
  if (accountCache && accountCache.exp > Date.now()) return accountCache.value;
  const [page, ig] = await Promise.all([
    graph(`/${PAGE()}`, { params: { fields: 'name,link' } }),
    graph(`/${IG()}`, { params: { fields: 'username' } }),
  ]);
  const value = { page: page.name, pageUrl: page.link || `https://www.facebook.com/${PAGE()}`, ig: ig.username };
  accountCache = { value, exp: Date.now() + 10 * 60e3 };
  return value;
}

// ---------- Facebook ----------
/** items: [{ url, video }] in order. Returns { id, url }. */
export async function publishFacebook({ caption, items }) {
  const token = await pageToken();
  const videos = items.filter((m) => m.video);
  if (videos.length && items.length > 1) throw Object.assign(new Error('fb_mixed'), { code: 'fb_mixed' });
  if (videos.length) {
    const d = await graph(`/${PAGE()}/videos`, { method: 'POST', token, params: { file_url: videos[0].url, description: caption } });
    return { id: d.id, url: `https://www.facebook.com/${PAGE()}/videos/${d.id}` };
  }
  if (items.length === 1) {
    const d = await graph(`/${PAGE()}/photos`, { method: 'POST', token, params: { url: items[0].url, message: caption } });
    const id = d.post_id || d.id;
    return { id, url: `https://www.facebook.com/${id}` };
  }
  const params = { message: caption };
  if (items.length > 1) {
    const ids = [];
    for (const m of items) ids.push((await graph(`/${PAGE()}/photos`, { method: 'POST', token, params: { url: m.url, published: 'false' } })).id);
    ids.forEach((id, i) => { params[`attached_media[${i}]`] = { media_fbid: id }; });
  }
  const d = await graph(`/${PAGE()}/feed`, { method: 'POST', token, params });
  return { id: d.id, url: `https://www.facebook.com/${d.id}` };
}

// ---------- Instagram ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Waits for a media container; true when ready, false when the deadline passes first. */
async function waitReady(id, deadline) {
  for (;;) {
    const d = await graph(`/${id}`, { params: { fields: 'status_code,status' } });
    if (d.status_code === 'FINISHED' || d.status_code === 'PUBLISHED') return true;
    if (d.status_code === 'ERROR' || d.status_code === 'EXPIRED') throw Object.assign(new MetaError({ message: d.status || d.status_code }), { container: d.status_code });
    if (Date.now() + 4000 > deadline) return false;
    await sleep(3000);
  }
}

async function publishContainer(id) {
  const d = await graph(`/${IG()}/media_publish`, { method: 'POST', params: { creation_id: id } });
  let url = 'https://www.instagram.com/';
  try { url = (await graph(`/${d.id}`, { params: { fields: 'permalink' } })).permalink || url; } catch {}
  return { id: d.id, url };
}

/** items: [{ url, video }]. Returns { id, url }, or { pending: containerId } while a video is still processing. */
export async function publishInstagram({ caption, items }, deadline) {
  if (!items.length) throw Object.assign(new Error('ig_needs_media'), { code: 'ig_needs_media' });
  if (items.length > 10) throw Object.assign(new Error('ig_too_many'), { code: 'ig_too_many' });
  let container;
  if (items.length === 1) {
    const m = items[0];
    const params = m.video ? { media_type: 'REELS', video_url: m.url, caption, share_to_feed: 'true' } : { image_url: m.url, caption };
    container = (await graph(`/${IG()}/media`, { method: 'POST', params })).id;
  } else {
    const children = [];
    for (const m of items) {
      const params = m.video ? { media_type: 'VIDEO', video_url: m.url, is_carousel_item: 'true' } : { image_url: m.url, is_carousel_item: 'true' };
      children.push((await graph(`/${IG()}/media`, { method: 'POST', params })).id);
    }
    for (const c of children) if (!(await waitReady(c, deadline))) throw Object.assign(new Error('ig_slow'), { code: 'ig_slow' });
    container = (await graph(`/${IG()}/media`, { method: 'POST', params: { media_type: 'CAROUSEL', children: children.join(','), caption } })).id;
  }
  if (!(await waitReady(container, deadline))) return { pending: container };
  return publishContainer(container);
}

/** One image story. Returns { id, url }, or { pending: containerId } when the deadline passes first. */
export async function publishStory(imageUrl, deadline) {
  const container = (await graph(`/${IG()}/media`, { method: 'POST', params: { media_type: 'STORIES', image_url: imageUrl } })).id;
  if (!(await waitReady(container, deadline))) return { pending: container };
  // Meta can report a story container FINISHED a moment before it accepts media_publish
  // ("not ready for publishing" / "cannot be found"): wait and try again.
  for (let tries = 0; ; tries++) {
    try { return { id: (await graph(`/${IG()}/media_publish`, { method: 'POST', params: { creation_id: container } })).id }; }
    catch (e) {
      if (tries >= 3 || !(e.code === 9007 || /not ready|cannot be found/i.test(e.message)) || Date.now() + 6000 > deadline) throw e;
      await sleep(4000);
    }
  }
}

/** Finishes a container that was still processing on an earlier run. */
export async function finishInstagram(container, deadline) {
  if (!(await waitReady(container, deadline))) return { pending: container };
  return publishContainer(container);
}

/** A message the owner can act on, in Arabic. */
export function explain(e) {
  const c = e.code;
  if (c === 'ig_needs_media') return 'إنستغرام يحتاج صورة أو فيديو: أضف ملفًا للمنشور.';
  if (c === 'ig_too_many') return 'الكاروسيل في إنستغرام 10 ملفات كحد أقصى.';
  if (c === 'ig_slow') return 'إنستغرام ما زال يعالج ملفات الكاروسيل. ستُعاد المحاولة تلقائيًا.';
  if (c === 'fb_mixed') return 'فيسبوك لا يجمع الفيديو مع الصور في منشور واحد. اترك فيديو واحدًا أو صورًا فقط.';
  if (c === 'no_google') return 'افتح قسم «المحتوى» في لوحة الإدارة مرة واحدة ليتمكّن النشر التلقائي من الوصول إلى Drive.';
  if (c === 190) return 'مفتاح Meta غير صالح أو أُلغي. أنشئ مفتاحًا جديدًا وضعه في Vercel باسم META_ACCESS_TOKEN.';
  if (c === 10 || c === 200 || (c >= 200 && c < 300)) return 'مفتاح Meta لا يملك صلاحية النشر. تأكد من pages_manage_posts وinstagram_content_publish.';
  if (c === 9004 || e.subcode === 2207052 || e.subcode === 2207026) return 'تعذّر على Meta تنزيل الملف. جرّب مرة أخرى بعد دقيقة.';
  if (c === 36003 || e.subcode === 2207009) return 'أبعاد الملف غير مقبولة في إنستغرام.';
  if (c === 4 || c === 17 || c === 32 || c === 613 || e.subcode === 2207042) return 'تجاوزت حد النشر المسموح مؤقتًا. ستُعاد المحاولة لاحقًا.';
  if (e.container) return `رفض إنستغرام الملف بعد معالجته (${e.message}).`;
  return `رفضت Meta النشر: ${String(e.message || 'خطأ غير معروف').slice(0, 200)}`;
}
