(() => {
  // Site settings: replace with the real addresses before going live.
  const SITE = {
    email: 'hello@nawa.studio',
    socials: [
      ['Instagram', 'https://instagram.com/nawa.studio'],
      ['Facebook', 'https://facebook.com/nawa.studio'],
      ['LinkedIn', 'https://www.linkedin.com/company/nawa-studio'],
      ['TikTok', 'https://www.tiktok.com/@nawa.studio'],
    ],
  };

  const T = window.NAWA_T;

  const LANGS = ['ar', 'en', 'fr'];
  const html = document.documentElement;
  const $ = (id) => document.getElementById(id);
  let lang = 'ar';
  let need = null;

  function subject() {
    const t = T[lang];
    return need ? `${t['subj.base']} · ${t['need.' + need]}` : t['subj.base'];
  }
  function renderContact() {
    const t = T[lang];
    $('subj').textContent = t['cta.subj'] + subject();
    $('mailLink').href = `mailto:${SITE.email}?subject=${encodeURIComponent(subject())}`;
    document.querySelectorAll('[data-need]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.need === need)));
  }

  function setLang(next, save) {
    lang = LANGS.includes(next) ? next : 'ar';
    const t = T[lang];
    html.lang = lang;
    html.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = t['meta.title'];
    document.querySelectorAll('[data-i]').forEach((el) => { if (t[el.dataset.i] != null) el.textContent = t[el.dataset.i]; });
    document.querySelectorAll('[data-i-html]').forEach((el) => { if (t[el.dataset.iHtml] != null) el.innerHTML = t[el.dataset.iHtml]; });
    document.querySelectorAll('[data-step]').forEach((el) => { el.innerHTML = `<b dir="ltr">${el.dataset.step}</b>${t['step.of']}`; });
    document.querySelectorAll('.langs button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    $('copied').textContent = '';
    renderContact();
    if (save) {
      try { localStorage.setItem('nawa.lang', lang); } catch (e) {}
      try {
        // Served over http(s): /, /en and /fr. Opened as a local file: #en / #fr.
        if (/^https?:$/.test(location.protocol)) history.replaceState(null, '', (lang === 'ar' ? '/' : '/' + lang) + location.hash.replace(/^#(en|fr|ar)$/, ''));
        else history.replaceState(null, '', lang === 'ar' ? location.pathname : '#' + lang);
      } catch (e) {}
    }
  }

  // Arabic first. The URL decides (/en, /fr, or #en / #fr); on the home URL a saved choice applies.
  let start = 'ar';
  const seg = location.pathname.split('/').filter(Boolean)[0];
  const h = location.hash.slice(1);
  if (LANGS.includes(seg)) start = seg;
  else if (LANGS.includes(h)) start = h;
  else { try { start = localStorage.getItem('nawa.lang') || start; } catch (e) {} }
  setLang(start, false);
  document.querySelectorAll('.langs button').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang, true)));
  document.querySelectorAll('[data-need]').forEach((b) => b.addEventListener('click', () => { need = need === b.dataset.need ? null : b.dataset.need; renderContact(); }));

  $('mail').textContent = SITE.email;
  SITE.socials.forEach(([name, url]) => { const a = document.createElement('a'); a.href = url; a.textContent = name; a.rel = 'noopener'; $('socials').appendChild(a); });

  $('copyMail').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(SITE.email); $('copied').textContent = T[lang]['cta.copied']; }
    catch (e) {
      const r = document.createRange(); r.selectNodeContents($('mail'));
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      $('copied').textContent = T[lang]['cta.copyFail'];
    }
  });

  // ----- Motion: only when the visitor allows it -----
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!calm && 'IntersectionObserver' in window) {
    // Mark what reveals on scroll: section headings, cards and visuals, with a small stagger.
    const groups = ['.jstrip li', '.roles .role', '.models article', '.getbox > div'];
    document.querySelectorAll('.band .kicker, .band h2, .band .lead, .split > *, .subhead, ul.dots, .path, .assure, .cta-box, ' + groups.join(','))
      .forEach((el) => { if (!el.parentElement.closest('[data-reveal]')) el.setAttribute('data-reveal', ''); });
    groups.forEach((sel) => document.querySelectorAll(sel).forEach((el, i) => el.style.setProperty('--d', (i * 0.08) + 's')));
    document.querySelectorAll('.path li').forEach((el, i) => el.style.setProperty('--d', (0.2 + i * 0.15) + 's'));

    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
    html.classList.add('motion');

    // Hero cycle: light up the six steps in turn; pause while the visitor points at it.
    const cycle = document.querySelector('.cycle');
    if (cycle) {
      const nodes = [...cycle.querySelectorAll('.node')];
      let i = 0, timer = null;
      const show = () => { nodes.forEach((n, k) => n.classList.toggle('on', k === i)); i = (i + 1) % nodes.length; };
      const play = () => { if (!timer) timer = setInterval(show, 1600); };
      const stop = () => { clearInterval(timer); timer = null; };
      cycle.classList.add('auto');
      setTimeout(() => { show(); play(); }, 1200);
      cycle.addEventListener('mouseenter', stop);
      cycle.addEventListener('mouseleave', play);
      document.addEventListener('visibilitychange', () => (document.hidden ? stop() : play()));
    }
  }
})();
