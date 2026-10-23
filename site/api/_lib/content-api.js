// The content dashboard's engine, shared by Nawa's admin (/api/admin/content) and the client
// portal (/api/portal). Where things are stored is the store's business (_lib/storage.js): Nawa's
// content in Nawa's Google Drive (with events in a Google Calendar), a client's in Supabase plus the
// client's own Drive or «تخزين نواة». Each tenant publishes to its own Page / Instagram (target).
import crypto from 'node:crypto';
import { json, readJson, siteUrl } from './http.js';
import * as G from './google.js';
import * as M from './meta.js';
import { META_PLATFORMS, isDue, publishPlatform } from './publish.js';
import { StorageError } from './storage.js';
import { seal, unseal } from './seal.js';
import { kv } from './supabase.js';
import { PLATFORMS, PLATFORM_IDS, KINDS, checkPost, isAt, captionFor, STARTER_PLAN } from '../../assets/js/content-schema.js';


const newId = () => 'p_' + crypto.randomBytes(6).toString('hex');
const now = () => new Date().toISOString();

function clean(input) {
  const out = {};
  for (const k of ['title', 'kind', 'date', 'platforms', 'captions', 'notes']) if (input[k] !== undefined) out[k] = input[k];
  if (typeof out.title === 'string') out.title = out.title.trim();
  if (out.platforms) out.platforms = [...new Set(out.platforms)];
  if (out.captions) out.captions = Object.fromEntries(Object.entries(out.captions).map(([k, v]) => [k, String(v)]));
  return out;
}

function addMinutes(at, m) {
  const d = new Date(at + ':00Z');
  d.setUTCMinutes(d.getUTCMinutes() + m);
  return d.toISOString().slice(0, 16);
}

// One calendar event per distinct time on a post: rebuilt whenever its schedule changes.
async function syncEvents(store, data, post) {
  if (!store.calendar) return; // client posts have the portal calendar only
  const g = store.g;
  const groups = new Map();
  for (const pf of PLATFORM_IDS) {
    const s = post.schedule?.[pf];
    if (!s || !s.at) continue;
    if (!groups.has(s.at)) groups.set(s.at, []);
    groups.get(s.at).push(pf);
  }
  // post.events lists every event this post owns, so removing a platform from the schedule
  // can never orphan its event.
  const old = new Set([...(post.events || []), ...Object.values(post.schedule || {}).map((s) => s.eventId)].filter(Boolean));
  const calendarId = groups.size || old.size ? await G.ensureCalendar(g, data.settings) : null;
  for (const id of old) await G.deleteEvent(g, calendarId, id);
  for (const s of Object.values(post.schedule || {})) delete s.eventId;
  post.events = [];
  for (const [at, pfs] of groups) {
    const allPublished = pfs.every((pf) => post.schedule[pf].status === 'published');
    const link = `${siteUrl()}/admin#content/${post.id}`;
    const caps = pfs.map((pf) => `— ${PLATFORMS[pf].name} —\n${captionFor(post, pf) || '(بدون نص)'}`).join('\n\n');
    const ev = await G.createEvent(g, calendarId, {
      summary: `${allPublished ? '✅' : '📣'} ${post.title} · ${pfs.map((pf) => PLATFORMS[pf].name).join(' + ')}`,
      description: `${KINDS[post.kind] || ''}\n\nافتح المنشور: ${link}${post.folderUrl ? `\nالملفات: ${post.folderUrl}` : ''}\n\n${caps}`.slice(0, 7500),
      start: { dateTime: at + ':00', timeZone: G.TZ },
      end: { dateTime: addMinutes(at, 15) + ':00', timeZone: G.TZ },
      colorId: allPublished ? '2' : '9',
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }, { method: 'popup', minutes: 5 }] },
      extendedProperties: { private: { nawaPost: post.id } },
      source: { title: 'Nawa Admin', url: link },
    });
    for (const pf of pfs) post.schedule[pf].eventId = ev.id;
    post.events.push(ev.id);
  }
}

// The scheduler needs Drive without a browser: the admin's Google connection is kept sealed in
// Supabase (app_state), refreshed whenever the content section is opened.
let storedConn = '';
export async function rememberConnection(conn) {
  if (!kv.ready() || storedConn === conn.refresh) return;
  try { await kv.set('google', seal('nawa-google-store', conn)); storedConn = conn.refresh; } catch (e) { console.error('kv', e.message); }
}

// Publishes a tenant's due Facebook/Instagram entries, oldest first, until the deadline.
export async function runSchedule(store, target = M.nawaTarget(), deadline = Date.now() + 50e3) {
  const { data, save } = await store.load();
  const due = [];
  for (const post of data.posts) for (const pf of META_PLATFORMS) if (post.platforms?.includes(pf) && isDue(post.schedule?.[pf])) due.push({ post, pf });
  due.sort((a, b) => (a.post.schedule[a.pf].at < b.post.schedule[b.pf].at ? -1 : 1));
  const results = [];
  for (const { post, pf } of due) {
    if (Date.now() > deadline - 15e3) break;
    const r = await publishPlatform(post, pf, { deadline, persist: save, target, urlFor: store.urlFor });
    results.push({ post: post.id, platform: pf, result: r });
    post.updatedAt = now();
    if (r === 'published') await syncEvents(store, data, post).catch((e) => console.error('events', e.message));
    await save();
  }
  return results;
}

/** Nawa's Google connection as remembered for the scheduler (or null). */
export async function storedConnection() {
  if (!kv.ready()) return null;
  return unseal('nawa-google-store', await kv.get('google').catch(() => null));
}

/** The Meta target of a client row (its Page and Instagram account, once Nawa has access). */
export const clientTarget = (c) => ({ page: c.fb_page_id || '', ig: c.ig_user_id || '' });

/**
 * Handles one content request. ctx: { store, conn, ownConnection, asClient, target, action, url }.
 * asClient: the request comes from the client portal (only its own files, no Drive links).
 * ownConnection: Nawa's admin with this device's Google connection, which may be remembered for the
 * scheduler and is cleared when Google revokes it.
 */
export async function contentApi(req, res, { store, conn = null, ownConnection = false, asClient = false, target = M.nawaTarget(), action, url }) {
  try {
    const { data, save, rootUrl } = await store.load();
    const find = (id) => data.posts.find((p) => p.id === id);
    const mediaOf = (id) => { for (const p of data.posts) for (const m of p.media || []) if (m.id === id) return m; return null; };

    // ---- image previews (only files of this tenant's posts)
    if (req.method === 'GET' && action === 'media') {
      const id = url.searchParams.get('id') || '';
      if (!/^[\w-]{10,}$/.test(id)) return json(res, 400, { ok: false, error: 'bad_id' });
      const size = Math.min(1600, Math.max(64, Number(url.searchParams.get('size')) || 400));
      const m = mediaOf(id) || (store.kind === 'nawa' && !asClient ? { id } : null);
      const r = m && await store.preview(m, size);
      if (!r) { res.statusCode = 404; return res.end(); }
      res.statusCode = 200;
      res.setHeader('Content-Type', r.type);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      return res.end(r.body);
    }

    // Drive links only for Nawa's own content in the admin
    const strip = (p) => (p && (asClient || store.kind !== 'nawa') ? (({ folderUrl, ...rest }) => ({ ...rest, media: (rest.media || []).map(({ key, ...m }) => m) }))(p) : p);
    const reply = (extra = {}) => json(res, 200, {
      ok: true, posts: data.posts.map(strip), settings: { seeded: Boolean(data.settings.seeded), calendar: Boolean(data.settings.calendarId) },
      ...(rootUrl && !asClient ? { rootUrl, email: conn?.email || '' } : {}), ...extra,
      ...(extra.post ? { post: strip(extra.post) } : {}),
    });

    if (req.method === 'GET' && action === 'files') {
      const post = find(url.searchParams.get('id'));
      if (!post) return json(res, 404, { ok: false, error: 'not_found' });
      const files = await store.refreshFiles(post);
      if (files) {
        const byId = new Map(files.map((f) => [f.id, f]));
        const kept = (post.media || []).filter((m) => byId.has(m.id)).map((m) => byId.get(m.id));
        const added = files.filter((f) => !kept.some((m) => m.id === f.id));
        const next = [...kept, ...added];
        if (JSON.stringify(next) !== JSON.stringify(post.media || [])) { post.media = next; post.updatedAt = now(); await save(); }
      }
      return reply({ post });
    }
    if (req.method === 'GET' && action === 'meta') {
      if (!M.metaTokenConfigured() || !(target.page || target.ig)) return json(res, 200, { ok: true, configured: false });
      try { return json(res, 200, { ok: true, configured: true, accounts: await M.accounts(target) }); }
      catch (e) { return json(res, 200, { ok: true, configured: true, error: M.explain(e) }); }
    }
    if (req.method === 'GET') { if (ownConnection && conn) await rememberConnection(conn); return reply(); }
    if (req.method !== 'POST') return json(res, 405, { ok: false });

    const body = await readJson(req);
    const post = body.id ? find(body.id) : null;
    if (body.id && !post) return json(res, 404, { ok: false, error: 'not_found' });

    switch (action) {
      case 'create': {
        const fields = clean(body);
        const err = checkPost(fields);
        if (err) return json(res, 400, { ok: false, error: err });
        const p = { id: newId(), kind: 'image', date: '', platforms: ['instagram', 'facebook'], captions: { all: '' }, notes: '', media: [], schedule: {}, ...fields, createdAt: now(), updatedAt: now() };
        data.posts.push(p);
        await save();
        return reply({ post: p });
      }
      case 'update': {
        if (!post) return json(res, 400, { ok: false, error: 'bad_id' });
        const fields = clean(body);
        const err = checkPost(fields, true);
        if (err) return json(res, 400, { ok: false, error: err });
        if (Array.isArray(body.media)) {
          const byId = new Map((post.media || []).map((m) => [m.id, m]));
          const order = body.media.filter((id) => byId.has(id));
          post.media = [...order.map((id) => byId.get(id)), ...(post.media || []).filter((m) => !order.includes(m.id))];
        }
        const renamed = fields.title !== undefined && fields.title !== post.title || fields.date !== undefined && fields.date.slice(0, 10) !== (post.date || '').slice(0, 10);
        Object.assign(post, fields, { updatedAt: now() });
        // a platform taken off the post loses its schedule
        for (const pf of Object.keys(post.schedule || {})) if (!post.platforms.includes(pf)) delete post.schedule[pf];
        if (renamed) await Promise.resolve(store.rename(post)).catch(() => {});
        if (Object.keys(post.schedule || {}).length || post.events?.length) await syncEvents(store, data, post); // refresh events after edits
        await save();
        return reply({ post });
      }
      case 'delete': {
        if (!post) return json(res, 400, { ok: false, error: 'bad_id' });
        const events = new Set([...(post.events || []), ...Object.values(post.schedule || {}).map((s) => s.eventId)].filter(Boolean));
        if (store.calendar && data.settings.calendarId) for (const ev of events) await G.deleteEvent(store.g, data.settings.calendarId, ev).catch(() => {});
        await Promise.resolve(store.removePost(post)).catch(() => {});
        data.posts = data.posts.filter((p) => p.id !== post.id);
        await save();
        return reply();
      }
      case 'upload': {
        if (!post) return json(res, 400, { ok: false, error: 'bad_id' });
        const { name, mimeType, size } = body;
        if (typeof name !== 'string' || !/^(image|video)\/[\w.+-]+$/.test(mimeType || '')) return json(res, 400, { ok: false, error: 'bad_file' });
        const up = await store.startUpload(post, { name: name.slice(0, 200), mimeType, size: Number(size) || 0, origin: req.headers.origin || siteUrl() });
        await save();
        return reply({ ...up, post });
      }
      case 'attach': {
        if (!post || !body.file?.id) return json(res, 400, { ok: false, error: 'bad_file' });
        const m = await store.attach(post, body.file);
        post.media = [...(post.media || []).filter((x) => x.id !== m.id), m];
        if (/^video\//.test(m.mimeType)) post.kind = 'video';
        else if (post.kind === 'image' && post.media.length > 1) post.kind = 'carousel';
        post.updatedAt = now();
        await save();
        return reply({ post });
      }
      case 'detach': {
        if (!post) return json(res, 400, { ok: false, error: 'bad_id' });
        const m = (post.media || []).find((x) => x.id === body.fileId);
        post.media = (post.media || []).filter((x) => x.id !== body.fileId);
        // only a file of this post can be removed
        if (body.trash && m) await Promise.resolve(store.trash(m)).catch(() => {});
        post.updatedAt = now();
        await save();
        return reply({ post });
      }
      case 'schedule': {
        if (!post) return json(res, 400, { ok: false, error: 'bad_id' });
        const pfs = Array.isArray(body.platforms) ? body.platforms.filter((x) => post.platforms.includes(x)) : [];
        if (!pfs.length) return json(res, 400, { ok: false, error: 'no_platforms' });
        if (!isAt(body.at)) return json(res, 400, { ok: false, error: 'bad_date' });
        post.schedule ||= {};
        for (const pf of pfs) {
          const old = post.schedule[pf];
          // moving an already-published entry only changes its time; it is never published twice
          post.schedule[pf] = old?.status === 'published' ? { ...old, at: body.at }
            : { at: body.at, status: 'scheduled', approvedAt: now(), ...(old?.auto === false ? { auto: false } : {}) };
        }
        post.updatedAt = now();
        await syncEvents(store, data, post);
        await save();
        return reply({ post });
      }
      case 'unschedule': {
        if (!post) return json(res, 400, { ok: false, error: 'bad_id' });
        for (const pf of body.platforms || []) delete post.schedule?.[pf];
        post.updatedAt = now();
        await syncEvents(store, data, post);
        await save();
        return reply({ post });
      }
      case 'published': {
        if (!post || !post.schedule?.[body.platform]) return json(res, 400, { ok: false, error: 'not_scheduled' });
        const s = post.schedule[body.platform];
        s.status = body.value ? 'published' : 'scheduled';
        if (body.value) s.publishedAt = now(); else delete s.publishedAt;
        post.updatedAt = now();
        await syncEvents(store, data, post);
        await save();
        return reply({ post });
      }
      case 'publish': {
        if (!post || !META_PLATFORMS.includes(body.platform) || !post.platforms.includes(body.platform)) return json(res, 400, { ok: false, error: 'bad_platform' });
        if (!M.metaTokenConfigured() || !(body.platform === 'facebook' ? target.page : target.ig)) return json(res, 409, { ok: false, error: store.kind === 'client' ? 'platform_not_connected' : 'meta_not_configured' });
        post.schedule ||= {};
        const s = post.schedule[body.platform];
        if (s?.status === 'published') return json(res, 409, { ok: false, error: 'already_published' });
        if (s?.lockedAt && Date.now() - Date.parse(s.lockedAt) < 5 * 60e3) return json(res, 409, { ok: false, error: 'publishing' });
        // publishing now is also the approval: the entry is scheduled for this minute if it wasn't
        if (!s) post.schedule[body.platform] = { at: new Date(Date.now() + 3600e3).toISOString().slice(0, 16), status: 'scheduled', approvedAt: now() }; // Algiers = UTC+1
        else delete s.error;
        if (ownConnection && conn) await rememberConnection(conn);
        const result = await publishPlatform(post, body.platform, { deadline: Date.now() + 45e3, persist: save, target, urlFor: store.urlFor });
        post.updatedAt = now();
        await syncEvents(store, data, post).catch((e) => console.error('events', e.message));
        await save();
        return reply({ post, result });
      }
      case 'auto': {
        const s = post?.schedule?.[body.platform];
        if (!s || !META_PLATFORMS.includes(body.platform)) return json(res, 400, { ok: false, error: 'not_scheduled' });
        if (body.value) { delete s.auto; delete s.error; } else s.auto = false;
        post.updatedAt = now();
        await save();
        return reply({ post });
      }
      case 'seed': {
        if (data.settings.seeded || store.kind !== 'nawa') return reply();
        for (const item of STARTER_PLAN) data.posts.push({ id: newId(), notes: '', media: [], schedule: {}, ...structuredClone(item), createdAt: now(), updatedAt: now() });
        data.settings.seeded = true;
        await save();
        return reply();
      }
      default:
        return json(res, 400, { ok: false, error: 'bad_action' });
    }
  } catch (e) {
    console.error(e.message);
    if (e instanceof StorageError) return json(res, 409, { ok: false, error: e.code });
    if (e.reconnect) {
      if (store.kind === 'client') return json(res, 409, { ok: false, error: 'drive_disconnected' });
      if (ownConnection) G.clearConnection(res);
      return json(res, 409, { ok: false, error: 'google_not_connected' });
    }
    if (e.status === 403 && /insufficient|scope/i.test(e.message)) return json(res, 409, { ok: false, error: 'google_scope' });
    return json(res, 502, { ok: false, error: 'google_error' });
  }
}
