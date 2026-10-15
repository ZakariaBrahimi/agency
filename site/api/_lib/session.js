// Admin session: a signed, expiring cookie. The signing key is derived from ADMIN_PASSWORD and
// the Supabase service key, so changing the password signs everyone out.
import crypto from 'node:crypto';
import { env } from './http.js';

const COOKIE = 'nawa_admin';
const DAYS = 14;
const key = () => crypto.createHash('sha256').update(`${env('ADMIN_PASSWORD')}|${env('SUPABASE_SERVICE_ROLE_KEY')}|nawa-admin`).digest();
const sign = (data) => crypto.createHmac('sha256', key()).update(data).digest('base64url');

export const adminConfigured = () => Boolean(env('ADMIN_PASSWORD'));

export function passwordMatches(given) {
  const a = crypto.createHash('sha256').update(String(given || '')).digest();
  const b = crypto.createHash('sha256').update(env('ADMIN_PASSWORD')).digest();
  return adminConfigured() && crypto.timingSafeEqual(a, b);
}

export function setSession(res) {
  const exp = Date.now() + DAYS * 864e5;
  const value = `${exp}.${sign(String(exp))}`;
  res.setHeader('Set-Cookie', `${COOKIE}=${value}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${DAYS * 86400}`);
}

export function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
}

export function isAdmin(req) {
  if (!adminConfigured()) return false;
  const raw = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
  if (!raw) return false;
  const [exp, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = sign(exp);
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
