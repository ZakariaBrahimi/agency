// Plain HTML form posts (works without JavaScript) and a best-effort per-instance rate limit.
export async function readForm(req, limit = 16 * 1024) {
  if (req.body && typeof req.body === 'object') return req.body;
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > limit) throw new Error('too_large'); chunks.push(c); }
  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString('utf8')));
}

const hits = new Map();
export function limited(req, bucket, max, windowMs = 10 * 60e3) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  const key = bucket + '|' + ip; const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  list.push(now); hits.set(key, list);
  return list.length > max;
}
