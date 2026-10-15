// Brand engine shared by the design templates and the Brand Picker page.
// Turns a brand config (brand/brand.json) into CSS variables, text and a logo mark.
(function (root) {
  const DEFAULT_BRAND = {
    name: 'Nawa',
    arabic: 'نواة',
    domain: 'nawa.studio',
    handle: 'nawa.studio',
    tagline: 'We build *products.*|We design brands.',
    palette: { dark: '#0B1220', primary: '#5B4BFF', accent: '#C6F432', paper: '#F6F5F2' },
    font: 'Inter',
    logo: 'signature',
    wordCase: 'lower',
    profileBg: 'primary',
  };

  // Everything the picker offers. Each name suggests a palette, but any combination works.
  const OPTIONS = {
    names: [
      { name: 'Nawa', arabic: 'نواة', meaning: 'The core, the seed', palette: 'core', recommended: true },
      { name: 'Noqta', arabic: 'نقطة', meaning: 'The dot, the starting point', palette: 'saffron' },
      { name: 'Athar', arabic: 'أثر', meaning: 'Impact, the mark you leave', palette: 'oasis' },
      { name: 'Sanaa', arabic: 'صنعة', meaning: 'Craft, made by hand', palette: 'craft' },
      { name: 'Zawaya', arabic: 'زوايا', meaning: 'Angles, perspectives', palette: 'coral' },
      { name: 'Bina', arabic: 'بناء', meaning: 'Building', palette: 'blueprint' },
      { name: 'Waha', arabic: 'واحة', meaning: 'Oasis, where things grow', palette: 'oasis' },
      { name: 'Raqm', arabic: 'رقم', meaning: 'Digit, the digital craft', palette: 'blueprint' },
    ],
    palettes: {
      core: { label: 'Core', dark: '#0B1220', primary: '#5B4BFF', accent: '#C6F432', paper: '#F6F5F2' },
      saffron: { label: 'Saffron', dark: '#1A0F2E', primary: '#D6336C', accent: '#FFB020', paper: '#FBF6F0' },
      oasis: { label: 'Oasis', dark: '#06231F', primary: '#0E9F6E', accent: '#F5D547', paper: '#F3F7F4' },
      craft: { label: 'Craft', dark: '#221D1A', primary: '#C8613A', accent: '#E9DCC7', paper: '#FAF6F0' },
      coral: { label: 'Coral', dark: '#111111', primary: '#FF5A4E', accent: '#FFE3C2', paper: '#FFF8F1' },
      blueprint: { label: 'Blueprint', dark: '#0A1B3D', primary: '#1F6FEB', accent: '#22D3EE', paper: '#F2F6FC' },
    },
    fonts: ['Inter', 'Sora', 'Manrope', 'Syne', 'Unbounded', 'Cairo', 'DM Serif Display'],
    logos: {
      signature: 'Signature N (only for names starting with N)',
      core: 'Letter + core dot',
      orbit: 'Orbit',
      bracket: 'Frame',
      stack: 'Growth stack',
    },
    taglines: [
      'We build *products.*|We design brands.',
      'Where *products* grow.|SaaS & social, from the core.',
      'Software you *use.*|Content you *share.*',
      'We ship *SaaS.*|We craft *stories.*',
    ],
  };

  const FONT_WEIGHTS = { 'DM Serif Display': 400, Unbounded: 700 };
  const weight = (f) => FONT_WEIGHTS[f] || 800;
  const fontStack = (f) => (f === 'Inter' ? `'Inter Display', ` : `'${f}', `) + `Inter, 'Helvetica Neue', Arial, sans-serif`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const letterOf = (name) => ([...String(name || '').trim()][0] || 'N').toUpperCase();

  function normalize(b) {
    b = Object.assign({}, DEFAULT_BRAND, b || {});
    b.palette = Object.assign({}, DEFAULT_BRAND.palette, (b && b.palette) || {});
    return b;
  }

  function wordmark(b) {
    const n = String(b.name || '');
    return b.wordCase === 'upper' ? n.toUpperCase() : b.wordCase === 'title' ? n : n.toLowerCase();
  }

  /** "We build *products.*|We design brands." -> HTML with highlighted words and line breaks. */
  function taglineHTML(t) {
    return esc(t).split('|').map((l) => l.replace(/\*(.+?)\*/g, '<span class="lime">$1</span>')).join('<br>');
  }
  const taglinePlain = (t) => String(t).replace(/\*/g, '').replace(/\|/g, ' ');

  /** Logo mark as an SVG string (512 grid). badge: rounded-square background. */
  function markSVG(b, opts) {
    b = normalize(b);
    const o = Object.assign({ badge: true, fg: '#FFFFFF', bg: b.palette.primary, dot: b.palette.accent, size: '' }, opts || {});
    const L = esc(letterOf(b.name));
    const F = esc(fontStack(b.font));
    const W = weight(b.font);
    const text = (size, x = 256, y = 256) =>
      `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="${F}" font-weight="${W}" font-size="${size}" fill="${o.fg}">${L}</text>`;
    const style = b.logo === 'signature' && L !== 'N' ? 'core' : b.logo;
    let inner;
    switch (style) {
      case 'signature':
        inner = `<path d="M168 344 V168 L344 344 V260" fill="none" stroke="${o.fg}" stroke-width="64" stroke-linecap="round" stroke-linejoin="round"/><circle cx="344" cy="164" r="38" fill="${o.dot}"/>`;
        break;
      case 'orbit':
        inner = `<circle cx="256" cy="256" r="166" fill="none" stroke="${o.fg}" stroke-opacity=".9" stroke-width="26"/>${text(210)}<circle cx="373" cy="139" r="40" fill="${o.dot}"/>`;
        break;
      case 'bracket':
        inner = `<path d="M118 206 V118 H206 M394 306 V394 H306" fill="none" stroke="${o.dot}" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>${text(220)}`;
        break;
      case 'stack':
        inner = `<rect x="106" y="304" width="300" height="80" rx="40" fill="${o.fg}"/><rect x="156" y="208" width="200" height="80" rx="40" fill="${o.fg}" fill-opacity=".8"/><circle cx="256" cy="148" r="42" fill="${o.dot}"/>`;
        break;
      default: // core: the letter followed by a "core" dot
        inner = `${text(270, 232)}<circle cx="392" cy="332" r="32" fill="${o.dot}"/>`;
    }
    const bg = o.badge ? `<rect width="512" height="512" rx="120" fill="${o.bg}"/>` : '';
    const vb = o.badge ? '0 0 512 512' : '72 72 368 368';
    const size = o.size ? ` width="${o.size}" height="${o.size}"` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${size} role="img" aria-label="${esc(b.name)}">${bg}${inner}</svg>`;
  }

  function fontHref(f) {
    if (!f) return null;
    const fam = f.replace(/ /g, '+');
    return f === 'DM Serif Display'
      ? `https://fonts.googleapis.com/css2?family=${fam}&display=swap`
      : `https://fonts.googleapis.com/css2?family=${fam}:wght@400;500;600;700;800&display=swap`;
  }

  /** Applies the brand to the current document: CSS variables, [data-brand] text and [data-mark] logos. */
  function apply(b, scope) {
    b = normalize(b);
    const doc = (scope && scope.ownerDocument) || document;
    const el = scope || doc.documentElement;
    const p = b.palette;
    el.style.setProperty('--ink', p.dark);
    el.style.setProperty('--indigo', p.primary);
    el.style.setProperty('--lime', p.accent);
    el.style.setProperty('--paper', p.paper);
    el.style.setProperty('--font-display', fontStack(b.font));
    el.style.setProperty('--display-weight', weight(b.font));
    const href = fontHref(b.font);
    if (href && !doc.querySelector(`link[href="${href}"]`)) {
      const l = doc.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      doc.head.appendChild(l);
    }
    const root = scope || doc;
    root.querySelectorAll('[data-brand]').forEach((n) => {
      const k = n.dataset.brand;
      if (k === 'tagline') n.innerHTML = taglineHTML(b.tagline);
      else if (k === 'wordmark') n.textContent = wordmark(b);
      else n.textContent = b[k] ?? '';
    });
    root.querySelectorAll('[data-mark]').forEach((n) => {
      const d = n.dataset;
      n.innerHTML = markSVG(b, {
        badge: d.mark === 'badge',
        fg: d.fg === 'dark' ? p.dark : d.fg || '#FFFFFF',
        dot: d.dot === 'dark' ? p.dark : d.dot || p.accent,
      });
    });
    return b;
  }

  const api = { DEFAULT_BRAND, OPTIONS, normalize, markSVG, apply, wordmark, taglineHTML, taglinePlain, letterOf, fontStack, weight };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Brand = api;
})(typeof window !== 'undefined' ? window : globalThis);
