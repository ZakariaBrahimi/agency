import fs from 'node:fs/promises';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

export async function readJson(rel) {
  return JSON.parse(await fs.readFile(path.join(ROOT, rel), 'utf8'));
}

export async function writeJson(rel, data) {
  await fs.writeFile(path.join(ROOT, rel), JSON.stringify(data, null, 2) + '\n');
}

export async function loadImage(rel) {
  const buf = await fs.readFile(path.join(ROOT, rel));
  const ext = path.extname(rel).toLowerCase();
  const type = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return { buf, type, name: path.basename(rel) };
}

/** fetch wrapper that throws with the API's error body so failures are readable in the Action log. */
export async function api(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = text; }
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${url.split('?')[0]} -> ${res.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  return { body, headers: res.headers };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Replaces {{mention}} in the caption with the platform-specific tag for the product. */
export function renderCaption(post, platform, products, mentionFor) {
  const text = post.captions?.[platform] ?? post.caption;
  const product = post.mention ? products[post.mention] : null;
  const tag = product ? mentionFor(product) : '';
  return text.replaceAll('{{mention}}', tag || product?.name || '');
}
