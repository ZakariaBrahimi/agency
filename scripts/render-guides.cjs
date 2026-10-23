// Renders the platform guide illustrations (design/templates/guides.html) to WebP for the client
// portal's activation steps: site/assets/guides/<name>.webp, 720×450 at 2× for sharp phones.
// Usage: node scripts/render-guides.cjs            -> every picture
//        node scripts/render-guides.cjs tiktok-2   -> one
const path = require('path'); const fs = require('fs'); const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PAGE = 'file://' + path.join(ROOT, 'design/templates/guides.html');
const OUT = path.join(ROOT, 'site/assets/guides');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 720, height: 450 }, deviceScaleFactor: 2 });
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(PAGE);
  const all = await p.evaluate(() => window.GUIDES);
  for (const g of all.filter((x) => !process.argv[2] || x === process.argv[2])) {
    await p.goto(`${PAGE}?g=${g}`); await p.evaluate(() => document.fonts.ready);
    const png = path.join(OUT, `${g}.png`);
    await p.screenshot({ path: png });
    execFileSync('python3', ['-c', 'import sys; from PIL import Image; Image.open(sys.argv[1]).save(sys.argv[2], "WEBP", quality=82, method=6)', png, path.join(OUT, `${g}.webp`)]);
    fs.unlinkSync(png);
    console.log('✓', g, Math.round(fs.statSync(path.join(OUT, `${g}.webp`)).size / 1024) + ' KB');
  }
  await b.close();
  if (errors.length) { console.error(errors); process.exit(1); }
})();
