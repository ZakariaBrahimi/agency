// Brand engine shared by the design templates and the Brand Pickers.
// Turns a brand config (brand/brand.json) into CSS variables, text, direction and a logo mark.
(function (root) {
  const DEFAULT_BRAND = {
    lang: 'ar',
    name: 'نواة',
    latin: 'Nawa',
    domain: 'nawa.studio',
    handle: 'nawa.studio',
    tagline: 'نطلق *المنتجات الرقمية.*|ونروي *القصص.*',
    palette: { dark: '#0B1220', primary: '#5B4BFF', accent: '#C6F432', paper: '#F6F5F2' },
    font: 'Thmanyah Sans',
    logo: 'signature',
    wordCase: 'lower',
    profileBg: 'primary',
  };

  const PALETTES = {
    core: { label: 'Core', labelAr: 'نواة', dark: '#0B1220', primary: '#5B4BFF', accent: '#C6F432', paper: '#F6F5F2' },
    saffron: { label: 'Saffron', labelAr: 'زعفران', dark: '#1A0F2E', primary: '#D6336C', accent: '#FFB020', paper: '#FBF6F0' },
    oasis: { label: 'Oasis', labelAr: 'واحة', dark: '#06231F', primary: '#0E9F6E', accent: '#F5D547', paper: '#F3F7F4' },
    craft: { label: 'Craft', labelAr: 'صنعة', dark: '#221D1A', primary: '#C8613A', accent: '#E9DCC7', paper: '#FAF6F0' },
    coral: { label: 'Coral', labelAr: 'مرجان', dark: '#111111', primary: '#FF5A4E', accent: '#FFE3C2', paper: '#FFF8F1' },
    blueprint: { label: 'Blueprint', labelAr: 'مخطط', dark: '#0A1B3D', primary: '#1F6FEB', accent: '#22D3EE', paper: '#F2F6FC' },
  };

  // Everything the pickers offer. Each name suggests a palette, but any combination works.
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
    palettes: PALETTES,
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

  const OPTIONS_AR = {
    names: [
      { name: 'نواة', latin: 'Nawa', meaning: 'اللبّ والبذرة، ومنها تنمو المنتجات', palette: 'core', recommended: true },
      { name: 'نقطة', latin: 'Noqta', meaning: 'نقطة البداية لكل فكرة', palette: 'saffron' },
      { name: 'أثر', latin: 'Athar', meaning: 'الأثر الذي يتركه عملنا', palette: 'oasis' },
      { name: 'صنعة', latin: 'Sanaa', meaning: 'الإتقان وصناعة اليد', palette: 'craft' },
      { name: 'زوايا', latin: 'Zawaya', meaning: 'زوايا ورؤى مختلفة', palette: 'coral' },
      { name: 'بناء', latin: 'Bina', meaning: 'البناء والهندسة', palette: 'blueprint' },
      { name: 'واحة', latin: 'Waha', meaning: 'واحة تنمو فيها الأفكار', palette: 'oasis' },
      { name: 'رقم', latin: 'Raqm', meaning: 'الحِرفة الرقمية', palette: 'blueprint' },
    ],
    palettes: PALETTES,
    fonts: ['Thmanyah Sans', 'Thmanyah Serif Display'],
    fontLabels: { 'Thmanyah Sans': 'ثمانية سانس', 'Thmanyah Serif Display': 'ثمانية سيرف' },
    logos: {
      signature: 'توقيع النون: نقطتها هي النواة (للأسماء التي تبدأ بالنون)',
      core: 'الحرف مع نقطة',
      orbit: 'مدار',
      bracket: 'إطار',
      stack: 'نمو',
    },
    taglines: [
      'نبني *المنتجات.*|ونصمّم العلامات.',
      'من *النواة*|تنمو المنتجات.',
      'برمجيات *تُستخدم.*|ومحتوى *يُشارَك.*',
      'نطلق *المنتجات الرقمية.*|ونروي *القصص.*',
    ],
  };

  // Fixed copy used inside the design templates, per language.
  const COPY = {
    en: {
      pill: 'SaaS · Social media · Design', homeOf: 'Home of', whatsNext: "— and what's next.", activeUsers: 'active users',
      newCampaign: 'New campaign ✦', ourProduct: 'Our product', builtBy: 'Built by', follow: 'Follow',
      productPre: 'A', productPost: 'product', product: 'Mizan',
      productTagline: 'Your business, in balance. Sales, stock and cash — one clear view.',
      revenue: 'Revenue', expenses: 'Expenses', balance: 'Balance',
    },
    ar: {
      pill: 'برمجيات · تواصل اجتماعي · تصميم', homeOf: 'موطن', whatsNext: 'وما هو قادم.', activeUsers: 'مستخدم نشط',
      newCampaign: 'حملة جديدة ✦', ourProduct: 'من منتجاتنا', builtBy: 'من تطوير', follow: 'تابعوا',
      productPre: 'أحد منتجات', productPost: '', product: 'ميزان',
      productTagline: 'أعمالك في توازن. المبيعات والمخزون والسيولة في لوحة واحدة واضحة.',
      revenue: 'الإيرادات', expenses: 'المصروفات', balance: 'الرصيد',
    },
  };

  // Thmanyah is not on Google Fonts: it is used when installed (or loaded locally) and
  // otherwise falls back to a similar Google font.
  const FONT_FALLBACK = {
    'Thmanyah Sans': { stack: `'IBM Plex Sans Arabic', 'Noto Sans Arabic', Tahoma, sans-serif`, google: 'IBM Plex Sans Arabic', weights: '400;500;700' },
    'Thmanyah Serif Display': { stack: `'Noto Naskh Arabic', 'IBM Plex Sans Arabic', serif`, google: 'Noto Naskh Arabic', weights: '400;700' },
    'Thmanyah Serif Text': { stack: `'Noto Naskh Arabic', 'IBM Plex Sans Arabic', serif`, google: 'Noto Naskh Arabic', weights: '400;700' },
  };
  const FONT_WEIGHTS = { 'DM Serif Display': 400, Unbounded: 700, 'Thmanyah Sans': 700, 'Thmanyah Serif Display': 700 };
  const weight = (f) => FONT_WEIGHTS[f] || 800;
  function fontStack(f) {
    if (FONT_FALLBACK[f]) return `'${f}', ${FONT_FALLBACK[f].stack}`;
    return (f === 'Inter' ? `'Inter Display', ` : `'${f}', `) + `Inter, 'Helvetica Neue', Arial, sans-serif`;
  }
  const isArabic = (b) => b.lang === 'ar';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const letterOf = (name) => ([...String(name || '').trim()][0] || 'N').toUpperCase();

  function normalize(b) {
    const base = b && b.lang === 'en' ? Object.assign({}, DEFAULT_BRAND, { lang: 'en', name: 'Nawa', tagline: OPTIONS.taglines[0], font: 'Inter' }) : DEFAULT_BRAND;
    const out = Object.assign({}, base, b || {});
    out.palette = Object.assign({}, base.palette, (b && b.palette) || {});
    return out;
  }

  function wordmark(b) {
    const n = String(b.name || '');
    if (isArabic(b)) return n;
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
    const L = letterOf(b.name);
    const F = esc(fontStack(b.font));
    const W = weight(b.font);
    const rtl = isArabic(b);
    const text = (size, x = 256, y = 256) =>
      `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="${F}" font-weight="${W}" font-size="${size}" fill="${o.fg}">${esc(L)}</text>`;
    const signature = L === 'N' || L === 'ن';
    const style = b.logo === 'signature' && !signature ? 'core' : b.logo;
    let inner;
    switch (style) {
      case 'signature':
        inner = L === 'ن'
          // Nun: an open bowl with the "core" as its dot.
          ? `<path d="M146 236 A110 110 0 0 0 366 236" fill="none" stroke="${o.fg}" stroke-width="62" stroke-linecap="round"/><circle cx="256" cy="148" r="40" fill="${o.dot}"/>`
          : `<path d="M168 344 V168 L344 344 V260" fill="none" stroke="${o.fg}" stroke-width="64" stroke-linecap="round" stroke-linejoin="round"/><circle cx="344" cy="164" r="38" fill="${o.dot}"/>`;
        break;
      case 'orbit':
        inner = `<circle cx="256" cy="256" r="166" fill="none" stroke="${o.fg}" stroke-opacity=".9" stroke-width="26"/>${text(210)}<circle cx="${rtl ? 139 : 373}" cy="139" r="40" fill="${o.dot}"/>`;
        break;
      case 'bracket':
        inner = `<path d="M118 206 V118 H206 M394 306 V394 H306" fill="none" stroke="${o.dot}" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>${text(220)}`;
        break;
      case 'stack':
        inner = `<rect x="106" y="304" width="300" height="80" rx="40" fill="${o.fg}"/><rect x="156" y="208" width="200" height="80" rx="40" fill="${o.fg}" fill-opacity=".8"/><circle cx="256" cy="148" r="42" fill="${o.dot}"/>`;
        break;
      default: // core: the letter followed by a "core" dot (to its left in Arabic)
        inner = rtl
          ? `${text(270, 286)}<circle cx="120" cy="332" r="32" fill="${o.dot}"/>`
          : `${text(270, 232)}<circle cx="392" cy="332" r="32" fill="${o.dot}"/>`;
    }
    const bg = o.badge ? `<rect width="512" height="512" rx="120" fill="${o.bg}"/>` : '';
    const vb = o.badge ? '0 0 512 512' : '72 72 368 368';
    const size = o.size ? ` width="${o.size}" height="${o.size}"` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${size} role="img" aria-label="${esc(b.name)}">${bg}${inner}</svg>`;
  }

  function fontHref(f) {
    if (!f) return null;
    const fb = FONT_FALLBACK[f];
    const fam = (fb ? fb.google : f).replace(/ /g, '+');
    if (f === 'DM Serif Display') return `https://fonts.googleapis.com/css2?family=${fam}&display=swap`;
    return `https://fonts.googleapis.com/css2?family=${fam}:wght@${fb ? fb.weights : '400;500;600;700;800'}&display=swap`;
  }

  /** Applies the brand: CSS variables, direction, [data-brand] text, [data-t] copy and [data-mark] logos. */
  function apply(b, scope) {
    b = normalize(b);
    const doc = (scope && scope.ownerDocument) || document;
    const el = scope || doc.documentElement;
    const p = b.palette;
    const copy = COPY[isArabic(b) ? 'ar' : 'en'];
    el.style.setProperty('--ink', p.dark);
    el.style.setProperty('--indigo', p.primary);
    el.style.setProperty('--lime', p.accent);
    el.style.setProperty('--paper', p.paper);
    el.style.setProperty('--font-display', fontStack(b.font));
    el.style.setProperty('--display-weight', weight(b.font));
    if (isArabic(b)) el.style.setProperty('--font-body', fontStack('Thmanyah Sans'));
    else el.style.removeProperty('--font-body');
    el.setAttribute('dir', isArabic(b) ? 'rtl' : 'ltr');
    el.setAttribute('lang', isArabic(b) ? 'ar' : 'en');
    for (const f of new Set([b.font, isArabic(b) ? 'Thmanyah Sans' : null])) {
      const href = fontHref(f);
      if (href && !doc.querySelector(`link[href="${href}"]`)) {
        const l = doc.createElement('link');
        l.rel = 'stylesheet';
        l.href = href;
        doc.head.appendChild(l);
      }
    }
    const rootEl = scope || doc;
    rootEl.querySelectorAll('[data-brand]').forEach((n) => {
      const k = n.dataset.brand;
      if (k === 'tagline') n.innerHTML = taglineHTML(b.tagline);
      else if (k === 'wordmark') n.textContent = wordmark(b);
      else n.textContent = b[k] ?? '';
    });
    rootEl.querySelectorAll('[data-t]').forEach((n) => { n.textContent = copy[n.dataset.t] ?? ''; });
    rootEl.querySelectorAll('[data-mark]').forEach((n) => {
      const d = n.dataset;
      n.innerHTML = markSVG(b, {
        badge: d.mark === 'badge',
        fg: d.fg === 'dark' ? p.dark : d.fg || '#FFFFFF',
        dot: d.dot === 'dark' ? p.dark : d.dot || p.accent,
      });
    });
    return b;
  }

  const api = { DEFAULT_BRAND, OPTIONS, OPTIONS_AR, COPY, normalize, markSVG, apply, wordmark, taglineHTML, taglinePlain, letterOf, fontStack, weight, isArabic };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Brand = api;
})(typeof window !== 'undefined' ? window : globalThis);
