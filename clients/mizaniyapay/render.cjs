// Renders Mizaniya Pay designs into clients/mizaniyapay/exports/.
// Usage: node clients/mizaniyapay/render.cjs            -> everything
//        node clients/mizaniyapay/render.cjs shop       -> only jobs whose name contains "shop"
// Reels need ffmpeg and python3 + numpy (the soundtrack comes from scripts/showreel-sound.py).
// Set CHROMIUM_PATH to use a Chromium other than Playwright's own.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const D = (file) => 'file://' + path.join(__dirname, 'design', file);
const OUT = path.join(__dirname, 'exports');

const post = (name, id) => ({ name, url: D(`post.html?id=${id}`), w: 1080, h: 1350 });
const JOBS = [
  { name: 'logo/logo-horizontal', url: D('logo.html'), w: 2400, h: 800, crop: '#logo', transparent: true },
  { name: 'logo/logo-horizontal-dark', url: D('logo.html?kind=horizontal-dark'), w: 2400, h: 800, crop: '#logo', transparent: true },
  { name: 'logo/logo-mark', url: D('logo.html?kind=mark'), w: 1400, h: 1200, crop: '#logo', transparent: true },
  post('week-1/01-sun-1nov-tribute', 'nov1'),
  ...[1, 2, 3, 4, 5, 6].map((i) => post(`week-1/03-tue-app-carousel/slide-${i}`, `app-${i}`)),
  ...[1, 2, 3, 4, 5, 6].map((i) => post(`week-1/05-thu-shop-carousel/slide-${i}`, `shop-${i}`)),
  { name: 'week-1/02-mon-qr-reel', url: D('reel.html?id=qr'), reel: true },
  { name: 'week-1/07-sat-recharge-reel', url: D('reel.html?id=recharge'), reel: true },
  { name: 'week-1/04-wed-cafe-reel-outro', url: D('reel.html?id=outro'), reel: true },
];

async function renderReel(browser, j) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-reel-'));
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto(j.url);
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.fonts].map((f) => f.load())); });
  const R = await page.evaluate(() => ({ DURATION: REEL.DURATION, CUES: REEL.CUES, MUSIC: REEL.MUSIC }));
  const el = await page.$('#reel');
  const n = Math.round(R.DURATION * 30);
  for (let i = 0; i < n; i++) {
    await page.evaluate((t) => REEL.render(t), i / 30);
    await el.screenshot({ path: path.join(dir, `f${String(i).padStart(4, '0')}.png`) });
  }
  await page.close();
  fs.writeFileSync(path.join(dir, 'cues.json'), JSON.stringify({ duration: R.DURATION, cues: R.CUES, music: R.MUSIC }));
  execFileSync('python3', [path.join(ROOT, 'scripts/showreel-sound.py'), path.join(dir, 'cues.json'), path.join(dir, 'sound.wav')], { stdio: 'inherit' });
  const out = path.join(OUT, j.name + '.mp4');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '30', '-i', path.join(dir, 'f%04d.png'), '-i', path.join(dir, 'sound.wav'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
  // A cover frame for the feed grid, taken from the hook.
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(dir, `f${String(Math.min(n - 1, 45)).padStart(4, '0')}.png`), out.replace(/\.mp4$/, '-cover.jpg')]);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('✓', path.relative(ROOT, out), `${R.DURATION}s`);
}

(async () => {
  const filter = process.argv[2];
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const j of JOBS.filter((j) => !filter || j.name.includes(filter))) {
    if (j.reel) { await renderReel(browser, j); continue; }
    const page = await browser.newPage({ viewport: { width: j.w, height: j.h } });
    await page.goto(j.url);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    const out = path.join(OUT, j.name + '.png');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const clip = j.crop ? await page.locator(j.crop).boundingBox() : { x: 0, y: 0, width: j.w, height: j.h };
    await page.screenshot({ path: out, clip, omitBackground: !!j.transparent });
    console.log('✓', path.relative(ROOT, out));
    await page.close();
  }
  await browser.close();
})();
