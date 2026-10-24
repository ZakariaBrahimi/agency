// Where content lives, behind one interface used by the content engine (_lib/content-api.js).
//
// nawaStore:   Nawa's own content, all in Nawa's Google Drive (index + one folder per post). Nawa only.
// clientStore: a client's content. Never in Nawa's Drive:
//   - post data (titles, captions, schedule) in Supabase (client_content)
//   - media in the client's own Google Drive (free, capped at DRIVE_CAP even on a paid Google plan,
//     and only while their account has room), or else in «تخزين نواة» (Cloudflare R2, billed per
//     GB-month) once the client turns it on. Each media entry remembers where it is (store).
//     storage_pref 'cloud' sends new uploads straight to «تخزين نواة»; moveToCloud() moves existing
//     Drive files there (and trashes them in Drive).
//
// A store: { kind, calendar, load() -> { data, save, rootUrl? }, startUpload, attach, preview,
//            trash, removePost, rename, refreshFiles, urlFor, usage }
import crypto from 'node:crypto';
import { siteUrl } from './http.js';
import * as G from './google.js';
import * as R2 from './r2.js';
import { mediaUrl } from './publish.js';
import { seal, unseal } from './seal.js';
import { sb } from './supabase.js';

export const DRIVE_CAP = 15e9; // Google's free 15 GB; clients can't go past it on Drive
const folderName = (p) => `${(p.date || '').slice(0, 10) || 'بدون تاريخ'} · ${p.title}`.slice(0, 200);
const slim = (f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, size: Number(f.size || 0), ...(f.videoMediaMetadata ? { video: true } : {}) });
const EMPTY = () => ({ version: 1, settings: {}, posts: [] });
const enc = encodeURIComponent;

export class StorageError extends Error { constructor(code) { super(code); this.code = code; } }

async function drivePreview(g, id, size) {
  const meta = await G.fileMeta(g, id);
  let r;
  if (meta.thumbnailLink) r = await g.call('', { raw: true, base: meta.thumbnailLink.replace(/=s\d+$/, '') + `=s${size}` });
  if ((!r || !r.ok) && /^image\//.test(meta.mimeType) && Number(meta.size || 0) < 4e6) r = await g.call(`/drive/v3/files/${id}?alt=media`, { raw: true });
  if (!r || !r.ok) return null;
  return { type: r.headers.get('content-type') || 'image/jpeg', body: Buffer.from(await r.arrayBuffer()) };
}

async function driveFolder(g, root, post) {
  if (post.folderId) return post.folderId;
  const f = await G.createPostFolder(g, root, folderName(post));
  post.folderId = f.id; post.folderUrl = f.webViewLink || `https://drive.google.com/drive/folders/${f.id}`;
  return f.id;
}

async function driveAttach(g, post, id) {
  const meta = await G.fileMeta(g, id);
  if (!meta.parents?.includes(post.folderId)) throw new StorageError('bad_file');
  return slim(meta);
}

// ---------- Nawa ----------
export function nawaStore(g) {
  let loc;
  return {
    kind: 'nawa', calendar: true, g,
    async load() {
      const r = await G.readIndex(g, G.NAWA); loc = r.loc;
      return { data: r.data, save: () => G.writeIndex(g, loc, r.data), rootUrl: `https://drive.google.com/drive/folders/${loc.root}` };
    },
    async startUpload(post, { name, mimeType, size, origin }) {
      const folder = await driveFolder(g, loc.root, post);
      return { uploadUrl: await G.startUpload(g, { folder, name, mimeType, size, origin }) };
    },
    attach: (post, file) => driveAttach(g, post, file.id),
    preview: (m, size) => drivePreview(g, m.id, size),
    trash: (m) => G.trashFile(g, m.id),
    removePost: (post) => (post.folderId ? G.trashFile(g, post.folderId) : null),
    rename: (post) => (post.folderId ? G.renameFile(g, post.folderId, folderName(post)) : null),
    async refreshFiles(post) {
      if (!post.folderId) return null;
      return (await G.listFolder(g, post.folderId)).map(slim);
    },
    urlFor: (m, platform) => mediaUrl(g, m, platform),
  };
}

// ---------- clients ----------
const DRIVE_PURPOSE = 'nawa-client-drive';
export const sealDrive = (conn) => seal(DRIVE_PURPOSE, conn);
export const driveConnection = (client) => (client.drive_conn ? unseal(DRIVE_PURPOSE, client.drive_conn) : null);

const countDrive = (data) => (data.posts || []).reduce((n, p) => n + (p.media || []).filter((m) => m.store !== 'cloud').length, 0);

/** Bytes a client's posts keep in each store. */
export function usageOf(data) {
  const u = { drive: 0, cloud: 0 };
  for (const p of data.posts || []) for (const m of p.media || []) u[m.store === 'cloud' ? 'cloud' : 'drive'] += Number(m.size || 0);
  return u;
}

/** The client's Google storage quota ({ limit, usage } in bytes), or null. */
export async function driveQuota(g) {
  try {
    const q = (await g.call('/drive/v3/about?fields=storageQuota')).storageQuota || {};
    return { limit: Number(q.limit || 0) || null, usage: Number(q.usage || 0) };
  } catch { return null; }
}

/** Creates the «نواة» folder in a client's Drive (drive.file: the app only sees what it creates). */
export async function createDriveFolder(g, client) {
  const f = await g.call('/drive/v3/files?fields=id', { method: 'POST', body: { name: `نواة · ${client.name}`.slice(0, 200), mimeType: 'application/vnd.google-apps.folder' } });
  return f.id;
}

const cloudPrefix = (client, post) => `clients/${client.id}/${post.id}/`;
const safeName = (s) => String(s).normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(-80) || 'file';

export async function clientStore(client) {
  const conn = driveConnection(client);
  const g = conn ? G.client(conn) : null;
  let data;
  const store = {
    kind: 'client', calendar: false, g,
    async load() {
      const [row] = await sb.select('client_content', `select=data&client_id=eq.${enc(client.id)}`);
      data = { ...EMPTY(), ...(row?.data || {}) };
      const save = () => sb.upsert('client_content', { client_id: client.id, data, updated_at: new Date().toISOString() }, 'client_id');
      return { data, save };
    },
    async startUpload(post, { name, mimeType, size, origin }) {
      const u = usageOf(data);
      let driveFull = false;
      const cloudFirst = client.storage_pref === 'cloud' && client.cloud_enabled && R2.r2Configured();
      if (g && client.drive_folder && !cloudFirst) {
        const q = await driveQuota(g);
        const room = q?.limit ? q.limit - q.usage : Infinity;
        if (u.drive + size <= DRIVE_CAP && size <= room) {
          const folder = await driveFolder(g, client.drive_folder, post);
          return { uploadUrl: await G.startUpload(g, { folder, name, mimeType, size, origin }), store: 'drive' };
        }
        driveFull = true;
      }
      if (client.cloud_enabled && R2.r2Configured()) {
        const id = 'c_' + crypto.randomBytes(8).toString('hex');
        const key = `${cloudPrefix(client, post)}${id}/${safeName(name)}`;
        return { uploadUrl: R2.presign('PUT', key, 3600), store: 'cloud', fileId: id, contentType: mimeType };
      }
      throw new StorageError(driveFull ? 'drive_full' : 'no_storage');
    },
    async attach(post, file) {
      if (/^c_[0-9a-f]{16}$/.test(file.id || '')) {
        const [obj] = await R2.list(`${cloudPrefix(client, post)}${file.id}/`);
        if (!obj) throw new StorageError('bad_file');
        const h = await R2.head(obj.key);
        if (!/^(image|video)\//.test(h?.type || '')) { await R2.remove(obj.key); throw new StorageError('bad_file'); }
        return { id: file.id, name: obj.key.split('/').pop(), mimeType: h.type, size: h.size, store: 'cloud', key: obj.key, ...(/^video\//.test(h.type) ? { video: true } : {}) };
      }
      if (!g) throw new StorageError('bad_file');
      return { ...(await driveAttach(g, post, file.id)), store: 'drive' };
    },
    async preview(m, size) {
      if (m.store === 'cloud') {
        if (!/^image\//.test(m.mimeType)) return null;
        const r = await R2.fetchObject(m.key);
        if (!r.ok) return null;
        const sharp = (await import('sharp')).default;
        const body = await sharp(Buffer.from(await r.arrayBuffer()), { failOn: 'none' }).rotate().resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
        return { type: 'image/jpeg', body };
      }
      return g ? drivePreview(g, m.id, size) : null;
    },
    async trash(m) {
      if (m.store === 'cloud') return R2.remove(m.key);
      if (g) return G.trashFile(g, m.id);
    },
    async removePost(post) {
      for (const m of post.media || []) if (m.store === 'cloud') await R2.remove(m.key).catch(() => {});
      if (post.folderId && g) await G.trashFile(g, post.folderId).catch(() => {});
    },
    rename: (post) => (post.folderId && g ? G.renameFile(g, post.folderId, folderName(post)) : null),
    async refreshFiles() { return null; }, // drive.file can't see files added in Drive directly: uploads go through the portal
    /**
     * Moves Drive files into «تخزين نواة», oldest posts first, until the deadline: each file is copied,
     * checked, swapped in the post, then trashed in Drive (recoverable there for 30 days).
     * Call load() first and save() after. Returns { moved, failed, remaining }.
     */
    async moveToCloud(deadline) {
      if (!g || !client.cloud_enabled || !R2.r2Configured()) throw new StorageError('no_storage');
      let moved = 0, failed = 0;
      for (const post of data.posts) {
        for (const [i, m] of (post.media || []).entries()) {
          if (m.store === 'cloud') continue;
          if (Date.now() > deadline) return { moved, failed, remaining: countDrive(data) };
          try {
            const src = await g.call(`/drive/v3/files/${enc(m.id)}?alt=media`, { raw: true });
            if (!src.ok) throw new Error('drive ' + src.status);
            const id = 'c_' + crypto.randomBytes(8).toString('hex');
            const key = `${cloudPrefix(client, post)}${id}/${safeName(m.name)}`;
            const size = Number(src.headers.get('content-length') || m.size || 0);
            // R2 needs the length up front: files up to 150 MB are buffered, bigger ones streamed with it
            const body = size && size <= 150e6 ? Buffer.from(await src.arrayBuffer()) : src.body;
            const put = await fetch(R2.presign('PUT', key, 3600), { method: 'PUT', body, ...(body === src.body ? { duplex: 'half' } : {}), headers: { 'Content-Type': m.mimeType, ...(size ? { 'Content-Length': String(size) } : {}) } });
            if (!put.ok) throw new Error('r2 ' + put.status);
            const h = await R2.head(key);
            if (!h?.size) throw new Error('r2 empty');
            post.media[i] = { id, name: m.name, mimeType: m.mimeType, size: h.size, store: 'cloud', key, ...(m.video ? { video: true } : {}) };
            await G.trashFile(g, m.id).catch(() => {});
            moved++;
          } catch (e) { console.error('move', m.id, e.message); failed++; }
        }
      }
      return { moved, failed, remaining: countDrive(data) };
    },
    urlFor(m, platform) {
      if (m.store === 'cloud') {
        const k = seal('nawa-media', { k: m.key, e: Date.now() + 30 * 60e3, m: m.video ? 'raw' : platform === 'instagram' ? 'ig' : 'fb' });
        return `${siteUrl()}/media/${k}.${m.video ? 'mp4' : 'jpg'}`;
      }
      if (!g) throw new StorageError('drive_disconnected');
      return mediaUrl(g, m, platform);
    },
  };
  return store;
}
