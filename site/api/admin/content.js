// /api/admin/content: the content dashboard. Nawa's own content lives in Nawa's Google Drive (see
// _lib/google.js); approved posts become events in the "Nawa · Content" calendar. Client content
// never touches Nawa's Drive: see _lib/storage.js.
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
// Any content action with &client=<id> works on that client's content instead of Nawa's.
//
// Clients (see _lib/clients-admin.js):
// GET  ?action=clients            -> { clients, pages, mail }   pages: Facebook Pages Nawa can manage
// POST ?action=client-create      { client: {...}, user: { name, email, phone } }
// POST ?action=client-update      { id, ...fields, fb_page_id?, platforms?, active? }
// POST ?action=client-delete      { id }
// POST ?action=client-user-add    { client_id, name, email, phone }
// POST ?action=client-user-remove { id }
// POST ?action=client-cloud       { id, enabled }          «تخزين نواة» on/off for a client
// POST ?action=invoice-mark       { id, status, method? }  an invoice paid / unpaid / void
// GET  ?action=billing            -> { settings, price_dzd }
// POST ?action=billing            { cost_usd?, fee_usd?, rate_dzd?, payment?: {...} }
// GET  ?action=storage-check      -> «تخزين نواة» (R2) health: connect, write, CORS (codes only, never keys)
//
// GET  /media/<sealed>     -> a post's file for Meta to download (rewritten here as ?action=pub-media)
// POST ?action=cron        publishes what is due; called every 5 minutes by Supabase (header x-cron-secret)
import crypto from 'node:crypto';
import { json, readJson, siteUrl, env } from '../_lib/http.js';
import { isAdmin } from '../_lib/session.js';
import * as G from '../_lib/google.js';
import * as M from '../_lib/meta.js';
import { serveMedia } from '../_lib/publish.js';
import { kv, sb } from '../_lib/supabase.js';
import { contentApi, runSchedule, storedConnection, clientTarget } from '../_lib/content-api.js';
import { nawaStore, clientStore, usageOf } from '../_lib/storage.js';
import { getClient } from '../_lib/clients.js';
import { adminClients, CLIENT_ACTIONS } from '../_lib/clients-admin.js';
import * as B from '../_lib/billing.js';
import { STORY_SETS, storyFiles } from '../../assets/js/stories-schema.js';

const now = () => new Date().toISOString();

function cronAllowed(req) {
  const want = env('CRON_SECRET'); const got = String(req.headers['x-cron-secret'] || '');
  if (!want || got.length !== want.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
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

// Cron: Nawa's due posts, then every active client's, sharing one ~50 second budget.
async function runAll(g) {
  const deadline = Date.now() + 50e3;
  const results = g ? await runSchedule(nawaStore(g), M.nawaTarget(), deadline) : [];
  if (!sb.ready()) return results;
  const clients = await sb.select('clients', 'select=*&active=is.true').catch(() => []);
  for (const c of clients) {
    if (Date.now() > deadline - 15e3) break;
    if (!c.fb_page_id && !c.ig_user_id) continue; // nothing it could publish to
    try { results.push(...(await runSchedule(await clientStore(c), clientTarget(c), deadline)).map((r) => ({ ...r, client: c.id }))); }
    catch (e) { console.error('cron client', c.id, e.message); }
  }
  return results;
}

// Cron, once a day: each client's stored bytes (for GB-month billing); on a new month, last
// month's invoices. Guarded in app_state so the 5-minute runs do it only once.
async function runBilling() {
  if (!sb.ready() || !kv.ready()) return null;
  const day = B.today();
  if ((await kv.get('billing_day').catch(() => null)) === day) return null;
  await kv.set('billing_day', day);
  const clients = await sb.select('clients', 'select=id').catch(() => []);
  const contents = await sb.select('client_content', 'select=client_id,data').catch(() => []);
  for (const c of clients) {
    const data = contents.find((x) => x.client_id === c.id)?.data || { posts: [] };
    await B.recordUsage(c.id, usageOf(data)).catch((e) => console.error('usage', c.id, e.message));
  }
  const month = B.thisMonth(), last = B.prevMonth(month);
  let issued = 0;
  if ((await kv.get('billing_invoiced').catch(() => null)) !== last) {
    const settings = await B.getSettings();
    for (const c of clients) if (await B.invoiceMonth(c.id, last, settings).catch((e) => console.error('invoice', c.id, e.message))) issued++;
    await kv.set('billing_invoiced', last);
  }
  return { day, clients: clients.length, issued };
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
    const billing = await runBilling().catch((e) => { console.error('cron billing', e.message); return null; });
    if (!M.metaConfigured()) return json(res, 200, { ok: true, skipped: 'not_configured', ...(billing ? { billing } : {}) });
    try { const story = await runStoriesQueue(); if (story) return json(res, 200, { ok: true, stories: story }); } // one job per run keeps it under the time limit
    catch (e) { console.error('cron stories', e.message); }
    const conn = G.googleConfigured() ? await storedConnection() : null; // Nawa's own posts need Nawa's Drive
    try { return json(res, 200, { ok: true, results: await runAll(conn ? G.client(conn) : null), ...(billing ? { billing } : {}) }); }
    catch (e) { console.error('cron', e.message); return json(res, 502, { ok: false, error: e.reconnect ? 'google_not_connected' : 'error' }); }
  }

  if (!isAdmin(req)) return json(res, 401, { ok: false, error: 'signed_out' });
  if (act0 === 'stories' || act0 === 'story') {
    try { return await stories(req, res); }
    catch (e) { console.error('stories', e.message); return json(res, 502, { ok: false, error: 'error' }); }
  }
  if (CLIENT_ACTIONS.includes(act0)) {
    try { return await adminClients(req, res, act0); }
    catch (e) { console.error('clients', e.message); return json(res, 502, { ok: false, error: 'error' }); }
  }
  if (act0 === 'storage-check') {
    const R2 = await import('../_lib/r2.js');
    return json(res, 200, { ok: true, check: await R2.check(env('SITE_URL') || siteUrl(req)) });
  }
  if (act0 === 'billing') {
    try {
      if (req.method === 'POST') await B.saveSettings(await readJson(req));
      const settings = await B.getSettings();
      return json(res, 200, { ok: true, settings, price_dzd: B.priceDzd(settings) });
    } catch (e) { return json(res, e.code ? 400 : 502, { ok: false, error: e.code || 'error', field: e.field }); }
  }
  const url = url0;
  const action = act0;
  // a client's content (its own storage, never Nawa's Drive) when ?client=<id>
  if (url.searchParams.get('client')) {
    const c = await getClient(url.searchParams.get('client')).catch(() => null);
    if (!c) return json(res, 404, { ok: false, error: 'client_not_found' });
    return contentApi(req, res, { store: await clientStore(c), target: clientTarget(c), action, url });
  }
  // Nawa's own content, in Nawa's Drive with this device's Google connection
  if (!G.googleConfigured()) return json(res, 503, { ok: false, error: 'google_not_configured' });
  const conn = G.connection(req);
  if (!conn) return json(res, 409, { ok: false, error: 'google_not_connected' });
  return contentApi(req, res, { store: nawaStore(G.client(conn)), conn, ownConnection: true, target: M.nawaTarget(), action, url });
}
