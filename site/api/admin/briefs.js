// GET /api/admin/briefs?status=new  ·  PATCH /api/admin/briefs { id, status?, admin_note? }
import { json, readJson } from '../_lib/http.js';
import { isAdmin } from '../_lib/session.js';
import { admin } from '../_lib/supabase.js';

const STATUSES = ['new', 'contacted', 'in_progress', 'won', 'closed'];
const UUID = /^[0-9a-f-]{36}$/i;

export default async function handler(req, res) {
  if (!isAdmin(req)) return json(res, 401, { ok: false, error: 'signed_out' });
  if (!admin.ready()) return json(res, 503, { ok: false, error: 'service_key_missing' });
  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://x');
      const status = url.searchParams.get('status');
      let q = 'select=*&order=created_at.desc&limit=500';
      if (STATUSES.includes(status)) q += `&status=eq.${status}`;
      return json(res, 200, { ok: true, briefs: await admin.list(q) });
    }
    if (req.method === 'PATCH') {
      const { id, status, admin_note } = await readJson(req);
      if (!UUID.test(id || '')) return json(res, 400, { ok: false, error: 'bad_id' });
      const patch = {};
      if (status !== undefined) { if (!STATUSES.includes(status)) return json(res, 400, { ok: false, error: 'bad_status' }); patch.status = status; }
      if (admin_note !== undefined) patch.admin_note = String(admin_note).slice(0, 8000);
      const [row] = await admin.update(id, patch);
      return json(res, 200, { ok: true, brief: row });
    }
    return json(res, 405, { ok: false });
  } catch (e) {
    console.error(e.message);
    return json(res, 500, { ok: false, error: 'server_error' });
  }
}
