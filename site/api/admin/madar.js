// /api/admin/madar: manage Madar from /admin.
//   GET ?what=posts|subscribers|pitches · POST { post } · PUT { id, post } · DELETE ?id= · PATCH { pitch, status }
import { json, readJson } from '../_lib/http.js';
import { isAdmin } from '../_lib/session.js';
import { admin, madar } from '../_lib/supabase.js';
import { validatePost } from '../../assets/js/madar-schema.js';

const UUID = /^[0-9a-f-]{36}$/i;
const RESERVED = new Set(['articles', 'topics', 'tips', 'podcast', 'write', 'rss-xml', 'sitemap-xml', 'admin', 'api']);

async function nextNumber(kind) {
  const [last] = await madar.admin.list('madar_posts', `select=number&kind=eq.${kind}&number=not.is.null&order=number.desc&limit=1`);
  return (last?.number || 0) + 1;
}

export default async function handler(req, res) {
  if (!isAdmin(req)) return json(res, 401, { ok: false, error: 'signed_out' });
  if (!admin.ready()) return json(res, 503, { ok: false, error: 'service_key_missing' });
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'GET') {
      const what = url.searchParams.get('what') || 'posts';
      if (what === 'subscribers') return json(res, 200, { ok: true, subscribers: await madar.admin.list('madar_subscribers', 'select=*&order=created_at.desc&limit=5000') });
      if (what === 'pitches') return json(res, 200, { ok: true, pitches: await madar.admin.list('madar_pitches', 'select=*&order=created_at.desc&limit=500') });
      return json(res, 200, { ok: true, posts: await madar.admin.list('madar_posts', 'select=*&order=updated_at.desc&limit=1000') });
    }
    if (req.method === 'DELETE') {
      const id = url.searchParams.get('id') || '';
      if (!UUID.test(id)) return json(res, 400, { ok: false, error: 'bad_id' });
      await madar.admin.remove('madar_posts', id);
      return json(res, 200, { ok: true });
    }
    const body = await readJson(req, 200 * 1024);
    if (req.method === 'PATCH') {
      if (!UUID.test(body.pitch || '') || !['new', 'accepted', 'declined'].includes(body.status)) return json(res, 400, { ok: false, error: 'bad_request' });
      const [row] = await madar.admin.update('madar_pitches', body.pitch, { status: body.status });
      return json(res, 200, { ok: true, pitch: row });
    }
    if (req.method === 'POST' || req.method === 'PUT') {
      const v = validatePost(body.post || {});
      if (!v.ok) return json(res, 400, v);
      if (RESERVED.has(v.row.slug)) return json(res, 400, { ok: false, error: 'reserved_slug' });
      if (v.row.kind !== 'article' && v.row.number == null) v.row.number = await nextNumber(v.row.kind);
      try {
        if (req.method === 'POST') {
          const [row] = await madar.admin.insert('madar_posts', v.row);
          return json(res, 200, { ok: true, post: row });
        }
        if (!UUID.test(body.id || '')) return json(res, 400, { ok: false, error: 'bad_id' });
        const [row] = await madar.admin.update('madar_posts', body.id, v.row);
        return json(res, 200, { ok: true, post: row });
      } catch (e) {
        if (/23505|duplicate key/.test(e.message)) return json(res, 409, { ok: false, error: 'slug_taken' });
        throw e;
      }
    }
    return json(res, 405, { ok: false });
  } catch (e) {
    console.error(e.message);
    return json(res, 500, { ok: false, error: 'server_error' });
  }
}
