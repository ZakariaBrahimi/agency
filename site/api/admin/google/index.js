// GET  /api/admin/google            -> { configured, connected, email }
// GET  /api/admin/google?connect=1  -> redirects to Google sign-in
// DELETE /api/admin/google          -> disconnects this device (and revokes the token)
import { json } from '../../_lib/http.js';
import { isAdmin } from '../../_lib/session.js';
import { googleConfigured, connection, authUrl, clearConnection, revoke, redirectUri } from '../../_lib/google.js';
import { kv } from '../../_lib/supabase.js';

export default async function handler(req, res) {
  if (!isAdmin(req)) return json(res, 401, { ok: false, error: 'signed_out' });
  const url = new URL(req.url, 'http://x');
  if (req.method === 'GET' && url.searchParams.has('connect')) {
    if (!googleConfigured()) return json(res, 503, { ok: false, error: 'google_not_configured' });
    res.statusCode = 302;
    res.setHeader('Location', authUrl(res));
    res.setHeader('Cache-Control', 'no-store');
    return res.end();
  }
  if (req.method === 'GET') {
    const c = connection(req);
    return json(res, 200, { ok: true, configured: googleConfigured(), connected: Boolean(c), email: c?.email || '', redirectUri: redirectUri() });
  }
  if (req.method === 'DELETE') {
    const c = connection(req);
    if (c) await revoke(c.refresh);
    if (kv.ready()) await kv.del('google').catch(() => {}); // scheduled publishing stops with it
    clearConnection(res);
    return json(res, 200, { ok: true });
  }
  return json(res, 405, { ok: false });
}
