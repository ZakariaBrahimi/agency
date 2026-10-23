// Publishing approved posts to Facebook and Instagram, by hand ("انشر الآن") or at their scheduled
// time (the cron run in /api/admin/content). State lives on each platform's schedule entry:
//   status: 'scheduled' | 'publishing' (Instagram still processing a video) | 'published'
//   auto: false turns off automatic publishing for that platform
//   remote: { id, url } once published · error: { message, at, tries } · container · lockedAt
import { Readable } from 'node:stream';
import { siteUrl } from './http.js';
import { seal, unseal } from './seal.js';
import * as M from './meta.js';
import { captionFor } from '../../assets/js/content-schema.js';

export const META_PLATFORMS = ['facebook', 'instagram'];
const MAX_TRIES = 3;
const LOCK_MS = 5 * 60e3;
const LINK_MS = 30 * 60e3;

// Scheduled times are wall-clock times in Algiers (UTC+1 all year, no daylight saving).
export const atToDate = (at) => new Date(`${at}:00+01:00`);

// ---------- signed media links ----------
// Meta downloads each file from /media/<sealed>. The sealed part carries the Drive file id, a
// short-lived Google access token and an expiry, encrypted, so the files stay private in Drive.
export async function mediaUrl(g, file, platform) {
  const k = seal('nawa-media', { f: file.id, a: await g.token(), e: Date.now() + LINK_MS, m: file.video ? 'raw' : platform === 'instagram' ? 'ig' : 'fb' });
  return `${siteUrl()}/media/${k}.${file.video ? 'mp4' : 'jpg'}`;
}

const INK = { r: 11, g: 18, b: 32 };
// Instagram accepts JPEG only, from 4:5 (portrait) to 1.91:1 (landscape). Anything outside that
// range is fitted onto Nawa ink rather than cropped, so nothing in the design is cut off.
async function toJpeg(buf, forInstagram) {
  const sharp = (await import('sharp')).default;
  let img = sharp(buf, { failOn: 'none' }).rotate();
  const { width, height } = await img.metadata();
  if (forInstagram && width && height) {
    const r = width / height;
    if (r < 0.8) { const add = Math.round(height * 0.8) - width; img = sharp(await img.toBuffer()).extend({ left: Math.floor(add / 2), right: Math.ceil(add / 2), background: INK }); }
    else if (r > 1.91) { const add = Math.round(width / 1.91) - height; img = sharp(await img.toBuffer()).extend({ top: Math.floor(add / 2), bottom: Math.ceil(add / 2), background: INK }); }
  }
  return img.flatten({ background: INK }).resize({ width: 1440, height: 1800, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
}

/** GET /media/<sealed>.<ext>: serves one file to Meta. */
export async function serveMedia(req, res, sealed, driveBase) {
  const t = unseal('nawa-media', String(sealed || '').replace(/\.\w+$/, ''));
  if (!t || !t.f || t.e < Date.now()) { res.statusCode = 404; return res.end(); }
  const r = await fetch(`${driveBase}/drive/v3/files/${encodeURIComponent(t.f)}?alt=media`, { headers: { Authorization: `Bearer ${t.a}` } });
  if (!r.ok) { res.statusCode = 404; return res.end(); }
  res.setHeader('Cache-Control', 'no-store');
  const type = r.headers.get('content-type') || 'application/octet-stream';
  if (t.m !== 'raw' && /^image\//.test(type)) {
    const out = await toJpeg(Buffer.from(await r.arrayBuffer()), t.m === 'ig');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', String(out.length));
    return res.end(out);
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', type);
  if (r.headers.get('content-length')) res.setHeader('Content-Length', r.headers.get('content-length'));
  if (req.method === 'HEAD') return res.end();
  Readable.fromWeb(r.body).pipe(res);
}

// ---------- publishing ----------
/** True when a platform entry should be published by the scheduler now. */
export function isDue(s, now = Date.now()) {
  if (!s) return false;
  if (s.lockedAt && now - Date.parse(s.lockedAt) < LOCK_MS) return false;
  if (s.status === 'publishing' && s.container) return true;
  return s.status === 'scheduled' && s.auto !== false && (s.error?.tries || 0) < MAX_TRIES && atToDate(s.at).getTime() <= now;
}

/**
 * Publishes one platform of a post. `persist` saves the index (called once with the lock, before
 * Meta is contacted, so a parallel run can't publish the same post twice). `target` is whose
 * Facebook Page and Instagram account to use (Nawa's by default, or a client's).
 * Returns 'published' | 'pending' | 'failed'.
 */
export async function publishPlatform(g, post, platform, { deadline, persist, target = M.nawaTarget() }) {
  const s = post.schedule[platform];
  s.lockedAt = new Date().toISOString();
  await persist();
  try {
    let r;
    if (platform === 'instagram' && s.container) r = await M.finishInstagram(s.container, deadline, target);
    else {
      const items = [];
      for (const m of post.media || []) items.push({ url: await mediaUrl(g, m, platform), video: Boolean(m.video || /^video\//.test(m.mimeType || '')) });
      const caption = captionFor(post, platform);
      r = platform === 'facebook' ? await M.publishFacebook({ caption, items }, target) : await M.publishInstagram({ caption, items }, deadline, target);
    }
    delete s.lockedAt;
    if (r.pending) { s.status = 'publishing'; s.container = r.pending; return 'pending'; }
    s.status = 'published'; s.publishedAt = new Date().toISOString(); s.remote = { id: r.id, url: r.url };
    delete s.error; delete s.container;
    return 'published';
  } catch (e) {
    console.error(`publish ${platform} ${post.id}:`, e.code, e.subcode, e.message);
    delete s.lockedAt;
    if (e.container || s.status === 'publishing') { delete s.container; s.status = 'scheduled'; }
    s.error = { message: M.explain(e), at: new Date().toISOString(), tries: (s.error?.tries || 0) + 1 };
    return 'failed';
  }
}
