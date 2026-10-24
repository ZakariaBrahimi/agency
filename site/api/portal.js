// /api/portal: the client portal (/portal). Clients of Nawa sign in here and manage their own
// social media content with the same tools Nawa uses (see _lib/content-api.js).
//
// Without a session:
// POST ?action=otp-send    { email }          sends a 6-digit code (always answers ok, so emails can't be probed)
// POST ?action=otp-verify  { email, code }    signs in
// GET  ?action=google                          signs in with Google (back through /api/admin/google/callback)
// With a session (cookie nawa_client):
// GET  ?action=me          -> { user, client, status }   status: each platform's activation state
// POST ?action=logout
// GET  ?action=storage     -> { drive, cloud, estimate, invoices, payment }   (see billing.storageSummary)
// GET  ?action=drive-connect                 connects the client's own Google Drive (free storage)
// POST ?action=drive-disconnect
// POST ?action=cloud       { enabled }      «تخزين نواة» (paid per GB-month) on/off
// POST ?action=storage-pref { pref }       where new uploads go: 'auto' (Drive first) | 'cloud' («تخزين نواة» always)
// POST ?action=move-to-cloud              moves Drive files into «تخزين نواة», a batch per call -> { moved, failed, remaining }
// POST ?action=platform-done { platform }   LinkedIn/TikTok: the client finished the steps -> «قيد المراجعة», Nawa is told on Telegram
// anything else            -> the content API for this client's own posts (list, create, update, upload,
//                             schedule, publish… exactly like /api/admin/content)
import { json, readJson } from './_lib/http.js';
import * as G from './_lib/google.js';
import { contentApi, clientTarget } from './_lib/content-api.js';
import { clientStore, driveConnection } from './_lib/storage.js';
import * as B from './_lib/billing.js';
import { clientSession, clearClientSession, requestCode, verifyCode, signedIn, normEmail, validEmail, mailConfigured } from './_lib/clients.js';
import { platformStatus, pagesOrNull, syncInstagram } from './_lib/clients-admin.js';
import { telegramReady, sendMessage, escapeHtml } from './_lib/telegram.js';
import { sb } from './_lib/supabase.js';

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  const action = url.searchParams.get('action') || '';
  if (!sb.ready()) return json(res, 503, { ok: false, error: 'storage_not_configured' });

  try {
    if (action === 'otp-send' && req.method === 'POST') {
      const email = normEmail((await readJson(req)).email);
      if (!validEmail(email)) return json(res, 400, { ok: false, error: 'bad_email' });
      if (!mailConfigured()) return json(res, 503, { ok: false, error: 'mail_not_configured' });
      const r = await requestCode(email);
      if (r === 'wait') return json(res, 429, { ok: false, error: 'wait' });
      return json(res, 200, { ok: true });
    }
    if (action === 'otp-verify' && req.method === 'POST') {
      const { email, code } = await readJson(req);
      const user = await verifyCode(email, String(code || '').replace(/\D/g, ''));
      if (!user) return json(res, 400, { ok: false, error: 'bad_code' });
      await signedIn(res, user);
      return json(res, 200, { ok: true });
    }
    if (action === 'google' && req.method === 'GET') {
      if (!G.googleConfigured()) return json(res, 503, { ok: false, error: 'google_not_configured' });
      res.statusCode = 302;
      res.setHeader('Location', G.authUrl(res, 'client'));
      res.setHeader('Cache-Control', 'no-store');
      return res.end();
    }

    const session = await clientSession(req);
    if (!session) { clearClientSession(res); return json(res, 401, { ok: false, error: 'signed_out' }); }
    const { user, client } = session;

    if (action === 'logout') { clearClientSession(res); return json(res, 200, { ok: true }); }
    if (action === 'me') {
      const pages = await pagesOrNull(url.searchParams.has('fresh'));
      await syncInstagram(client, pages);
      return json(res, 200, {
        ok: true,
        user: { name: user.name, email: user.email, role: user.role },
        client: { name: client.name, industry: client.industry, city: client.city, website: client.website },
        status: platformStatus(client, pages),
      });
    }

    // ---- a manual platform's steps are done: Nawa checks and turns it on
    if (action === 'platform-done' && req.method === 'POST') {
      const k = (await readJson(req)).platform;
      if (!['linkedin', 'tiktok'].includes(k)) return json(res, 400, { ok: false, error: 'bad_platform' });
      const cur = client.platforms?.[k] || {};
      if (!['active', 'in_review'].includes(cur.status)) {
        const platforms = { ...(client.platforms || {}), [k]: { ...cur, status: 'in_review', client_done_at: new Date().toISOString() } };
        await sb.update('clients', `id=eq.${encodeURIComponent(client.id)}`, { platforms, updated_at: new Date().toISOString() });
        client.platforms = platforms;
        if (telegramReady()) {
          const name = k === 'linkedin' ? 'LinkedIn' : 'TikTok';
          await sendMessage(`🔔 <b>${escapeHtml(client.name)}</b> أنهى خطوات تفعيل <b>${name}</b>.\nتحقّق من الوصول ثم فعّل المنصة من «العملاء».`).catch((e) => console.error('telegram', e.message));
        }
      }
      return json(res, 200, { ok: true, status: platformStatus(client, await pagesOrNull(false)) });
    }

    // ---- storage
    if (action === 'storage') {
      const [row] = await sb.select('client_content', `select=data&client_id=eq.${encodeURIComponent(client.id)}`);
      const settings = await B.getSettings();
      const summary = await B.storageSummary(client, row?.data || { posts: [] }, settings, { withQuota: true });
      return json(res, 200, { ok: true, ...summary, payment: settings.payment });
    }
    if (action === 'drive-connect' && req.method === 'GET') {
      if (!G.googleConfigured()) return json(res, 503, { ok: false, error: 'google_not_configured' });
      res.statusCode = 302;
      res.setHeader('Location', G.authUrl(res, 'client-drive', { c: client.id }));
      res.setHeader('Cache-Control', 'no-store');
      return res.end();
    }
    if (action === 'drive-disconnect' && req.method === 'POST') {
      const conn = driveConnection(client);
      if (conn) await G.revoke(conn.refresh);
      // the files stay in the client's Drive; the portal just can't reach them any more
      await sb.update('clients', `id=eq.${encodeURIComponent(client.id)}`, { drive_conn: null, updated_at: new Date().toISOString() });
      return json(res, 200, { ok: true });
    }
    if (action === 'cloud' && req.method === 'POST') {
      const { enabled } = await readJson(req);
      if (!enabled) {
        // turning it off is only possible once nothing is stored there (stored files are billed)
        const [row] = await sb.select('client_content', `select=data&client_id=eq.${encodeURIComponent(client.id)}`);
        const { usageOf } = await import('./_lib/storage.js');
        if (usageOf(row?.data || { posts: [] }).cloud > 0) return json(res, 409, { ok: false, error: 'cloud_not_empty' });
      }
      await sb.update('clients', `id=eq.${encodeURIComponent(client.id)}`, { cloud_enabled: Boolean(enabled), ...(enabled ? {} : { storage_pref: 'auto' }), updated_at: new Date().toISOString() });
      return json(res, 200, { ok: true });
    }
    if (action === 'storage-pref' && req.method === 'POST') {
      const pref = (await readJson(req)).pref === 'cloud' ? 'cloud' : 'auto';
      if (pref === 'cloud' && !client.cloud_enabled) return json(res, 409, { ok: false, error: 'cloud_off' });
      await sb.update('clients', `id=eq.${encodeURIComponent(client.id)}`, { storage_pref: pref, updated_at: new Date().toISOString() });
      return json(res, 200, { ok: true, pref });
    }
    if (action === 'move-to-cloud' && req.method === 'POST') {
      if (!client.cloud_enabled) return json(res, 409, { ok: false, error: 'cloud_off' });
      const store = await clientStore(client);
      const { save } = await store.load();
      try {
        const r = await store.moveToCloud(Date.now() + 40e3); // the client calls again while files remain
        if (r.moved) await save();
        return json(res, 200, { ok: true, ...r });
      } catch (e) {
        if (e.code) return json(res, 409, { ok: false, error: e.code });
        throw e;
      }
    }

    // ---- content: in the client's own storage (never Nawa's Drive)
    return contentApi(req, res, { store: await clientStore(client), asClient: true, target: clientTarget(client), action, url });
  } catch (e) {
    console.error('portal', action, e.message);
    return json(res, 502, { ok: false, error: 'error' });
  }
}
