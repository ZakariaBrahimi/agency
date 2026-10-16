"""Writes the HyperFrames composition for the Nawa services reel.

index.html hosts eight scene sub-compositions (compositions/frames/*.html) plus two registry
primitives (toggle-flip, logo-sting). Run `python3 build.py` after editing a scene below.
"""
import json
from pathlib import Path

ROOT = Path(__file__).parent
W, H, FPS = 1080, 1920, 30
GSAP = '<script src="assets/vendor/gsap.min.js"></script>'

FONTS = """
@font-face { font-family: 'IBM Plex Sans Arabic'; font-weight: 500; src: url('assets/fonts/IBMPlexSansArabic-500-arabic.woff2') format('woff2'); unicode-range: U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC; }
@font-face { font-family: 'IBM Plex Sans Arabic'; font-weight: 500; src: url('assets/fonts/IBMPlexSansArabic-500-latin.woff2') format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215; }
@font-face { font-family: 'IBM Plex Sans Arabic'; font-weight: 700; src: url('assets/fonts/IBMPlexSansArabic-700-arabic.woff2') format('woff2'); unicode-range: U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC; }
@font-face { font-family: 'IBM Plex Sans Arabic'; font-weight: 700; src: url('assets/fonts/IBMPlexSansArabic-700-latin.woff2') format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215; }
@font-face { font-family: 'Bricolage Grotesque'; font-weight: 800; src: url('assets/fonts/BricolageGrotesque-800-latin.woff2') format('woff2'); }
@font-face { font-family: 'JetBrains Mono'; font-weight: 600; src: url('assets/fonts/JetBrainsMono-600-latin.woff2') format('woff2'); }
"""

# Shared tokens + the pieces every service scene uses (chip + headline). Each scene prefixes its own classes.
BASE = """
.sc { position: absolute; inset: 0; direction: rtl; color: #F1F2F6; font-family: 'IBM Plex Sans Arabic', sans-serif; font-weight: 500; }
.sc .in { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; padding: 250px 90px 0; gap: 34px; box-sizing: border-box; }
.sc .chip { display: flex; align-items: center; gap: 16px; padding: 14px 30px; border-radius: 999px; border: 3px solid #2A3553; background: #151D31; font-size: 34px; color: #A3ABC2; }
.sc .chip b { font-family: 'JetBrains Mono', monospace; font-weight: 600; font-size: 28px; letter-spacing: 3px; color: #C6F432; direction: ltr; }
.sc .hl { margin: 0; text-align: center; font-weight: 700; font-size: 108px; line-height: 1.22; }
.sc .hl .w { display: inline-block; }
.sc .lime { color: #C6F432; }
.sc .mono { font-family: 'JetBrains Mono', monospace; font-weight: 600; letter-spacing: 3px; direction: ltr; color: #A3ABC2; }
.sc .card { background: #151D31; border: 3px solid #2A3553; border-radius: 40px; box-shadow: 0 40px 90px rgba(3,6,15,.55); }
.sc .num { font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800; direction: ltr; font-variant-numeric: tabular-nums; }
"""

# Shared JS: chip + headline entrance and a scene exit, so every scene enters the same way but each
# body choreography is its own.
JS_HELPERS = """
function enter(tl, sel, at) {
  tl.fromTo(sel + ' .chip', { opacity: 0, y: -40, scale: 0.85 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'back.out(2)' }, at);
  tl.fromTo(sel + ' .hl .w', { opacity: 0, y: 70, scale: 0.8 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'expo.out', stagger: 0.08 }, at + 0.08);
}
function exit(tl, sel, at) {
  tl.fromTo(sel + ' .in', { opacity: 1, scale: 1 }, { opacity: 0, scale: 1.06, duration: 0.3, ease: 'power2.in' }, at);
}
"""


def words(text):
    """'نطوّر لك *المنتج*' -> spans; *x* is the lime word."""
    out = []
    for w in text.split(' '):
        lime = w.startswith('*')
        w = w.strip('*')
        out.append(f'<span class="w{" lime" if lime else ""}">{w}</span>')
    return ' '.join(out)


def scene_file(cid, dur, css, body, js, extra_head=''):
    return f"""<!doctype html>
<html lang="ar">
  <head><meta charset="UTF-8" /><title>{cid}</title></head>
  <body>
    <template>
      <div id="{cid}" data-composition-id="{cid}" data-duration="{dur}" data-fps="{FPS}">
        <style>{FONTS}{BASE}{css}</style>
        <div id="{cid}-scene" class="clip sc {cid}" data-start="0" data-duration="{dur}" data-track-index="0">
          <div class="in">{body}</div>
        </div>
        {GSAP}{extra_head}
        <script>
          (function () {{
            {JS_HELPERS}
            const tl = gsap.timeline({{ paused: true }});
            const S = '.{cid}';
            {js}
            window.__timelines["{cid}"] = tl;
          }})();
        </script>
      </div>
    </template>
  </body>
</html>
"""


def chip(n, en, ar):
    return f'<div class="chip"><b>{n:02d} · {en}</b><span>{ar}</span></div>'


SC = {}

# ---- 0 · Hook (kinetic-type-beats + kinetic-beat-slam)
SC['s0-hook'] = (2.8, """
.s0-hook .in { justify-content: center; padding: 0 80px 120px; gap: 60px; }
.s0-hook .line { font-weight: 700; font-size: 150px; line-height: 1.15; text-align: center; margin: 0; }
.s0-hook .line + .line { font-size: 118px; margin-top: -30px; }
.s0-hook .w { display: inline-block; }
.s0-hook .cta { position: relative; display: grid; place-items: center; width: 480px; height: 140px; }
.s0-hook .pill { width: 480px; height: 140px; border-radius: 999px; background: #C6F432; color: #0B1220; font-weight: 700; font-size: 58px; display: grid; place-items: center; }
.s0-hook .ring { position: absolute; width: 480px; height: 140px; border-radius: 999px; border: 6px solid #C6F432; opacity: 0; }
.s0-hook .tag { font-size: 28px; }
""", f"""
<p class="line">{words('عندك *فكرة؟*')}</p>
<p class="line">{words('نحوّلها لمنتج *ينمو.*')}</p>
<div class="cta"><div class="ring"></div><div class="pill">ابدأ معنا</div></div>
<div class="mono tag">NAWA STUDIO</div>
""", """
const beats = [0.12, 0.36, 0.78, 0.98, 1.2];
document.querySelectorAll(S + ' .w').forEach((w, i) => {
  tl.fromTo(w, { opacity: 0, scale: 1.7, y: -30 }, { opacity: 1, scale: 1, y: 0, duration: 0.32, ease: 'expo.out' }, beats[i]);
});
tl.fromTo(S + ' .pill', { opacity: 0, scale: 0.55 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2.2)' }, 1.55);
tl.fromTo(S + ' .tag', { opacity: 0 }, { opacity: 1, duration: 0.4 }, 1.7);
tl.fromTo(S + ' .pill', { scale: 1 }, { scale: 0.9, duration: 0.08, ease: 'power2.in', immediateRender: false }, 2.02);
tl.fromTo(S + ' .pill', { scale: 0.9 }, { scale: 1, duration: 0.35, ease: 'back.out(3)', immediateRender: false }, 2.1);
tl.fromTo(S + ' .ring', { opacity: 0.9, scale: 1 }, { opacity: 0, scale: 1.8, duration: 0.5, ease: 'power2.out' }, 2.08);
tl.fromTo(S + ' .in', { opacity: 1, y: 0 }, { opacity: 0, y: -80, duration: 0.28, ease: 'power2.in' }, 2.52);
""")

# ---- 1 · Build (device-surface-showcase + stat-bars-and-fills, registry success-check)
CHECK_CSS = """
.hf-transition-success-check { display: grid; place-items: center; width: 96px; height: 96px; border-radius: 999px; background: #DCFCE7; color: #16A34A; flex: none; }
.hf-transition-success-check svg { width: 74px; height: 74px; fill: none; stroke: currentColor; stroke-width: 5; stroke-linecap: round; stroke-linejoin: round;
  filter: blur(var(--hf-check-blur, 0px)); transform: rotate(var(--hf-check-rotate, 0deg)) scale(var(--hf-check-scale, 1)); }
.hf-transition-success-check circle { opacity: 0.28; }
.hf-transition-success-check path { stroke-dasharray: 36; stroke-dashoffset: var(--hf-check-dash, 0); }
"""
SC['s1-build'] = (3.6, CHECK_CSS + """
.s1-build .win { width: 900px; height: 620px; overflow: hidden; display: flex; flex-direction: column; }
.s1-build .bar { height: 80px; display: flex; align-items: center; gap: 14px; padding: 0 34px; border-bottom: 3px solid #2A3553; direction: ltr; }
.s1-build .dot { width: 22px; height: 22px; border-radius: 50%; }
.s1-build .url { margin-left: auto; font-size: 26px; }
.s1-build .body { flex: 1; display: flex; direction: ltr; }
.s1-build .side { width: 190px; border-right: 3px solid #2A3553; padding: 34px 26px; display: flex; flex-direction: column; gap: 22px; }
.s1-build .side i { display: block; height: 44px; border-radius: 14px; background: #1D2741; }
.s1-build .side i:first-child { background: #5B4BFF; }
.s1-build .main { flex: 1; padding: 44px 40px; display: flex; flex-direction: column; gap: 28px; }
.s1-build .ln { display: block; height: 28px; border-radius: 14px; transform-origin: left center; }
.s1-build .prog { margin-top: auto; display: flex; flex-direction: column; gap: 16px; }
.s1-build .prog-top { display: flex; justify-content: space-between; font-size: 34px; color: #A3ABC2; }
.s1-build .prog-top span:first-child { direction: rtl; font-family: 'IBM Plex Sans Arabic', sans-serif; font-weight: 500; }
.s1-build .track { height: 26px; border-radius: 13px; background: #1D2741; overflow: hidden; }
.s1-build .fill { display: block; width: 100%; height: 100%; background: #C6F432; transform-origin: left center; }
.s1-build .toast { display: flex; align-items: center; gap: 28px; padding: 22px 40px 22px 26px; border-radius: 999px; background: #10261F; border: 3px solid #1E5C46; margin-top: -10px; }
.s1-build .toast b { font-size: 48px; font-weight: 700; }
.s1-build .toast .mono { font-size: 28px; }
""", f"""
{chip(1, 'BUILD', 'نطوّر المنتج')}
<h1 class="hl">{words('نطوّر لك *المنتج*')}</h1>
<div class="card win">
  <div class="bar"><i class="dot" style="background:#FF6B6B"></i><i class="dot" style="background:#FFD166"></i><i class="dot" style="background:#3DDC97"></i><span class="mono url">your-product.app</span></div>
  <div class="body">
    <div class="side"><i></i><i></i><i></i><i></i></div>
    <div class="main">
      <span class="ln" style="width:78%;background:#8A7DFF"></span>
      <span class="ln" style="width:52%;background:#C6F432"></span>
      <span class="ln" style="width:90%;background:#4A5578"></span>
      <span class="ln" style="width:40%;background:#8A7DFF"></span>
      <span class="ln" style="width:66%;background:#4A5578"></span>
      <div class="prog"><div class="prog-top"><span>جاري البناء</span><span class="num s1-pct">0%</span></div><div class="track"><span class="fill"></span></div></div>
    </div>
  </div>
</div>
<div class="toast"><div class="hf-transition-success-check" aria-label="Success"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="27" /><path d="M20 33.5l8 8L45 23" /></svg></div><b>تم الإطلاق</b><span class="mono">v1.0</span></div>
""", """
enter(tl, S, 0.05);
tl.fromTo(S + ' .win', { opacity: 0, y: 240, rotationX: 18, transformPerspective: 1400 }, { opacity: 1, y: 0, rotationX: 0, duration: 0.7, ease: 'expo.out' }, 0.35);
tl.fromTo(S + ' .ln', { scaleX: 0 }, { scaleX: 1, duration: 0.3, ease: 'power3.out', stagger: 0.1 }, 0.7);
tl.fromTo(S + ' .fill', { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: 'power2.inOut' }, 1.0);
const pct = document.querySelector(S + ' .s1-pct'); const p = { v: 0 };
tl.fromTo(p, { v: 0 }, { v: 100, duration: 1.2, ease: 'power2.inOut', onUpdate: () => { pct.textContent = Math.round(p.v) + '%'; } }, 1.0);
tl.fromTo(S + ' .toast', { opacity: 0, y: 60, scale: 0.8 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(2)' }, 2.25);
// registry success-check timeline integration
tl.fromTo(S + ' .hf-transition-success-check svg', { opacity: 0, '--hf-check-scale': 0.72, '--hf-check-rotate': '-18deg', '--hf-check-blur': '7px' }, { opacity: 1, '--hf-check-scale': 1, '--hf-check-rotate': '0deg', '--hf-check-blur': '0px', duration: 0.34, ease: 'back.out(1.8)' }, 2.35);
tl.fromTo(S + ' .hf-transition-success-check path', { '--hf-check-dash': 36 }, { '--hf-check-dash': 0, duration: 0.42, ease: 'power2.out' }, 2.47);
exit(tl, S, 3.3);
""")

# ---- 2 · Identity (logo-assemble-lockup + grid-card-assemble)
SWATCHES = [('#0B1220', '#0B1220'), ('#5B4BFF', '#5B4BFF'), ('#C6F432', '#C6F432'), ('#F6F5F2', '#F6F5F2')]
SC['s2-identity'] = (3.6, """
.s2-identity .sw { display: flex; gap: 34px; direction: ltr; margin-top: 10px; }
.s2-identity .s { display: flex; flex-direction: column; align-items: center; gap: 16px; }
.s2-identity .s i { display: block; width: 184px; height: 184px; border-radius: 50%; border: 4px solid #3A4566; }
.s2-identity .s span { font-size: 26px; }
.s2-identity .row { display: flex; gap: 30px; direction: ltr; }
.s2-identity .logo { width: 420px; height: 440px; border-radius: 48px; background: #5B4BFF; display: grid; place-items: center; }
.s2-identity .logo svg { width: 300px; height: 300px; overflow: visible; }
.s2-identity .type { width: 420px; height: 440px; border-radius: 48px; background: #F6F5F2; color: #0B1220; padding: 44px; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; }
.s2-identity .type .ar { font-size: 150px; font-weight: 700; line-height: 1; text-align: right; direction: rtl; }
.s2-identity .type .num { font-size: 104px; line-height: 1; }
.s2-identity .type small { font-size: 26px; color: #4B5368; font-family: 'JetBrains Mono', monospace; font-weight: 600; letter-spacing: 2px; }
""", f"""
{chip(2, 'BRAND', 'الهوية البصرية')}
<h1 class="hl">{words('نصنع لك *هوية* وحضورًا')}</h1>
<div class="sw">{''.join(f'<div class="s"><i style="background:{c}"></i><span class="mono">{h}</span></div>' for c, h in SWATCHES)}</div>
<div class="row">
  <div class="logo"><svg viewBox="72 72 368 368"><path class="bowl" d="M366 236 A110 110 0 0 1 146 236" fill="none" stroke="#FFFFFF" stroke-width="62" stroke-linecap="round" pathLength="1000" stroke-dasharray="1000" stroke-dashoffset="1000" /><circle class="dot" cx="256" cy="148" r="40" fill="#C6F432" /></svg></div>
  <div class="type"><div class="ar">أب</div><div class="num">Aa</div><small>PLEX ARABIC · BRICOLAGE</small></div>
</div>
""", """
enter(tl, S, 0.05);
tl.fromTo(S + ' .s', { opacity: 0, y: -220, scale: 0.6 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'back.out(1.8)', stagger: 0.12 }, 0.4);
tl.fromTo(S + ' .logo', { opacity: 0, y: 200 }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out' }, 0.9);
tl.fromTo(S + ' .bowl', { strokeDashoffset: 1000, opacity: 0 }, { strokeDashoffset: 0, opacity: 1, duration: 0.7, ease: 'power2.inOut' }, 1.2);
tl.fromTo(S + ' .dot', { scale: 0, transformOrigin: '256px 148px' }, { scale: 1, duration: 0.45, ease: 'back.out(3)' }, 1.9);
tl.fromTo(S + ' .type', { opacity: 0, rotationY: -85, transformPerspective: 1400 }, { opacity: 1, rotationY: 0, duration: 0.65, ease: 'back.out(1.6)' }, 2.1);
exit(tl, S, 3.3);
""")

# ---- 3 · Social (grid-card-assemble + counting-dynamic-scale)
HEART = '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.5 3 5 6.5 5c2 0 3.5 1.2 5.5 3.3C14 6.2 15.5 5 17.5 5 21 5 23.1 8.5 21.6 11.8 19.5 16.4 12 21 12 21z"/></svg>'
SC['s3-social'] = (3.6, """
.s3-social .stage { position: relative; width: 900px; height: 600px; margin-top: 20px; }
.s3-social .post { position: absolute; left: 260px; top: 20px; width: 380px; height: 520px; padding: 24px; box-sizing: border-box; display: flex; flex-direction: column; gap: 22px; }
.s3-social .post .img { height: 330px; border-radius: 26px; display: grid; place-items: center; font-size: 84px; font-weight: 700; color: #FFFFFF; }
.s3-social .post i { display: block; height: 24px; border-radius: 12px; background: #2A3553; }
.s3-social .heart { position: absolute; width: 90px; height: 90px; }
.s3-social .heart svg { width: 100%; height: 100%; fill: #FF4D6D; }
.s3-social .likes { display: flex; align-items: center; gap: 22px; padding: 22px 48px; border-radius: 999px; }
.s3-social .likes svg { width: 60px; height: 60px; fill: #FF4D6D; }
.s3-social .likes .num { font-size: 70px; display: inline-block; }
.s3-social .likes span:last-child { font-size: 40px; color: #A3ABC2; }
.s3-social .note { font-size: 24px; margin-top: -10px; }
""", f"""
{chip(3, 'CONTENT', 'تصاميم السوشل')}
<h1 class="hl">{words('نصمّم محتوى *يوقف* *التمرير*')}</h1>
<div class="stage" data-layout-allow-overlap data-layout-allow-occlusion>
  <div class="card post p0"><div class="img" style="background:#E8674D">٪</div><i style="width:80%"></i><i style="width:50%"></i></div>
  <div class="card post p1"><div class="img" style="background:#1E9E6A">✦</div><i style="width:70%"></i><i style="width:45%"></i></div>
  <div class="card post p2"><div class="img" style="background:#5B4BFF">نواة</div><i style="width:85%"></i><i style="width:60%"></i></div>
  <div class="heart h0" style="left:640px;top:430px">{HEART}</div><div class="heart h1" style="left:740px;top:470px">{HEART}</div><div class="heart h2" style="left:560px;top:480px">{HEART}</div>
</div>
<div class="card likes">{HEART}<span class="num s3-count">0</span><span>إعجاب</span></div>
<div class="mono note">أرقام توضيحية · ILLUSTRATIVE</div>
""", """
enter(tl, S, 0.05);
[[-16, -270], [0, 0], [16, 270]].forEach(([r, x], i) => {
  tl.fromTo(S + ' .p' + i, { opacity: 0, y: 280, rotation: 0, x: 0, scale: 0.85 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'expo.out' }, 0.4 + i * 0.08);
  tl.fromTo(S + ' .p' + i, { rotation: 0, x: 0, y: 0 }, { rotation: r, x: x, y: Math.abs(r) * 3, duration: 0.6, ease: 'back.out(1.7)', immediateRender: false }, 0.95);
});
tl.fromTo(S + ' .likes', { opacity: 0, scale: 0.6, y: 60 }, { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: 'back.out(2)' }, 1.15);
tl.fromTo(S + ' .note', { opacity: 0 }, { opacity: 1, duration: 0.4 }, 1.4);
const el = document.querySelector(S + ' .s3-count'); const c = { v: 0 };
tl.fromTo(c, { v: 0 }, { v: 2480, duration: 1.4, ease: 'power3.out', onUpdate: () => { el.textContent = Math.round(c.v).toLocaleString('en-US'); } }, 1.3);
tl.fromTo(S + ' .likes .num', { scale: 1 }, { scale: 1.22, duration: 1.2, ease: 'power2.in' }, 1.3);
tl.fromTo(S + ' .likes .num', { scale: 1.22 }, { scale: 1, duration: 0.4, ease: 'back.out(3)', immediateRender: false }, 2.5);
[0, 1, 2].forEach((i) => {
  tl.fromTo(S + ' .h' + i, { opacity: 0, scale: 0.2, y: 0 }, { opacity: 1, scale: 1.1, y: -40, duration: 0.35, ease: 'back.out(2)' }, 1.4 + i * 0.22);
  tl.fromTo(S + ' .h' + i, { opacity: 1, y: -40 }, { opacity: 0, y: -460, x: i % 2 ? 50 : -50, duration: 1.0, ease: 'power2.in', immediateRender: false }, 1.8 + i * 0.22);
});
exit(tl, S, 3.3);
""")

# ---- 4 · Ads (panel-edit-live-sync; the campaign switch is the registry toggle-flip, mounted by the host
# into the slot at the coordinates below)
TOGGLE_SLOT = dict(left=170, top=709, width=280, height=150)
SC['s4-ads'] = (3.6, """
.s4-ads .panel { width: 900px; padding: 44px 50px; box-sizing: border-box; display: flex; flex-direction: column; gap: 40px; }
.s4-ads .ph { display: flex; justify-content: space-between; align-items: center; }
.s4-ads .ph b { font-size: 46px; font-weight: 700; }
.s4-ads .badge { padding: 10px 26px; border-radius: 999px; background: #10261F; border: 3px solid #1E5C46; color: #3DDC97; font-size: 30px; font-weight: 700; }
.s4-ads .run { height: 150px; display: flex; align-items: center; justify-content: space-between; padding: 0 30px; border-radius: 30px; background: #1D2741; }
.s4-ads .run .t { display: flex; flex-direction: column; gap: 4px; }
.s4-ads .run .t b { font-size: 42px; font-weight: 700; }
.s4-ads .run .t span { font-size: 26px; }
.s4-ads .slot { width: 280px; height: 150px; }
.s4-ads .bud { display: flex; flex-direction: column; gap: 22px; }
.s4-ads .bud .top { display: flex; justify-content: space-between; font-size: 36px; color: #A3ABC2; }
.s4-ads .bud .top b { color: #F1F2F6; }
.s4-ads .rail { position: relative; height: 22px; border-radius: 11px; background: #1D2741; direction: ltr; }
.s4-ads .rail .fl { position: absolute; inset: 0; border-radius: 11px; background: #C6F432; transform-origin: left center; }
.s4-ads .rail .kn { position: absolute; top: -18px; left: -29px; width: 58px; height: 58px; border-radius: 50%; background: #FFFFFF; box-shadow: 0 6px 20px rgba(0,0,0,.4); }
.s4-ads .reach { display: flex; justify-content: space-between; align-items: center; border-top: 3px solid #2A3553; padding-top: 34px; }
.s4-ads .reach span { font-size: 36px; color: #A3ABC2; }
.s4-ads .reach .num { font-size: 92px; color: #C6F432; }
.s4-ads .note { font-size: 24px; }
""", f"""
{chip(4, 'ADS', 'الإعلانات')}
<h1 class="hl">{words('نروّج لها *بالإعلانات*')}</h1>
<div class="card panel">
  <div class="ph"><b>مدير الحملات</b><span class="badge">الحملة نشطة</span></div>
  <div class="run"><div class="t"><b>تشغيل الحملة</b><span class="mono">META · TIKTOK</span></div><div class="slot"></div></div>
  <div class="bud"><div class="top"><span>الميزانية اليومية</span><span><b class="num s4-bud">0</b> دج</span></div><div class="rail"><i class="fl"></i><i class="kn"></i></div></div>
  <div class="reach"><span>الوصول المتوقع</span><b class="num s4-reach">0</b></div>
</div>
<div class="mono note">أرقام توضيحية · ILLUSTRATIVE</div>
""", """
enter(tl, S, 0.05);
tl.fromTo(S + ' .panel', { opacity: 0, y: 260 }, { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out' }, 0.3);
tl.fromTo(S + ' .badge', { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(3)' }, 1.15);
const K = 760; // rail travel in px (rail width 800 minus knob overshoot)
tl.fromTo(S + ' .fl', { scaleX: 0.001 }, { scaleX: 0.72, duration: 0.85, ease: 'power2.inOut' }, 1.55);
tl.fromTo(S + ' .kn', { x: 0 }, { x: K * 0.72, duration: 0.85, ease: 'power2.inOut' }, 1.55);
const b = document.querySelector(S + ' .s4-bud'), r = document.querySelector(S + ' .s4-reach'); const v = { b: 0, r: 0 };
tl.fromTo(v, { b: 0 }, { b: 5000, duration: 0.85, ease: 'power2.inOut', onUpdate: () => { b.textContent = Math.round(v.b).toLocaleString('en-US'); } }, 1.55);
tl.fromTo(v, { r: 0 }, { r: 184300, duration: 1.3, ease: 'power3.out', onUpdate: () => { r.textContent = Math.round(v.r).toLocaleString('en-US'); } }, 1.6);
tl.fromTo(S + ' .note', { opacity: 0 }, { opacity: 1, duration: 0.4 }, 1.6);
exit(tl, S, 3.3);
""")

# ---- 5 · Results (dataviz-countup + registry animated-bar-chart, restyled to the brand)
SC['s5-results'] = (3.6, """
.hf-catalog-animated-bar-chart { width: 900px; border-radius: 40px; background: #151D31; border: 3px solid #2A3553; padding: 44px; box-sizing: border-box; display: grid; gap: 26px; color: #F1F2F6; direction: ltr; box-shadow: 0 40px 90px rgba(3,6,15,.55); }
.hf-catalog-animated-bar-chart header { display: flex; justify-content: space-between; align-items: center; }
.hf-catalog-animated-bar-chart h3 { margin: 0; font-size: 42px; font-weight: 700; font-family: 'IBM Plex Sans Arabic', sans-serif; direction: rtl; }
.hf-catalog-animated-bar-chart strong { font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800; font-size: 64px; color: #C6F432; }
.hf-catalog-animated-bar-chart .plot { position: relative; height: 380px; }
.hf-catalog-animated-bar-chart .bars { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(7, 1fr); align-items: end; gap: 18px; }
.hf-catalog-animated-bar-chart .bar { display: block; height: calc(var(--h) * var(--hf-grow, 1)); border-radius: 16px 16px 6px 6px; background: #2A3553; }
.hf-catalog-animated-bar-chart .bar:nth-child(4) { background: #3A2DD6; }
.hf-catalog-animated-bar-chart .bar:nth-child(5) { background: #5B4BFF; }
.hf-catalog-animated-bar-chart .bar:nth-child(6) { background: #8A7DFF; }
.hf-catalog-animated-bar-chart .bar:nth-child(7) { background: #C6F432; }
.hf-catalog-animated-bar-chart svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.hf-catalog-animated-bar-chart path { color: #FFFFFF; stroke-dasharray: 900; stroke-dashoffset: var(--hf-dash, 0); }
.s5-results .kpis { display: flex; gap: 30px; width: 900px; }
.s5-results .kpi { flex: 1; padding: 34px 38px; display: flex; flex-direction: column; gap: 12px; }
.s5-results .kpi span { font-size: 34px; color: #A3ABC2; }
.s5-results .kpi .num { font-size: 96px; text-align: right; }
.s5-results .kpi.up .num { color: #C6F432; }
.s5-results .note { font-size: 24px; }
""", f"""
{chip(5, 'DATA', 'دراسة النتائج')}
<h1 class="hl">{words('ندرس *النتائج* بالأرقام')}</h1>
<div class="hf-catalog-animated-bar-chart">
  <header><strong>+32%</strong><h3>المبيعات الشهرية</h3></header>
  <div class="plot">
    <div class="bars"><span class="bar" style="--h:30%"></span><span class="bar" style="--h:42%"></span><span class="bar" style="--h:38%"></span><span class="bar" style="--h:55%"></span><span class="bar" style="--h:64%"></span><span class="bar" style="--h:78%"></span><span class="bar" style="--h:96%"></span></div>
    <svg viewBox="0 0 812 380" preserveAspectRatio="none"><path d="M40 300 C140 250, 200 280, 290 240 S440 200, 520 150 S660 90, 770 24" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" /></svg>
  </div>
</div>
<div class="kpis"><div class="card kpi up"><span>المبيعات</span><b class="num s5-a">+0%</b></div><div class="card kpi"><span>تكلفة العميل</span><b class="num s5-b">-0%</b></div></div>
<div class="mono note">أرقام توضيحية · ILLUSTRATIVE</div>
""", """
enter(tl, S, 0.05);
tl.fromTo(S + ' .hf-catalog-animated-bar-chart', { opacity: 0, y: 240 }, { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out' }, 0.3);
// registry animated-bar-chart timeline integration
tl.fromTo(S + ' .hf-catalog-animated-bar-chart', { '--hf-grow': 0, '--hf-dash': 900 }, { '--hf-grow': 1, '--hf-dash': 0, duration: 1.2, ease: 'power3.out' }, 0.7);
tl.fromTo(S + ' .kpi', { opacity: 0, y: 100, scale: 0.85 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(2)', stagger: 0.15 }, 1.6);
const a = document.querySelector(S + ' .s5-a'), bb = document.querySelector(S + ' .s5-b'); const k = { a: 0, b: 0 };
tl.fromTo(k, { a: 0 }, { a: 32, duration: 0.9, ease: 'power3.out', onUpdate: () => { a.textContent = '+' + Math.round(k.a) + '%'; } }, 1.65);
tl.fromTo(k, { b: 0 }, { b: 18, duration: 0.9, ease: 'power3.out', onUpdate: () => { bb.textContent = '-' + Math.round(k.b) + '%'; } }, 1.8);
tl.fromTo(S + ' .note', { opacity: 0 }, { opacity: 1, duration: 0.4 }, 1.9);
exit(tl, S, 3.3);
""")

# ---- 6 · Cycle (constellation-hub: held hub, satellites, lime arc)
RING = ['نطوّر', 'هوية', 'محتوى', 'إعلانات', 'نتائج', 'تحسين']
import math
nodes = ''
for i, w in enumerate(RING):
    a = math.radians(-90 + i * 60)
    x, y = 350 + 300 * math.cos(a), 350 + 300 * math.sin(a)
    nodes += f'<div class="node n{i}" style="left:{x - 115:.0f}px;top:{y - 42:.0f}px">{w}</div>'
SC['s6-cycle'] = (2.6, """
.s6-cycle .hub { position: relative; width: 700px; height: 700px; margin-top: 40px; }
.s6-cycle .hub svg.r { position: absolute; inset: 0; width: 700px; height: 700px; }
.s6-cycle .core { position: absolute; left: 250px; top: 250px; width: 200px; height: 200px; border-radius: 56px; background: #5B4BFF; display: grid; place-items: center; }
.s6-cycle .core svg { width: 140px; height: 140px; }
.s6-cycle .node { position: absolute; width: 230px; height: 84px; border-radius: 999px; background: #151D31; border: 4px solid #2A3553; display: grid; place-items: center; font-size: 38px; font-weight: 700; box-sizing: border-box; }
""", f"""
{chip(6, 'GROW', 'التطوير المستمر')}
<h1 class="hl">{words('ونطوّر.. ثم نعيد *الدورة*')}</h1>
<div class="hub">
  <svg class="r" viewBox="0 0 700 700"><circle cx="350" cy="350" r="300" fill="none" stroke="#2A3553" stroke-width="10" /><circle class="arc" cx="350" cy="350" r="300" fill="none" stroke="#C6F432" stroke-width="12" stroke-linecap="round" pathLength="1000" stroke-dasharray="170 830" transform="rotate(-90 350 350)" /></svg>
  <div class="core"><svg viewBox="72 72 368 368"><path d="M146 236 A110 110 0 0 0 366 236" fill="none" stroke="#FFFFFF" stroke-width="62" stroke-linecap="round" /><circle cx="256" cy="148" r="40" fill="#C6F432" /></svg></div>
  {nodes}
</div>
""", """
enter(tl, S, 0.05);
tl.fromTo(S + ' svg.r', { opacity: 0, scale: 0.5, rotation: -90 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.7, ease: 'back.out(1.5)' }, 0.2);
tl.fromTo(S + ' .core', { opacity: 0, scale: 0.2 }, { opacity: 1, scale: 1, duration: 0.55, ease: 'back.out(2.5)' }, 0.35);
tl.fromTo(S + ' .node', { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2.4)', stagger: 0.07 }, 0.45);
tl.fromTo(S + ' .arc', { strokeDashoffset: 0 }, { strokeDashoffset: -1500, duration: 1.7, ease: 'power1.inOut' }, 0.6);
for (let i = 0; i < 6; i++) {
  const at = 0.75 + i * 0.27;
  tl.fromTo(S + ' .n' + i, { borderColor: '#2A3553', color: '#F1F2F6' }, { borderColor: '#C6F432', color: '#C6F432', duration: 0.12, immediateRender: false }, at);
  tl.fromTo(S + ' .n' + i, { borderColor: '#C6F432', color: '#C6F432' }, { borderColor: '#2A3553', color: '#F1F2F6', duration: 0.3, immediateRender: false }, at + 0.3);
}
exit(tl, S, 2.3);
""")

# ---- 8 · End card (cta-morph-press)
SC['s8-end'] = (3.4, """
.s8-end .in { justify-content: center; padding: 0 80px 160px; gap: 30px; }
.s8-end .mk { width: 360px; height: 360px; border-radius: 90px; background: #5B4BFF; display: grid; place-items: center; }
.s8-end .mk svg { width: 250px; height: 250px; overflow: visible; }
.s8-end .word { font-size: 190px; font-weight: 700; line-height: 1.05; margin: 10px 0 0; }
.s8-end .latin { font-size: 36px; color: #C6F432; letter-spacing: 14px; }
.s8-end .tag { font-size: 52px; text-align: center; margin: 10px 0 30px; }
.s8-end .cta { width: 540px; height: 140px; border-radius: 999px; background: #C6F432; color: #0B1220; font-size: 56px; font-weight: 700; display: grid; place-items: center; }
.s8-end .bio { font-size: 30px; }
""", f"""
<div class="mk"><svg viewBox="72 72 368 368"><path d="M146 236 A110 110 0 0 0 366 236" fill="none" stroke="#FFFFFF" stroke-width="62" stroke-linecap="round" /><circle class="cdot" cx="256" cy="148" r="40" fill="#C6F432" /></svg></div>
<p class="word">نواة</p>
<div class="mono latin">NAWA STUDIO</div>
<p class="tag">نطلق <span class="lime">المنتجات الرقمية.</span> ونروي <span class="lime">القصص.</span></p>
<div class="cta">ابدأ مشروعك</div>
<div class="mono bio">LINK IN BIO · الرابط في البايو</div>
""", """
tl.fromTo(S + ' .mk', { opacity: 0, y: -700, scaleY: 1 }, { opacity: 1, y: 0, duration: 0.42, ease: 'power3.in' }, 0.05);
tl.fromTo(S + ' .mk', { scaleY: 0.82, scaleX: 1.12 }, { scaleY: 1, scaleX: 1, duration: 0.5, ease: 'back.out(3)', immediateRender: false }, 0.47);
tl.fromTo(S + ' .cdot', { scale: 1, transformOrigin: '256px 148px' }, { scale: 1.35, duration: 0.12, immediateRender: false }, 0.6);
tl.fromTo(S + ' .cdot', { scale: 1.35, transformOrigin: '256px 148px' }, { scale: 1, duration: 0.45, ease: 'back.out(3)', immediateRender: false }, 0.72);
tl.fromTo(S + ' .word', { opacity: 0, y: 100 }, { opacity: 1, y: 0, duration: 0.55, ease: 'expo.out' }, 0.75);
tl.fromTo(S + ' .latin', { opacity: 0, scale: 1.3 }, { opacity: 1, scale: 1, duration: 0.7, ease: 'power3.out' }, 0.9);
tl.fromTo(S + ' .tag', { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 1.05);
tl.fromTo(S + ' .cta', { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.55, ease: 'back.out(2.2)' }, 1.35);
tl.fromTo(S + ' .cta', { scale: 1 }, { scale: 0.9, duration: 0.08, ease: 'power2.in', immediateRender: false }, 2.15);
tl.fromTo(S + ' .cta', { scale: 0.9 }, { scale: 1, duration: 0.35, ease: 'back.out(3)', immediateRender: false }, 2.23);
tl.fromTo(S + ' .bio', { opacity: 0 }, { opacity: 1, duration: 0.4 }, 2.4);
""")

# ---------- host ----------
TIMES = [('s0-hook', 0.0), ('s1-build', 2.8), ('s2-identity', 6.4), ('s3-social', 10.0), ('s4-ads', 13.6),
         ('s5-results', 17.2), ('s6-cycle', 20.8), ('s8-end', 25.6)]
STING = (23.4, 2.2)
TOGGLE = (14.15, 17.2 - 14.15)
TOTAL = 29.0


def host():
    mounts = ''
    for i, (cid, start) in enumerate(TIMES):
        dur = SC[cid][0]
        mounts += f'\n      <div id="scene-{cid}" data-composition-id="{cid}" data-composition-src="compositions/frames/{cid}.html" data-start="{start}" data-duration="{dur}" data-track-index="{i + 2}" data-width="{W}" data-height="{H}" style="position:absolute;inset:0;z-index:5"></div>'
    s = TOGGLE_SLOT
    return f"""<!doctype html>
<html lang="ar">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <title>Nawa · Services reel</title>
    {GSAP}
    <style>
      {FONTS}
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ background: #0B1220; overflow: hidden; }}
      #root {{ position: relative; width: 100%; height: 100%; overflow: hidden; background: #0B1220; }}
      .toggle-slot {{ position: absolute; left: {s['left']}px; top: {s['top']}px; width: {s['width']}px; height: {s['height']}px; z-index: 8;
        --bg: #1D2741; --surface: #DDE2EE; --border: #8892AD; --brand: #C6F432; --accent: #C6F432; --muted: #A3ABC2; }}
      .sting-slot {{ position: absolute; inset: 0; z-index: 9; --bg: #0B1220; --fg: #F1F2F6; --font-display: 'Bricolage Grotesque', sans-serif; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{TOTAL}" data-width="{W}" data-height="{H}">
      <div id="background" data-composition-id="bg" data-composition-src="compositions/frames/bg.html" data-start="0" data-duration="{TOTAL}" data-track-index="0" data-width="{W}" data-height="{H}" style="position:absolute;inset:0;z-index:1"></div>{mounts}
      <div id="campaign-toggle" class="toggle-slot" data-composition-id="toggle-flip" data-composition-src="compositions/components/toggle-flip.html" data-start="{TOGGLE[0]}" data-duration="{TOGGLE[1]:.2f}" data-track-index="11" data-variable-values='{{"direction":"on","label":"","size":80}}'></div>
      <div id="brand-sting" class="sting-slot" data-composition-id="logo-sting" data-composition-src="compositions/components/logo-sting.html" data-start="{STING[0]}" data-duration="{STING[1]}" data-track-index="12" data-width="{W}" data-height="{H}" data-variable-values='{{"wordmark":"NAWA STUDIO","accent":"violet"}}'></div>
      <audio id="soundtrack" src="assets/audio/soundtrack.wav" data-start="0" data-duration="{TOTAL}" data-track-index="13"></audio>
    </div>
    <script>
      const tl = gsap.timeline({{ paused: true }});
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
"""


# ---------- sound cues (read by ../../scripts/showreel-sound.py) ----------
def cues():
    c = []
    add = lambda t, n, p=0: c.append([round(t, 3), n, p])
    for i, t in enumerate([0.12, 0.36, 0.78, 0.98, 1.2]): add(t, 'pop', i)
    add(1.55, 'pop', 5); add(2.02, 'click'); add(2.55, 'whoosh')
    for base in [2.8, 6.4, 10.0, 13.6, 17.2, 20.8]: add(base + 0.05, 'hit')
    add(3.15, 'swish'); [add(3.5 + i * 0.1, 'tick') for i in range(5)]; add(5.15, 'ding')
    [add(6.8 + i * 0.12, 'pop', i + 2) for i in range(4)]; add(7.6, 'swish'); add(8.3, 'chime'); add(8.5, 'hit')
    add(10.4, 'swish'); add(10.95, 'whoosh'); add(11.15, 'pop', 4); [add(11.3 + i * 0.12, 'tick') for i in range(10)]
    [add(11.4 + i * 0.22, 'pop', 6 + i % 2) for i in range(3)]
    add(13.9, 'swish'); add(14.65, 'click'); add(14.75, 'pop', 5); add(15.15, 'whoosh'); [add(15.2 + i * 0.1, 'tick') for i in range(9)]
    add(17.5, 'swish'); [add(17.9 + i * 0.15, 'pluck', i) for i in range(7)]; add(18.8, 'pop', 3); add(18.95, 'pop', 5); add(19.8, 'ding')
    add(21.0, 'swish'); [add(21.25 + i * 0.07, 'pop', i) for i in range(6)]; add(22.6, 'ding')
    add(22.1, 'riser'); add(23.95, 'impact')
    add(25.65, 'whoosh'); add(26.07, 'hit'); add(26.2, 'chime'); add(27.75, 'click'); add(27.8, 'pop', 7)
    c.sort()
    return {'duration': TOTAL, 'cues': c, 'music': {'start': 2.8, 'end': 23.4, 'bpm': 128}}


BG_FILE = """<!doctype html>
<html lang="ar">
  <head><meta charset="UTF-8" /><title>bg</title></head>
  <body>
    <template>
      <div id="bg" data-composition-id="bg" data-duration="29" data-fps="30">
        <style>""" + FONTS + """
      .bg { position: absolute; inset: 0; overflow: hidden; }
      .bg .grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,.05) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,.05) 2px, transparent 2px); background-size: 90px 90px; }
      .bg .glow { position: absolute; width: 1100px; height: 1100px; border-radius: 50%; }
      .bg .g1 { left: -420px; top: 120px; background: radial-gradient(closest-side, rgba(91,75,255,.55), rgba(91,75,255,0)); }
      .bg .g2 { left: 420px; top: 1050px; background: radial-gradient(closest-side, rgba(58,45,214,.5), rgba(58,45,214,0)); }
      .bg .ghost { position: absolute; right: -120px; top: 1380px; font-family: 'IBM Plex Sans Arabic', sans-serif; font-weight: 700; font-size: 520px; color: rgba(198,244,50,.07); direction: rtl; white-space: nowrap; }
      .bg .foot { position: absolute; left: 0; right: 0; bottom: 90px; display: flex; justify-content: center; align-items: center; gap: 18px; font-family: 'IBM Plex Sans Arabic', sans-serif; font-weight: 700; font-size: 36px; color: #A3ABC2; }
      .bg .foot svg { width: 50px; height: 50px; }

        </style>
        <div id="bg-layer" class="clip bg" data-start="0" data-duration="29" data-track-index="0">
          <div class="grid"></div><div class="glow g1" data-layout-allow-overflow></div><div class="glow g2" data-layout-allow-overflow></div>
                    <div class="foot"><svg viewBox="0 0 512 512"><rect width="512" height="512" rx="120" fill="#5B4BFF"/><path d="M146 236 A110 110 0 0 0 366 236" fill="none" stroke="#FFFFFF" stroke-width="62" stroke-linecap="round"/><circle cx="256" cy="148" r="40" fill="#C6F432"/></svg><span>نواة</span></div>
        </div>
        """ + GSAP + """
        <script>
          (function () {
            const tl = gsap.timeline({ paused: true });
            const S = '#bg-layer';
      tl.fromTo(S + ' .g1', { x: 0, y: 0, scale: 1 }, { x: 380, y: 760, scale: 1.15, duration: 29.0, ease: 'none' }, 0);
      tl.fromTo(S + ' .g2', { x: 0, y: 0 }, { x: -520, y: -700, duration: 29.0, ease: 'none' }, 0);
            tl.fromTo(S + ' .grid', { backgroundPosition: '0px 0px' }, { backgroundPosition: '0px 540px', duration: 29.0, ease: 'none' }, 0);
      tl.fromTo(S + ' .foot', { opacity: 0 }, { opacity: 1, duration: 0.6 }, 2.8);
      tl.fromTo(S + ' .foot', { opacity: 1 }, { opacity: 0, duration: 0.3, immediateRender: false }, 23.1);

            window.__timelines["bg"] = tl;
          })();
        </script>
      </div>
    </template>
  </body>
</html>
"""


if __name__ == '__main__':
    (ROOT / 'compositions/frames').mkdir(parents=True, exist_ok=True)
    for cid, (dur, css, body, js) in SC.items():
        (ROOT / f'compositions/frames/{cid}.html').write_text(scene_file(cid, dur, css, body, js))
    (ROOT / 'index.html').write_text(host())
    (ROOT / 'compositions/frames/bg.html').write_text(BG_FILE)
    (ROOT / 'assets/audio').mkdir(parents=True, exist_ok=True)
    (ROOT / 'assets/audio/cues.json').write_text(json.dumps(cues()))
    print('wrote', len(SC), 'scenes')
