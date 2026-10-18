// Renders the Instagram highlight stories (design/templates/stories.html) to JPEG, straight into the
// site so the admin can publish them (Meta downloads each one from its public URL), plus the PNG
// highlight covers into exports/highlights/.
// Usage: node scripts/render-stories.cjs            -> every set
//        node scripts/render-stories.cjs madar      -> one set
const path = require('path'); const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PAGE = 'file://' + path.join(ROOT, 'design/templates/stories.html');
const OUT = path.join(ROOT, 'site/assets/stories'); const COVERS = path.join(ROOT, 'exports/highlights');

(async () => {
  fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(COVERS, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  const open = async (qs) => {
    await p.goto(`${PAGE}?${qs}`); await p.waitForLoadState('networkidle');
    await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); });
  };
  await open('s=about');
  const sets = await p.evaluate(() => window.STORIES);
  const only = process.argv[2];
  for (const [id, s] of Object.entries(sets)) {
    if (only && id !== only) continue;
    for (let n = 1; n <= s.count; n++) {
      await open(`s=${id}&n=${n}`);
      await p.screenshot({ path: path.join(OUT, `${id}-${n}.jpg`), type: 'jpeg', quality: 90 });
    }
    await open(`s=${id}&cover=1`);
    await p.screenshot({ path: path.join(OUT, `${id}-cover.jpg`), type: 'jpeg', quality: 90 });
    await p.screenshot({ path: path.join(COVERS, `highlight-${id}.png`) });
    console.log('✓', id, s.name, `${s.count} stories + cover`);
  }
  await b.close();
  if (errors.length) { console.error(errors); process.exit(1); }
})();
