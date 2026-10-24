// Client management for Nawa's admin (/api/admin/content?action=client-…) and the platform status
// both the admin and the client portal show.
//
// Facebook and Instagram are checked automatically: a client's Page counts as connected when it is
// among the Pages Nawa's Meta key can manage (the client added Nawa as a partner and Nawa assigned
// the Page to its system user), and Instagram when that Page has an Instagram business account.
// LinkedIn and TikTok have no API access yet, so Nawa sets their status by hand.
import { json, readJson } from './http.js';
import { sb } from './supabase.js';
import * as M from './meta.js';
import * as B from './billing.js';
import { listClients, getClient, cleanClient, cleanUser, validEmail, findUserByEmail, mailConfigured, PLATFORM_KEYS, MANUAL_STATUS } from './clients.js';

export const CLIENT_ACTIONS = ['clients', 'client-create', 'client-update', 'client-delete', 'client-user-add', 'client-user-remove', 'client-cloud', 'invoice-mark'];
export const PAY_METHODS = ['baridimob', 'ccp', 'redotpay', 'cash', 'other'];
const enc = encodeURIComponent;

/** Facebook Pages Nawa can manage, or null when Meta isn't set up or can't be reached. */
export async function pagesOrNull(fresh) {
  if (!M.metaTokenConfigured()) return null;
  try { return await M.accessiblePages({ fresh }); } catch (e) { console.error('pages', e.message); return null; }
}

/**
 * Each platform's status for a client: { status, auto, name?, url?, note? }.
 * status: not_started | waiting_access | waiting_client | in_review | active | issue | unknown
 */
export function platformStatus(c, pages) {
  const page = pages && c.fb_page_id ? pages.find((p) => p.id === c.fb_page_id) : null;
  const manual = (k) => {
    const m = c.platforms?.[k] || {};
    return { status: MANUAL_STATUS.includes(m.status) ? m.status : 'not_started', auto: false, url: m.url || '', note: m.note || '' };
  };
  const note = (k) => c.platforms?.[k]?.note || '';
  const fb = !c.fb_page_id ? { status: 'not_started' }
    : pages === null ? { status: 'unknown' }
    : page ? { status: 'active', name: page.name, url: page.link } : { status: 'waiting_access' };
  const ig = !c.fb_page_id ? { status: 'not_started' }
    : pages === null ? { status: 'unknown' }
    : !page ? { status: 'waiting_access' }
    : page.ig ? { status: 'active', name: '@' + page.ig.username, url: `https://www.instagram.com/${page.ig.username}` } : { status: 'waiting_client' };
  return {
    facebook: { ...fb, auto: true, note: note('facebook') },
    instagram: { ...ig, auto: true, note: note('instagram') },
    linkedin: manual('linkedin'),
    tiktok: manual('tiktok'),
  };
}

/** Keeps the stored Instagram id in step with the Page (it is read from Meta, never typed). */
export async function syncInstagram(c, pages) {
  if (!pages || !c.fb_page_id) return c;
  const page = pages.find((p) => p.id === c.fb_page_id);
  const ig = page?.ig?.id || null;
  if (page && ig !== (c.ig_user_id || null)) {
    await sb.update('clients', `id=eq.${enc(c.id)}`, { ig_user_id: ig, updated_at: new Date().toISOString() }).catch(() => {});
    c.ig_user_id = ig;
  }
  return c;
}

function cleanPlatforms(input, prev = {}) {
  const out = { ...prev };
  for (const k of PLATFORM_KEYS) {
    const v = input?.[k];
    if (!v || typeof v !== 'object') continue;
    out[k] = {
      ...(out[k] || {}),
      ...(v.status !== undefined && MANUAL_STATUS.includes(v.status) && (k === 'linkedin' || k === 'tiktok') ? { status: v.status } : {}),
      ...(v.url !== undefined ? { url: String(v.url).trim().slice(0, 300) } : {}),
      ...(v.note !== undefined ? { note: String(v.note).trim().slice(0, 500) } : {}),
    };
  }
  return out;
}

export async function adminClients(req, res, action) {
  if (!sb.ready()) return json(res, 503, { ok: false, error: 'storage_not_configured' });
  const reply = async (extra = {}) => {
    const pages = await pagesOrNull(extra.fresh);
    const clients = await listClients();
    for (const c of clients) await syncInstagram(c, pages);
    // a Page is taken once a client uses it; Nawa's own Page is never offered
    const used = new Set([...clients.map((c) => c.fb_page_id), M.nawaTarget().page].filter(Boolean));
    delete extra.fresh;
    // storage overview per client: where its files are, how much, this month, unpaid invoices
    const settings = await B.getSettings();
    const contents = await sb.select('client_content', 'select=client_id,data').catch(() => []);
    const storage = await Promise.all(clients.map((c) => B.storageSummary(c, contents.find((x) => x.client_id === c.id)?.data || { posts: [] }, settings).catch(() => null)));
    // «تخزين نواة» plan per client
    const P = await import('./plans.js');
    for (const [i, c] of clients.entries()) if (storage[i]) storage[i].plan = P.planState(c, storage[i].cloud.bytes);
    return json(res, 200, {
      ok: true, mail: mailConfigured(), meta: M.metaTokenConfigured(), price_dzd: B.priceDzd(settings),
      pages: pages ? pages.map((p) => ({ ...p, used: used.has(p.id) })) : null,
      // the sealed Drive connection never leaves the server
      clients: clients.map(({ drive_conn, ...c }, i) => ({ ...c, status: platformStatus(c, pages), storage: storage[i] })), ...extra,
    });
  };
  if (req.method === 'GET') return reply({ fresh: new URL(req.url, 'http://x').searchParams.has('fresh') });
  if (req.method !== 'POST') return json(res, 405, { ok: false });
  const body = await readJson(req);
  const stamp = { updated_at: new Date().toISOString() };

  switch (action) {
    case 'client-create': {
      const client = cleanClient(body.client || {});
      const user = cleanUser(body.user || {});
      if (!client.name) return json(res, 400, { ok: false, error: 'name_required' });
      if (!validEmail(user.email)) return json(res, 400, { ok: false, error: 'bad_email' });
      if (await findUserByEmail(user.email)) return json(res, 409, { ok: false, error: 'email_taken' });
      const [c] = await sb.insert('clients', client);
      try { await sb.insert('client_users', { ...user, client_id: c.id, role: 'owner' }); }
      catch (e) { await sb.remove('clients', `id=eq.${enc(c.id)}`); throw e; }
      return reply({ created: c.id });
    }
    case 'client-update': {
      const c = await getClient(body.id);
      if (!c) return json(res, 404, { ok: false, error: 'client_not_found' });
      const patch = { ...cleanClient(body), ...stamp };
      if (patch.name === '') return json(res, 400, { ok: false, error: 'name_required' });
      if (body.active !== undefined) patch.active = Boolean(body.active);
      if (body.platforms) patch.platforms = cleanPlatforms(body.platforms, c.platforms || {});
      if (body.fb_page_id !== undefined) {
        const id = String(body.fb_page_id || '').trim();
        if (id && !/^\d{1,30}$/.test(id)) return json(res, 400, { ok: false, error: 'bad_page' });
        patch.fb_page_id = id || null;
        // Instagram follows the Page: read it straight away
        const pages = await pagesOrNull(true);
        patch.ig_user_id = (id && pages?.find((p) => p.id === id)?.ig?.id) || null;
      }
      await sb.update('clients', `id=eq.${enc(c.id)}`, patch);
      return reply();
    }
    case 'client-delete': {
      const c = await getClient(body.id);
      if (!c) return json(res, 404, { ok: false, error: 'client_not_found' });
      await sb.remove('clients', `id=eq.${enc(c.id)}`); // its people go with it (on delete cascade); its Drive folder stays
      return reply();
    }
    case 'client-user-add': {
      const c = await getClient(body.client_id);
      if (!c) return json(res, 404, { ok: false, error: 'client_not_found' });
      const user = cleanUser(body);
      if (!validEmail(user.email)) return json(res, 400, { ok: false, error: 'bad_email' });
      if (await findUserByEmail(user.email)) return json(res, 409, { ok: false, error: 'email_taken' });
      await sb.insert('client_users', { ...user, client_id: c.id, role: 'member' });
      return reply();
    }
    case 'client-cloud': {
      const c = await getClient(body.id);
      if (!c) return json(res, 404, { ok: false, error: 'client_not_found' });
      await sb.update('clients', `id=eq.${enc(c.id)}`, { cloud_enabled: Boolean(body.enabled), ...stamp });
      return reply();
    }
    case 'invoice-mark': {
      if (!/^[0-9a-f-]{36}$/.test(String(body.id || '')) || !['paid', 'unpaid', 'void'].includes(body.status)) return json(res, 400, { ok: false, error: 'bad_id' });
      const method = PAY_METHODS.includes(body.method) ? body.method : null;
      await sb.update('client_invoices', `id=eq.${enc(body.id)}`, body.status === 'paid'
        ? { status: 'paid', method: method || 'other', paid_at: new Date().toISOString() }
        : { status: body.status, method: null, paid_at: null });
      return reply();
    }
    case 'client-user-remove': {
      if (!/^[0-9a-f-]{36}$/.test(String(body.id || ''))) return json(res, 400, { ok: false, error: 'bad_id' });
      await sb.remove('client_users', `id=eq.${enc(body.id)}`);
      await sb.remove('client_otps', `email=eq.${enc(String(body.email || ''))}`).catch(() => {});
      return reply();
    }
    default:
      return reply();
  }
}
