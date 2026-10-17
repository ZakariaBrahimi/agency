// Renders the «نبض» (Nabd) podcast artwork from design/templates/podcast.html into exports/podcast/.
// Usage: node scripts/render-podcast.cjs            (show cover, logos, sample episode set)
//        node scripts/render-podcast.cjs n=2 title="…" guest="…" role="…" topic=dev   (one episode's set)
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'exports/podcast');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split(/=(.*)/s).slice(0, 2)));
const url = (params) => 'file://' + path.join(ROOT, 'design/templates/podcast.html') + '?' + new URLSearchParams(params);

const ep = args.n ? { n: args.n, title: args.title || '', guest: args.guest || '', role: args.role || '', topic: args.topic || 'product' } : null;
const epName = ep ? `episode-${String(ep.n).padStart(2, '0')}` : 'episode-sample';
const epParams = ep || { n: '1', title: 'لماذا فشل إطلاقنا الأول؟', guest: 'اسم الضيف', role: 'مؤسس منصة توصيل', topic: 'product' };

// css size x scale = exported pixels. Apple/Spotify want a 3000x3000 square.
const JOBS = [
  ...(ep ? [] : [
    { name: 'nabd-cover-3000', p: { kind: 'cover' }, w: 1500, h: 1500, scale: 2 },
    { name: 'logo/nabd-mark', p: { kind: 'mark' }, w: 512, h: 512, scale: 2, transparent: true },
    { name: 'logo/nabd-mark-ink', p: { kind: 'mark', bg: '#0B1220' }, w: 512, h: 512, scale: 2, transparent: true },
    { name: 'logo/nabd-mark-free', p: { kind: 'mark', tile: '0', bars: '#0B1220', rings: '0' }, w: 512, h: 512, scale: 2, transparent: true },
  ]),
  { name: `${epName}-cover-3000`, p: { kind: 'episode', ...epParams }, w: 1500, h: 1500, scale: 2 },
  { name: `${epName}-story`, p: { kind: 'story', ...epParams }, w: 1080, h: 1920, scale: 1 },
  { name: `${epName}-youtube`, p: { kind: 'thumb', ...epParams }, w: 1280, h: 720, scale: 1 },
];

(async () => {
  const browser = await chromium.launch();
  for (const j of JOBS) {
    const page = await browser.newPage({ viewport: { width: j.w, height: j.h }, deviceScaleFactor: j.scale });
    await page.goto(url({ ...j.p, w: j.w, h: j.h }));
    await page.waitForSelector('body[data-ready]');
    const file = path.join(OUT, j.name + '.png');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file, omitBackground: !!j.transparent, clip: { x: 0, y: 0, width: j.w, height: j.h } });
    console.log('✓', path.relative(ROOT, file));
    await page.close();
  }
  await browser.close();
})();
