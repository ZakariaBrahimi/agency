// Renders the HTML design templates to PNG at the exact size each platform wants.
// Usage: npm run render                -> renders everything in JOBS
//        npm run render -- cover        -> renders only jobs whose name contains "cover"
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const T = (file) => 'file://' + path.join(ROOT, 'design/templates', file);

// Cover safe areas keep text clear of the profile-photo overlap and mobile cropping.
const JOBS = [
  { name: 'profile/nawa-profile-indigo', url: T('profile.html'), w: 1080, h: 1080 },
  { name: 'profile/nawa-profile-ink', url: T('profile.html?variant=ink'), w: 1080, h: 1080 },
  // Facebook page cover: shown 820x312 on desktop, side-cropped on mobile
  { name: 'covers/facebook-cover', url: T('cover.html'), w: 1640, h: 624, safe: [200, 70, 1240, 484] },
  // LinkedIn company cover: logo overlaps bottom-left
  { name: 'covers/linkedin-cover', url: T('cover.html'), w: 1584, h: 396, safe: [380, 40, 1150, 316] },
  // X header: avatar overlaps bottom-left
  { name: 'covers/x-header', url: T('cover.html'), w: 1500, h: 500, safe: [300, 60, 1140, 380] },
  // YouTube banner: only the central 1546x423 is visible on every device
  { name: 'covers/youtube-banner', url: T('cover.html'), w: 2560, h: 1440, safe: [507, 508, 1546, 423] },
  { name: 'posts/mizan-intro', url: T('product-post.html'), w: 1080, h: 1350 },
  { name: 'logo/nawa-mark', url: T('logo.html?file=nawa-mark&w=1024&h=1024'), w: 1024, h: 1024, transparent: true },
  { name: 'logo/nawa-logo-horizontal', url: T('logo.html?file=nawa-logo-horizontal&w=1340&h=512'), w: 1340, h: 512, transparent: true },
  { name: 'logo/nawa-logo-horizontal-dark', url: T('logo.html?file=nawa-logo-horizontal-dark&w=1340&h=512'), w: 1340, h: 512, transparent: true },
  { name: 'brand/name-options', url: T('name-options.html'), w: 1600, h: 1000 },
];

(async () => {
  const filter = process.argv[2];
  const browser = await chromium.launch();
  for (const j of JOBS.filter((j) => !filter || j.name.includes(filter))) {
    const page = await browser.newPage({ viewport: { width: j.w, height: j.h }, deviceScaleFactor: 1 });
    let url = j.url;
    if (j.safe) {
      const [sx, sy, sw, sh] = j.safe;
      url += `${url.includes('?') ? '&' : '?'}w=${j.w}&h=${j.h}&sx=${sx}&sy=${sy}&sw=${sw}&sh=${sh}`;
    }
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForLoadState('networkidle');
    const out = path.join(ROOT, 'exports', j.name + '.png');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: j.w, height: j.h }, omitBackground: !!j.transparent });
    console.log('✓', path.relative(ROOT, out), `${j.w}x${j.h}`);
    await page.close();
  }
  await browser.close();
})();
