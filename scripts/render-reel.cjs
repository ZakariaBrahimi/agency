// Renders a canvas reel page (window.SHOWREEL = { render, DURATION, CUES, MUSIC }) to an MP4 with sound.
// Usage: node scripts/render-reel.cjs design/templates/launch-reel.html exports/motion/launch-founder-vertical.mp4
// Needs playwright, ffmpeg and python3 + numpy (the soundtrack comes from scripts/showreel-sound.py).
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');

(async () => {
  const [page, out] = process.argv.slice(2);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-'));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto('file://' + path.resolve(page) + '?t=0');
  await p.waitForLoadState('networkidle');
  await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.fonts].map((f) => f.load())); });
  const R = await p.evaluate(() => ({ DURATION: SHOWREEL.DURATION, CUES: SHOWREEL.CUES, MUSIC: SHOWREEL.MUSIC }));
  fs.writeFileSync(path.join(dir, 'cues.json'), JSON.stringify({ duration: R.DURATION, cues: R.CUES, music: R.MUSIC }));
  const canvas = await p.$('canvas');
  const n = Math.round(R.DURATION * 30);
  for (let i = 0; i < n; i++) {
    await p.evaluate((t) => SHOWREEL.render(t), i / 30);
    await canvas.screenshot({ path: path.join(dir, `f${String(i).padStart(4, '0')}.png`) });
    if (i % 150 === 0) console.log(`frame ${i}/${n}`);
  }
  await b.close();
  execFileSync('python3', [path.join(__dirname, 'showreel-sound.py'), path.join(dir, 'cues.json'), path.join(dir, 'sound.wav')], { stdio: 'inherit' });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '30', '-i', path.join(dir, 'f%04d.png'), '-i', path.join(dir, 'sound.wav'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('✓', out, `${R.DURATION}s`);
})();
