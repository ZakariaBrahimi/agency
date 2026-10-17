// Madar pages: reading progress, sharing, forms, tip of the day (streak + saved tips) and the podcast player.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  // Reading progress and the active heading in the table of contents.
  const bar = $('.md-progress i'); const prose = $('.md-article .md-prose');
  if (bar && prose) {
    const toc = $$('.md-toc a'); const heads = toc.map((a) => document.getElementById(a.hash.slice(1))).filter(Boolean);
    const onScroll = () => {
      const r = prose.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (innerHeight * 0.35 - r.top) / r.height));
      bar.style.width = (p * 100).toFixed(1) + '%';
      let cur = null; heads.forEach((h) => { if (h.getBoundingClientRect().top < 180) cur = h.id; });
      toc.forEach((a) => a.classList.toggle('on', a.hash === '#' + cur));
    };
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }

  // Share: the native sheet on phones, otherwise copy the link.
  $$('[data-share]').forEach((b) => b.addEventListener('click', async () => {
    const msg = b.parentElement.querySelector('.md-form-msg');
    const data = { title: document.title, url: location.href.split('#')[0] };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(data.url); if (msg) msg.textContent = 'تم نسخ الرابط.'; }
    } catch (e) { if (e.name !== 'AbortError' && msg) msg.textContent = 'انسخ الرابط من شريط العنوان.'; }
  }));

  // Forms (newsletter, write with us): sent as JSON; without JavaScript they post normally.
  const ERR = { bad_email: 'تحقّق من البريد الإلكتروني.', missing_fields: 'أكمل الحقول المطلوبة.', rate_limited: 'محاولات كثيرة. حاول بعد دقائق.' };
  $$('form[data-form]').forEach((f) => {
    const hp = document.createElement('input');
    hp.type = 'text'; hp.name = 'website'; hp.tabIndex = -1; hp.autocomplete = 'off'; hp.className = 'sr'; hp.setAttribute('aria-hidden', 'true');
    f.appendChild(hp);
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = $('.md-form-msg', f); const btn = $('button[type=submit]', f);
      btn.disabled = true; msg.textContent = 'جارٍ الإرسال…';
      try {
        const r = await fetch(f.action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(f))) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error);
        f.reset();
        msg.textContent = f.dataset.form === 'pitch' ? 'وصلتنا فكرتك. نرد عليك خلال أسبوع.' : 'تم الاشتراك. أول رسالة يوم الخميس.';
      } catch (err) {
        msg.textContent = ERR[err.message] || 'تعذّر الإرسال. حاول مرة أخرى.';
      } finally { btn.disabled = false; }
    });
  });
  const qs = new URLSearchParams(location.search);
  if (qs.get('subscribed')) { const m = $('.md-news .md-form-msg'); if (m) m.textContent = 'تم الاشتراك. أول رسالة يوم الخميس.'; }
  if (qs.get('sent')) { const m = $('.md-form .md-form-msg'); if (m) m.textContent = 'وصلتنا فكرتك. نرد عليك خلال أسبوع.'; }

  // Tips: daily streak, saved tips and "another tip".
  const today = $('[data-today]');
  if (today) {
    const day = new Date().toISOString().slice(0, 10);
    const yday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    const s = store.get('madar.streak', { last: null, count: 0 });
    if (s.last !== day) { s.count = s.last === yday ? s.count + 1 : 1; s.last = day; store.set('madar.streak', s); }
    const st = $('[data-streak]');
    if (s.count > 1) { st.hidden = false; $('span', st).textContent = s.count; }

    const all = JSON.parse($('#md-tips-data').textContent || '[]');
    let cur = all.findIndex((t) => String(t.n) === today.dataset.today);
    const saveBtn = $('[data-tip-save]'); const openLink = $('.md-swipe a');
    const saved = () => store.get('madar.saved', []);
    const sync = () => saveBtn.setAttribute('aria-pressed', String(saved().includes(all[cur]?.n)));
    sync();
    saveBtn.addEventListener('click', () => {
      const n = all[cur]?.n; let list = saved();
      list = list.includes(n) ? list.filter((x) => x !== n) : [...list, n];
      store.set('madar.saved', list); sync(); applyFilter();
    });
    $('[data-tip-next]').addEventListener('click', () => {
      if (all.length < 2) return;
      cur = (cur + 1) % all.length;
      $('.md-stack', today).innerHTML = all[cur].html; openLink.href = all[cur].url; sync();
    });
    let filter = 'all';
    const applyFilter = () => {
      const list = saved(); let shown = 0;
      $$('[data-tips] .md-tip').forEach((el) => { const show = filter === 'all' || list.includes(Number(el.dataset.tip)); el.hidden = !show; shown += show; });
      const empty = $('.md-empty-saved'); if (empty) empty.hidden = !(filter === 'saved' && !shown);
    };
    $$('[data-tips-filter]').forEach((b) => b.addEventListener('click', () => {
      filter = b.dataset.tipsFilter;
      $$('[data-tips-filter]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      applyFilter();
    }));
  }

  // Podcast player: custom controls, chapters and playback speed.
  const player = $('[data-player]'); const audio = player && $('audio', player);
  if (audio) {
    player.classList.add('js');
    const play = $('[data-play]', player); const rate = $('[data-rate]', player);
    const chapters = $$('[data-seek]', player);
    play.addEventListener('click', () => (audio.paused ? audio.play() : audio.pause()));
    audio.addEventListener('play', () => { play.textContent = '❚❚'; play.setAttribute('aria-label', 'إيقاف مؤقت'); });
    audio.addEventListener('pause', () => { play.textContent = '▶'; play.setAttribute('aria-label', 'تشغيل'); });
    $$('[data-skip]', player).forEach((b) => b.addEventListener('click', () => { audio.currentTime = Math.max(0, audio.currentTime + Number(b.dataset.skip)); }));
    const rates = [1, 1.25, 1.5, 2];
    rate.addEventListener('click', () => { const r = rates[(rates.indexOf(audio.playbackRate) + 1) % rates.length]; audio.playbackRate = r; rate.textContent = r + '×'; });
    chapters.forEach((b) => b.addEventListener('click', () => { audio.currentTime = Number(b.dataset.seek); audio.play(); }));
    audio.addEventListener('timeupdate', () => {
      let on = null; chapters.forEach((b) => { if (audio.currentTime >= Number(b.dataset.seek)) on = b; });
      chapters.forEach((b) => b.classList.toggle('on', b === on));
    });
  }
})();
