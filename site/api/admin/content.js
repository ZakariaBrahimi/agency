// /api/admin/content: the content dashboard. Everything lives in the Nawa Google Drive
// (see _lib/google.js); approved posts become events in the "Nawa · Content" calendar.
//
// GET                      -> { posts, settings, rootUrl }
// GET  ?action=media&id=   -> an image preview (proxied, so files never need to be public)
// GET  ?action=files&id=   -> re-reads the post's Drive folder (picks up files added in Drive)
// POST ?action=create      { title, kind?, date?, platforms?, captions?, notes? }
// POST ?action=update      { id, ...fields }            (media order too: media: [fileId…])
// POST ?action=delete      { id }
// POST ?action=upload      { id, name, mimeType, size } -> { uploadUrl }   (browser sends the bytes)
// POST ?action=attach      { id, file: { id, name, mimeType } }
// POST ?action=detach      { id, fileId, trash? }
// POST ?action=schedule    { id, platforms: [...], at: 'YYYY-MM-DDTHH:mm' }
// POST ?action=unschedule  { id, platforms: [...] }
// POST ?action=published   { id, platform, value: true|false }
// POST ?action=seed        adds the starter plan (once)
// GET  ?action=meta        -> { configured, accounts }   (Facebook Page and Instagram account names)
// POST ?action=publish     { id, platform }               publishes to Facebook or Instagram now
// POST ?action=auto        { id, platform, value }        automatic publishing at the scheduled time on/off
// GET  ?action=stories     -> { sets: { [id]: state }, queue }   highlight stories published so far (no Google needed)
// POST ?action=story       { set }                        publishes one highlight's stories to Instagram, in order
//                          (sets listed in app_state «stories_queue» are published by the cron run, one per run)
//
// Public (no admin session), each with its own check:
// GET  /media/<sealed>     -> a post's file for Meta to download (rewritten here as ?action=pub-media)
// POST ?action=cron        publishes what is due; called every 5 minutes by Supabase (header x-cron-secret)
import crypto from 'node:crypto';
import { json, readJson, siteUrl, env } from '../_lib/http.js';
import { isAdmin } from '../_lib/session.js';
import * as G from '../_lib/google.js';
import * as M from '../_lib/meta.js';
import { META_PLATFORMS, isDue, publishPlatform, serveMedia } from '../_lib/publish.js';
import { seal, unseal } from '../_lib/seal.js';
import { kv } from '../_lib/supabase.js';
import { PLATFORMS, PLATFORM_IDS, KINDS, checkPost, isAt, captionFor, STARTER_PLAN } from '../../assets/js/content-schema.js';
import { STORY_SETS, storyFiles } from '../../assets/js/stories-schema.js';

const newId = () => 'p_' + crypto.randomBytes(6).toString('hex');
const now = () => new Date().toISOString();
const folderName = (p) => `${(p.date || '').slice(0, 10) || 'بدون تاريخ'} · ${p.title}`.slice(0, 200);

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
async function syncEvents(g, data, post) {
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

async function ensureFolder(g, loc, post) {
  if (post.folderId) return post.folderId;
  const f = await G.createPostFolder(g, loc.root, folderName(post));
  post.folderId = f.id; post.folderUrl = f.webViewLink || `https://drive.google.com/drive/folders/${f.id}`;
  return f.id;
}

const slim = (f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, ...(f.videoMediaMetadata ? { video: true } : {}) });

// The scheduler needs Drive without a browser: the admin's Google connection is kept sealed in
// Supabase (app_state), refreshed whenever the content section is opened.
let storedConn = '';
async function rememberConnection(conn) {
  if (!kv.ready() || storedConn === conn.refresh) return;
  try { await kv.set('google', seal('nawa-google-store', conn)); storedConn = conn.refresh; } catch (e) { console.error('kv', e.message); }
}

function cronAllowed(req) {
  const want = env('CRON_SECRET'); const got = String(req.headers['x-cron-secret'] || '');
  if (!want || got.length !== want.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

// Publishes every due Facebook/Instagram entry, oldest first, within ~50 seconds.
async function runSchedule(g) {
  const started = Date.now(); const deadline = started + 50e3;
  const { loc, data } = await G.readIndex(g);
  const due = [];
  for (const post of data.posts) for (const pf of META_PLATFORMS) if (post.platforms?.includes(pf) && isDue(post.schedule?.[pf])) due.push({ post, pf });
  due.sort((a, b) => (a.post.schedule[a.pf].at < b.post.schedule[b.pf].at ? -1 : 1));
  const results = [];
  for (const { post, pf } of due) {
    if (Date.now() > deadline - 15e3) break;
    const r = await publishPlatform(g, post, pf, { deadline, persist: () => G.writeIndex(g, loc, data) });
    results.push({ post: post.id, platform: pf, result: r });
    post.updatedAt = now();
    if (r === 'published') await syncEvents(g, data, post).catch((e) => console.error('events', e.message));
    await G.writeIndex(g, loc, data);
  }
  return results;
}

// Highlight stories: state per set in app_state «stories»: { done, ids, container?, publishedAt?, error? }.
// A set publishes its stories one after another; a run that stops part-way continues where it left off.
// «stories_queue» lists sets waiting for the cron run, which publishes one set every 5 minutes.
async function publishSet(set, deadline) {
  const all = (await kv.get('stories')) || {};
  const st = all[set.id] && !all[set.id].publishedAt ? all[set.id] : { done: 0, ids: [] };
  if (st.lockedAt && Date.now() - Date.parse(st.lockedAt) < 90e3) return { all, st, busy: true };
  const persist = () => kv.set('stories', { ...all, [set.id]: st });
  st.lockedAt = now(); delete st.error;
  await persist();
  const files = storyFiles(set);
  try {
    while (st.done < files.length && Date.now() < deadline - 8e3) {
      const r = st.container ? await M.finishInstagram(st.container, deadline) : await M.publishStory(siteUrl() + files[st.done], deadline);
      if (r.pending) { st.container = r.pending; break; }
      delete st.container; st.ids.push(r.id); st.done++;
      await persist();
    }
    if (st.done === files.length) st.publishedAt = now();
  } catch (e) {
    console.error('story', set.id, e.code, e.message);
    delete st.container;
    st.error = { message: M.explain(e), at: now() };
  }
  delete st.lockedAt;
  await persist();
  all[set.id] = st;
  return { all, st };
}

async function stories(req, res) {
  if (!kv.ready()) return json(res, 503, { ok: false, error: 'storage_not_configured' });
  if (req.method === 'GET') return json(res, 200, { ok: true, sets: (await kv.get('stories')) || {}, queue: (await kv.get('stories_queue')) || [] });
  if (!M.metaConfigured()) return json(res, 409, { ok: false, error: 'meta_not_configured' });
  if (req.method !== 'POST') return json(res, 405, { ok: false });
  const { set: id } = await readJson(req);
  const set = STORY_SETS.find((s) => s.id === id);
  if (!set) return json(res, 400, { ok: false, error: 'bad_set' });
  const r = await publishSet(set, Date.now() + 50e3);
  if (r.busy) return json(res, 409, { ok: false, error: 'publishing' });
  const queue = ((await kv.get('stories_queue')) || []).filter((q) => q !== set.id || !r.st.publishedAt);
  await kv.set('stories_queue', queue);
  return json(res, 200, { ok: true, sets: r.all, queue });
}

// Cron: the next queued set, if any. Returns null when there is nothing to do.
async function runStoriesQueue() {
  if (!kv.ready()) return null;
  const raw = await kv.get('stories_queue');
  const queue = Array.isArray(raw) ? raw : [];
  if (!queue.length) return null;
  const set = STORY_SETS.find((s) => s.id === queue[0]);
  if (!set) { await kv.set('stories_queue', queue.slice(1)); return { set: queue[0], result: 'unknown' }; }
  const r = await publishSet(set, Date.now() + 50e3);
  if (r.busy) return { set: set.id, result: 'busy' };
  // a finished or failed set leaves the queue (a failure shows in the admin); a partial one stays
  if (r.st.publishedAt || r.st.error) await kv.set('stories_queue', ((await kv.get('stories_queue')) || []).filter((q) => q !== set.id));
  return { set: set.id, result: r.st.publishedAt ? 'published' : r.st.error ? 'failed' : 'partial', done: r.st.done };
}

export default async function handler(req, res) {
  const url0 = new URL(req.url, 'http://x');
  const act0 = url0.searchParams.get('action') || '';
  if (act0 === 'pub-media' && (req.method === 'GET' || req.method === 'HEAD')) {
    try { return await serveMedia(req, res, url0.searchParams.get('k'), G.DRIVE_BASE); }
    catch (e) { console.error('media', e.message); res.statusCode = 502; return res.end(); }
  }
  if (act0 === 'cron') {
    if (!cronAllowed(req)) return json(res, 401, { ok: false });
    if (!M.metaConfigured()) return json(res, 200, { ok: true, skipped: 'not_configured' });
    try { const story = await runStoriesQueue(); if (story) return json(res, 200, { ok: true, stories: story }); } // one job per run keeps it under the time limit
    catch (e) { console.error('cron stories', e.message); }
    if (!G.googleConfigured()) return json(res, 200, { ok: true, skipped: 'not_configured' });
    const conn = unseal('nawa-google-store', await kv.get('google').catch(() => null));
    if (!conn) return json(res, 200, { ok: true, skipped: 'no_google' });
    try { return json(res, 200, { ok: true, results: await runSchedule(G.client(conn)) }); }
    catch (e) { console.error('cron', e.message); return json(res, 502, { ok: false, error: e.reconnect ? 'google_not_connected' : 'error' }); }
  }

  if (!isAdmin(req)) return json(res, 401, { ok: false, error: 'signed_out' });
  if (act0 === 'stories' || act0 === 'story') {
    try { return await stories(req, res); }
    catch (e) { console.error('stories', e.message); return json(res, 502, { ok: false, error: 'error' }); }
  }
  if (!G.googleConfigured()) return json(res, 503, { ok: false, error: 'google_not_configured' });
  const conn = G.connection(req);
  if (!conn) return json(res, 409, { ok: false, error: 'google_not_connected' });
  const g = G.client(conn);
  const url = url0;
  const action = act0;

  try {
    // ---- image previews
    if (req.method === 'GET' && action === 'media') {
      const id = url.searchParams.get('id') || '';
      if (!/^[\w-]{10,}$/.test(id)) return json(res, 400, { ok: false, error: 'bad_id' });
      const size = Math.min(1600, Math.max(64, Number(url.searchParams.get('size')) || 400));
      const meta = await G.fileMeta(g, id);
      let r;
      if (meta.thumbnailLink) r = await g.call('', { raw: true, base: meta.thumbnailLink.replace(/=s\d+$/, '') + `=s${size}` });
      if ((!r || !r.ok) && /^image\//.test(meta.mimeType) && Number(meta.size || 0) < 4e6) r = await g.call(`/drive/v3/files/${id}?alt=media`, { raw: true });
      if (!r || !r.ok) { res.statusCode = 404; return res.end(); }
      res.statusCode = 200;
      res.setHeader('Content-Type', r.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      return res.end(Buffer.from(await r.arrayBuffer()));
    }

    const { loc, data } = await G.readIndex(g);
    const find = (id) => data.posts.find((p) => p.id === id);
    const save = () => G.writeIndex(g, loc, data);
    const reply = (extra = {}) => json(res, 200, {
      ok: true, posts: data.posts, settings: { seeded: Boolean(data.settings.seeded), calendar: Boolean(data.settings.calendarId) },
      rootUrl: `https://drive.google.com/drive/folders/${loc.root}`, email: conn.email, ...extra,
    });

    if (req.method === 'GET' && action === 'files') {
      const post = find(url.searchParams.get('id'));
      if (!post) return json(res, 404, { ok: false, error: 'not_found' });
      if (post.folderId) {
        const files = (await G.listFolder(g, post.folderId)).map(slim);
        const byId = new Map(files.map((f) => [f.id, f]));
        const kept = (post.media || []).filter((m) => byId.has(m.id)).map((m) => byId.get(m.id));
        const added = files.filter((f) => !kept.some((m) => m.id === f.id));
        const next = [...kept, ...added];
        if (JSON.stringify(next) !== JSON.stringify(post.media || [])) { post.media = next; post.updatedAt = now(); await save(); }
      }
      return reply({ post });
    }
    if (req.method === 'GET' && action === 'meta') {
      if (!M.metaConfigured()) return json(res, 200, { ok: true, configured: false });
      try { return json(res, 200, { ok: true, configured: true, accounts: await M.accounts() }); }
      catch (e) { return json(res, 200, { ok: true, configured: true, error: M.explain(e) }); }
    }
    if (req.method === 'GET') { await rememberConnection(conn); return reply(); }
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
        if (post.folderId && renamed) await G.renameFile(g, post.folderId, folderName(post)).catch(() => {});
        if (Object.keys(post.schedule || {}).length || post.events?.length) await syncEvents(g, data, post); // refresh events after edits
        await save();
        return reply({ post });
      }
      case 'delete': {
        if (!post) return json(res, 400, { ok: false, error: 'bad_id' });
        const events = new Set([...(post.events || []), ...Object.values(post.schedule || {}).map((s) => s.eventId)].filter(Boolean));
        if (data.settings.calendarId) for (const ev of events) await G.deleteEvent(g, data.settings.calendarId, ev).catch(() => {});
        if (post.folderId) await G.trashFile(g, post.folderId).catch(() => {});
        data.posts = data.posts.filter((p) => p.id !== post.id);
        await save();
        return reply();
      }
      case 'upload': {
        if (!post) return json(res, 400, { ok: false, error: 'bad_id' });
        const { name, mimeType, size } = body;
        if (typeof name !== 'string' || !/^(image|video)\/[\w.+-]+$/.test(mimeType || '')) return json(res, 400, { ok: false, error: 'bad_file' });
        const folder = await ensureFolder(g, loc, post);
        await save();
        const origin = req.headers.origin || siteUrl();
        const uploadUrl = await G.startUpload(g, { folder, name: name.slice(0, 200), mimeType, size: Number(size) || 0, origin });
        return reply({ uploadUrl, post });
      }
      case 'attach': {
        if (!post || !body.file?.id) return json(res, 400, { ok: false, error: 'bad_file' });
        const meta = await G.fileMeta(g, body.file.id);
        if (!meta.parents?.includes(post.folderId)) return json(res, 400, { ok: false, error: 'bad_file' });
        post.media = [...(post.media || []).filter((m) => m.id !== meta.id), slim(meta)];
        if (/^video\//.test(meta.mimeType)) post.kind = 'video';
        else if (post.kind === 'image' && post.media.length > 1) post.kind = 'carousel';
        post.updatedAt = now();
        await save();
        return reply({ post });
      }
      case 'detach': {
        if (!post) return json(res, 400, { ok: false, error: 'bad_id' });
        post.media = (post.media || []).filter((m) => m.id !== body.fileId);
        if (body.trash && /^[\w-]{10,}$/.test(body.fileId || '')) await G.trashFile(g, body.fileId).catch(() => {});
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
        await syncEvents(g, data, post);
        await save();
        return reply({ post });
      }
      case 'unschedule': {
        if (!post) return json(res, 400, { ok: false, error: 'bad_id' });
        for (const pf of body.platforms || []) delete post.schedule?.[pf];
        post.updatedAt = now();
        await syncEvents(g, data, post);
        await save();
        return reply({ post });
      }
      case 'published': {
        if (!post || !post.schedule?.[body.platform]) return json(res, 400, { ok: false, error: 'not_scheduled' });
        const s = post.schedule[body.platform];
        s.status = body.value ? 'published' : 'scheduled';
        if (body.value) s.publishedAt = now(); else delete s.publishedAt;
        post.updatedAt = now();
        await syncEvents(g, data, post);
        await save();
        return reply({ post });
      }
      case 'publish': {
        if (!post || !META_PLATFORMS.includes(body.platform) || !post.platforms.includes(body.platform)) return json(res, 400, { ok: false, error: 'bad_platform' });
        if (!M.metaConfigured()) return json(res, 409, { ok: false, error: 'meta_not_configured' });
        post.schedule ||= {};
        const s = post.schedule[body.platform];
        if (s?.status === 'published') return json(res, 409, { ok: false, error: 'already_published' });
        if (s?.lockedAt && Date.now() - Date.parse(s.lockedAt) < 5 * 60e3) return json(res, 409, { ok: false, error: 'publishing' });
        // publishing now is also the approval: the entry is scheduled for this minute if it wasn't
        if (!s) post.schedule[body.platform] = { at: new Date(Date.now() + 3600e3).toISOString().slice(0, 16), status: 'scheduled', approvedAt: now() }; // Algiers = UTC+1
        else delete s.error;
        await rememberConnection(conn);
        const result = await publishPlatform(g, post, body.platform, { deadline: Date.now() + 45e3, persist: save });
        post.updatedAt = now();
        await syncEvents(g, data, post).catch((e) => console.error('events', e.message));
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
        if (data.settings.seeded) return reply();
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
    if (e.reconnect) { G.clearConnection(res); return json(res, 409, { ok: false, error: 'google_not_connected' }); }
    if (e.status === 403 && /insufficient|scope/i.test(e.message)) return json(res, 409, { ok: false, error: 'google_scope' });
    return json(res, 502, { ok: false, error: 'google_error' });
  }
}
