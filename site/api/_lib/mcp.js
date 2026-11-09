// The client's Claude connector: a remote MCP server (Streamable HTTP, JSON responses) at
// /mcp/<token>, rewritten to /api/portal?action=mcp&t=<token>.
//
// The client creates the private link in the portal (only its hash is stored). Through it Claude can
// read the client's account and calendar, create DRAFT proposals and delete posts; it can never
// schedule or publish. Deleted posts go to the client's «المحذوفات» for 30 days (restorable), then are
// removed with their files. Proposals carry post.proposal = { by: 'claude', at, idea } until the client approves
// them in «المحتوى» (approval schedules them) or rejects them (the reason is kept for Claude).
//
// Files: images from public https links (attach_image), or any file Claude has in its code workspace
// (attached in the chat, or made there): start_upload gives a one-hour link straight to the client's
// storage (their Drive or «تخزين نواة»), Claude PUTs the bytes from its workspace, finish_upload checks
// the file arrived and attaches it. Claude's workspace needs network access to the upload host.
import crypto from 'node:crypto';
import { json, readJson, siteUrl, env } from './http.js';
import { seal, unseal } from './seal.js';
import { sb } from './supabase.js';
import { clientStore, StorageError } from './storage.js';
import { platformStatus, pagesOrNull } from './clients-admin.js';
import { PLATFORMS, KINDS, checkPost, postStatus, captionFor, normAt } from '../../assets/js/content-schema.js';

export const DAILY_DRAFTS = 30;
export const TRASH_DAYS = 30;
const MAX_IMAGE = 15e6;
const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const enc = encodeURIComponent;
const now = () => new Date().toISOString();
const algiers = () => new Date(Date.now() + 3600e3).toISOString(); // UTC+1, no DST
const hash = (token) => crypto.createHmac('sha256', `${env('ADMIN_PASSWORD')}|${env('SUPABASE_SERVICE_ROLE_KEY')}|nawa-mcp`).update(token).digest('hex');
const newId = () => 'p_' + crypto.randomBytes(6).toString('hex');

// ---------- the link (portal «المساعد الذكي») ----------

const publicLink = ({ token_hash, ...row }) => row;
export const linkOf = async (clientId) => {
  const [row] = await sb.select('client_ai_links', `select=*&client_id=eq.${enc(clientId)}`).catch(() => []);
  return row ? publicLink(row) : null;
};
/** A new private link for a client (replaces the old one). The token is returned once and never stored. */
export async function createLink(client, user) {
  const token = 'nwa_' + crypto.randomBytes(24).toString('base64url');
  await sb.remove('client_ai_links', `client_id=eq.${enc(client.id)}`);
  await sb.insert('client_ai_links', { client_id: client.id, token_hash: hash(token), created_by: user.name || user.email || '' });
  return { url: `${siteUrl()}/mcp/${token}`, link: await linkOf(client.id) };
}
export const revokeLink = (clientId) => sb.remove('client_ai_links', `client_id=eq.${enc(clientId)}`);

// ---------- the MCP endpoint ----------

/** Handles one MCP request for the link `token`. */
export async function handleMcp(req, res, token) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { error: 'POST JSON-RPC to this URL' }); }
  const [link] = /^nwa_[\w-]{20,}$/.test(token || '') ? await sb.select('client_ai_links', `select=*&token_hash=eq.${hash(token)}`).catch(() => []) : [];
  if (!link) return json(res, 401, { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'This Nawa link is not valid or was revoked. Create a new one in the Nawa portal.' } });
  const [client] = await sb.select('clients', `select=*&id=eq.${enc(link.client_id)}`);
  if (!client?.active) return json(res, 403, { jsonrpc: '2.0', id: null, error: { code: -32002, message: 'This Nawa account is not active.' } });

  let body;
  try { body = await readJson(req, 1e6); } catch { return json(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); }
  const batch = Array.isArray(body);
  const out = [];
  for (const msg of batch ? body : [body]) {
    const r = await one(msg, { link, client, req });
    if (r) out.push(r);
  }
  if (!out.length) { res.statusCode = 202; return res.end(); } // notifications only
  return json(res, 200, batch ? out : out[0]);
}

async function one(msg, ctx) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return { jsonrpc: '2.0', id: msg?.id ?? null, error: { code: -32600, message: 'Invalid request' } };
  const reply = (result) => (msg.id === undefined ? null : { jsonrpc: '2.0', id: msg.id, result });
  const fail = (code, message) => (msg.id === undefined ? null : { jsonrpc: '2.0', id: msg.id, error: { code, message } });
  switch (msg.method) {
    case 'initialize': {
      const v = VERSIONS.includes(msg.params?.protocolVersion) ? msg.params.protocolVersion : VERSIONS[0];
      return reply({
        protocolVersion: v,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'nawa', title: `Nawa · ${ctx.client.name}`, version: '1.0.0' },
        instructions: INSTRUCTIONS(ctx.client),
      });
    }
    case 'notifications/initialized': case 'notifications/cancelled': return null;
    case 'ping': return reply({});
    case 'tools/list': return reply({ tools: TOOLS });
    case 'tools/call': {
      const tool = HANDLERS[msg.params?.name];
      if (!tool) return fail(-32602, `Unknown tool: ${msg.params?.name}`);
      try {
        const result = await tool(msg.params.arguments || {}, ctx);
        await sb.update('client_ai_links', `id=eq.${enc(ctx.link.id)}`, { last_used_at: now() }).catch(() => {});
        return reply({ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
      } catch (e) {
        if (!(e instanceof ToolError)) console.error('mcp', msg.params?.name, e.message);
        return reply({ content: [{ type: 'text', text: e instanceof ToolError ? e.message : 'Something went wrong in Nawa. Please try again.' }], isError: true });
      }
    }
    default: return fail(-32601, `Method not found: ${msg.method}`);
  }
}

class ToolError extends Error {}
const need = (ok, message) => { if (!ok) throw new ToolError(message); };

const INSTRUCTIONS = (c) => `You are connected to the Nawa social media planner of "${c.name}"${c.industry ? ` (${c.industry}${c.city ? `, ${c.city}` : ''})` : ''}.
- You can read the account and its content calendar, create DRAFT post proposals, and delete posts. You can never schedule or publish: the client reviews every proposal in the Nawa portal («المحتوى») and approves or rejects it.
- Call get_account first: it gives the active platforms, today's date in Algiers (UTC+1), the rules, and the client's recent rejection reasons, so you can follow their taste.
- Call list_posts before planning so you don't repeat topics or crowd a day.
- Write captions in the client's language (Arabic by default unless the client asks otherwise), ready to post, with relevant hashtags.
- Give each draft a suggested time (suggested_at, Algiers time).
- Video posts can have a cover image (sent as the reel cover on Instagram and the video thumbnail on Facebook): upload it with start_upload (as_cover: true) or attach_image (as_cover: true). Prefer a 9:16 image (e.g. 1080×1920) with the hook as text.
- delete_post removes a post from the calendar when the user asks (or a draft you made is no longer wanted). It goes to the client's trash for 30 days, where they can restore it. Give a short reason. Deleting a published post only removes it from Nawa, not from Facebook/Instagram.
- Files (videos and images): if the user attached files in the chat or you created them in your code workspace, upload them yourself: create the draft, call start_upload with the file's name, type and exact size in bytes, run the returned command in your code workspace (bash/python), then call finish_upload. Do one file at a time, in the order they should appear. For public https image links use attach_image. If you have no file, describe the visual in image_idea.
- If the upload command fails with a network or host error, your workspace can't reach the upload address: tell the user to turn on code execution and allow network access ("All domains", or add the host from the error) in Claude → Settings → Capabilities, then try again. Never paste file contents into a tool call.`;

// ---------- tools ----------

const KIND_IDS = Object.keys(KINDS), PF_IDS = Object.keys(PLATFORMS);
const UPLOAD_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/quicktime': 'mov' };
const MAX_UPLOAD = 1e9;
const draftProps = {
  title: { type: 'string', description: 'Short internal title of the post (max 200 chars).' },
  kind: { type: 'string', enum: KIND_IDS, description: 'image (one photo), carousel (several photos), video (reel / video), text (text only).' },
  suggested_at: { type: 'string', description: 'Suggested publishing time in Algiers time, format YYYY-MM-DDTHH:MM (e.g. 2026-11-05T19:00). Must not be in the past.' },
  platforms: { type: 'array', items: { type: 'string', enum: PF_IDS }, description: 'Where to post. Defaults to instagram and facebook. Prefer the active platforms from get_account.' },
  caption: { type: 'string', description: 'The caption used on every platform unless a platform-specific one is given.' },
  captions: { type: 'object', properties: Object.fromEntries(PF_IDS.map((p) => [p, { type: 'string', description: `Caption for ${p} only (max ${PLATFORMS[p].limit} chars).` }])), additionalProperties: false, description: 'Optional platform-specific captions.' },
  image_idea: { type: 'string', description: 'If you have no image: describe the visual (what to show, style, text on it) for the designer.' },
  image_urls: { type: 'array', items: { type: 'string' }, maxItems: 10, description: 'Public https links to images (JPG/PNG/WebP, max 15 MB each) to attach, in order.' },
};
const TOOLS = [
  { name: 'get_account', title: 'Account and rules', description: 'The client (name, field, city, website), which platforms are active, today\'s date and time in Algiers, the rules for drafts, and the client\'s recent rejection reasons. Call this first.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true } },
  { name: 'list_posts', title: 'Content calendar', description: 'Posts in a date range (default: 14 days ago to 30 days ahead), with their status: draft, proposal (yours, waiting for the client), scheduled or published. Use it to avoid repeating topics or crowding a day.', inputSchema: { type: 'object', properties: { from: { type: 'string', description: 'YYYY-MM-DD' }, to: { type: 'string', description: 'YYYY-MM-DD' } }, additionalProperties: false }, annotations: { readOnlyHint: true } },
  { name: 'create_draft', title: 'Create a draft proposal', description: `Creates a DRAFT post proposal in the client's calendar, marked "suggested by Claude". It is never scheduled or published: the client approves it in Nawa. At most ${DAILY_DRAFTS} drafts a day.`, inputSchema: { type: 'object', properties: draftProps, required: ['title', 'suggested_at'], additionalProperties: false } },
  { name: 'update_draft', title: 'Update one of your proposals', description: 'Changes a proposal you created that the client has not approved or rejected yet. Only the given fields change; image_urls are added to the existing images.', inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'The post id from create_draft or list_posts.' }, ...draftProps }, required: ['id'], additionalProperties: false } },
  { name: 'attach_image', title: 'Attach an image to a proposal', description: 'Adds one image from a public https link to one of your pending proposals (as_cover: true makes it the video post\'s cover instead).', inputSchema: { type: 'object', properties: { id: { type: 'string' }, url: { type: 'string' }, as_cover: { type: 'boolean', description: 'true: the video post\'s cover image.' } }, required: ['id', 'url'], additionalProperties: false } },
  { name: 'delete_post', title: 'Delete a post', description: 'Deletes a post from the client\'s calendar: any draft, scheduled post or your proposals (a scheduled post will then not be published). It goes to the client\'s trash («المحذوفات») for 30 days, where they can restore it; then it is removed with its files. A published post stays online on Facebook/Instagram: this only removes it from Nawa.', inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'The post id from list_posts.' }, reason: { type: 'string', description: 'Why it is deleted (shown to the client), e.g. "duplicate of Thursday\'s post".' } }, required: ['id'], additionalProperties: false }, annotations: { destructiveHint: true } },
  { name: 'start_upload', title: 'Upload a file (step 1 of 2)', description: `For a video or image you have in your code workspace (attached in the chat, or created there). Returns a one-hour upload link straight to the client's storage and the exact command to run in your workspace. Then call finish_upload. JPG, PNG, WebP, MP4 or MOV, up to 1 GB.`, inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'One of your pending proposals (from create_draft).' }, name: { type: 'string', description: 'The file name, e.g. demo.mp4.' }, mime_type: { type: 'string', enum: Object.keys(UPLOAD_TYPES), description: 'The file type.' }, size: { type: 'integer', description: 'The exact file size in bytes (e.g. from `stat -c %s file` or os.path.getsize).' }, as_cover: { type: 'boolean', description: 'true: this image is the video post\'s cover (reel cover / video thumbnail), not one of its files. Images only.' } }, required: ['id', 'name', 'mime_type', 'size'], additionalProperties: false } },
  { name: 'finish_upload', title: 'Upload a file (step 2 of 2)', description: 'After the upload command finished: checks the file arrived and attaches it to the proposal (videos make it a reel/video post, several images a carousel).', inputSchema: { type: 'object', properties: { upload_token: { type: 'string', description: 'The upload_token from start_upload.' } }, required: ['upload_token'], additionalProperties: false } },
];

async function load(client) {
  const store = await clientStore(client);
  const { data, save } = await store.load();
  data.settings ||= {};
  return { store, data, save };
}
const today = () => algiers().slice(0, 10);
const slim = (p) => ({
  id: p.id, title: p.title, kind: p.kind, date: p.date || null,
  status: p.proposal ? 'proposal' : postStatus(p), platforms: p.platforms,
  caption: (captionFor(p, p.platforms?.[0] || 'instagram') || '').slice(0, 400),
  images: (p.media || []).length, ...(p.cover ? { cover: true } : {}), ...(p.proposal ? { suggested_by_claude: true } : {}),
});

const HANDLERS = {
  async get_account(_, { client, link }) {
    const st = platformStatus(client, await pagesOrNull(false));
    const { data } = await load(client);
    const used = link.day === today() ? link.day_count : 0;
    return {
      client: { name: client.name, industry: client.industry || '', city: client.city || '', website: client.website || '' },
      platforms: Object.fromEntries(PF_IDS.map((k) => [k, st[k]?.status === 'active' ? 'active' : 'not active'])),
      now_in_algiers: algiers().slice(0, 16).replace('T', ' '),
      timezone: 'Africa/Algiers (UTC+1)',
      rules: { drafts_only: true, drafts_left_today: Math.max(0, DAILY_DRAFTS - used), kinds: KINDS, caption_limits: Object.fromEntries(PF_IDS.map((k) => [k, PLATFORMS[k].limit])) },
      recent_rejections: (data.settings.aiFeedback || []).slice(-10).reverse(),
      pending_proposals: data.posts.filter((p) => p.proposal).length,
    };
  },

  async list_posts(args, { client }) {
    const from = /^\d{4}-\d{2}-\d{2}$/.test(args.from || '') ? args.from : addDays(today(), -14);
    const to = /^\d{4}-\d{2}-\d{2}$/.test(args.to || '') ? args.to : addDays(today(), 30);
    const { data } = await load(client);
    const inRange = data.posts.filter((p) => { const d = (p.date || '').slice(0, 10); return d && d >= from && d <= to; }).sort((a, b) => a.date.localeCompare(b.date));
    const undated = data.posts.filter((p) => !p.date && p.proposal);
    return { from, to, posts: inRange.map(slim), undated_proposals: undated.map(slim) };
  },

  async create_draft(args, ctx) {
    const { client, link } = ctx;
    const used = link.day === today() ? link.day_count : 0;
    need(used < DAILY_DRAFTS, `The daily limit of ${DAILY_DRAFTS} drafts is reached. Try again tomorrow.`);
    const fields = draftFields(args);
    need(fields.title, 'title is required.');
    need(fields.date, 'suggested_at is required (YYYY-MM-DDTHH:MM, Algiers time).');
    const { store, data, save } = await load(client);
    const post = { id: newId(), kind: 'image', platforms: ['instagram', 'facebook'], captions: { all: '' }, notes: '', media: [], schedule: {}, ...fields, proposal: { by: 'claude', at: now(), ...(args.image_idea ? { idea: String(args.image_idea).slice(0, 2000) } : {}) }, createdAt: now(), updatedAt: now() };
    data.posts.push(post);
    await save();
    await sb.update('client_ai_links', `id=eq.${enc(link.id)}`, { day: today(), day_count: used + 1, drafts_total: (link.drafts_total || 0) + 1 }).catch(() => {});
    link.day = today(); link.day_count = used + 1;
    const images = await attachAll(store, data, save, post, args.image_urls);
    return { created: slim(post), images, note: 'Saved as a draft proposal. The client will review it in Nawa.' };
  },

  async update_draft(args, { client }) {
    const { store, data, save } = await load(client);
    const post = data.posts.find((p) => p.id === args.id);
    need(post, 'No post with this id.');
    need(post.proposal?.by === 'claude', 'This post is not one of your pending proposals (the client approved, rejected or wrote it), so it can\'t be changed.');
    const fields = draftFields(args, true);
    Object.assign(post, fields, { updatedAt: now() });
    if (args.image_idea !== undefined) post.proposal.idea = String(args.image_idea).slice(0, 2000);
    await save();
    const images = await attachAll(store, data, save, post, args.image_urls);
    return { updated: slim(post), images };
  },

  async delete_post(args, { client }) {
    const { data, save } = await load(client);
    const post = data.posts.find((p) => p.id === args.id);
    need(post, 'No post with this id (it may already be deleted).');
    const published = Object.values(post.schedule || {}).some((x) => x.status === 'published');
    data.posts = data.posts.filter((p) => p.id !== post.id);
    data.trash = [...(data.trash || []), { post, deletedAt: now(), by: 'claude', ...(args.reason ? { reason: String(args.reason).slice(0, 300) } : {}) }].slice(-200);
    await save();
    return { deleted: { id: post.id, title: post.title }, note: `Moved to the client's trash for ${TRASH_DAYS} days (they can restore it).${published ? ' It was already published: it stays online on the platforms.' : ''}` };
  },

  async start_upload(args, { client }) {
    const { store, data, save } = await load(client);
    const post = data.posts.find((p) => p.id === args.id);
    need(post?.proposal?.by === 'claude', 'This post is not one of your pending proposals. Create a draft first, then upload to it.');
    need(UPLOAD_TYPES[args.mime_type], `mime_type must be one of: ${Object.keys(UPLOAD_TYPES).join(', ')}.`);
    need(!args.as_cover || /^image\//.test(args.mime_type), 'A cover must be an image (JPG, PNG or WebP).');
    const size = Math.round(Number(args.size));
    need(Number.isFinite(size) && size > 0, 'size must be the exact file size in bytes.');
    need(size <= MAX_UPLOAD, 'The file is larger than 1 GB.');
    const ext = UPLOAD_TYPES[args.mime_type];
    const name = String(args.name || 'file').replace(/[^\w.-]+/g, '-').replace(/^-+/, '').slice(-80) || `file.${ext}`;
    let up;
    try { up = await store.startUpload(post, { name, mimeType: args.mime_type, size, origin: siteUrl() }); }
    catch (e) { throw new ToolError(imageError(e).replace('images can\'t be saved', 'files can\'t be saved').replace('The image', 'The file')); }
    await save(); // a Drive upload may have created the post's folder
    const token = seal('nawa-upload', { c: client.id, p: post.id, u: up.uploadUrl, f: up.fileId || null, s: size, m: args.mime_type, e: Date.now() + 3600e3, ...(args.as_cover ? { cv: 1 } : {}) });
    const host = new URL(up.uploadUrl).host;
    return {
      upload_url: up.uploadUrl, method: 'PUT', headers: { 'Content-Type': args.mime_type }, size, expires_in_minutes: 60, upload_host: host,
      command: `curl -sS --fail -X PUT -H 'Content-Type: ${args.mime_type}' --data-binary @'${name}' '${up.uploadUrl}'`,
      python: `import requests\nwith open('${name}', 'rb') as f:\n    r = requests.put('${up.uploadUrl}', data=f, headers={'Content-Type': '${args.mime_type}'})\nprint(r.status_code)`,
      next: 'Run the command (or the python) in your code workspace with the path of the file, check it succeeded (HTTP 200), then call finish_upload with upload_token.',
      upload_token: token,
    };
  },

  async finish_upload(args, { client }) {
    const t = unseal('nawa-upload', args.upload_token);
    need(t && t.c === client.id, 'This upload_token is not valid. Call start_upload again.');
    need(Date.now() < t.e, 'This upload link expired (1 hour). Call start_upload again.');
    const { store, data, save } = await load(client);
    const post = data.posts.find((p) => p.id === t.p);
    need(post?.proposal?.by === 'claude', 'The proposal was approved, rejected or removed meanwhile, so the file can\'t be attached.');
    let fileId = t.f;
    if (!fileId) {
      // Drive: ask the upload session whether the whole file arrived
      const r = await fetch(t.u, { method: 'PUT', headers: { 'Content-Range': `bytes */${t.s}`, 'Content-Length': '0' } }).catch(() => null);
      need(r, 'Couldn\'t check the upload. Try finish_upload again in a moment.');
      if (r.status === 308) {
        const got = Number((r.headers.get('range') || '').split('-')[1] || -1) + 1;
        throw new ToolError(`The upload isn't complete (${got} of ${t.s} bytes arrived). Run the upload command again, then call finish_upload.`);
      }
      need(r.ok, 'The upload link is no longer valid. Call start_upload again.');
      fileId = (await r.json().catch(() => ({}))).id;
      need(fileId, 'Couldn\'t confirm the upload. Call start_upload again.');
    }
    let m;
    try { m = await store.attach(post, { id: fileId }); }
    catch { throw new ToolError('The file didn\'t arrive (or isn\'t an image/video). Check the upload command printed 200, then call finish_upload again.'); }
    if (t.cv) setCover(store, post, m);
    else {
      post.media = [...(post.media || []).filter((x) => x.id !== m.id), m];
      if (/^video\//.test(m.mimeType)) post.kind = 'video';
      else if (post.kind === 'image' && post.media.length > 1) post.kind = 'carousel';
    }
    post.updatedAt = now();
    await save();
    return { attached: { name: m.name, type: m.mimeType, size: m.size, ...(t.cv ? { as: 'cover' } : {}) }, updated: slim(post) };
  },

  async attach_image(args, { client }) {
    const { store, data, save } = await load(client);
    const post = data.posts.find((p) => p.id === args.id);
    need(post?.proposal?.by === 'claude', 'This post is not one of your pending proposals.');
    const [r] = await attachAll(store, data, save, post, [args.url], { asCover: Boolean(args.as_cover) });
    need(r.ok, r.error);
    return { updated: slim(post), image: r };
  },
};

const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);

/** Turns tool arguments into post fields, checked with the same rules as the dashboard. */
function draftFields(a, partial = false) {
  const f = {};
  if (a.title !== undefined) f.title = String(a.title).trim().slice(0, 200);
  if (a.kind !== undefined) { need(KINDS[a.kind], `kind must be one of: ${KIND_IDS.join(', ')}.`); f.kind = a.kind; }
  if (a.suggested_at !== undefined) {
    a.suggested_at = normAt(a.suggested_at);
    need(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(a.suggested_at), 'suggested_at must look like 2026-11-05T19:00 (Algiers time).');
    need(a.suggested_at >= algiers().slice(0, 16), 'suggested_at is in the past. Pick a future time (Algiers time).');
    f.date = a.suggested_at;
  }
  if (a.platforms !== undefined) {
    need(Array.isArray(a.platforms) && a.platforms.length && a.platforms.every((p) => PLATFORMS[p]), `platforms must be a list of: ${PF_IDS.join(', ')}.`);
    f.platforms = [...new Set(a.platforms)];
  }
  if (a.caption !== undefined || a.captions !== undefined) {
    f.captions = { all: String(a.caption ?? '') };
    for (const [k, v] of Object.entries(a.captions || {})) { need(PLATFORMS[k], `Unknown platform in captions: ${k}.`); f.captions[k] = String(v); }
  }
  const err = checkPost(f, partial);
  need(!err, { title_required: 'title is required.', title_too_long: 'title is too long (max 200).', bad_date: 'suggested_at is not valid.' }[err] || (err.startsWith('caption_too_long') ? `The ${err.split(':')[1]} caption is too long.` : `Invalid draft (${err}).`));
  return f;
}

// ---------- images from links ----------

const PRIVATE = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?|\[?f[cd])/i;
/** Makes an image the post's cover (the old cover file is removed). */
function setCover(store, post, m) {
  if (post.cover && post.cover.id !== m.id) Promise.resolve(store.trash(post.cover)).catch(() => {});
  post.cover = m;
}

async function attachAll(store, data, save, post, urls, { asCover = false } = {}) {
  const out = [];
  for (const url of (Array.isArray(urls) ? urls : []).slice(0, 10)) {
    try { out.push({ url, ok: true, ...(await attachOne(store, post, String(url), asCover)) }); }
    catch (e) { out.push({ url, ok: false, error: e instanceof ToolError ? e.message : imageError(e) }); }
    await save();
  }
  return out;
}
const imageError = (e) => (e instanceof StorageError ? {
  no_storage: 'The client has no storage connected yet, so images can\'t be saved. The draft is kept; describe the visual in image_idea instead.',
  drive_full: 'The client\'s storage is full. The draft is kept; describe the visual in image_idea instead.',
  plan_full: 'The client\'s storage plan is full. The draft is kept; describe the visual in image_idea instead.',
  plan_ended: 'The client\'s storage plan is not active. The draft is kept; describe the visual in image_idea instead.',
}[e.code] || 'The image couldn\'t be saved.' : 'The image couldn\'t be downloaded or saved.');

async function attachOne(store, post, url, asCover = false) {
  let u; try { u = new URL(url); } catch { throw new ToolError('Not a valid link.'); }
  need(u.protocol === 'https:' && !PRIVATE.test(u.hostname), 'Only public https image links are accepted.');
  const r = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(20e3) }).catch(() => null);
  need(r?.ok, 'The image link didn\'t answer (it must be public, without sign-in).');
  const type = (r.headers.get('content-type') || '').split(';')[0].trim();
  need(/^image\/(jpeg|png|webp)$/.test(type), 'The link must point to a JPG, PNG or WebP image.');
  need(Number(r.headers.get('content-length') || 0) <= MAX_IMAGE, 'The image is larger than 15 MB.');
  const chunks = []; let size = 0;
  for await (const c of r.body) { size += c.length; need(size <= MAX_IMAGE, 'The image is larger than 15 MB.'); chunks.push(c); }
  const bytes = Buffer.concat(chunks);
  const name = (decodeURIComponent(u.pathname.split('/').pop() || '') || 'image').replace(/[^\w.-]+/g, '-').slice(-60) + (/\.(jpe?g|png|webp)$/i.test(u.pathname) ? '' : `.${type.split('/')[1].replace('jpeg', 'jpg')}`);
  // the same path as an upload from the browser: start, send the bytes, attach
  const up = await store.startUpload(post, { name, mimeType: type, size: bytes.length, origin: siteUrl() });
  const put = await fetch(up.uploadUrl, { method: 'PUT', headers: { 'Content-Type': type, 'Content-Length': String(bytes.length) }, body: bytes });
  need(put.ok, 'The image couldn\'t be saved to the client\'s storage.');
  const fileId = up.fileId || (await put.json().catch(() => ({}))).id;
  const m = await store.attach(post, { id: fileId });
  if (asCover) setCover(store, post, m);
  else {
    post.media = [...(post.media || []).filter((x) => x.id !== m.id), m];
    if (post.kind === 'image' && post.media.length > 1) post.kind = 'carousel';
  }
  post.updatedAt = now();
  return { name, size: bytes.length, ...(asCover ? { as: 'cover' } : {}) };
}

// ---------- the daily email about new proposals (cron) ----------

/** Removes trashed posts older than TRASH_DAYS for good, with their files (cron, once a day). */
export async function purgeTrash(contents) {
  const limit = new Date(Date.now() - TRASH_DAYS * 864e5).toISOString();
  let removed = 0;
  for (const row of contents) {
    if (!(row.data?.trash || []).some((t) => t.deletedAt < limit)) continue;
    const [client] = await sb.select('clients', `select=*&id=eq.${enc(row.client_id)}`).catch(() => []);
    if (!client) continue;
    const store = await clientStore(client);
    const { data, save } = await store.load();
    const old = (data.trash || []).filter((t) => t.deletedAt < limit);
    for (const t of old) await Promise.resolve(store.removePost(t.post)).catch(() => {});
    data.trash = (data.trash || []).filter((t) => t.deletedAt >= limit);
    await save();
    removed += old.length;
  }
  return removed;
}

/** Emails each client's users once a day when Claude added proposals since the last email. */
export async function dailyDigest(contents) {
  const { sendNotice } = await import('./clients.js');
  const links = await sb.select('client_ai_links', 'select=id,client_id,created_at,digest_at').catch(() => []);
  let sent = 0;
  for (const l of links) {
    const since = l.digest_at || l.created_at;
    const data = contents.find((x) => x.client_id === l.client_id)?.data || {};
    const posts = (data.posts || []).filter((p) => p.proposal && p.proposal.at > since);
    const gone = (data.trash || []).filter((t) => t.by === 'claude' && t.deletedAt > since);
    if (!posts.length && !gone.length) continue;
    const users = await sb.select('client_users', `select=name,email&client_id=eq.${enc(l.client_id)}`).catch(() => []);
    const subject = posts.length ? (posts.length === 1 ? 'Claude اقترح منشورًا جديدًا' : `Claude اقترح ${posts.length} منشورات جديدة`) : `Claude حذف ${gone.length === 1 ? 'منشورًا' : `${gone.length} منشورات`}`;
    const list = posts.slice(0, 8).map((p) => `• ${p.title}${p.date ? ` (${p.date.replace('T', ' ')})` : ''}`).join('\n');
    const goneList = gone.slice(0, 8).map((t) => `• ${t.post.title}${t.reason ? ` — ${t.reason}` : ''}`).join('\n');
    const lines = [
      ...(posts.length ? [`أضاف Claude مقترحات جديدة إلى «المحتوى» في نواة:\n${list}`, 'لا يُنشر شيء قبل موافقتك: افتح المقترح واضغط «اعتماد وجدولة» أو «رفض».'] : []),
      ...(gone.length ? [`حذف Claude من التقويم:\n${goneList}`, `تبقى في «المحذوفات» ${TRASH_DAYS} يومًا، ويمكنك استعادتها.`] : []),
    ];
    for (const u of users) {
      await sendNotice(u.email, subject, [`مرحبًا ${u.name || ''}،`, ...lines], { path: '/portal#content', button: posts.length ? 'راجع المقترحات' : 'افتح «المحتوى»' }).catch(() => {});
    }
    await sb.update('client_ai_links', `id=eq.${enc(l.id)}`, { digest_at: now() }).catch(() => {});
    sent++;
  }
  return sent;
}
