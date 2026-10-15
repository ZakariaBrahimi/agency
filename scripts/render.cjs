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
  { name: 'posts/mizan-intro', url: T('product-post.html'), w: 1080, h: 1350 },
  // Logos: transparent, cropped to the artwork
  { name: 'logo/logo-mark', url: T('logo.html?kind=mark'), w: 2400, h: 600, crop: '#logo', transparent: true },
  { name: 'logo/logo-horizontal', url: T('logo.html?kind=horizontal'), w: 2400, h: 600, crop: '#logo', transparent: true },
  { name: 'logo/logo-horizontal-dark', url: T('logo.html?kind=horizontal-dark'), w: 2400, h: 600, crop: '#logo', transparent: true },
  { name: 'brand/name-options', url: T('name-options.html'), w: 1600, h: 1000 },
];

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
    const out = path.join(ROOT, 'exports', j.name + '.png');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const clip = j.crop ? await page.locator(j.crop).boundingBox() : { x: 0, y: 0, width: j.w, height: j.h };
    await page.screenshot({ path: out, clip, omitBackground: !!j.transparent });
    console.log('✓', path.relative(ROOT, out), `${Math.round(clip.width)}x${Math.round(clip.height)}`);
    await page.close();
  }
  await browser.close();
})();
