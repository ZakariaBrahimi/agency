// «تخزين نواة» (Nawa Cloud): client media in a Cloudflare R2 bucket, through R2's S3-compatible API,
// signed with AWS Signature V4 (no SDK). Clients never see the provider: the portal only shows
// «تخزين نواة», and objects are keyed clients/<clientId>/<postId>/<file>.
//
// Env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET (R2_ENDPOINT for local tests).
// The bucket needs a CORS rule allowing PUT and GET from the site, for uploads straight from the browser.
import crypto from 'node:crypto';
import { env } from './http.js';

export const r2Configured = () => Boolean(env('R2_ACCESS_KEY_ID') && env('R2_SECRET_ACCESS_KEY') && env('R2_BUCKET') && (env('R2_ACCOUNT_ID') || env('R2_ENDPOINT')));
const endpoint = () => (env('R2_ENDPOINT') || `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`).replace(/\/$/, '');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const hmac = (k, s) => crypto.createHmac('sha256', k).update(s).digest();
// RFC 3986 encoding, as SigV4 wants it ("/" kept in paths)
const enc = (s, keepSlash) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()).replace(keepSlash ? /%2F/g : /$^/, '/');
const amzDate = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function signingKey(secret, date, region, service) {
  return hmac(hmac(hmac(hmac('AWS4' + secret, date), region), service), 'aws4_request');
}

/**
 * Signs one request. Returns { url, headers } (headers mode) or { url } (presigned query mode).
 * Exported for the test vectors in AWS's documentation.
 */
export function sign({ method, host, path, query = {}, headers = {}, payloadHash = 'UNSIGNED-PAYLOAD', presign = 0, now = new Date(),
  accessKey = env('R2_ACCESS_KEY_ID'), secretKey = env('R2_SECRET_ACCESS_KEY'), region = 'auto', service = 's3' }) {
  const datetime = amzDate(now), date = datetime.slice(0, 8);
  const scope = `${date}/${region}/${service}/aws4_request`;
  const h = { host, ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).trim()])) };
  if (!presign) { h['x-amz-date'] = datetime; h['x-amz-content-sha256'] = payloadHash; }
  const signed = Object.keys(h).sort();
  const q = { ...query };
  if (presign) Object.assign(q, { 'X-Amz-Algorithm': 'AWS4-HMAC-SHA256', 'X-Amz-Credential': `${accessKey}/${scope}`, 'X-Amz-Date': datetime, 'X-Amz-Expires': String(presign), 'X-Amz-SignedHeaders': signed.join(';') });
  const qs = Object.keys(q).sort().map((k) => `${enc(k)}=${enc(String(q[k]))}`).join('&');
  const canonical = [method, enc(path, true), qs, signed.map((k) => `${k}:${h[k]}\n`).join(''), signed.join(';'), presign ? 'UNSIGNED-PAYLOAD' : payloadHash].join('\n');
  const toSign = ['AWS4-HMAC-SHA256', datetime, scope, sha256(canonical)].join('\n');
  const signature = crypto.createHmac('sha256', signingKey(secretKey, date, region, service)).update(toSign).digest('hex');
  if (presign) return { url: `${qs}&X-Amz-Signature=${signature}` };
  return { headers: { ...h, authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signed.join(';')}, Signature=${signature}` }, qs };
}

const objectPath = (key) => (key ? `/${env('R2_BUCKET')}/${key}` : `/${env('R2_BUCKET')}`);

/** A time-limited link to read (GET) or upload (PUT) one object. */
export function presign(method, key, seconds = 1800) {
  const base = new URL(endpoint());
  const { url } = sign({ method, host: base.host, path: base.pathname.replace(/\/$/, '') + objectPath(key), presign: seconds });
  return `${endpoint()}${objectPath(key)}?${url}`;
}

async function request(method, key, { query = {}, headers = {}, body } = {}) {
  const base = new URL(endpoint());
  const path = base.pathname.replace(/\/$/, '') + objectPath(key);
  const payloadHash = body ? sha256(body) : sha256('');
  const s = sign({ method, host: base.host, path, query, headers, payloadHash });
  const r = await fetch(`${endpoint()}${objectPath(key)}${s.qs ? '?' + s.qs : ''}`, { method, headers: s.headers, body });
  return r;
}

/** { size, type } of an object, or null when it doesn't exist. */
export async function head(key) {
  const r = await request('HEAD', key);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`r2 head ${r.status}`);
  return { size: Number(r.headers.get('content-length') || 0), type: r.headers.get('content-type') || '' };
}

export async function remove(key) {
  const r = await request('DELETE', key);
  if (!r.ok && r.status !== 404) throw new Error(`r2 delete ${r.status}`);
}

/** Every object under a prefix: [{ key, size }]. */
export async function list(prefix) {
  const out = []; let token = '';
  for (;;) {
    const query = { 'list-type': '2', prefix, ...(token ? { 'continuation-token': token } : {}) };
    const r = await request('GET', '', { query });
    if (!r.ok) throw new Error(`r2 list ${r.status}`);
    const xml = await r.text();
    for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      out.push({ key: decodeXml(m[1].match(/<Key>([\s\S]*?)<\/Key>/)[1]), size: Number(m[1].match(/<Size>(\d+)<\/Size>/)?.[1] || 0) });
    }
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? decodeXml(xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1] || '') : '';
    if (!token) return out;
  }
}
const decodeXml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** The bytes of an object (a fetch Response). */
export const fetchObject = (key) => fetch(presign('GET', key, 300));
