// Renders the HTML design templates to PNG at the exact size each platform wants,
// using the brand chosen in brand/brand.json (edit it, or pick one in the Brand Picker).
// Usage: npm run render                -> renders everything in JOBS
//        npm run render -- cover        -> renders only jobs whose name contains "cover"
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const Brand = require('../design/templates/brand.js');

const ROOT = path.resolve(__dirname, '..');
const T = (file) => 'file://' + path.join(ROOT, 'design/templates', file);
const brand = Brand.normalize(JSON.parse(fs.readFileSync(path.join(ROOT, 'brand/brand.json'), 'utf8')));

// Cover safe areas keep text clear of the profile-photo overlap and mobile cropping.
const JOBS = [
  { name: 'profile/profile-primary', url: T('profile.html?variant=primary'), w: 1080, h: 1080 },
  { name: 'profile/profile-dark', url: T('profile.html?variant=dark'), w: 1080, h: 1080 },
  // Facebook page cover: shown 820x312 on desktop, side-cropped on mobile
  { name: 'covers/facebook-cover', url: T('cover.html'), w: 1640, h: 624, safe: [200, 70, 1240, 484] },
  // LinkedIn company cover: logo overlaps bottom-left
  { name: 'covers/linkedin-cover', url: T('cover.html'), w: 1584, h: 396, safe: [380, 40, 1150, 316] },
  // X header: avatar overlaps bottom-left
  { name: 'covers/x-header', url: T('cover.html'), w: 1500, h: 500, safe: [300, 60, 1140, 380] },
  // YouTube banner: only the central 1546x423 is visible on every device
  { name: 'covers/youtube-banner', url: T('cover.html'), w: 2560, h: 1440, safe: [507, 508, 1546, 423] },
  // Instagram story highlight covers (1080x1920, icon inside the central circle)
  ...['services', 'work', 'mizan', 'results', 'contact'].map((k) => ({ name: `highlights/highlight-${k}`, url: T(`highlight.html?k=${k}`), w: 1080, h: 1920 })),
  { name: 'posts/mizan-intro', url: T('product-post.html'), w: 1080, h: 1350 },
  // Website share image (Open Graph), written straight into the site
  { name: 'og', url: T('cover.html'), w: 1200, h: 630, safe: [60, 70, 1080, 490], out: 'site/assets/img/og.png' },
  // Logos: transparent, cropped to the artwork
  { name: 'logo/logo-mark', url: T('logo.html?kind=mark'), w: 2400, h: 600, crop: '#logo', transparent: true },
  { name: 'logo/logo-horizontal', url: T('logo.html?kind=horizontal'), w: 2400, h: 600, crop: '#logo', transparent: true },
  { name: 'logo/logo-horizontal-dark', url: T('logo.html?kind=horizontal-dark'), w: 2400, h: 600, crop: '#logo', transparent: true },
];

// Thmanyah can't be committed (license), so it is loaded from fonts/thmanyah/ when present.
function findFonts(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? findFonts(p) : /\.(otf|ttf|woff2?)$/i.test(e.name) ? [p] : [];
  });
}
function writeLocalFontCss() {
  const css = findFonts(path.join(ROOT, 'fonts/thmanyah')).map((file) => {
    const n = path.basename(file).replace(/[-_ ]/g, '').toLowerCase();
    const family = /serifdisplay|display/.test(n) ? 'Thmanyah Serif Display' : /serif/.test(n) ? 'Thmanyah Serif Text' : 'Thmanyah Sans';
    const weight = /black|heavy/.test(n) ? 900 : /bold/.test(n) ? 700 : /medium/.test(n) ? 500 : /light/.test(n) ? 300 : 400;
    const rel = path.relative(path.join(ROOT, 'design/templates'), file).split(path.sep).join('/');
    return { family, weight, css: `@font-face { font-family: '${family}'; font-weight: ${weight}; src: url('${encodeURI(rel)}'); }` };
  });
  fs.writeFileSync(path.join(ROOT, 'design/templates/fonts.local.css'), css.map((c) => c.css).join('\n') + '\n');
  if (css.length) {
    console.log(`✓ Thmanyah: ${css.map((c) => `${c.family} ${c.weight}`).join(', ')}`);
  } else if (/thmanyah/i.test(brand.font)) {
    let installed = false;
    try { installed = /thmanyah/i.test(require('child_process').execSync('fc-list', { encoding: 'utf8' })); } catch {}
    console.warn(installed
      ? '✓ Thmanyah: using the copy installed on this computer'
      : '! Thmanyah font not found: rendering with the IBM Plex Sans Arabic fallback. See fonts/thmanyah/README.md');
  }
}

function writeLogoSvgs() {
  const dir = path.join(ROOT, 'brand/logo');
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.svg')) fs.unlinkSync(path.join(dir, f));
  fs.writeFileSync(path.join(dir, 'mark.svg'), Brand.markSVG(brand) + '\n');
  fs.writeFileSync(path.join(dir, 'mark-mono-white.svg'), Brand.markSVG(brand, { badge: false, dot: '#FFFFFF' }) + '\n');
  fs.writeFileSync(path.join(dir, 'mark-mono-dark.svg'), Brand.markSVG(brand, { badge: false, fg: brand.palette.dark, dot: brand.palette.dark }) + '\n');
  console.log('✓ brand/logo/*.svg');
}

(async () => {
  const filter = process.argv[2];
  writeLocalFontCss();
  if (!filter) writeLogoSvgs();
  const browser = await chromium.launch();
  for (const j of JOBS.filter((j) => !filter || j.name.includes(filter))) {
    const page = await browser.newPage({ viewport: { width: j.w, height: j.h }, deviceScaleFactor: 1 });
    await page.addInitScript((b) => { window.BRAND = b; }, brand);
    let url = j.url;
    if (j.safe) {
      const [sx, sy, sw, sh] = j.safe;
      url += `${url.includes('?') ? '&' : '?'}w=${j.w}&h=${j.h}&sx=${sx}&sy=${sy}&sw=${sw}&sh=${sh}`;
    }
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    const out = path.join(ROOT, j.out || path.join('exports', j.name + '.png'));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const clip = j.crop ? await page.locator(j.crop).boundingBox() : { x: 0, y: 0, width: j.w, height: j.h };
    await page.screenshot({ path: out, clip, omitBackground: !!j.transparent });
    console.log('✓', path.relative(ROOT, out), `${Math.round(clip.width)}x${Math.round(clip.height)}`);
    await page.close();
  }
  await browser.close();
})();
