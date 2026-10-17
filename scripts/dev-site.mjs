// Local dev server for site/: serves static files and runs site/api/*.js like Vercel does.
// Usage: SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=... node scripts/dev-site.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../site');
const PORT = Number(process.argv[2] || 3000);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let p = decodeURIComponent(url.pathname);
  if (p.startsWith('/media/')) { // vercel.json rewrite
    req.url = '/api/admin/content?action=pub-media&k=' + encodeURIComponent(p.slice(7));
    p = '/api/admin/content';
  }
  if (p === '/madar' || p.startsWith('/madar/')) { // vercel.json rewrite
    url.searchParams.set('p', p.replace(/^\/madar\/?/, ''));
    req.url = '/api/madar/render?' + url.searchParams;
    p = '/api/madar/render';
  }
  if (p.startsWith('/api/')) {
    let file = path.join(ROOT, p + '.js');
    if (!fs.existsSync(file)) file = path.join(ROOT, p, 'index.js'); // like Vercel: api/x/index.js serves /api/x
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.statusCode = 404; return res.end('{}'); }
    const mod = await import(pathToFileURL(file).href + '?t=' + Date.now());
    return mod.default(req, res);
  }
  if (p === '/en' || p === '/fr') p = '/';
  let file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.statusCode = 403; return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) && fs.existsSync(file + '.html')) file += '.html';
  if (!fs.existsSync(file)) { res.statusCode = 404; file = path.join(ROOT, '404.html'); }
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`site on http://localhost:${PORT}`));
