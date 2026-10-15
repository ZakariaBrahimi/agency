// POST /api/brief: receives a project brief from /start, saves it and notifies on Telegram.
import crypto from 'node:crypto';
import { json, readJson, siteUrl } from './_lib/http.js';
import { insertBrief, admin } from './_lib/supabase.js';
import { telegramReady, sendMessage, escapeHtml } from './_lib/telegram.js';
import { validateBrief, summarize, serviceById, t, formatAnswer, PROJECT, CONTACT } from '../assets/js/brief-schema.js';

// Best-effort rate limit per instance: 5 briefs per IP per 10 minutes.
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t0) => now - t0 < 10 * 60e3);
  list.push(now); hits.set(ip, list);
  return list.length > 5;
}

const field = (list, id) => list.find((q) => q.id === id);

function telegramText(id, b) {
  const p = b.project, c = b.contact;
  const services = b.services.map((s) => t(serviceById(s).title, 'ar')).join(' + ');
  const wa = c.whatsapp ? c.whatsapp.replace(/[^\d]/g, '') : '';
  const lines = [
    `🆕 <b>طلب جديد</b> · <code>#${id.slice(0, 8)}</code>`,
    '',
    `<b>${escapeHtml(c.name)}</b> · ${escapeHtml(p.business)}`,
    `${escapeHtml(formatAnswer(field(PROJECT, 'sector'), p.sector, 'ar'))}${p.country ? ' · ' + escapeHtml(p.country) : ''}`,
    '',
    `<b>الخدمات:</b> ${escapeHtml(services)}`,
    `<b>الميزانية:</b> ${escapeHtml(formatAnswer(field(PROJECT, 'budget'), p.budget, 'ar'))}`,
    `<b>البدء:</b> ${escapeHtml(formatAnswer(field(PROJECT, 'timeline'), p.timeline, 'ar'))}`,
    '',
    `<b>التواصل المفضّل:</b> ${escapeHtml(formatAnswer(field(CONTACT, 'prefer'), c.prefer, 'ar'))}`,
    `📧 ${escapeHtml(c.email)}`,
    wa ? `📱 <a href="https://wa.me/${wa}">${escapeHtml(c.whatsapp)}</a>` : '',
    '',
    `<a href="${siteUrl()}/admin#${id}">افتح الطلب كاملًا ←</a>`,
  ];
  return lines.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });

  let body;
  try { body = await readJson(req); } catch { return json(res, 400, { ok: false, error: 'bad_json' }); }

  // Spam guards: hidden "website" field must stay empty, and a human takes more than 4 seconds.
  if (body.website) return json(res, 200, { ok: true, id: crypto.randomUUID() });
  if (typeof body.startedAt === 'number' && Date.now() - body.startedAt < 4000) return json(res, 429, { ok: false, error: 'too_fast' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) return json(res, 429, { ok: false, error: 'rate_limited' });

  const { brief, errors } = validateBrief(body);
  if (errors.length) return json(res, 422, { ok: false, error: 'invalid', fields: errors });

  const id = crypto.randomUUID();
  try {
    await insertBrief({
      id, lang: brief.lang, services: brief.services, answers: brief.answers,
      business: brief.project, contact: brief.contact, summary: summarize(brief, 'ar'),
    });
  } catch (e) {
    console.error('save failed', e.message);
    return json(res, 500, { ok: false, error: 'save_failed' });
  }

  // The brief is saved; a Telegram problem must not fail the client's submission.
  if (telegramReady()) {
    try {
      await sendMessage(telegramText(id, brief));
      if (admin.ready()) await admin.update(id, { notified: true }).catch(() => {});
    } catch (e) { console.error('telegram failed', e.message); }
  }
  return json(res, 200, { ok: true, id });
}
