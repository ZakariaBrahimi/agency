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
  ...[1, 2, 3, 4, 5, 6].map((i) => post(`week-2/02-mon-safe-carousel/slide-${i}`, `safe-${i}`)),
  post('week-2/04-wed-linkedin-gateway', 'gateway'),
  post('week-2/07-sat-save-card', 'cards'),
  { name: 'week-2/01-sun-signup-reel', url: D('reel.html?id=signup'), reel: true },
  { name: 'week-2/05-thu-partner-reel', url: D('reel.html?id=partner'), reel: true },
  ...[1, 2, 3, 4, 5, 6, 7].map((i) => post(`week-3/02-mon-home-carousel/slide-${i}`, `home-${i}`)),
  ...[1, 2, 3, 4, 5, 6, 7].map((i) => post(`week-3/05-thu-tips-carousel/slide-${i}`, `tips-${i}`)),
  { name: 'week-3/01-sun-internet-reel', url: D('reel.html?id=internet'), reel: true },
  { name: 'week-3/03-tue-shop-owner-outro', url: D('reel.html?id=outro-partner'), reel: true },
  { name: 'week-3/07-sat-request-reel', url: D('reel.html?id=request'), reel: true },
  // Hero reel: no voice-over, then one per language once design/vo/<lang>-<n>.mp3 exist (voiceover.md).
  // Instagram highlights: covers for every suggested highlight, stories for the ones that have them.
  ...['start', 'qr', 'recharge', 'bills', 'partners', 'safety', 'faq', 'offers'].map((h) => ({ name: `highlights/covers/${h}`, url: D(`stories.html?s=${h}&cover=1`), w: 1080, h: 1920 })),
  ...[1, 2, 3, 4, 5, 6].map((i) => ({ name: `highlights/start/story-${i}`, url: D(`stories.html?s=start&n=${i}`), w: 1080, h: 1920 })),
  { name: 'hero/hero-no-voiceover', url: D('hero.html?lang=dz'), reel: true },
  { name: 'hero/hero-voiceover-darija', url: D('hero.html?lang=dz&vo=1'), reel: true },
  { name: 'hero/hero-voiceover-arabic', url: D('hero.html?lang=ar&vo=1'), reel: true },
];

async function renderReel(browser, j) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-reel-'));
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto(j.url);
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.fonts].map((f) => f.load())); });
  const R = await page.evaluate(() => ({ DURATION: REEL.DURATION, CUES: REEL.CUES, MUSIC: REEL.MUSIC, VOICE: REEL.VOICE || [] }));
  // Voice-over files are listed relative to the design folder; skip the job if any is missing.
  const voice = R.VOICE.map(([at, f]) => [at, path.join(__dirname, 'design', f)]);
  const missing = voice.filter(([, f]) => !fs.existsSync(f));
  if (missing.length) {
    await page.close(); fs.rmSync(dir, { recursive: true, force: true });
    console.log('…', j.name, `skipped: missing ${missing.map(([, f]) => path.relative(__dirname, f)).join(', ')}`);
    return;
  }
  const el = await page.$('#reel');
  const n = Math.round(R.DURATION * 30);
  for (let i = 0; i < n; i++) {
    await page.evaluate((t) => REEL.render(t), i / 30);
    await el.screenshot({ path: path.join(dir, `f${String(i).padStart(4, '0')}.png`) });
  }
  await page.close();
  fs.writeFileSync(path.join(dir, 'cues.json'), JSON.stringify({ duration: R.DURATION, cues: R.CUES, music: R.MUSIC }));
  execFileSync('python3', [path.join(ROOT, 'scripts/showreel-sound.py'), path.join(dir, 'cues.json'), path.join(dir, 'sound.wav')], { stdio: 'inherit' });
  let sound = path.join(dir, 'sound.wav');
  if (voice.length) {
    // Voice lines on top; the music and effects duck under them.
    const lines = voice.map(([at], i) => `[${i + 1}:a]aresample=44100,pan=stereo|c0=c0|c1=c0,adelay=${Math.round(at * 1000)}:all=1[v${i}]`);
    const filter = [...lines,
      `${voice.map((_, i) => `[v${i}]`).join('')}amix=inputs=${voice.length}:normalize=0,volume=1.7,apad=whole_dur=${R.DURATION},asplit[vo][key]`,
      '[0:a][key]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=350[bed]',
      '[bed][vo]amix=inputs=2:normalize=0,alimiter=limit=0.79[out]'].join(';');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', sound, ...voice.flatMap(([, f]) => ['-i', f]), '-filter_complex', filter, '-map', '[out]', '-t', String(R.DURATION), path.join(dir, 'mix.wav')], { stdio: 'inherit' });
    sound = path.join(dir, 'mix.wav');
  }
  const out = path.join(OUT, j.name + '.mp4');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '30', '-i', path.join(dir, 'f%04d.png'), '-i', sound,
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
