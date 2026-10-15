// Publishes every post in content/queue.json whose publish_at has passed.
//
//   node publisher/publish.mjs            publish due posts
//   node publisher/publish.mjs --dry-run  show what would be published, call no APIs
//   node publisher/publish.mjs --now <id> publish one post immediately, ignoring publish_at and draft status
//
// Per-platform results are written back into the queue, so a platform that already
// succeeded is never posted twice and a failed one is retried on the next run.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readJson, writeJson } from './lib.mjs';
import * as facebook from './platforms/facebook.mjs';
import * as instagram from './platforms/instagram.mjs';
import * as linkedin from './platforms/linkedin.mjs';
import * as x from './platforms/x.mjs';

const PLATFORMS = { facebook, instagram, linkedin, x };
const MAX_ATTEMPTS = 3;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || process.env.DRY_RUN === '1';
const nowId = args.includes('--now') ? args[args.indexOf('--now') + 1] : null;

const queue = await readJson('content/queue.json');
const { products } = await readJson('config/products.json');
const now = new Date();
let failures = 0;

for (const post of queue.posts) {
  if (post.status === 'published' || (post.status === 'draft' && !nowId)) continue;
  if (nowId ? post.id !== nowId : new Date(post.publish_at) > now) continue;

  if (!fs.existsSync(path.join(ROOT, post.image))) {
    console.error(`✗ ${post.id}: image not found: ${post.image} (run "npm run render")`);
    failures++;
    continue;
  }

  console.log(`\n▶ ${post.id}`);
  post.results ??= {};
  for (const key of post.platforms) {
    const platform = PLATFORMS[key];
    const result = (post.results[key] ??= { attempts: 0 });
    if (!platform) { console.warn(`  ? ${key}: unknown platform`); continue; }
    if (result.id) { console.log(`  = ${key}: already published (${result.id})`); continue; }
    if (result.attempts >= MAX_ATTEMPTS) { console.warn(`  ✗ ${key}: gave up after ${MAX_ATTEMPTS} attempts`); continue; }

    const missing = platform.required.filter((k) => !process.env[k]);
    if (dryRun || missing.length) {
      const why = dryRun ? 'dry run' : `skipped, missing ${missing.join(', ')}`;
      console.log(`  ~ ${key} (${why})\n    ${platform.caption(post, products).replace(/\n/g, '\n    ')}`);
      continue;
    }

    try {
      result.attempts++;
      const { id } = await platform.publish(post, products);
      Object.assign(result, { id, published_at: new Date().toISOString(), error: undefined });
      console.log(`  ✓ ${key}: ${id}`);
    } catch (e) {
      result.error = e.message;
      failures++;
      console.error(`  ✗ ${key}: ${e.message}`);
    }
  }

  if (!dryRun) {
    const done = post.platforms.filter((k) => post.results[k]?.id).length;
    post.status = done === post.platforms.length ? 'published' : done ? 'partial' : post.status;
  }
}

if (!dryRun) await writeJson('content/queue.json', queue);
process.exitCode = failures ? 1 : 0;
