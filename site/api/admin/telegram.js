// Admin-only Telegram setup helpers.
// GET  /api/admin/telegram          → is the bot configured? which chats have messaged it?
// POST /api/admin/telegram { chatId? } → send a test message
import { json, readJson, env } from '../_lib/http.js';
import { isAdmin } from '../_lib/session.js';
import { telegram, sendMessage } from '../_lib/telegram.js';

export default async function handler(req, res) {
  if (!isAdmin(req)) return json(res, 401, { ok: false, error: 'signed_out' });
  if (!env('TELEGRAM_BOT_TOKEN')) return json(res, 200, { ok: true, token: false, chatId: null, chats: [] });
  try {
    if (req.method === 'GET') {
      const me = await telegram('getMe');
      let chats = [];
      try {
        const updates = await telegram('getUpdates', { limit: 50 });
        const seen = new Map();
        for (const u of updates) {
          const c = (u.message || u.my_chat_member || u.channel_post || {}).chat;
          if (c) seen.set(c.id, { id: c.id, name: c.title || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.username || '', type: c.type });
        }
        chats = [...seen.values()];
      } catch { /* getUpdates is unavailable when a webhook is set */ }
      return json(res, 200, { ok: true, token: true, bot: me.username, chatId: env('TELEGRAM_CHAT_ID') || null, chats });
    }
    if (req.method === 'POST') {
      const { chatId } = await readJson(req).catch(() => ({}));
      await sendMessage('✅ <b>نواة</b>: الإشعارات تعمل. ستصلك الطلبات الجديدة هنا.', chatId || env('TELEGRAM_CHAT_ID'));
      return json(res, 200, { ok: true });
    }
    return json(res, 405, { ok: false });
  } catch (e) {
    return json(res, 502, { ok: false, error: e.message });
  }
}
