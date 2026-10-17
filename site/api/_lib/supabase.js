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

// Madar: the public key reads published posts (row-level security) and can add subscribers and
// pitches; the service key manages everything from /admin.
const pub = () => env('SUPABASE_PUBLISHABLE_KEY');
const svc = () => env('SUPABASE_SERVICE_ROLE_KEY');
export const madar = {
  ready: () => Boolean(env('SUPABASE_URL') && pub()),
  posts: (query) => rest(`madar_posts?${query}`, { key: pub() }),
  subscribe: (row) => rest('madar_subscribers', { key: pub(), method: 'POST', body: row, prefer: 'return=minimal' }),
  pitch: (row) => rest('madar_pitches', { key: pub(), method: 'POST', body: row, prefer: 'return=minimal' }),
  admin: {
    list: (table, query) => rest(`${table}?${query}`, { key: svc() }),
    insert: (table, row) => rest(table, { key: svc(), method: 'POST', body: row, prefer: 'return=representation' }),
    update: (table, id, patch) => rest(`${table}?id=eq.${encodeURIComponent(id)}`, { key: svc(), method: 'PATCH', body: patch, prefer: 'return=representation' }),
    remove: (table, id) => rest(`${table}?id=eq.${encodeURIComponent(id)}`, { key: svc(), method: 'DELETE' }),
  },
};

// Small server-only key/value store (table app_state, no public access): used to keep the Google
// connection, sealed, so scheduled publishing can reach Drive when no one has the admin open.
export const kv = {
  ready: () => Boolean(env('SUPABASE_URL') && svc()),
  async get(k) {
    const [row] = await rest(`app_state?select=value&key=eq.${encodeURIComponent(k)}`, { key: svc() });
    return row?.value ?? null;
  },
  set: (k, value) => rest('app_state?on_conflict=key', { key: svc(), method: 'POST', body: { key: k, value, updated_at: new Date().toISOString() }, prefer: 'resolution=merge-duplicates,return=minimal' }),
  del: (k) => rest(`app_state?key=eq.${encodeURIComponent(k)}`, { key: svc(), method: 'DELETE' }),
};
