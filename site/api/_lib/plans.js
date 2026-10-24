// «تخزين نواة» plans. The client picks how many GB (1–200) and for how long (1, 3, 6 or 12 months,
// with the discounts Nawa sets in «الإعدادات»), pays by BaridiMob / CCP / RedotPay with a receipt
// photo, and Nawa approves it in «المدفوعات». The plan holds that space until its last day.
//
// Price = GB × price per GB per month × months × (1 − discount). During a paid period the client can
// upgrade (pay only the extra GB for the days left) and renew (the next period starts after this one;
// a smaller size applies from then, never below what is stored).
// After the last day: GRACE_DAYS of grace, then new files stop going to «تخزين نواة» (Drive if it
// has room). Nothing is ever deleted and stored files keep publishing. Emails at 7 and 3 days before
// the end, at 90% full, when the plan ends and when uploads pause; Telegram to Nawa for each
// request and 30 days after a plan ended.
import { sb } from './supabase.js';
import { priceDzd, today } from './billing.js';
import { sendNotice } from './clients.js';
import { telegramReady, sendMessage, escapeHtml } from './telegram.js';

export const GRACE_DAYS = 7;
export const METHODS = ['baridimob', 'ccp', 'redotpay', 'cash', 'other'];
const enc = encodeURIComponent;
const GB = 1e9;
const KIND = { new: 'جديدة', renew: 'تجديد', upgrade: 'ترقية' };

// ---------- dates (YYYY-MM-DD, Algiers days) ----------
const toDate = (s) => new Date(`${s}T00:00:00Z`);
const fmt = (d) => d.toISOString().slice(0, 10);
export const addDays = (s, n) => fmt(new Date(toDate(s).getTime() + n * 864e5));
const diffDays = (a, b) => Math.round((toDate(b) - toDate(a)) / 864e5); // b − a
/** The last day of a period of `months` starting on `start` (Oct 24 + 1 month → Nov 23). */
export function periodEnd(start, months) {
  const d = toDate(start), y = d.getUTCFullYear(), m = d.getUTCMonth() + months, day = d.getUTCDate();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  if (day > last) return fmt(new Date(Date.UTC(y, m, last))); // Jan 31 + 1 month → Feb 28
  return addDays(fmt(new Date(Date.UTC(y, m, day))), -1);
}

/** The payment methods a client can pick, from the details Nawa filled in («الإعدادات»). */
export const clientMethods = (payment = {}) => [
  payment.baridimob_rip && 'baridimob',
  payment.ccp_account && 'ccp',
  (payment.redotpay_uid || payment.redotpay_email) && 'redotpay',
].filter(Boolean);

/**
 * The client's plan right now:
 *   none | active | expiring (≤ 7 days left) | grace (ended, still uploading) | paused
 */
export function planState(client, cloudBytes = 0, day = today()) {
  const gb = Number(client.plan_gb || 0), until = client.plan_until || null;
  const base = { gb, until, usedGb: cloudBytes / GB, next: client.plan_next_gb ? { gb: client.plan_next_gb, from: client.plan_next_from } : null };
  if (!gb || !until) return { ...base, state: 'none', daysLeft: 0 };
  const left = diffDays(day, until) + 1; // the last day counts
  const fill = gb ? cloudBytes / (gb * GB) : 0;
  const extra = { full: fill >= 1, almost: fill >= 0.9 };
  if (left > 7) return { ...base, ...extra, state: 'active', daysLeft: left };
  if (left > 0) return { ...base, ...extra, state: 'expiring', daysLeft: left };
  const graceLeft = GRACE_DAYS + left; // left ≤ 0: days since the end
  return graceLeft > 0 ? { ...base, ...extra, state: 'grace', daysLeft: 0, graceLeft } : { ...base, ...extra, state: 'paused', daysLeft: 0, graceLeft: 0 };
}
const live = (s) => ['active', 'expiring', 'grace'].includes(s);

/** May a file go to «تخزين نواة», leaving `bytesAfter` stored? */
export const planAllows = (client, bytesAfter, day = today()) => {
  const p = planState(client, 0, day);
  return live(p.state) && bytesAfter <= p.gb * GB;
};

export class PlanError extends Error { constructor(code) { super(code); this.code = code; } }

/**
 * What a choice costs: { gb, months, unit, discount, upgradeDzd, periodDzd, total, kind }.
 * months 0 = upgrade only (during a paid period, to a bigger size).
 */
export function quote(client, cloudBytes, { gb, months }, settings, day = today()) {
  const P = settings.plans, unit = priceDzd(settings);
  gb = Math.round(Number(gb)); months = Math.round(Number(months));
  const p = planState(client, cloudBytes, day);
  const active = ['active', 'expiring'].includes(p.state);
  if (!Number.isFinite(gb) || gb < P.min_gb || gb > P.max_gb) throw new PlanError('bad_gb');
  if (gb * GB < cloudBytes) throw new PlanError('below_usage');
  const dur = P.durations.find((d) => d.months === months && d.on);
  if (months === 0) { if (!active || gb <= p.gb) throw new PlanError('bad_months'); }
  else if (!dur) throw new PlanError('bad_months');
  const discount = dur?.discount || 0;
  const upgradeDzd = active && gb > p.gb ? Math.round((gb - p.gb) * unit * p.daysLeft / 30) : 0;
  const periodDzd = months ? Math.round(gb * unit * months * (1 - discount / 100)) : 0;
  const kind = !active ? (p.state === 'none' ? 'new' : 'renew') : months ? 'renew' : 'upgrade';
  return { gb, months, unit, discount, upgradeDzd, periodDzd, total: upgradeDzd + periodDzd, kind };
}

/** Everything the portal shows about the plan. */
export async function planSummary(client, cloudBytes, settings) {
  const payments = await sb.select('client_payments', `select=id,amount_dzd,method,reference,status,reason,source,kind,gb,months,discount_pct,created_at,reviewed_at&client_id=eq.${enc(client.id)}&order=created_at.desc&limit=30`).catch(() => []);
  return { ...planState(client, cloudBytes), graceDays: GRACE_DAYS, unit: priceDzd(settings), options: settings.plans, payments, methods: clientMethods(settings.payment), pending: payments.filter((p) => p.status === 'pending').length };
}

// ---------- requests and approvals ----------

const RECEIPT = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

/** A client's plan request: { gb, months, method, receipt (data URL) }. */
export async function requestPlan(client, cloudBytes, input, settings) {
  const q = quote(client, cloudBytes, input, settings);
  if (!clientMethods(settings.payment).includes(input.method)) throw new PlanError('bad_method');
  const receipt = String(input.receipt || '');
  if (!receipt) throw new PlanError('proof_required');
  if (!RECEIPT.test(receipt) || receipt.length > 1.4e6) throw new PlanError('bad_receipt');
  const pending = await sb.select('client_payments', `select=id&client_id=eq.${enc(client.id)}&status=eq.pending`).catch(() => []);
  if (pending.length >= 3) throw new PlanError('too_many_pending');
  const [row] = await sb.insert('client_payments', {
    client_id: client.id, amount_dzd: q.total, method: input.method, receipt,
    kind: q.kind, gb: q.gb, months: q.months, discount_pct: q.discount, unit_price: q.unit, upgrade_dzd: q.upgradeDzd,
  });
  if (telegramReady()) {
    const M = { baridimob: 'بريدي موب', ccp: 'CCP', redotpay: 'RedotPay' };
    await sendMessage(`💳 <b>${escapeHtml(client.name)}</b>: ${describe(q)} = ${q.total} دج عبر ${M[input.method]}.\nتحقّق من الوصل في «المدفوعات».`).catch((e) => console.error('telegram', e.message));
  }
  return row;
}
const describe = (p) => `${p.gb} غ.ب${p.months ? ` × ${p.months === 1 ? 'شهر' : `${p.months} أشهر`}` : ''}${p.discount || p.discount_pct ? ` (−${p.discount || p.discount_pct}%)` : ''} · ${KIND[p.kind] || ''}`;

/** Puts an approved payment into effect on the client's plan. */
async function apply(clientId, pay, day = today()) {
  const [c] = await sb.select('clients', `select=id,plan_gb,plan_until,plan_next_gb,plan_next_from&id=eq.${enc(clientId)}`);
  const p = planState(c, 0, day), active = ['active', 'expiring'].includes(p.state);
  const patch = { cloud_enabled: true, wallet_alert: '', updated_at: new Date().toISOString() };
  if (pay.months) {
    const start = active ? addDays(c.plan_until, 1) : day;
    patch.plan_until = periodEnd(start, pay.months);
    if (!active || pay.gb >= p.gb) Object.assign(patch, { plan_gb: pay.gb, plan_next_gb: null, plan_next_from: null });
    else Object.assign(patch, { plan_next_gb: pay.gb, plan_next_from: start }); // smaller: from the next period
  } else if (pay.gb > p.gb) patch.plan_gb = pay.gb; // upgrade only
  await sb.update('clients', `id=eq.${enc(clientId)}`, patch);
}

/** Nawa approves (puts the plan into effect) or rejects (with a reason) a pending request. */
export async function review(id, approve, reason = '') {
  const [p] = await sb.select('client_payments', `select=id,client_id,amount_dzd,method,status,kind,gb,months,discount_pct&id=eq.${enc(id)}`);
  if (!p) throw new PlanError('not_found');
  if (p.status !== 'pending') throw new PlanError('already_reviewed');
  if (approve) await apply(p.client_id, p);
  await sb.update('client_payments', `id=eq.${enc(id)}`, { status: approve ? 'approved' : 'rejected', reason: approve ? '' : String(reason).trim().slice(0, 200), reviewed_at: new Date().toISOString() });
  const [c] = await sb.select('clients', `select=plan_gb,plan_until&id=eq.${enc(p.client_id)}`).catch(() => [{}]);
  const subject = approve ? `خطة «تخزين نواة»: ${c.plan_gb} غيغابايت حتى ${c.plan_until}` : 'لم نتمكن من تأكيد الدفع';
  const lines = approve ? [`تأكّدنا من دفعتك (${p.amount_dzd} دج). خطتك الآن ${c.plan_gb} غيغابايت حتى ${c.plan_until}. شكرًا لك.`]
    : [`لم نتمكن من تأكيد دفعة ${p.amount_dzd} دج.`, ...(reason ? [`السبب: ${String(reason).trim()}`] : []), 'يمكنك إرسال الطلب من جديد من «التخزين».'];
  for (const u of await usersOf(p.client_id)) await sendNotice(u.email, subject, [`مرحبًا ${u.name || ''}،`, ...lines]).catch(() => {});
  return { ...p, status: approve ? 'approved' : 'rejected' };
}

/** A plan Nawa grants directly (cash, a transfer it already checked). amount defaults to the quote. */
export async function grantPlan(clientId, input, settings) {
  const [c] = await sb.select('clients', `select=*&id=eq.${enc(clientId)}`);
  if (!c) throw new PlanError('not_found');
  const { usageOf } = await import('./storage.js');
  const [row] = await sb.select('client_content', `select=data&client_id=eq.${enc(clientId)}`).catch(() => []);
  const q = quote(c, usageOf(row?.data || { posts: [] }).cloud, input, settings);
  const amount = input.amount === '' || input.amount == null ? q.total : Math.round(Number(input.amount));
  if (!Number.isFinite(amount) || amount < 0 || amount > 1000000) throw new PlanError('bad_amount');
  const method = METHODS.includes(input.method) ? input.method : 'cash';
  const [p] = await sb.insert('client_payments', {
    client_id: clientId, amount_dzd: amount, method, reference: String(input.note || '').trim().slice(0, 80), status: 'approved', source: 'admin', reviewed_at: new Date().toISOString(),
    kind: q.kind, gb: q.gb, months: q.months, discount_pct: q.discount, unit_price: q.unit, upgrade_dzd: q.upgradeDzd,
  });
  await apply(clientId, q);
  return p;
}

// ---------- the daily run (cron) ----------

/** Applies a smaller size chosen at renewal when its period starts, and sends each alert once. */
export async function dailyPlan(client, cloudBytes, settings, day = today()) {
  const patch = {};
  if (client.plan_next_gb && client.plan_next_from && day >= client.plan_next_from) Object.assign(patch, { plan_gb: client.plan_next_gb, plan_next_gb: null, plan_next_from: null });
  const c = { ...client, ...patch };
  const p = planState(c, cloudBytes, day);
  if (p.state === 'none') { if (Object.keys(patch).length) await save(client.id, patch); return p; }
  const sinceEnd = p.until ? diffDays(p.until, day) : 0;
  const level = p.state === 'expiring' ? (p.daysLeft <= 3 ? 'd3' : 'd7')
    : p.state === 'grace' ? 'ended'
    : p.state === 'paused' ? (sinceEnd >= 30 ? 'day30' : 'paused')
    : p.almost ? 'full90' : '';
  const ORDER = ['', 'full90', 'd7', 'd3', 'ended', 'paused', 'day30'];
  if (level && ORDER.indexOf(level) > ORDER.indexOf(client.wallet_alert || '')) {
    patch.wallet_alert = level;
    await alert(c, level, p).catch((e) => console.error('plan alert', client.id, e.message));
  }
  if (Object.keys(patch).length) await save(client.id, patch);
  return { ...p, alert: patch.wallet_alert };
}
const save = (id, patch) => sb.update('clients', `id=eq.${enc(id)}`, { ...patch, updated_at: new Date().toISOString() });

async function alert(client, level, p) {
  if (level === 'day30') {
    if (telegramReady()) await sendMessage(`⚠️ <b>${escapeHtml(client.name)}</b>: انتهت خطة «تخزين نواة» منذ 30 يومًا ولم تُجدَّد. تواصل مع العميل.`);
    return;
  }
  const renew = `جدّد خطتك من «التخزين»: ${p.gb} غيغابايت.`;
  const msg = {
    full90: [`استعملت ${Math.round((p.usedGb / p.gb) * 100)}% من خطتك (${p.gb} غيغابايت).`, 'رقِّ خطتك من «التخزين» حتى لا يتوقف حفظ الملفات الجديدة.'],
    d7: [`تنتهي خطة «تخزين نواة» بعد ${p.daysLeft} أيام (${p.until}).`, renew],
    d3: [`تنتهي خطة «تخزين نواة» بعد ${p.daysLeft} أيام (${p.until}).`, renew],
    ended: ['انتهت خطة «تخزين نواة».', `يستمر كل شيء كالمعتاد لمدة ${GRACE_DAYS} أيام. بعدها يتوقف حفظ الملفات الجديدة في تخزين نواة حتى تجدّد.`, 'ملفاتك المحفوظة لا تُحذف، ومنشوراتك المجدولة تُنشر كالمعتاد.'],
    paused: ['توقّف حفظ الملفات الجديدة في «تخزين نواة» لأن الخطة انتهت.', 'ملفاتك المحفوظة لا تُحذف، ومنشوراتك المجدولة تُنشر كالمعتاد. جدّد خطتك ليعود الحفظ فورًا.'],
  }[level];
  const subject = { full90: 'مساحة «تخزين نواة» قاربت على الامتلاء', d7: 'خطة «تخزين نواة» تنتهي قريبًا', d3: 'خطة «تخزين نواة»: 3 أيام متبقية', ended: 'انتهت خطة «تخزين نواة»', paused: 'توقّف حفظ الملفات في «تخزين نواة»' }[level];
  for (const u of await usersOf(client.id)) await sendNotice(u.email, subject, [`مرحبًا ${u.name || ''}،`, ...msg]);
}
const usersOf = (clientId) => sb.select('client_users', `select=name,email&client_id=eq.${enc(clientId)}`).catch(() => []);

// ---------- admin «المدفوعات» ----------

/** Pending requests, the month's payments, every client's plan, and the month's figures. */
export async function adminOverview(month, settings) {
  const [clients, payments, contents] = await Promise.all([
    sb.select('clients', 'select=id,name,cloud_enabled,plan_gb,plan_until,plan_next_gb,plan_next_from,wallet_alert&order=name.asc'),
    sb.select('client_payments', 'select=id,client_id,amount_dzd,method,reference,status,reason,source,kind,gb,months,discount_pct,upgrade_dzd,created_at,reviewed_at,receipt&order=created_at.desc&limit=500'),
    sb.select('client_content', 'select=client_id,data').catch(() => []),
  ]);
  const { usageOf } = await import('./storage.js');
  const name = new Map(clients.map((c) => [c.id, c.name]));
  const slim = ({ receipt, ...p }) => ({ ...p, client: name.get(p.client_id) || '—', has_receipt: Boolean(receipt) });
  const unit = priceDzd(settings);
  const plans = clients.map((c) => {
    const cloud = usageOf(contents.find((x) => x.client_id === c.id)?.data || { posts: [] }).cloud;
    return { id: c.id, name: c.name, cloud_bytes: cloud, ...planState(c, cloud) };
  });
  const inMonth = (iso) => String(iso || '').startsWith(month);
  const approved = payments.filter((p) => p.status === 'approved' && inMonth(p.reviewed_at || p.created_at));
  const paying = plans.filter((p) => live(p.state));
  const soldGb = paying.reduce((a, p) => a + p.gb, 0), usedGb = plans.reduce((a, p) => a + p.usedGb, 0);
  const costMonth = usedGb * settings.cost_usd * settings.rate_dzd;
  const mrr = soldGb * unit;
  return {
    month, unit,
    pending: payments.filter((p) => p.status === 'pending').map(slim),
    payments: payments.filter((p) => p.status !== 'pending' && inMonth(p.reviewed_at || p.created_at)).map(slim),
    plans,
    totals: { received: approved.reduce((a, p) => a + p.amount_dzd, 0), count: approved.length, active: paying.length, mrr: Math.round(mrr), soldGb, usedGb: Math.round(usedGb * 100) / 100, cost: Math.round(costMonth), margin: Math.round(mrr - costMonth) },
    options: settings.plans,
  };
}

/** The receipt image of one payment: { type, body } or null. */
export async function receiptOf(id) {
  const [p] = await sb.select('client_payments', `select=receipt&id=eq.${enc(id)}`).catch(() => []);
  const m = p?.receipt?.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  return m ? { type: m[1], body: Buffer.from(m[2], 'base64') } : null;
}
