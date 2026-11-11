// Copies the static build (out/) into ../site, where Vercel serves it next to the /api functions.
// Only the pages built here are replaced; the rest of the site is left as it is.
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('out'), SITE = path.resolve('../site');
const PAGES = ['portal.html'];
fs.rmSync(path.join(SITE, '_next'), { recursive: true, force: true });
fs.cpSync(path.join(OUT, '_next'), path.join(SITE, '_next'), { recursive: true });
for (const p of PAGES) fs.copyFileSync(path.join(OUT, p), path.join(SITE, p));
console.log('synced', PAGES.join(', '), '+ _next into', SITE);
