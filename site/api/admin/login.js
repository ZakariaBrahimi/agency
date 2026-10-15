// POST /api/admin/login { password }  ·  DELETE /api/admin/login (sign out)
import { json, readJson } from '../_lib/http.js';
import { adminConfigured, passwordMatches, setSession, clearSession } from '../_lib/session.js';

export default async function handler(req, res) {
  if (req.method === 'DELETE') { clearSession(res); return json(res, 200, { ok: true }); }
  if (req.method !== 'POST') return json(res, 405, { ok: false });
  if (!adminConfigured()) return json(res, 503, { ok: false, error: 'not_configured' });
  const { password } = await readJson(req).catch(() => ({}));
  await new Promise((r) => setTimeout(r, 400)); // slow down guessing
  if (!passwordMatches(password)) return json(res, 401, { ok: false, error: 'wrong_password' });
  setSession(res);
  return json(res, 200, { ok: true });
}
