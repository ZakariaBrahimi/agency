// POST /api/madar/subscribe { email, source }: Thursday newsletter sign-up (JSON from madar.js, or a plain form post).
import { json, readJson } from '../_lib/http.js';
import { madar } from '../_lib/supabase.js';
import { telegramReady, sendMessage, escapeHtml } from '../_lib/telegram.js';
import { readForm, limited } from '../_lib/form.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false });
  const isForm = /application\/x-www-form-urlencoded/.test(req.headers['content-type'] || '');
  try {
    const b = isForm ? await readForm(req) : await readJson(req, 4096);
    if (String(b.website || '')) return done(); // honeypot
    const email = String(b.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) return json(res, 400, { ok: false, error: 'bad_email' });
    if (limited(req, 'sub', 5)) return json(res, 429, { ok: false, error: 'rate_limited' });
    try { await madar.subscribe({ email, source: String(b.source || '').slice(0, 120) }); }
    catch (e) { if (!/ 409:|23505/.test(e.message)) throw e; return done(); } // already subscribed
    if (telegramReady()) await sendMessage(`📬 <b>مشترك جديد في رسالة مدار</b>\n${escapeHtml(email)}`).catch(() => {});
    return done();
  } catch (e) {
    console.error(e.message);
    return json(res, 500, { ok: false, error: 'server_error' });
  }
  function done() {
    if (isForm) { res.statusCode = 303; res.setHeader('Location', '/madar?subscribed=1'); return res.end(); }
    return json(res, 200, { ok: true });
  }
}
