// Client portal: companies Nawa manages and the people who sign in for them (Supabase tables
// clients / client_users / client_otps, service key only).
//
// Sign-in is invite-only: Nawa adds a person's email in the admin, and that person signs in at
// /portal with a 6-digit code sent by email (or with Google, matched on the verified email).
// The session is a sealed cookie scoped to /api/portal; every request re-reads the person, so
// removing them in the admin signs them out at once.
import crypto from 'node:crypto';
import { env } from './http.js';
import { seal, unseal } from './seal.js';
import { sb } from './supabase.js';

export const PLATFORM_KEYS = ['facebook', 'instagram', 'linkedin', 'tiktok'];
export const MANUAL_STATUS = ['not_started', 'waiting_client', 'in_review', 'active', 'issue'];

const enc = encodeURIComponent;
export const normEmail = (e) => String(e || '').trim().toLowerCase();
export const validEmail = (e) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test(e);

// ---------- data ----------
export async function listClients() {
  const [clients, users] = await Promise.all([
    sb.select('clients', 'select=*&order=created_at.desc'),
    sb.select('client_users', 'select=*&order=created_at.asc'),
  ]);
  return clients.map((c) => ({ ...c, users: users.filter((u) => u.client_id === c.id) }));
}
export async function getClient(id) {
  if (!/^[0-9a-f-]{36}$/.test(String(id || ''))) return null;
  const [c] = await sb.select('clients', `select=*&id=eq.${enc(id)}`);
  return c || null;
}
export async function findUserByEmail(email) {
  const [u] = await sb.select('client_users', `select=*&email=eq.${enc(normEmail(email))}`);
  return u || null;
}

const CLIENT_FIELDS = ['name', 'industry', 'city', 'phone', 'website', 'notes'];
export function cleanClient(input) {
  const out = {};
  for (const k of CLIENT_FIELDS) if (input[k] !== undefined) out[k] = String(input[k] ?? '').trim().slice(0, k === 'notes' ? 2000 : 200);
  return out;
}
export function cleanUser(input) {
  return { name: String(input.name || '').trim().slice(0, 120), email: normEmail(input.email), phone: String(input.phone || '').trim().slice(0, 40) };
}

// ---------- session ----------
const COOKIE = 'nawa_client';
const DAYS = 30;
const PURPOSE = 'nawa-client-session';

function addCookie(res, value) {
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [...(prev ? [].concat(prev) : []), value]);
}
export function setClientSession(res, user) {
  const v = seal(PURPOSE, { u: user.id, e: Date.now() + DAYS * 864e5 });
  addCookie(res, `${COOKIE}=${v}; Path=/api/portal; HttpOnly; Secure; SameSite=Lax; Max-Age=${DAYS * 86400}`);
}
export const clearClientSession = (res) => addCookie(res, `${COOKIE}=; Path=/api/portal; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);

/** The signed-in person and their company, or null. */
export async function clientSession(req) {
  const raw = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
  const s = raw && unseal(PURPOSE, decodeURIComponent(raw.slice(COOKIE.length + 1)));
  if (!s || s.e < Date.now() || !/^[0-9a-f-]{36}$/.test(s.u)) return null;
  const [user] = await sb.select('client_users', `select=*&id=eq.${enc(s.u)}`);
  if (!user) return null;
  const client = await getClient(user.client_id);
  if (!client || !client.active) return null;
  return { user, client };
}

export async function signedIn(res, user) {
  setClientSession(res, user);
  await sb.update('client_users', `id=eq.${enc(user.id)}`, { last_login_at: new Date().toISOString() }).catch(() => {});
}

// ---------- one-time codes ----------
const CODE_MS = 10 * 60e3, RESEND_MS = 60e3, WINDOW_MS = 3600e3, MAX_SENDS = 5, MAX_TRIES = 5;
const hashCode = (email, code) => crypto.createHmac('sha256', `${env('ADMIN_PASSWORD')}|${env('SUPABASE_SERVICE_ROLE_KEY')}|nawa-otp`).update(`${email}|${code}`).digest('hex');

/** Sends a sign-in code if the email belongs to a client. Returns 'sent' | 'unknown' | 'wait'. */
export async function requestCode(email) {
  const user = await findUserByEmail(email);
  if (!user) return 'unknown';
  const client = await getClient(user.client_id);
  if (!client?.active) return 'unknown';
  const [prev] = await sb.select('client_otps', `select=*&email=eq.${enc(user.email)}`);
  const now = Date.now();
  let sends = 1, windowStart = new Date(now).toISOString();
  if (prev) {
    if (now - Date.parse(prev.sent_at) < RESEND_MS) return 'wait';
    if (now - Date.parse(prev.window_start) < WINDOW_MS) {
      if (prev.sends >= MAX_SENDS) return 'wait';
      sends = prev.sends + 1; windowStart = prev.window_start;
    }
  }
  const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
  await sb.upsert('client_otps', {
    email: user.email, code_hash: hashCode(user.email, code), expires_at: new Date(now + CODE_MS).toISOString(),
    attempts: 0, sends, window_start: windowStart, sent_at: new Date(now).toISOString(),
  }, 'email');
  await sendCodeEmail(user, client, code);
  return 'sent';
}

/** Checks a code. Returns the person when it matches, else null. */
export async function verifyCode(email, code) {
  email = normEmail(email);
  if (!/^\d{6}$/.test(String(code || ''))) return null;
  const [otp] = await sb.select('client_otps', `select=*&email=eq.${enc(email)}`);
  if (!otp || Date.parse(otp.expires_at) < Date.now() || otp.attempts >= MAX_TRIES) return null;
  const a = Buffer.from(hashCode(email, String(code))), b = Buffer.from(otp.code_hash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    await sb.update('client_otps', `email=eq.${enc(email)}`, { attempts: otp.attempts + 1 });
    return null;
  }
  await sb.remove('client_otps', `email=eq.${enc(email)}`);
  return findUserByEmail(email);
}

// ---------- email ----------
export const mailConfigured = () => Boolean(env('SMTP_USER') && env('SMTP_PASS')) || env('MAIL_LOG') === '1';

async function sendCodeEmail(user, client, code) {
  const subject = `رمز الدخول إلى نواة: ${code}`;
  const text = `مرحبًا ${user.name || ''}\n\nرمز الدخول إلى مساحة ${client.name} في نواة: ${code}\nصالح لمدة 10 دقائق. إذا لم تطلبه، تجاهل هذه الرسالة.\n\nنواة · Nawa Studio`;
  const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;background:#F6F5F2;padding:32px 16px;color:#0B1220">
  <div style="max-width:440px;margin:0 auto;background:#fff;border-radius:20px;padding:28px;text-align:center">
    <div style="font-size:22px;font-weight:700;margin-bottom:6px">نواة</div>
    <p style="margin:0 0 18px;color:#5E6578">مرحبًا ${escapeHtml(user.name || '')}، هذا رمز الدخول إلى مساحة <b>${escapeHtml(client.name)}</b>:</p>
    <div dir="ltr" style="font-size:36px;letter-spacing:10px;font-weight:700;background:#C6F432;border-radius:14px;padding:14px 0;margin:0 0 18px">${code}</div>
    <p style="margin:0;color:#5E6578;font-size:13px">صالح لمدة 10 دقائق. إذا لم تطلبه، تجاهل هذه الرسالة.</p>
  </div></div>`;
  if (env('MAIL_LOG') === '1' && !env('SMTP_USER')) { console.log(`[mail] to ${user.email}: code ${code}`); return; } // local tests only
  const nodemailer = (await import('nodemailer')).default;
  const t = nodemailer.createTransport({
    host: env('SMTP_HOST') || 'smtp.gmail.com', port: Number(env('SMTP_PORT') || 465), secure: Number(env('SMTP_PORT') || 465) === 465,
    auth: { user: env('SMTP_USER'), pass: env('SMTP_PASS') },
  });
  await t.sendMail({ from: `"نواة · Nawa" <${env('SMTP_FROM') || env('SMTP_USER')}>`, to: user.email, subject, text, html });
}
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
