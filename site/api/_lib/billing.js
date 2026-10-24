// «تخزين نواة» billing: clients pay per GB-month, in DZD only.
//
// Price per GB per month (DZD) = ceil((storage cost USD + Nawa's fee USD) × exchange rate), all three
// set by Nawa in the admin («الإعدادات»). The cron records each client's stored bytes once a day;
// a month's bill is the average stored over the month × the price (2 GB for half the month then
// 4 GB for the other half = 3 GB), rounded to the nearest dinar. Invoices keep the price they were issued with.
//
// Settings live in app_state «billing», never in the code: { cost_usd, fee_usd, rate_dzd, payment: {...},
// contact: { email } }. Only `contact` is public (the site reads it through GET /api/brief).
import { kv, sb } from './supabase.js';

export const DEFAULTS = { cost_usd: 0.015, fee_usd: 0.5, rate_dzd: 250 };
export const PAYMENT_FIELDS = ['baridimob_rip', 'ccp_name', 'ccp_account', 'ccp_key', 'redotpay_uid', 'redotpay_email'];
export const CONTACT_DEFAULTS = { email: 'nawa.studio.ai@gmail.com' };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GB = 1e9;
const enc = encodeURIComponent;

export async function getSettings() {
  const s = (await kv.get('billing').catch(() => null)) || {};
  const payment = Object.fromEntries(PAYMENT_FIELDS.map((k) => [k, String(s.payment?.[k] ?? '')]));
  const contact = { ...CONTACT_DEFAULTS, ...Object.fromEntries(Object.entries(s.contact || {}).filter(([k, v]) => k in CONTACT_DEFAULTS && v)) };
  return { ...DEFAULTS, ...pick(s, Object.keys(DEFAULTS)), payment, contact };
}
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => typeof o?.[k] === 'number').map((k) => [k, o[k]]));

/** Validates and saves new settings (numbers > 0; payment details as text). */
export async function saveSettings(input) {
  const cur = await getSettings();
  const next = { ...cur };
  for (const k of Object.keys(DEFAULTS)) {
    if (input[k] === undefined) continue;
    const v = Number(input[k]);
    if (!Number.isFinite(v) || v < 0 || v > (k === 'rate_dzd' ? 10000 : 100)) throw Object.assign(new Error('bad_number'), { code: 'bad_number', field: k });
    next[k] = v;
  }
  if (input.payment) for (const k of PAYMENT_FIELDS) if (input.payment[k] !== undefined) next.payment[k] = String(input.payment[k]).trim().slice(0, 120);
  if (input.contact?.email !== undefined) {
    const email = String(input.contact.email).trim().toLowerCase().slice(0, 120);
    if (!EMAIL.test(email)) throw Object.assign(new Error('bad_email'), { code: 'bad_email', field: 'email' });
    next.contact = { ...next.contact, email };
  }
  await kv.set('billing', next);
  return next;
}

/** Client price in DZD per GB per month, rounded up to a whole dinar. */
export const priceDzd = (s) => Math.ceil((s.cost_usd + s.fee_usd) * s.rate_dzd - 1e-9);

const daysIn = (month) => { const [y, m] = month.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
export const thisMonth = () => new Date(Date.now() + 3600e3).toISOString().slice(0, 7); // Algiers time
export const today = () => new Date(Date.now() + 3600e3).toISOString().slice(0, 10);
export const nextMonth = (month) => { const [y, m] = month.split('-').map(Number); return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7); };
export const prevMonth = (month) => { const [y, m] = month.split('-').map(Number); return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7); };

/**
 * Average GB stored in a month from the daily records. A day without a record keeps the last known
 * value; days before the first record count as 0. `upto` (a day) stops the average early, for the
 * running estimate. Returns { avgGb, gbDays, days }.
 */
export function monthAverage(rows, month, { upto, current } = {}) {
  const total = daysIn(month);
  const byDay = new Map(rows.map((r) => [String(r.day).slice(0, 10), Number(r.cloud_bytes || 0)]));
  let last = 0, gbDays = 0, counted = 0;
  for (let d = 1; d <= total; d++) {
    const day = `${month}-${String(d).padStart(2, '0')}`;
    if (upto && day > upto) break;
    if (byDay.has(day)) last = byDay.get(day);
    gbDays += last / GB; counted++;
  }
  // the rest of the month at today's size, for the projection
  const projected = gbDays + (total - counted) * ((current ?? last) / GB);
  return { avgGb: gbDays / total, projectedAvgGb: projected / total, days: total, counted };
}

/** This month so far and projected, for one client. */
export async function estimate(clientId, currentBytes, settings) {
  const month = thisMonth();
  const rows = await sb.select('client_usage_daily', `select=day,cloud_bytes&client_id=eq.${enc(clientId)}&day=gte.${month}-01&order=day.asc`).catch(() => []);
  const a = monthAverage(rows, month, { upto: today(), current: currentBytes });
  const price = priceDzd(settings);
  return { month, price_dzd: price, so_far_dzd: Math.round(a.avgGb * price), projected_dzd: Math.round(a.projectedAvgGb * price), avg_gb: a.avgGb };
}

/** Records today's stored bytes for a client (the cron calls this once a day per client). */
export const recordUsage = (clientId, usage) =>
  sb.upsert('client_usage_daily', { client_id: clientId, day: today(), cloud_bytes: Math.round(usage.cloud), drive_bytes: Math.round(usage.drive) }, 'client_id,day');

/** Issues last month's invoice for a client (once; nothing when the amount is 0). */
export async function invoiceMonth(clientId, month, settings) {
  const rows = await sb.select('client_usage_daily', `select=day,cloud_bytes&client_id=eq.${enc(clientId)}&day=gte.${month}-01&day=lt.${nextMonth(month)}-01&order=day.asc`);
  const before = await sb.select('client_usage_daily', `select=day,cloud_bytes&client_id=eq.${enc(clientId)}&day=lt.${month}-01&order=day.desc&limit=1`);
  // carry the last value from before the month into its first day
  if (before[0] && !rows.some((r) => String(r.day).slice(0, 10) === `${month}-01`)) rows.unshift({ day: `${month}-01`, cloud_bytes: before[0].cloud_bytes });
  const { avgGb } = monthAverage(rows, month);
  const price = priceDzd(settings);
  const amount = Math.round(avgGb * price); // a few MB never turn into a bill
  if (amount < 1) return null;
  const [inv] = await sb.insert('client_invoices', { client_id: clientId, month, avg_gb: Number(avgGb.toFixed(3)), price_dzd: price, amount_dzd: amount }).catch((e) => {
    if (/23505|duplicate/.test(e.message)) return [null]; // already issued
    throw e;
  });
  return inv;
}

/**
 * A client's storage at a glance, for the portal and the admin overview:
 * { drive: { connected, email, bytes, cap, quota? }, cloud: { available, enabled, bytes },
 *   estimate: { month, price_dzd, so_far_dzd, projected_dzd }, invoices: [...] }
 * quota (the client's whole Google account) is read only when `withQuota` (one Google call).
 */
export async function storageSummary(client, data, settings, { withQuota = false } = {}) {
  const { usageOf, DRIVE_CAP, driveConnection, driveQuota } = await import('./storage.js');
  const { r2Configured } = await import('./r2.js');
  const G = await import('./google.js');
  const u = usageOf(data);
  let quota = null;
  if (withQuota && client.drive_conn) { const conn = driveConnection(client); if (conn) quota = await driveQuota(G.client(conn)); }
  const [est, invoices] = await Promise.all([
    estimate(client.id, u.cloud, settings),
    sb.select('client_invoices', `select=id,month,avg_gb,price_dzd,amount_dzd,status,method,paid_at,created_at&client_id=eq.${enc(client.id)}&order=month.desc&limit=24`).catch(() => []),
  ]);
  return {
    drive: { connected: Boolean(client.drive_conn), email: client.drive_email || '', bytes: u.drive, cap: DRIVE_CAP, ...(quota ? { quota } : {}) },
    cloud: { available: r2Configured(), enabled: Boolean(client.cloud_enabled), bytes: u.cloud, pref: client.storage_pref === 'cloud' ? 'cloud' : 'auto' },
    driveFiles: (data.posts || []).reduce((n, p) => n + (p.media || []).filter((m) => m.store !== 'cloud').length, 0),
    estimate: est,
    invoices,
  };
}
