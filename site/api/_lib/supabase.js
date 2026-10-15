// Supabase REST (PostgREST) calls without the SDK.
// - Public key (SUPABASE_PUBLISHABLE_KEY): can only INSERT new briefs (row-level security).
// - Service key (SUPABASE_SERVICE_ROLE_KEY): used only by /api/admin/* to read and update.
import { env } from './http.js';

async function rest(path, { key, method = 'GET', body, prefer } = {}) {
  const url = env('SUPABASE_URL').replace(/\/$/, '') + '/rest/v1/' + path;
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  if (!key.startsWith('sb_')) headers.Authorization = `Bearer ${key}`;
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`supabase ${r.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

export const insertBrief = (row) =>
  rest('briefs', { key: env('SUPABASE_PUBLISHABLE_KEY'), method: 'POST', body: row, prefer: 'return=minimal' });

export const admin = {
  ready: () => Boolean(env('SUPABASE_SERVICE_ROLE_KEY')),
  list: (query) => rest(`briefs?${query}`, { key: env('SUPABASE_SERVICE_ROLE_KEY') }),
  update: (id, patch) => rest(`briefs?id=eq.${encodeURIComponent(id)}`, {
    key: env('SUPABASE_SERVICE_ROLE_KEY'), method: 'PATCH', body: patch, prefer: 'return=representation',
  }),
};
