// Encrypts small server-side values (AES-256-GCM). Each purpose gets its own key, derived from the
// admin password and the Google client secret, so changing either one invalidates every sealed value.
import crypto from 'node:crypto';
import { env } from './http.js';

const key = (purpose) => crypto.createHash('sha256').update(`${env('ADMIN_PASSWORD')}|${env('GOOGLE_CLIENT_SECRET')}|${purpose}`).digest();

export function seal(purpose, obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(purpose), iv);
  const ct = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64url');
}

export function unseal(purpose, s) {
  try {
    const b = Buffer.from(String(s || ''), 'base64url');
    const d = crypto.createDecipheriv('aes-256-gcm', key(purpose), b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'));
  } catch { return null; }
}
