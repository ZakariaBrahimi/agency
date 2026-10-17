// POST /api/madar/pitch: a "write with us" proposal from /madar/write. Saved for the admin and sent to Telegram.
import { json, readJson, siteUrl } from '../_lib/http.js';
import { madar } from '../_lib/supabase.js';
import { telegramReady, sendMessage, escapeHtml } from '../_lib/telegram.js';
import { readForm, limited } from '../_lib/form.js';
import { TOPICS, topicById } from '../../assets/js/madar-schema.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false });
  const isForm = /application\/x-www-form-urlencoded/.test(req.headers['content-type'] || '');
  try {
    const b = isForm ? await readForm(req) : await readJson(req, 16 * 1024);
    if (String(b.website || '')) return done();
    const row = {
      name: String(b.name || '').trim().slice(0, 120),
      email: String(b.email || '').trim().slice(0, 200),
      topic: TOPICS.some((t) => t.id === b.topic) ? b.topic : '',
      title: String(b.title || '').trim().slice(0, 200),
      outline: String(b.outline || '').trim().slice(0, 4000),
      links: String(b.links || '').trim().slice(0, 1000),
    };
    if (!row.name || !row.title || !row.topic || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.email)) return json(res, 400, { ok: false, error: 'missing_fields' });
    if (limited(req, 'pitch', 3)) return json(res, 429, { ok: false, error: 'rate_limited' });
    await madar.pitch(row);
    if (telegramReady()) {
      await sendMessage([`✍️ <b>فكرة مقال لمدار</b>`, '', `<b>${escapeHtml(row.title)}</b>`, `${escapeHtml(topicById(row.topic).ar)} · ${escapeHtml(row.name)} · ${escapeHtml(row.email)}`, row.outline ? '\n' + escapeHtml(row.outline.slice(0, 900)) : '', '', `${siteUrl()}/admin#madar`].join('\n')).catch(() => {});
    }
    return done();
  } catch (e) {
    console.error(e.message);
    return json(res, 500, { ok: false, error: 'server_error' });
  }
  function done() {
    if (isForm) { res.statusCode = 303; res.setHeader('Location', '/madar/write?sent=1'); return res.end(); }
    return json(res, 200, { ok: true });
  }
}
