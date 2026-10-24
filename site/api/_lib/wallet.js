// «تخزين نواة» prepaid balance. Clients top up (BaridiMob / CCP / RedotPay, with the transfer
// reference and a receipt screenshot); Nawa approves in admin «المدفوعات»; every day the cron takes
// that day's storage from the balance (GB stored × monthly price ÷ days in the month).
//
// Balance = the sum of client_ledger (topups +, usage −). When it reaches 0, uploads to «تخزين نواة»
// keep working for GRACE_DAYS, then pause (new files go to the client's Drive if it has room).
// Nothing is ever deleted and stored files keep publishing. Alerts: email at 7 and 3 days left, at
// 0 and when uploads pause; Telegram to Nawa for each top-up and after 30 days unpaid.
import { sb } from './supabase.js';
import { priceDzd, today, thisMonth } from './billing.js';
import { sendNotice } from './clients.js';
import { telegramReady, sendMessage, escapeHtml } from './telegram.js';

export const GRACE_DAYS = 7;
export const METHODS = ['baridimob', 'ccp', 'redotpay', 'cash', 'other'];
const enc = encodeURIComponent;
const GB = 1e9;
const round2 = (n) => Math.round(n * 100) / 100;
const daysIn = (day) => { const [y, m] = day.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

/** The payment methods a client can pick, from the details Nawa filled in («الإعدادات»). */
export const clientMethods = (payment = {}) => [
  payment.baridimob_rip && 'baridimob',
  payment.ccp_account && 'ccp',
  (payment.redotpay_uid || payment.redotpay_email) && 'redotpay',
].filter(Boolean);

export const ledgerOf = (clientId) => sb.select('client_ledger', `select=kind,amount_dzd,ref,note,created_at&client_id=eq.${enc(clientId)}&order=created_at.asc`).catch(() => []);
export const balanceOf = (rows) => round2(rows.reduce((a, r) => a + Number(r.amount_dzd || 0), 0));

/** DZD a day at the current stored size. */
export const dailyCost = (cloudBytes, settings, day = today()) => (cloudBytes / GB) * priceDzd(settings) / daysIn(day);

/**
 * The client's wallet state:
 *   ok | low (≤ 7 days left) | empty (nothing to spend, never in grace) | grace (0, still uploading) | paused
 */
export function walletState(client, balance, daily, day = today()) {
  if (balance > 0) {
    const daysLeft = daily > 0 ? Math.floor(balance / daily) : null;
    return { state: daysLeft !== null && daysLeft <= 7 ? 'low' : 'ok', daysLeft };
  }
  if (!client.wallet_zero_since) return { state: 'empty', daysLeft: 0 };
  const left = GRACE_DAYS - daysBetween(client.wallet_zero_since, day);
  return left > 0 ? { state: 'grace', daysLeft: 0, graceLeft: left } : { state: 'paused', daysLeft: 0, graceLeft: 0 };
}

/** May new files go to «تخزين نواة» right now? */
export async function cloudAllowed(client) {
  const bal = balanceOf(await ledgerOf(client.id));
  return ['ok', 'low', 'grace'].includes(walletState(client, bal, 0).state);
}

/** Months of the statement, newest first: { month, opening, topups, usage, closing }. */
export function statement(rows) {
  const months = new Map(); let running = 0;
  for (const r of rows) {
    const m = String(r.created_at).slice(0, 7), a = Number(r.amount_dzd || 0);
    if (!months.has(m)) months.set(m, { month: m, opening: round2(running), topups: 0, usage: 0, closing: 0 });
    const s = months.get(m);
    if (a >= 0) s.topups = round2(s.topups + a); else s.usage = round2(s.usage - a);
    running += a; s.closing = round2(running);
  }
  return [...months.values()].reverse();
}

/** Everything the portal shows about the balance. */
export async function walletSummary(client, cloudBytes, settings) {
  const [rows, payments] = await Promise.all([
    ledgerOf(client.id),
    sb.select('client_payments', `select=id,amount_dzd,method,reference,status,reason,source,created_at,reviewed_at&client_id=eq.${enc(client.id)}&order=created_at.desc&limit=30`).catch(() => []),
  ]);
  const balance = balanceOf(rows), daily = dailyCost(cloudBytes, settings);
  const month = thisMonth();
  const usedThisMonth = round2(-rows.filter((r) => r.kind === 'usage' && String(r.created_at).startsWith(month)).reduce((a, r) => a + Number(r.amount_dzd), 0));
  return { balance, daily: round2(daily), usedThisMonth, ...walletState(client, balance, daily), graceDays: GRACE_DAYS, statement: statement(rows), payments, methods: clientMethods(settings.payment) };
}

// ---------- the daily charge (cron) ----------

/** Takes one day of storage from the balance (once per client and day), then updates grace and alerts. */
export async function chargeDay(client, cloudBytes, settings, day = today()) {
  const amount = round2(dailyCost(cloudBytes, settings, day));
  if (amount > 0) {
    await sb.insert('client_ledger', { client_id: client.id, kind: 'usage', amount_dzd: -amount, ref: `usage:${day}`, note: `${(cloudBytes / GB).toFixed(2)} GB` })
      .catch((e) => { if (!/23505|duplicate/.test(e.message)) throw e; });
  }
  return refreshState(client, cloudBytes, settings, day);
}

/** Starts or ends the grace period and sends each alert once (until the balance is topped up). */
export async function refreshState(client, cloudBytes, settings, day = today()) {
  const balance = balanceOf(await ledgerOf(client.id));
  const patch = {};
  if (balance > 0 && client.wallet_zero_since) patch.wallet_zero_since = null;
  if (balance <= 0 && !client.wallet_zero_since && cloudBytes > 0) patch.wallet_zero_since = day;
  const c = { ...client, ...patch };
  const w = walletState(c, balance, dailyCost(cloudBytes, settings, day), day);
  const level = w.state === 'low' ? (w.daysLeft <= 3 ? 'd3' : 'd7')
    : w.state === 'grace' ? 'zero'
    : w.state === 'paused' ? (daysBetween(c.wallet_zero_since, day) >= 30 ? 'day30' : 'paused') : '';
  const ORDER = ['', 'd7', 'd3', 'zero', 'paused', 'day30'];
  if (balance > 0 && w.state === 'ok' && client.wallet_alert) patch.wallet_alert = '';
  else if (level && ORDER.indexOf(level) > ORDER.indexOf(client.wallet_alert || '')) {
    patch.wallet_alert = level;
    await alert(c, level, { balance, daysLeft: w.daysLeft, price: priceDzd(settings) }).catch((e) => console.error('wallet alert', client.id, e.message));
  }
  if (Object.keys(patch).length) await sb.update('clients', `id=eq.${enc(client.id)}`, { ...patch, updated_at: new Date().toISOString() });
  return { balance, ...w, alert: patch.wallet_alert };
}

async function alert(client, level, { balance, daysLeft }) {
  if (level === 'day30') {
    if (telegramReady()) await sendMessage(`⚠️ <b>${escapeHtml(client.name)}</b>: رصيد «تخزين نواة» صفر منذ 30 يومًا. تواصل مع العميل.`);
    return;
  }
  const msg = {
    d7: [`رصيد «تخزين نواة» يكفي لنحو ${daysLeft} أيام فقط (${Math.round(balance)} دج).`, 'اشحن رصيدك من «التخزين» حتى لا يتوقف حفظ الملفات الجديدة.'],
    d3: [`رصيد «تخزين نواة» يكفي لنحو ${daysLeft} أيام فقط (${Math.round(balance)} دج).`, 'اشحن رصيدك الآن من «التخزين».'],
    zero: ['نفد رصيد «تخزين نواة».', `يستمر كل شيء كالمعتاد لمدة ${GRACE_DAYS} أيام. بعدها يتوقف حفظ الملفات الجديدة في تخزين نواة حتى تشحن رصيدك.`, 'ملفاتك المحفوظة لا تُحذف، ومنشوراتك المجدولة تُنشر كالمعتاد.'],
    paused: ['توقّف حفظ الملفات الجديدة في «تخزين نواة» لأن الرصيد نفد.', 'ملفاتك المحفوظة لا تُحذف، ومنشوراتك المجدولة تُنشر كالمعتاد. اشحن رصيدك ليعود الحفظ فورًا.'],
  }[level];
  const subject = { d7: 'رصيد «تخزين نواة» قارب على النفاد', d3: 'رصيد «تخزين نواة»: 3 أيام متبقية', zero: 'نفد رصيد «تخزين نواة»', paused: 'توقّف حفظ الملفات في «تخزين نواة»' }[level];
  for (const u of await usersOf(client.id)) await sendNotice(u.email, subject, [`مرحبًا ${u.name || ''}،`, ...msg]);
}
const usersOf = (clientId) => sb.select('client_users', `select=name,email&client_id=eq.${enc(clientId)}`).catch(() => []);

// ---------- top-ups ----------

const RECEIPT = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
export class WalletError extends Error { constructor(code) { super(code); this.code = code; } }

/** A client's top-up request: { amount, method, reference, receipt (data URL) }. */
export async function requestTopup(client, input, settings) {
  const amount = Math.round(Number(input.amount));
  if (!Number.isFinite(amount) || amount < 100 || amount > 1000000) throw new WalletError('bad_amount');
  if (!clientMethods(settings.payment).includes(input.method)) throw new WalletError('bad_method');
  const reference = String(input.reference || '').trim().slice(0, 80);
  const receipt = String(input.receipt || '');
  if (!reference && !receipt) throw new WalletError('proof_required');
  if (receipt && (!RECEIPT.test(receipt) || receipt.length > 1.4e6)) throw new WalletError('bad_receipt');
  const pending = await sb.select('client_payments', `select=id&client_id=eq.${enc(client.id)}&status=eq.pending`).catch(() => []);
  if (pending.length >= 5) throw new WalletError('too_many_pending');
  const [row] = await sb.insert('client_payments', { client_id: client.id, amount_dzd: amount, method: input.method, reference, receipt: receipt || null });
  if (telegramReady()) {
    const M = { baridimob: 'بريدي موب', ccp: 'CCP', redotpay: 'RedotPay' };
    await sendMessage(`💳 <b>${escapeHtml(client.name)}</b> أرسل ${amount} دج عبر ${M[input.method]}${reference ? ` · المرجع <code>${escapeHtml(reference)}</code>` : ''}.\nتحقّق من الوصل في «المدفوعات».`).catch((e) => console.error('telegram', e.message));
  }
  return row;
}

/** Nawa approves (credits the balance) or rejects (with a reason) a pending top-up. */
export async function review(id, approve, reason = '') {
  const [p] = await sb.select('client_payments', `select=id,client_id,amount_dzd,method,status&id=eq.${enc(id)}`);
  if (!p) throw new WalletError('not_found');
  if (p.status !== 'pending') throw new WalletError('already_reviewed');
  const now = new Date().toISOString();
  if (approve) {
    await sb.insert('client_ledger', { client_id: p.client_id, kind: 'topup', amount_dzd: p.amount_dzd, ref: `payment:${p.id}`, note: p.method })
      .catch((e) => { if (!/23505|duplicate/.test(e.message)) throw e; });
  }
  await sb.update('client_payments', `id=eq.${enc(id)}`, { status: approve ? 'approved' : 'rejected', reason: approve ? '' : String(reason).trim().slice(0, 200), reviewed_at: now });
  await afterTopup(p.client_id);
  const subject = approve ? `أُضيف ${p.amount_dzd} دج إلى رصيد «تخزين نواة»` : 'لم نتمكن من تأكيد عملية الشحن';
  const lines = approve ? [`تأكّدنا من دفعتك، وأُضيف ${p.amount_dzd} دج إلى رصيدك. شكرًا لك.`]
    : [`لم نتمكن من تأكيد دفعة ${p.amount_dzd} دج.`, ...(reason ? [`السبب: ${String(reason).trim()}`] : []), 'يمكنك إرسال الطلب من جديد من «التخزين».'];
  for (const u of await usersOf(p.client_id)) await sendNotice(u.email, subject, [`مرحبًا ${u.name || ''}،`, ...lines]).catch(() => {});
  return { ...p, status: approve ? 'approved' : 'rejected' };
}

/** A payment Nawa received directly (cash, transfer it already checked): credited at once. */
export async function manualTopup(clientId, input) {
  const amount = Math.round(Number(input.amount));
  if (!Number.isFinite(amount) || amount < 1 || amount > 1000000) throw new WalletError('bad_amount');
  const method = METHODS.includes(input.method) ? input.method : 'cash';
  const now = new Date().toISOString();
  const [p] = await sb.insert('client_payments', { client_id: clientId, amount_dzd: amount, method, reference: String(input.note || '').trim().slice(0, 80), status: 'approved', source: 'admin', reviewed_at: now });
  await sb.insert('client_ledger', { client_id: clientId, kind: 'topup', amount_dzd: amount, ref: `payment:${p.id}`, note: method });
  await afterTopup(clientId);
  return p;
}

// a top-up ends the grace period and clears alerts
async function afterTopup(clientId) {
  const balance = balanceOf(await ledgerOf(clientId));
  if (balance > 0) await sb.update('clients', `id=eq.${enc(clientId)}`, { wallet_zero_since: null, wallet_alert: '', updated_at: new Date().toISOString() });
}

// ---------- admin «المدفوعات» ----------

/** Pending receipts, the month's payments, every client's balance, and the month's totals. */
export async function adminOverview(month, settings) {
  const [clients, payments, ledger, contents] = await Promise.all([
    sb.select('clients', 'select=id,name,cloud_enabled,wallet_zero_since,wallet_alert&order=name.asc'),
    sb.select('client_payments', 'select=id,client_id,amount_dzd,method,reference,status,reason,source,created_at,reviewed_at,receipt&order=created_at.desc&limit=500'),
    sb.select('client_ledger', 'select=client_id,kind,amount_dzd,created_at'),
    sb.select('client_content', 'select=client_id,data').catch(() => []),
  ]);
  const { usageOf } = await import('./storage.js');
  const name = new Map(clients.map((c) => [c.id, c.name]));
  const slim = ({ receipt, ...p }) => ({ ...p, client: name.get(p.client_id) || '—', has_receipt: Boolean(receipt) });
  const balances = clients.map((c) => {
    const rows = ledger.filter((r) => r.client_id === c.id);
    const cloud = usageOf(contents.find((x) => x.client_id === c.id)?.data || { posts: [] }).cloud;
    const balance = balanceOf(rows), daily = dailyCost(cloud, settings);
    return { id: c.id, name: c.name, cloud_enabled: c.cloud_enabled, cloud_bytes: cloud, balance, daily: round2(daily), ...walletState(c, balance, daily) };
  });
  const inMonth = (iso) => String(iso || '').startsWith(month);
  const approved = payments.filter((p) => p.status === 'approved' && inMonth(p.reviewed_at || p.created_at));
  const used = round2(-ledger.filter((r) => r.kind === 'usage' && inMonth(r.created_at)).reduce((a, r) => a + Number(r.amount_dzd), 0));
  const share = settings.cost_usd / ((settings.cost_usd + settings.fee_usd) || 1);
  return {
    month,
    pending: payments.filter((p) => p.status === 'pending').map(slim),
    payments: payments.filter((p) => p.status !== 'pending' && inMonth(p.reviewed_at || p.created_at)).map(slim),
    balances,
    totals: { received: approved.reduce((a, p) => a + p.amount_dzd, 0), count: approved.length, used, cost: round2(used * share), margin: round2(used * (1 - share)), balances: round2(balances.reduce((a, b) => a + Math.max(0, b.balance), 0)) },
    clients: clients.map((c) => ({ id: c.id, name: c.name })),
  };
}

/** The receipt image of one payment: { type, body } or null. */
export async function receiptOf(id) {
  const [p] = await sb.select('client_payments', `select=receipt&id=eq.${enc(id)}`).catch(() => []);
  const m = p?.receipt?.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  return m ? { type: m[1], body: Buffer.from(m[2], 'base64') } : null;
}
