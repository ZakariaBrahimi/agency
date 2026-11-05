// «المحتوى»: plan, draft, edit, schedule and publish posts. Data lives in the Nawa Google Drive;
// scheduling (the approval) adds events to a Google Calendar.
// Runs in two places with the same tools:
// - /admin  (window.NAWA_CT unset): Nawa's own content, or any client's (the switcher at the top)
// - /portal (window.NAWA_CT = { api: '/api/portal', mode: 'client' }): a client's own content
import { PLATFORMS, PLATFORM_IDS, KINDS, STATUS, AUTO_PLATFORMS, captionFor, platformStatus, postStatus } from './content-schema.js?v=20261023b';
import { COPY_ICON } from './portal-schema.js?v=20261103d';
import { STORY_SETS, storyFiles, storyCover } from './stories-schema.js?v=20261023b';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const CFG = window.NAWA_CT || { api: '/api/admin/content', mode: 'admin' };
const CLIENT_MODE = CFG.mode === 'client';
let tenant = ''; // admin only: '' = Nawa, else the id of the client being managed
/** The content API URL for an action (the admin adds the client being managed). */
const api = (action, params = {}) => {
  const q = new URLSearchParams({ ...(action ? { action } : {}), ...params, ...(tenant ? { client: tenant } : {}) }).toString();
  return CFG.api + (q ? '?' + q : '');
};
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MONTHS = ['جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان', 'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const ERR = {
  google_error: 'تعذّر الاتصال بـ Google. حاول مرة أخرى.',
  google_scope: 'صلاحيات Google ناقصة. افصل الحساب ثم اربطه من جديد ووافق على كل الصلاحيات.',
  title_required: 'اكتب عنوانًا للمنشور.',
  bad_date: 'اختر تاريخًا ووقتًا صحيحين.',
  no_platforms: 'اختر منصة واحدة على الأقل.',
  bad_file: 'هذا الملف غير مدعوم. استخدم صورة أو فيديو.',
  meta_not_configured: 'Meta غير مربوطة بعد: أضف META_ACCESS_TOKEN وMETA_PAGE_ID وMETA_IG_USER_ID في Vercel.',
  already_published: 'نُشر هذا المنشور على هذه المنصة من قبل.',
  publishing: 'النشر جارٍ الآن. انتظر دقيقة ثم حدّث.',
  bad_platform: 'هذه المنصة غير مختارة لهذا المنشور.',
  platform_not_connected: 'هذه المنصة غير مفعّلة بعد: أكمل خطوات تفعيلها في «المنصات».',
  content_unavailable: 'المحتوى غير متاح مؤقتًا. تواصل مع نواة.',
  client_not_found: 'هذا العميل غير موجود.',
  no_storage: 'اختر مكان التخزين أولًا من «التخزين»: Google Drive مجانًا أو «تخزين نواة».',
  drive_full: 'مساحة Google Drive المجانية ممتلئة. اختر خطة «تخزين نواة» من «التخزين» لمتابعة الرفع.',
  cover_not_image: 'الغلاف يجب أن يكون صورة (JPG أو PNG أو WebP).',
  plan_full: 'امتلأت مساحة خطة «تخزين نواة». رقِّها من «التخزين» لمتابعة الرفع.',
  plan_ended: 'خطة «تخزين نواة» غير نشطة. اختر خطة أو جدّدها من «التخزين» لمتابعة الرفع.',
  drive_disconnected: 'Google Drive غير مربوط. أعد ربطه من «التخزين».',
  storage_not_configured: 'قاعدة البيانات غير مربوطة (Supabase).',
  tiktok_privacy: 'اختر في إعدادات تيك توك من يمكنه مشاهدة الفيديو.',
  tiktok_brand: 'المحتوى التجاري مفعّل: اختر «علامتك التجارية» أو «محتوى ممول»، أو أوقفه.',
  tiktok_brand_private: 'المحتوى الممول لا يمكن أن يكون «أنا فقط».',
  tiktok_not_connected: 'تيك توك غير مربوط: اربطه من «المنصات».',
  tiktok_video_only: 'تيك توك هنا يقبل منشورًا بفيديو واحد فقط.',
  linkedin_not_connected: 'لينكدإن غير مربوط: اربطه واختر الصفحة من «المنصات».',
};
const errText = (e) => (e?.code?.startsWith('caption_too_long') ? 'النص أطول من حد المنصة.' : ERR[e?.code] || e?.msg || 'حدث خطأ. حاول مرة أخرى.');

const state = { loaded: false, status: null, posts: [], settings: {}, rootUrl: '', email: '', view: 'calendar', filter: 'all', month: null, open: null, dirty: false, meta: null };
try { state.view = localStorage.getItem('nawa.ct.view') || 'calendar'; } catch {}

// ---------- API ----------
async function call(path, { method = 'GET', body } = {}) {
  const r = await fetch(path, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) { window.dispatchEvent(new Event('nawa:signed-out')); throw Object.assign(new Error('signed_out'), { code: 'signed_out' }); }
  if (!r.ok || d.ok === false) throw Object.assign(new Error(d.error || 'error'), { code: d.error || 'error', msg: d.message || '' });
  return d;
}
const act = (action, body) => call(api(action), { method: 'POST', body });
function absorb(d) {
  if (d.posts) state.posts = d.posts;
  if (d.settings) state.settings = d.settings;
  if (d.rootUrl) state.rootUrl = d.rootUrl;
  if (d.email !== undefined) state.email = d.email;
  if (d.trash) state.trash = d.trash;
  if (d.post) state.posts = state.posts.map((p) => (p.id === d.post.id ? d.post : p));
  if (CLIENT_MODE && d.posts) window.dispatchEvent(new CustomEvent('nawa:proposals', { detail: state.posts.filter((p) => p.proposal).length }));
}

function toast(msg, bad = false) {
  const t = $('ctToast');
  const host = $('ctDialog').open ? $('ctDialog') : document.body; // a modal dialog covers anything outside it
  if (t.parentNode !== host) host.appendChild(t);
  t.textContent = msg; t.classList.toggle('bad', bad); t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 3200);
}

// ---------- load ----------
async function load() {
  const body = $('ctBody');
  if (CLIENT_MODE) return loadContent();
  if (!body.firstChild) body.innerHTML = NawaUI.loading('جارٍ التحقق من حساب Google…', 'calendar');
  try {
    state.status = await call('/api/admin/google');
  } catch (e) { if (e.code !== 'signed_out') body.innerHTML = `<p class="empty">${esc(errText(e))}</p>`; return; }
  const s = state.status;
  $('ctHeadActions').hidden = true;
  if (!s.configured) {
    $('ctAccount').textContent = '';
    body.innerHTML = `<div class="ct-card ct-setup"><h2>اربط Google أولًا</h2>
      <p>أضف مفتاحي Google في Vercel ← nawa-studio ← Settings ← Environment Variables، ثم أعد النشر:</p>
      <ul><li><code dir="ltr">GOOGLE_CLIENT_ID</code></li><li><code dir="ltr">GOOGLE_CLIENT_SECRET</code></li></ul>
      <p class="muted">عنوان الرجوع الذي يجب إضافته في Google Cloud: <code dir="ltr">${esc(s.redirectUri)}</code></p></div>`;
    return;
  }
  if (!s.connected) {
    $('ctAccount').textContent = '';
    body.innerHTML = `<div class="ct-card ct-setup"><h2>اربط حساب Google الخاص بنواة</h2>
      <p>يُحفظ المحتوى في Google Drive، وتُضاف المنشورات المعتمدة إلى تقويم «Nawa · Content». تربط مرة واحدة على كل جهاز.</p>
      <a class="btn btn-lime" href="/api/admin/google?connect=1">ربط حساب Google</a>
      <p class="muted">سيظهر تنبيه «Google hasn't verified this app» لأن التطبيق خاص بك: اضغط <b dir="ltr">Advanced</b> ثم <b dir="ltr">Go to Nawa Admin</b> ووافق على الصلاحيات.</p></div>`;
    return;
  }
  if (!state.clients) call(api('clients')).then((d) => { state.clients = d.clients; if (state.loaded) render(); }).catch(() => {});
  return loadContent();
}

async function loadContent() {
  const body = $('ctBody');
  body.innerHTML = NawaUI.loading('جارٍ تحميل المحتوى…', 'calendar');
  state.meta = null; state.posts = []; state.busy = true;
  try {
    absorb(await call(api()));
    state.loaded = true;
  } catch (e) {
    state.busy = false;
    if (e.code === 'google_not_connected') return load();
    if (e.code !== 'signed_out') body.innerHTML = `<p class="empty">${esc(errText(e))}</p>`;
    return;
  }
  state.busy = false;
  $('ctHeadActions').hidden = false;
  render();
  routeHash();
  call(api('meta')).then((m) => { state.meta = m; drawStories(); const p = current(); if (p && $('ceSched')) drawSchedule(p); }).catch(() => {});
  if (!CLIENT_MODE && !tenant) call(api('stories')).then((d) => { state.stories = d.sets; state.storyQueue = d.queue || []; drawStories(); }).catch(() => {});
}

const fmtTime = (iso) => new Date(iso).toLocaleString('ar-DZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
// What a Facebook/Instagram row says about direct publishing.
function metaLine(p, pf) {
  const s = p.schedule?.[pf];
  const media = p.media || [];
  if (s?.remote?.url) return `<span class="ct-meta ok">✓ نُشر ${s.publishedAt ? fmtTime(s.publishedAt) : ''} · <a href="${esc(s.remote.url)}" target="_blank" rel="noopener">عرض المنشور ↗</a></span>`;
  if (s?.status === 'publishing') return `<span class="ct-meta">⏳ ${pf === 'tiktok' ? 'تيك توك يعالج الفيديو، وقد يستغرق ظهوره بضع دقائق.' : pf === 'linkedin' ? 'لينكدإن يعالج الفيديو، ويُنشر تلقائيًا خلال دقائق.' : 'إنستغرام يعالج الفيديو، ويُنشر تلقائيًا خلال دقائق.'}</span>`;
  const warn = pf === 'instagram' && !media.length ? '<span class="ct-meta bad">إنستغرام يحتاج صورة أو فيديو قبل النشر.</span>'
    : pf === 'tiktok' && !ttVideo(p) ? '<span class="ct-meta bad">تيك توك هنا يقبل منشورًا بفيديو واحد فقط.</span>'
    : pf === 'linkedin' && media.some((m) => isVideo(m)) && media.length > 1 ? '<span class="ct-meta bad">لينكدإن يقبل فيديو واحدًا بلا صور في المنشور الواحد.</span>'
    : pf === 'linkedin' && media.length > 20 ? '<span class="ct-meta bad">لينكدإن يقبل 20 صورة على الأكثر.</span>'
    : pf === 'facebook' && media.length > 1 && media.some((m) => m.video || /^video\//.test(m.mimeType || '')) ? '<span class="ct-meta bad">فيسبوك لا يجمع الفيديو مع الصور في منشور واحد.</span>' : '';
  const err = s?.error ? `<span class="ct-meta bad">${esc(s.error.message)}${s.error.tries >= 3 ? ' توقفت المحاولات التلقائية: صحّح ثم اضغط «انشر الآن».' : ''}</span>` : '';
  const when = s && s.status === 'scheduled' ? (s.auto === false ? '<span class="ct-meta">النشر التلقائي متوقف: انشر يدويًا أو فعّله.</span>' : `<span class="ct-meta">⏱ يُنشر تلقائيًا في موعده على ${PLATFORMS[pf].name}.</span>`) : '';
  return warn + err + when;
}

function routeHash() {
  const h = location.hash.replace(/^#content\/?/, '');
  if (h === 'google-connected') { toast('تم ربط حساب Google.'); history.replaceState(null, '', '#content'); }
  else if (h === 'google-denied') { toast('لم تتم الموافقة على الربط.', true); history.replaceState(null, '', '#content'); }
  else if (h === 'google-failed') { toast('تعذّر الربط. حاول مرة أخرى.', true); history.replaceState(null, '', '#content'); }
  else if (h.startsWith('p_') && state.posts.some((p) => p.id === h) && state.open !== h) openEditor(h);
}

// ---------- helpers ----------
const fmtAt = (at) => {
  if (!at) return 'بدون تاريخ';
  const [d, t] = at.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
  return `${DAYS[wd]} ${day} ${MONTHS[m - 1]} · ${t}`;
};
const thumb = (m, size = 300) => api('media', { id: m.id, size: String(size) });
const isVideo = (m) => m.video || /^video\//.test(m.mimeType);
// a video plays from its original file (the server redirects to a signed link or streams with Range);
// "#t=0.5" makes the browser show an early frame as the thumbnail
const videoSrc = (m) => api('media', { id: m.id });
// (with a cover image, the cover is the thumbnail)
const videoThumb = (m, cover) => `${cover ? `<img src="${thumb(cover)}" alt="" loading="lazy">` : `<video src="${videoSrc(m)}#t=0.5" preload="metadata" muted playsinline aria-hidden="true" tabindex="-1"></video>`}<i class="ct-play">▶</i>`;
/** Plays a post's video in a window (controls, playsinline). */
function playVideo(m, cover) {
  let d = document.getElementById('ctPlayer');
  if (!d) {
    d = document.createElement('dialog'); d.id = 'ctPlayer'; d.className = 'ct-player';
    d.innerHTML = '<button type="button" class="ct-x" aria-label="إغلاق">✕</button><video controls playsinline preload="metadata"></video>';
    document.body.appendChild(d);
    const close = () => { d.querySelector('video').pause(); d.close(); };
    d.querySelector('button').onclick = close;
    d.addEventListener('click', (e) => { if (e.target === d) close(); });
    d.addEventListener('close', () => d.querySelector('video').pause());
  }
  const v = d.querySelector('video');
  v.poster = cover ? thumb(cover, 1200) : ''; v.src = videoSrc(m); v.setAttribute('aria-label', m.name || 'video');
  d.showModal(); v.play().catch(() => {});
}
const todayAt = () => {
  const d = new Date(Date.now() + 3600e3); // Algeria is UTC+1 all year
  return d.toISOString().slice(0, 10);
};
// Claude's proposals (client portal connector) are drafts that wait for the client's approval
const stOf = (p) => (p.proposal ? 'proposal' : postStatus(p));
const LABEL = { ...STATUS, proposal: 'مقترح من Claude' };
const filtered = () => state.posts.filter((p) => state.filter === 'all' || stOf(p) === state.filter);
const byDate = (a, b) => (a.date || '9999').localeCompare(b.date || '9999');

function pfBadges(p) {
  return (p.platforms || []).map((pf) => `<span class="ct-pf st-${platformStatus(p, pf)}" title="${esc(PLATFORMS[pf].name)} · ${STATUS[platformStatus(p, pf)]}">${PLATFORMS[pf].short}</span>`).join('');
}

// ---------- render ----------
function render() {
  const body = $('ctBody');
  const s = state.status;
  if (!CLIENT_MODE) {
    const who = state.clients?.length ? `<label class="ct-tenant"><span>محتوى:</span><select id="ctTenant" aria-label="محتوى من">
        <option value="">نواة</option>${state.clients.map((c) => `<option value="${esc(c.id)}"${c.id === tenant ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label> · ` : '';
    $('ctAccount').innerHTML = `${who}متصل بـ <b dir="ltr">${esc(state.email || 'Google')}</b> · <a href="${esc(state.rootUrl)}" target="_blank" rel="noopener">مجلد Drive ↗</a> · <button type="button" class="link-btn" id="ctDisconnect">فصل</button>`;
    $('ctDisconnect').onclick = async () => { await call('/api/admin/google', { method: 'DELETE' }); state.loaded = false; load(); };
    if ($('ctTenant')) $('ctTenant').onchange = (e) => switchTenant(e.target.value);
  }
  document.querySelectorAll('.ct-views button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));

  const counts = { draft: 0, scheduled: 0, published: 0, proposal: 0 };
  state.posts.forEach((p) => counts[stOf(p)]++);
  const weekEnd = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), today = todayAt();
  const thisWeek = state.posts.filter((p) => p.date && p.date.slice(0, 10) >= today && p.date.slice(0, 10) <= weekEnd).length;

  const seed = !state.settings.seeded && !CLIENT_MODE && !tenant ? `<div class="ct-card ct-seed"><div><b>ابدأ بخطة الشهر الأول</b><p class="muted">16 مسودة بعناوينها وتواريخها (4 منشورات في الأسبوع، الساعة 20:00)، مع نصوص جاهزة لمنشورات الإطلاق.</p></div>
      <button type="button" class="btn btn-lime" id="ctSeed">إضافة الخطة</button></div>` : '';

  body.innerHTML = `${seed}
    <div id="ctStories"></div>
    <div class="stats">
      <div class="stat"><b dir="ltr">${counts.draft}</b><span>مسودات</span></div>
      <div class="stat hl"><b dir="ltr">${counts.scheduled}</b><span>مجدولة</span></div>
      <div class="stat"><b dir="ltr">${counts.published}</b><span>منشورة</span></div>
      <div class="stat"><b dir="ltr">${thisWeek}</b><span>هذا الأسبوع</span></div>
    </div>
    <div class="tabs" role="tablist" aria-label="تصفية حسب الحالة">
      ${[['all', 'الكل', state.posts.length], ...(counts.proposal ? [['proposal', '✦ مقترحات Claude', counts.proposal]] : []), ['draft', STATUS.draft, counts.draft], ['scheduled', STATUS.scheduled, counts.scheduled], ['published', STATUS.published, counts.published]]
        .map(([k, l, n]) => `<button type="button" role="tab" data-cf="${k}" aria-selected="${state.filter === k}">${l} <span dir="ltr">${n}</span></button>`).join('')}
      ${(state.trash || []).length ? `<button type="button" role="tab" data-cf="trash" aria-selected="${state.filter === 'trash'}">🗑 المحذوفات <span dir="ltr">${state.trash.length}</span></button>` : ''}
    </div>
    <div id="ctView"></div>`;
  body.querySelectorAll('[data-cf]').forEach((b) => b.addEventListener('click', () => { state.filter = b.dataset.cf; render(); }));
  if ($('ctSeed')) $('ctSeed').onclick = async (e) => {
    e.target.disabled = true;
    try { absorb(await act('seed')); toast('أُضيفت خطة الشهر الأول.'); jumpToFirst(); render(); } catch (err) { toast(errText(err), true); e.target.disabled = false; }
  };
  drawStories();
  if (state.filter === 'trash') renderTrash();
  else if (state.view === 'list') renderList(); else renderCalendar();
}

// ---------- «المحذوفات»: posts Claude deleted, restorable for 30 days ----------
function renderTrash() {
  const items = state.trash || [];
  if (!items.length) { state.filter = 'all'; return render(); }
  const left = (iso) => Math.max(0, 30 - Math.floor((Date.now() - Date.parse(iso)) / 864e5));
  $('ctView').innerHTML = `
    <p class="muted ct-trash-lead">تبقى المنشورات المحذوفة هنا 30 يومًا ثم تُحذف نهائيًا مع ملفاتها. الاستعادة تعيدها كما كانت (وما فات موعده يعود مسودة).</p>
    <ul class="ct-trash">${items.map((t) => `<li>
      <div><b>${esc(t.title)}</b>
        <span class="muted">${t.by === 'claude' ? '✦ حذفه Claude' : 'محذوف'} · ${esc(fmtTime(t.deletedAt))}${t.date ? ` · كان موعده ${esc(fmtAt(t.date))}` : ''} · يُحذف نهائيًا بعد ${left(t.deletedAt)} يومًا</span>
        ${t.reason ? `<span class="ct-trash-why">السبب: ${esc(t.reason)}</span>` : ''}</div>
      <span class="ct-trash-acts"><button type="button" class="btn btn-dark" data-restore="${esc(t.id)}">استعادة</button><button type="button" class="link-btn ct-danger" data-purge="${esc(t.id)}">حذف نهائي</button></span>
    </li>`).join('')}</ul>`;
  $('ctView').querySelectorAll('[data-restore]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    try { absorb(await act('trash-restore', { tid: b.dataset.restore })); render(); toast('استُعيد المنشور.'); } catch (err) { b.disabled = false; toast(errText(err), true); }
  }));
  $('ctView').querySelectorAll('[data-purge]').forEach((b) => b.addEventListener('click', async () => {
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'تأكيد الحذف النهائي'; return; }
    b.disabled = true;
    try { absorb(await act('trash-purge', { tid: b.dataset.purge })); render(); toast('حُذف نهائيًا.'); } catch (err) { b.disabled = false; toast(errText(err), true); }
  }));
}

// ---------- highlight stories ----------
// Six ready-made story sets (rendered into /assets/stories). Publishing posts a set's stories to
// Instagram in order; Instagram has no API for highlights, so the highlight itself is made in the app.
function drawStories() {
  const box = $('ctStories'); if (!box) return;
  if (CLIENT_MODE || tenant) { box.innerHTML = ''; return; } // Nawa's own highlights only
  const sets = state.stories || {};
  const done = STORY_SETS.filter((s) => sets[s.id]?.publishedAt).length;
  const live = state.meta?.configured && state.meta.accounts;
  let open = true; try { open = localStorage.getItem('nawa.ct.stories') !== 'closed'; } catch {}
  const label = (set, st) => (st.publishedAt ? 'انشرها مرة أخرى' : st.done ? `أكمل النشر (${set.count - st.done})` : `انشر ${set.count} قصص`);
  box.innerHTML = `<details class="ct-card ct-stories"${open ? ' open' : ''}>
    <summary><b>قصص الهايلايت</b> <span class="muted">${STORY_SETS.length} مجموعات · ${done} منشورة على إنستغرام</span></summary>
    <p class="muted">انشر قصص كل مجموعة، ثم في تطبيق إنستغرام: ملفك ← <b>+</b> ← هايلايت جديد ← اختر قصص المجموعة ← اكتب الاسم ← «تعديل الغلاف» واختر صورة الغلاف من هاتفك. القصص تبقى في الأرشيف بعد 24 ساعة، فيمكنك صنع الهايلايت لاحقًا.</p>
    ${state.meta && !live ? `<p class="ct-metabar"><b>Meta:</b> ${esc(state.meta.error || ERR.meta_not_configured)}</p>` : ''}
    <ul class="ct-story-sets">${STORY_SETS.map((set) => {
      const st = sets[set.id] || {};
      const status = st.publishedAt ? `<span class="pill ct-st st-published">نُشرت · ${esc(fmtTime(st.publishedAt))}</span>`
        : st.done ? `<span class="pill ct-st st-scheduled">نُشر ${st.done} من ${set.count}</span>`
        : (state.storyQueue || []).includes(set.id) ? '<span class="pill ct-st st-scheduled">في الطابور · تُنشر تلقائيًا</span>' : '';
      return `<li class="ct-story-set">
        <div class="ct-story-head"><span class="ct-story-cover" style="background-image:url(${storyCover(set)})"></span><b>${esc(set.name)}</b>${status}</div>
        <div class="ct-story-frames">${storyFiles(set).map((f, i) => `<a href="${f}" target="_blank" rel="noopener"><img src="${f}" alt="${esc(set.name)} · قصة ${i + 1}" loading="lazy"></a>`).join('')}</div>
        ${st.error ? `<p class="ct-story-err">${esc(st.error.message)}</p>` : ''}
        <div class="ct-story-btns">
          ${live ? `<button type="button" class="btn ${st.publishedAt ? 'btn-ghost-dark' : 'btn-dark'}" data-story="${set.id}">${label(set, st)}</button>` : ''}
          <a class="link-btn" href="${storyCover(set)}" download="highlight-${set.id}.jpg">تنزيل الغلاف</a>
        </div>
      </li>`;
    }).join('')}</ul>
  </details>`;
  box.querySelector('details').addEventListener('toggle', (e) => { try { localStorage.setItem('nawa.ct.stories', e.target.open ? 'open' : 'closed'); } catch {} });
  box.querySelectorAll('[data-story]').forEach((b) => b.addEventListener('click', async () => {
    const set = STORY_SETS.find((s) => s.id === b.dataset.story);
    if (!b.dataset.armed) {
      b.dataset.armed = '1'; b.textContent = `تأكيد: انشر «${set.name}» على إنستغرام`; b.classList.add('armed');
      setTimeout(() => { if (b.isConnected && b.dataset.armed) { delete b.dataset.armed; b.textContent = label(set, sets[set.id] || {}); b.classList.remove('armed'); } }, 5000);
      return;
    }
    box.querySelectorAll('[data-story]').forEach((x) => (x.disabled = true));
    b.textContent = 'جارٍ النشر… قد يستغرق دقيقة';
    try {
      const d = await act('story', { set: set.id });
      state.stories = d.sets; state.storyQueue = d.queue || [];
      const st = d.sets[set.id];
      if (st.publishedAt) toast(`نُشرت قصص «${set.name}». أضفها الآن إلى هايلايت من التطبيق.`);
      else if (st.error) toast(st.error.message, true);
      else toast(`نُشر ${st.done} من ${set.count}. اضغط «أكمل النشر» للباقي.`);
    } catch (e) { toast(errText(e), true); }
    drawStories();
  }));
}

function jumpToFirst() {
  const first = state.posts.filter((p) => p.date).sort(byDate)[0];
  if (first) state.month = first.date.slice(0, 7);
}

function renderCalendar() {
  if (!state.month) {
    const today = todayAt().slice(0, 7);
    const upcoming = state.posts.filter((p) => p.date && p.date.slice(0, 10) >= todayAt()).sort(byDate)[0];
    state.month = state.posts.some((p) => p.date?.startsWith(today)) || !upcoming ? today : upcoming.date.slice(0, 7);
  }
  const [y, m] = state.month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = first.getUTCDay(); // weeks start on Sunday
  const posts = filtered();
  const today = todayAt();
  let cells = '';
  for (let i = 0; i < lead; i++) cells += '<div class="ct-day out"></div>';
  for (let d = 1; d <= days; d++) {
    const key = `${state.month}-${String(d).padStart(2, '0')}`;
    const list = posts.filter((p) => p.date?.startsWith(key)).sort(byDate);
    cells += `<div class="ct-day${key === today ? ' today' : ''}" data-day="${key}">
      <span class="ct-dnum" dir="ltr">${d}</span>
      ${list.map((p) => `<button type="button" class="ct-chip st-${stOf(p)}" data-open="${p.id}"><span class="ct-chip-t">${esc(p.title)}</span><span class="ct-chip-pf">${pfBadges(p)}</span></button>`).join('')}
      <button type="button" class="ct-add" data-new="${key}" aria-label="منشور جديد يوم ${d}">+</button>
    </div>`;
  }
  const undated = posts.filter((p) => !p.date);
  $('ctView').innerHTML = `
    <div class="ct-cal-head">
      <button type="button" class="btn btn-ghost-dark" id="ctPrev" aria-label="الشهر السابق">→</button>
      <h2>${MONTHS[m - 1]} <span dir="ltr">${y}</span></h2>
      <button type="button" class="btn btn-ghost-dark" id="ctNext" aria-label="الشهر التالي">←</button>
    </div>
    <div class="ct-cal-scroll"><div class="ct-cal">${DAYS.map((d) => `<div class="ct-dow">${d}</div>`).join('')}${cells}</div></div>
    <div class="ct-dayview" id="ctDayView" aria-live="polite"></div>
    ${undated.length ? `<h3 class="ct-sub">بدون تاريخ</h3><div class="ct-grid">${undated.map(card).join('')}</div>` : ''}`;
  const shift = (n) => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); state.month = d.toISOString().slice(0, 7); renderCalendar(); };
  $('ctPrev').onclick = () => shift(-1);
  $('ctNext').onclick = () => shift(1);
  bindOpen($('ctView'));
  // phones: the month is compact (dots per post); tapping a day lists its posts underneath
  if (!state.day?.startsWith(state.month)) {
    state.day = today.startsWith(state.month) ? today : (posts.find((p) => p.date?.startsWith(state.month))?.date.slice(0, 10) || `${state.month}-01`);
  }
  $('ctView').querySelectorAll('.ct-day[data-day]').forEach((c) => c.addEventListener('click', (e) => {
    if (!phone()) return;
    e.preventDefault(); e.stopPropagation();
    state.day = c.dataset.day; drawDay(posts);
  }, true));
  drawDay(posts);
}

const phone = () => matchMedia('(max-width: 640px)').matches;
function drawDay(posts) {
  const key = state.day, box = $('ctDayView'); if (!box) return;
  $('ctView').querySelectorAll('.ct-day[data-day]').forEach((c) => c.classList.toggle('sel', c.dataset.day === key));
  const list = posts.filter((p) => p.date?.startsWith(key)).sort(byDate);
  const [, mm, dd] = key.split('-').map(Number);
  box.innerHTML = `<div class="ct-dayview-head"><b><span dir="ltr">${dd}</span> ${MONTHS[mm - 1]}</b><button type="button" class="btn btn-ghost-dark" data-new="${key}">+ منشور في هذا اليوم</button></div>
    ${list.length ? list.map((p) => `<button type="button" class="ct-dayitem st-${stOf(p)}" data-open="${p.id}"><span class="pill ct-st st-${stOf(p)}">${LABEL[stOf(p)]}</span><b>${esc(p.title)}</b><span class="muted">${esc(fmtAt(p.date))}</span><span class="ct-pfs">${pfBadges(p)}</span></button>`).join('') : '<p class="muted">لا منشورات في هذا اليوم.</p>'}`;
  bindOpen(box);
}

function card(p) {
  const cover = (p.media || [])[0];
  const st = stOf(p);
  return `<button type="button" class="ct-post${p.proposal ? ' proposal' : ''}" data-open="${p.id}">
    <span class="ct-cover">${cover ? (isVideo(cover) ? videoThumb(cover, p.cover) : `<img src="${thumb(cover)}" alt="" loading="lazy">`) : `<span class="ct-kind">${esc(KINDS[p.kind] || '')}<small>بدون ملفات بعد</small></span>`}
      ${(p.media || []).length > 1 ? `<i class="ct-count" dir="ltr">1/${p.media.length}</i>` : ''}</span>
    <span class="ct-post-body">
      <span class="pill ct-st st-${st}">${LABEL[st]}</span>
      <b>${esc(p.title)}</b>
      <span class="muted">${esc(fmtAt(p.date))} · ${esc(KINDS[p.kind] || '')}</span>
      <span class="ct-pfs">${pfBadges(p)}</span>
    </span>
  </button>`;
}

function renderList() {
  const posts = filtered().sort(byDate);
  $('ctView').innerHTML = posts.length ? `<div class="ct-grid">${posts.map(card).join('')}</div>` : '<p class="empty">لا توجد منشورات بهذه الحالة.</p>';
  bindOpen($('ctView'));
}

function bindOpen(root) {
  root.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openEditor(b.dataset.open)));
  root.querySelectorAll('[data-new]').forEach((b) => b.addEventListener('click', () => newPost(b.dataset.new + 'T20:00')));
}

async function newPost(date = '') {
  try {
    const d = await act('create', { title: 'منشور جديد', date, platforms: ['instagram', 'facebook'] });
    absorb(d); state.posts.some((p) => p.id === d.post.id) || state.posts.push(d.post);
    render(); openEditor(d.post.id, true);
  } catch (e) { toast(errText(e), true); }
}

// ---------- editor ----------
let capTab = 'all';

function openEditor(id, fresh = false) {
  const p = state.posts.find((x) => x.id === id);
  if (!p) return;
  state.open = id; state.dirty = false; capTab = 'all';
  if (location.hash !== '#content/' + id) history.replaceState(null, '', '#content/' + id);
  drawEditor(p);
  const dlg = $('ctDialog');
  if (!dlg.open) dlg.showModal();
  if (fresh) setTimeout(() => { const t = $('ceTitle'); t.focus(); t.select(); }, 30);
  // pick up files added straight into the post's Drive folder
  if (p.folderId) call(api('files', { id })).then((d) => { absorb(d); if (state.open === id) drawMedia(); render(); }).catch(() => {});
}

function current() { return state.posts.find((x) => x.id === state.open); }

/** Reads the form into a patch (unsaved edits live in the form until «حفظ»). */
function formPatch() {
  const captions = { ...(current().captions || {}) };
  captions[capTab] = $('ceCaption').value;
  return {
    title: $('ceTitle').value,
    kind: $('ceKind').value,
    date: $('ceDate').value,
    platforms: PLATFORM_IDS.filter((pf) => $('cePf_' + pf).checked),
    captions,
    notes: $('ceNotes').value,
  };
}

function drawEditor(p) {
  const f = $('ctForm');
  const st = stOf(p);
  f.innerHTML = `
    <div class="ct-dlg-head">
      <div><span class="pill ct-st st-${st}">${LABEL[st]}</span> <span class="muted">${esc(fmtAt(p.date))}</span>${p.from?.by === 'claude' ? ' <span class="pill ct-from">✦ من Claude</span>' : ''}</div>
      <button type="button" class="ct-x" id="ceClose" aria-label="إغلاق">✕</button>
    </div>
    ${p.proposal ? `
    <div class="ct-proposal">
      <b>✦ مقترح من Claude</b>
      <span class="muted">أُنشئ ${esc(fmtTime(p.proposal.at))} · ${p.date ? `الموعد المقترح ${esc(fmtAt(p.date))}` : 'بدون موعد مقترح'} · لم يُجدول بعد</span>
      ${p.proposal.idea ? `<p><b>فكرة الصورة:</b> ${esc(p.proposal.idea)}</p>` : ''}
      ${CLIENT_MODE ? `
        <div class="ct-prop-acts"><button type="button" class="btn btn-lime" id="cePropOk">اعتماد وجدولة</button><button type="button" class="btn btn-ghost-dark" id="cePropNo">رفض</button></div>
        <div class="ct-prop-why" id="cePropWhy" hidden><input id="cePropReason" maxlength="300" placeholder="سبب الرفض (اختياري، يتعلّم منه Claude)"><button type="button" class="btn btn-dark" id="cePropReject">تأكيد الرفض</button></div>
        <small class="muted">يمكنك تعديل المقترح قبل اعتماده. الاعتماد يجدوله على المنصات المختارة في موعده.</small>`
      : '<span class="muted">بانتظار موافقة العميل من حسابه.</span>'}
    </div>` : ''}
    <label class="ct-field"><span id="ctDlgTitle">العنوان</span><input id="ceTitle" maxlength="200" value="${esc(p.title)}" required></label>
    <div class="ct-row">
      <label class="ct-field"><span>النوع</span><select id="ceKind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}"${p.kind === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="ct-field"><span>الموعد المخطط (توقيت الجزائر)</span><input id="ceDate" type="datetime-local" value="${esc(p.date || '')}"></label>
    </div>
    <fieldset class="ct-field ct-pfpick"><legend>المنصات</legend>
      ${PLATFORM_IDS.map((pf) => `<label class="ct-check"><input type="checkbox" id="cePf_${pf}"${(p.platforms || []).includes(pf) ? ' checked' : ''}> ${PLATFORMS[pf].name}</label>`).join('')}
    </fieldset>

    <section class="ct-sec"><div class="ct-sec-head"><h3>الصور والفيديو</h3>
      <label class="btn btn-ghost-dark ct-upload">رفع ملفات<input type="file" id="ceFiles" accept="image/*,video/*" multiple hidden></label></div>
      <div id="ceMedia"></div>
      <div id="ceUploads"></div>
      <div id="ceCover"></div>
      ${p.folderUrl ? `<p class="muted">الملفات في <a href="${esc(p.folderUrl)}" target="_blank" rel="noopener">مجلد المنشور على Drive ↗</a>. أي ملف تضيفه هناك يظهر هنا.</p>` : ''}
    </section>

    <section class="ct-sec"><div class="ct-sec-head"><h3>النص</h3><button type="button" class="copy-ico" id="ceCopy" aria-label="نسخ النص" title="نسخ النص">${COPY_ICON}</button></div>
      <div class="ct-captabs" role="tablist">
        <button type="button" role="tab" data-cap="all" aria-selected="true">النص العام</button>
        ${PLATFORM_IDS.map((pf) => `<button type="button" role="tab" data-cap="${pf}" aria-selected="false">${PLATFORMS[pf].name}${(p.captions?.[pf] || '').trim() ? ' •' : ''}</button>`).join('')}
      </div>
      <textarea id="ceCaption" rows="8"></textarea>
      <div class="ct-capfoot"><span class="muted" id="ceCapHint"></span><span class="ct-counter" id="ceCount" dir="ltr"></span></div>
    </section>

    <label class="ct-field"><span>ملاحظات داخلية</span><textarea id="ceNotes" rows="2" placeholder="فكرة التصميم، مراجع، ما يجب تذكّره">${esc(p.notes || '')}</textarea></label>

    <div class="ct-save"><button type="button" class="btn btn-dark" id="ceSave">حفظ المسودة</button><span class="muted" id="ceSaved" role="status"></span></div>

    <section class="ct-sec ct-sched" id="ceSched"></section>

    <div class="ct-dlg-foot"><button type="button" class="link-btn ct-danger" id="ceDelete">حذف المنشور</button></div>`;

  drawCaption(p);
  drawMedia();
  drawSchedule(p);
  const mark = () => { state.dirty = true; $('ceSaved').textContent = 'تعديلات غير محفوظة'; };
  f.querySelectorAll('input, select, textarea').forEach((el) => el.addEventListener('input', mark));
  f.querySelectorAll('[data-cap]').forEach((b) => b.addEventListener('click', () => {
    const p2 = current(); p2.captions = { ...(p2.captions || {}), [capTab]: $('ceCaption').value };
    capTab = b.dataset.cap; drawCaption(p2);
  }));
  $('ceCaption').addEventListener('input', countCaption);
  $('ceCopy').onclick = (e) => copy(e.currentTarget, capTab === 'all' ? $('ceCaption').value : ($('ceCaption').value.trim() || current().captions?.all || ''));
  $('ceSave').onclick = () => save();
  $('ceClose').onclick = close;
  if ($('cePropOk')) {
    $('cePropOk').onclick = async (e) => {
      const b = e.currentTarget; b.disabled = true;
      try {
        if (state.dirty) await save(true);
        const d = await act('proposal-approve', { id: p.id }); absorb(d); render(); drawEditor(current());
        toast(d.tiktok_settings ? (d.scheduled ? 'اعتُمد وجُدول. بقي تيك توك: اختر إعداداته في الأسفل ثم جدوِله.' : 'اعتُمد. اختر إعدادات تيك توك في الأسفل ثم جدوِله.')
          : d.scheduled ? 'اعتُمد وجُدول في موعده.' : 'اعتُمد. اختر الموعد ثم جدوِله.');
      } catch (err) { b.disabled = false; toast(errText(err), true); }
    };
    // (the editor is a form, so the reason box is a plain block, not a nested form)
    $('cePropNo').onclick = () => { $('cePropWhy').hidden = !$('cePropWhy').hidden; if (!$('cePropWhy').hidden) $('cePropReason').focus(); };
    const reject = async () => {
      const b = $('cePropReject'); b.disabled = true;
      try { absorb(await act('proposal-reject', { id: p.id, reason: $('cePropReason').value })); state.dirty = false; close(); render(); toast('رُفض المقترح.'); }
      catch (err) { b.disabled = false; toast(errText(err), true); }
    };
    $('cePropReject').onclick = reject;
    $('cePropReason').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); reject(); } };
  }
  $('ceFiles').onchange = (e) => upload([...e.target.files]);
  $('ceDelete').onclick = (e) => {
    if (e.target.dataset.armed) return remove();
    e.target.dataset.armed = '1'; e.target.textContent = 'اضغط مرة أخرى لتأكيد الحذف (والملفات على Drive)';
    setTimeout(() => { if (e.target.isConnected) { delete e.target.dataset.armed; e.target.textContent = 'حذف المنشور'; } }, 4000);
  };
}

function drawCaption(p) {
  document.querySelectorAll('[data-cap]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.cap === capTab)));
  const ta = $('ceCaption');
  ta.value = p.captions?.[capTab] || '';
  ta.placeholder = capTab === 'all' ? 'النص الذي يُنشر على كل المنصات…' : `اتركه فارغًا ليستخدم النص العام، أو اكتب نصًا خاصًا بـ ${PLATFORMS[capTab].name}.`;
  $('ceCapHint').textContent = capTab === 'all' ? 'يُستخدم على كل منصة ليس لها نص خاص.' : (ta.value.trim() ? `نص خاص بـ ${PLATFORMS[capTab].name}.` : `يستخدم النص العام حاليًا.`);
  countCaption();
}

function countCaption() {
  const n = [...$('ceCaption').value].length;
  const limits = capTab === 'all' ? Math.min(...current().platforms.map((pf) => PLATFORMS[pf].limit).concat([63206])) : PLATFORMS[capTab].limit;
  const c = $('ceCount');
  c.textContent = `${n.toLocaleString('en-US')} / ${limits.toLocaleString('en-US')}`;
  c.classList.toggle('over', n > limits);
}

async function copy(btn, text) {
  try {
    await navigator.clipboard.writeText(text); toast('نُسخ النص.');
    btn.classList.add('done'); clearTimeout(btn._t); btn._t = setTimeout(() => btn.classList.remove('done'), 1600);
  } catch { toast('تعذّر النسخ. حدّد النص وانسخه يدويًا.', true); }
}

async function save(quiet = false) {
  const p = current();
  try {
    const d = await act('update', { id: p.id, ...formPatch() });
    absorb(d); state.dirty = false;
    render();
    if (!quiet) drawEditor(current());
    if ($('ceSaved')) $('ceSaved').textContent = 'تم الحفظ' + (Object.keys(d.post.schedule || {}).length ? '، وحُدّثت أحداث التقويم.' : '.');
    return true;
  } catch (e) { toast(errText(e), true); return false; }
}

function close() {
  if (state.dirty && !$('ceSave').dataset.warned) {
    $('ceSave').dataset.warned = '1';
    $('ceSaved').textContent = 'لديك تعديلات غير محفوظة. اضغط ✕ مرة أخرى للإغلاق بدون حفظ.';
    return;
  }
  state.open = null; state.dirty = false;
  $('ctDialog').close();
  history.replaceState(null, '', '#content');
}
$('ctDialog').addEventListener('cancel', (e) => { e.preventDefault(); close(); });

async function remove() {
  try { absorb(await act('delete', { id: state.open })); state.dirty = false; close(); render(); toast('حُذف المنشور.'); }
  catch (e) { toast(errText(e), true); }
}

// ---------- media ----------
function drawMedia() {
  const p = current(); if (!p || !$('ceMedia')) return;
  const media = p.media || [];
  $('ceMedia').innerHTML = media.length ? `<ol class="ct-media">${media.map((m, i) => `
    <li>
      <a class="ct-mthumb" href="${isVideo(m) ? esc(videoSrc(m)) : CLIENT_MODE || tenant || m.store ? esc(thumb(m, 1600)) : `https://drive.google.com/file/d/${encodeURIComponent(m.id)}/view`}" target="_blank" rel="noopener" title="${esc(m.name)}"${isVideo(m) ? ` data-play="${i}"` : ''}>
        ${isVideo(m) ? videoThumb(m, p.cover) : `<img src="${thumb(m, 360)}" alt="${esc(m.name)}" loading="lazy">`}<i class="ct-idx" dir="ltr">${i + 1}</i>${CLIENT_MODE ? `<i class="ct-store${m.store === 'cloud' ? ' cloud' : ''}">${m.store === 'cloud' ? 'تخزين نواة' : 'Drive'}</i>` : ''}</a>
      <span class="ct-mtools">
        <button type="button" data-mv="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="تقديم">→</button>
        <button type="button" data-mv="${i}" data-d="1" ${i === media.length - 1 ? 'disabled' : ''} aria-label="تأخير">←</button>
        ${CLIENT_MODE ? '' : `<a href="https://drive.google.com/uc?id=${encodeURIComponent(m.id)}&export=download" aria-label="تنزيل">⤓</a>`}
        <button type="button" data-rm="${m.id}" aria-label="حذف">✕</button>
      </span>
    </li>`).join('')}</ol>` : '<p class="muted">لا توجد ملفات بعد. للكاروسيل ارفع عدة صور بالترتيب.</p>';
  drawCover(p);
  $('ceMedia').querySelectorAll('[data-play]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); playVideo(media[Number(a.dataset.play)], p.cover); }));
  $('ceMedia').querySelectorAll('[data-mv]').forEach((b) => b.addEventListener('click', async () => {
    const i = Number(b.dataset.mv), j = i + Number(b.dataset.d);
    const order = media.map((m) => m.id); [order[i], order[j]] = [order[j], order[i]];
    try { absorb(await act('update', { id: p.id, media: order })); drawMedia(); render(); } catch (e) { toast(errText(e), true); }
  }));
  $('ceMedia').querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', async () => {
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'تأكيد'; b.classList.add('armed'); return; }
    try { absorb(await act('detach', { id: p.id, fileId: b.dataset.rm, trash: true })); drawMedia(); render(); toast('حُذف الملف (في سلة Drive).'); } catch (e) { toast(errText(e), true); }
  }));
}

// ---------- a video post's cover image (sent as the reel cover / video thumbnail when publishing) ----------
function drawCover(p) {
  const box = $('ceCover'); if (!box) return;
  const hasVideo = (p.media || []).some(isVideo) || p.kind === 'video';
  if (!hasVideo && !p.cover) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="ct-coverfield">
    <div class="ct-coverthumb">${p.cover ? `<img src="${thumb(p.cover, 360)}" alt="صورة الغلاف">` : '<span>بدون غلاف</span>'}</div>
    <div class="ct-covertext"><b>صورة الغلاف</b><span class="muted">تُرسل غلافًا للريل على إنستغرام وصورةً مصغّرة للفيديو على فيسبوك. الأفضل صورة 9:16 (1080×1920). بدونها تختار المنصة إطارًا من الفيديو.</span>
      <span class="ct-coveracts"><label class="btn btn-ghost-dark ct-upload">${p.cover ? 'تغيير الغلاف' : 'رفع غلاف'}<input type="file" id="ceCoverFile" accept="image/jpeg,image/png,image/webp" hidden></label>${p.cover ? '<button type="button" class="link-btn ct-danger" id="ceCoverRm">إزالة</button>' : ''}</span></div>
  </div>`;
  $('ceCoverFile').onchange = (e) => { const f = e.target.files?.[0]; if (f) upload([f], { asCover: true }); e.target.value = ''; };
  if ($('ceCoverRm')) $('ceCoverRm').onclick = async () => {
    try { absorb(await act('cover-remove', { id: p.id })); drawMedia(); render(); toast('أُزيل الغلاف.'); } catch (err) { toast(errText(err), true); }
  };
}

async function upload(files, { asCover = false } = {}) {
  const p = current();
  if (state.dirty) await save(true);
  for (const file of files) {
    const row = document.createElement('div');
    row.className = 'ct-up';
    row.innerHTML = `<span>${esc(file.name)}</span><progress max="100" value="0"></progress>`;
    $('ceUploads').appendChild(row);
    try {
      const d = await act('upload', { id: p.id, name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size });
      absorb(d);
      const uploaded = await new Promise((resolve, reject) => {
        const x = new XMLHttpRequest();
        x.open('PUT', d.uploadUrl);
        if (d.contentType) x.setRequestHeader('Content-Type', d.contentType); // «تخزين نواة» keeps the file's type
        x.upload.onprogress = (e) => { if (e.lengthComputable) row.querySelector('progress').value = (e.loaded / e.total) * 100; };
        // Google answers with the new file; «تخزين نواة» answers empty and the id comes from the server
        x.onload = () => (x.status < 300 ? resolve(d.fileId ? { id: d.fileId } : JSON.parse(x.responseText || '{}')) : reject(new Error('upload ' + x.status)));
        x.onerror = () => reject(new Error('network'));
        x.send(file);
      });
      absorb(await act('attach', { id: p.id, file: { id: uploaded.id }, ...(asCover ? { as: 'cover' } : {}) }));
      row.remove();
    } catch (e) {
      row.classList.add('bad'); row.querySelector('progress').remove();
      // a refused connection is usually the storage's CORS rule; a status is the storage refusing the upload
      const why = e.code ? errText(e) : e.message === 'network' ? 'تعذّر الرفع: رفض التخزين الاتصال.' : `تعذّر الرفع (${e.message.replace('upload ', 'رمز ')}).`;
      row.insertAdjacentHTML('beforeend', `<span>${esc(why)}</span>`);
    }
    drawMedia(); render();
  }
  if (state.open === p.id) { const cur = current(); $('ceKind').value = cur.kind; drawSchedule(cur); }
  $('ceFiles').value = '';
}

// ---------- scheduling (approval) ----------
function drawSchedule(p) {
  const box = $('ceSched'); if (!box) return;
  const pfs = p.platforms || [];
  const def = p.date || `${todayAt()}T20:00`;
  box.innerHTML = `<div class="ct-sec-head"><h3>الموافقة والجدولة</h3></div>
    <p class="muted">الجدولة هي موافقتك: تضيف حدثًا في تقويم «Nawa · Content» مع تذكير قبل ساعة. يُحفظ أي تعديل غير محفوظ أولًا.</p>
    ${state.meta?.configured ? `<p class="ct-metabar">${state.meta.accounts ? `<b>النشر المباشر مفعّل</b> · فيسبوك: <bdi>${esc(state.meta.accounts.page)}</bdi> · إنستغرام: <bdi dir="ltr">@${esc(state.meta.accounts.ig)}</bdi>. المنشورات المجدولة على هاتين المنصتين تُنشر وحدها في موعدها (خلال 5 دقائق).` : `<b>Meta:</b> ${esc(state.meta.error || 'تعذّر التحقق من الحساب.')}`}</p>` : ''}
    ${pfs.length ? `<div class="ct-all">
      <input type="datetime-local" id="ceAllAt" value="${esc(def)}" aria-label="موعد كل المنصات">
      <button type="button" class="btn btn-lime" id="ceAll">جدولة على كل المنصات (${pfs.length})</button>
    </div>
    <ul class="ct-pfrows">${pfs.map((pf) => {
      const s = p.schedule?.[pf]; const st = platformStatus(p, pf);
      const tt = pf === 'tiktok' && Boolean(state.meta?.tiktok?.connected);
      const li = pf === 'linkedin' && Boolean(state.meta?.linkedin?.ready);
      const direct = tt || li || (state.meta?.configured && AUTO_PLATFORMS.includes(pf));
      const ttBlock = tt && st !== 'published' && !ttReady(p); // TikTok's settings must be chosen first
      const canPublish = direct && st !== 'published' && st !== 'publishing' && !(pf === 'instagram' && !(p.media || []).length);
      return `<li class="ct-pfrow">
        <span class="ct-pfname"><b>${PLATFORMS[pf].name}</b><span class="pill ct-st st-${st}">${STATUS[st]}${s?.at ? ` · <span dir="ltr">${esc(s.at.replace('T', ' '))}</span>` : ''}</span></span>
        <input type="datetime-local" data-at="${pf}" value="${esc(s?.at || def)}" aria-label="موعد ${PLATFORMS[pf].name}">
        <span class="ct-pfbtns">
          <button type="button" class="btn btn-ghost-dark" data-one="${pf}"${ttBlock ? ' disabled' : ''}>${s ? 'تحديث الموعد' : 'جدولة هنا فقط'}</button>
          ${canPublish ? `<button type="button" class="btn btn-dark" data-now="${pf}"${ttBlock ? ' disabled' : ''}>انشر الآن على ${PLATFORMS[pf].name}</button>` : ''}
          ${direct && s && st === 'scheduled' ? `<button type="button" class="link-btn" data-auto="${pf}" data-v="${s.auto === false}">${s.auto === false ? 'تفعيل النشر التلقائي' : 'إيقاف النشر التلقائي'}</button>` : ''}
          ${s && !(direct && (st !== 'published' || s.remote)) ? `<button type="button" class="btn btn-ghost-dark" data-pub="${pf}" data-v="${st !== 'published'}">${st === 'published' ? 'إلغاء «منشور»' : 'تم النشر ✓'}</button>` : ''}
          ${s && st !== 'published' ? `<button type="button" class="link-btn ct-danger" data-un="${pf}">إلغاء الجدولة</button>` : ''}
          <button type="button" class="copy-ico" data-copy="${pf}" aria-label="نسخ نص ${PLATFORMS[pf].name}" title="نسخ نص ${PLATFORMS[pf].name}">${COPY_ICON}</button>
        </span>
        ${direct ? `<span class="ct-metas">${metaLine(p, pf)}</span>` : ''}
        ${tt && st !== 'published' && st !== 'publishing' ? '<div class="ct-tt" id="ceTT"></div>' : ''}
      </li>`;
    }).join('')}</ul>` : '<p class="muted">اختر منصة واحدة على الأقل في الأعلى ثم احفظ.</p>'}`;

  const run = async (fn, okMsg) => {
    box.querySelectorAll('button').forEach((b) => (b.disabled = true));
    try {
      if (state.dirty && !(await save(true))) return;
      absorb(await fn()); render(); drawEditor(current()); toast(okMsg);
    } catch (e) { toast(errText(e), true); drawSchedule(current()); }
  };
  if ($('ceAll')) $('ceAll').onclick = () => run(() => act('schedule', { id: p.id, platforms: current().platforms, at: $('ceAllAt').value }), 'جُدول على كل المنصات وأُضيف إلى التقويم.');
  box.querySelectorAll('[data-one]').forEach((b) => b.addEventListener('click', () => {
    const pf = b.dataset.one;
    run(() => act('schedule', { id: p.id, platforms: [pf], at: box.querySelector(`[data-at="${pf}"]`).value }), `جُدول على ${PLATFORMS[pf].name}.`);
  }));
  box.querySelectorAll('[data-un]').forEach((b) => b.addEventListener('click', () => run(() => act('unschedule', { id: p.id, platforms: [b.dataset.un] }), 'أُلغيت الجدولة وحُذف الحدث من التقويم.')));
  box.querySelectorAll('[data-pub]').forEach((b) => b.addEventListener('click', () => run(() => act('published', { id: p.id, platform: b.dataset.pub, value: b.dataset.v === 'true' }), b.dataset.v === 'true' ? 'سُجّل كمنشور.' : 'أُعيد إلى «مجدول».')));
  box.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => copy(b, captionFor({ ...current(), captions: formPatch().captions }, b.dataset.copy))));
  box.querySelectorAll('[data-auto]').forEach((b) => b.addEventListener('click', () => run(() => act('auto', { id: p.id, platform: b.dataset.auto, value: b.dataset.v === 'true' }), b.dataset.v === 'true' ? 'سيُنشر تلقائيًا في موعده.' : 'أُوقف النشر التلقائي لهذه المنصة.')));
  box.querySelectorAll('[data-now]').forEach((b) => b.addEventListener('click', async () => {
    const pf = b.dataset.now;
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = `تأكيد: انشر على ${PLATFORMS[pf].name} الآن`; b.classList.add('armed'); setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = `انشر الآن على ${PLATFORMS[pf].name}`; b.classList.remove('armed'); } }, 5000); return; }
    b.textContent = 'جارٍ النشر… قد يستغرق دقيقة';
    let result = '';
    await run(async () => { const d = await act('publish', { id: p.id, platform: pf }); result = d.result; return d; },
      `نُشر على ${PLATFORMS[pf].name}.`);
    if (result === 'pending') toast(pf === 'tiktok' ? 'أُرسل إلى تيك توك. قد يستغرق ظهور الفيديو بضع دقائق.' : pf === 'linkedin' ? 'لينكدإن يعالج الفيديو. سيُنشر تلقائيًا خلال دقائق.' : 'إنستغرام يعالج الفيديو. سيُنشر تلقائيًا خلال دقائق.');
    else if (result === 'published' && pf === 'tiktok') toast('نُشر على تيك توك. قد يستغرق ظهوره في الحساب بضع دقائق.');
    else if (result === 'failed') toast(current()?.schedule?.[pf]?.error?.message || 'تعذّر النشر.', true);
  }));
  drawTikTok(p);
}

// ---------- TikTok: what TikTok requires before a Direct Post ----------
// The account it goes to (asked from TikTok each time), who can watch (no default), interactions (off
// by default, greyed out when the account turned them off), the commercial content disclosure, the
// consent line, and the video's length against the account's limit.
const TTX = {
  ar: { to: 'سيُنشر على حساب تيك توك', who: 'من يمكنه مشاهدة الفيديو؟', pick: 'اختر…', PUBLIC_TO_EVERYONE: 'الجميع', MUTUAL_FOLLOW_FRIENDS: 'الأصدقاء', FOLLOWER_OF_CREATOR: 'المتابعون', SELF_ONLY: 'أنا فقط', allow: 'السماح للمستخدمين بـ', comment: 'التعليق', duet: 'الثنائي (Duet)', stitch: 'الدمج (Stitch)', off: 'متوقف في إعدادات حسابك', disclose: 'الإفصاح عن محتوى تجاري', discloseSub: 'فعّله إذا كان الفيديو يروّج لك أو لعلامة تجارية أو منتج أو خدمة.', own: 'علامتك التجارية', ownSub: 'تروّج لنفسك أو لنشاطك.', paid: 'محتوى ممول', paidSub: 'تروّج لعلامة تجارية أخرى أو لطرف ثالث.', pickOne: 'اختر واحدًا على الأقل لتتمكن من النشر.', labelOwn: 'سيُوسم الفيديو بـ «محتوى ترويجي» (Promotional content).', labelPaid: 'سيُوسم الفيديو بـ «شراكة مدفوعة» (Paid partnership).', noPrivate: 'المحتوى الممول لا يمكن أن يكون خاصًا.', consent: 'بالنشر، أنت توافق على', music: 'تأكيد استخدام الموسيقى', bc: 'سياسة المحتوى الممول', and: 'و', tail: ' في تيك توك.', later: 'بعد النشر، قد يستغرق ظهور الفيديو في حسابك بضع دقائق.', tooLong: (a, b) => `مدة الفيديو ${a} ث، والحد في هذا الحساب ${b} ث. قصّره ثم أعد رفعه.`, oneVideo: 'تيك توك هنا يقبل منشورًا بفيديو واحد فقط: ارفع فيديو واحدًا.', loading: 'جارٍ التحقق من حساب تيك توك…', saved: 'حُفظت إعدادات تيك توك.' },
  en: { to: 'Posting to TikTok account', who: 'Who can watch this video?', pick: 'Select…', PUBLIC_TO_EVERYONE: 'Everyone', MUTUAL_FOLLOW_FRIENDS: 'Friends', FOLLOWER_OF_CREATOR: 'Followers', SELF_ONLY: 'Only me', allow: 'Allow users to', comment: 'Comment', duet: 'Duet', stitch: 'Stitch', off: 'turned off in your account settings', disclose: 'Disclose commercial content', discloseSub: 'Turn on if this video promotes yourself, a brand, product or service.', own: 'Your brand', ownSub: 'You are promoting yourself or your own business.', paid: 'Branded content', paidSub: 'You are promoting another brand or a third party.', pickOne: 'Select at least one to publish.', labelOwn: 'Your video will be labeled “Promotional content”.', labelPaid: 'Your video will be labeled “Paid partnership”.', noPrivate: 'Branded content visibility cannot be set to private.', consent: 'By posting, you agree to TikTok’s', music: 'Music Usage Confirmation', bc: 'Branded Content Policy', and: ' and ', tail: '.', later: 'After posting, it may take a few minutes for the video to appear on your profile.', tooLong: (a, b) => `This video is ${a}s; this account allows up to ${b}s. Trim it and upload it again.`, oneVideo: 'TikTok here takes a post with exactly one video: upload one video.', loading: 'Checking your TikTok account…', saved: 'TikTok settings saved.' },
};
const tx = (k, ...a) => { const d = TTX[document.documentElement.lang === 'ar' ? 'ar' : 'en']; return typeof d[k] === 'function' ? d[k](...a) : d[k]; };
const ttVideo = (p) => ((p.media || []).length === 1 && isVideo(p.media[0]) ? p.media[0] : null);
const ttDur = {}; // video id -> seconds, read in the browser
function ttReady(p) {
  const t = p.tiktok || {}, c = state.ttCreator?.id === p.id ? state.ttCreator.c : null, v = ttVideo(p);
  if (!v || !t.privacy || (c && !c.privacy.includes(t.privacy))) return false;
  if (t.commercial && !t.brand_own && !t.brand_paid) return false;
  if (t.brand_paid && t.privacy === 'SELF_ONLY') return false;
  if (c?.max_duration && ttDur[v.id] > c.max_duration) return false;
  return true;
}
async function drawTikTok(p) {
  const box = $('ceTT'); if (!box) return;
  if (state.ttCreator?.id !== p.id || Date.now() - state.ttCreator.at > 120e3) {
    box.innerHTML = `<p class="muted">${esc(tx('loading'))}</p>`;
    try { state.ttCreator = { id: p.id, at: Date.now(), c: (await call(api('tiktok-creator'))).creator }; }
    catch (e) { if ($('ceTT')) $('ceTT').innerHTML = `<p class="ct-meta bad">${esc(errText(e))}</p>`; return; }
    if (current()?.id !== p.id || !$('ceTT')) return;
    return drawSchedule(current()); // the buttons depend on what the account allows
  }
  const c = state.ttCreator.c, t = p.tiktok || {}, v = ttVideo(p);
  // the video's length, read once from the file
  if (v && ttDur[v.id] === undefined) {
    ttDur[v.id] = 0;
    const el = document.createElement('video'); el.preload = 'metadata'; el.muted = true; el.src = videoSrc(v);
    el.onloadedmetadata = () => { ttDur[v.id] = Math.round(el.duration || 0); el.removeAttribute('src'); const cur = current(); if (cur?.id === p.id && $('ceTT')) drawSchedule(cur); };
  }
  const tooLong = v && c.max_duration && ttDur[v.id] > c.max_duration;
  const link = (href, label) => `<a href="${href}" target="_blank" rel="noopener">${esc(label)}</a>`;
  const music = link('https://www.tiktok.com/legal/page/global/music-usage-confirmation/en', tx('music'));
  const bc = link('https://www.tiktok.com/legal/page/global/bc-policy/en', tx('bc'));
  box.innerHTML = `
    <div class="ct-tt-acct">${c.avatar ? `<img src="${esc(c.avatar)}" alt="" width="36" height="36">` : ''}<span><small class="muted">${esc(tx('to'))}</small><b>${esc(c.nickname || c.username)}</b>${c.username ? ` <bdi dir="ltr" class="muted">@${esc(c.username)}</bdi>` : ''}</span></div>
    ${!v ? `<p class="ct-meta bad">${esc(tx('oneVideo'))}</p>` : tooLong ? `<p class="ct-meta bad">${esc(tx('tooLong', ttDur[v.id], c.max_duration))}</p>` : ''}
    <label class="ct-field"><span>${esc(tx('who'))}</span><select id="ttPrivacy"><option value=""${t.privacy ? '' : ' selected'} disabled>${esc(tx('pick'))}</option>${c.privacy.map((x) => {
      const off = x === 'SELF_ONLY' && t.brand_paid;
      return `<option value="${x}"${t.privacy === x ? ' selected' : ''}${off ? ` disabled title="${esc(tx('noPrivate'))}"` : ''}>${esc(tx(x))}${off ? ` · ${esc(tx('noPrivate'))}` : ''}</option>`;
    }).join('')}</select></label>
    <fieldset class="ct-tt-allow"><legend>${esc(tx('allow'))}</legend>
      ${['comment', 'duet', 'stitch'].map((k) => { const off = c[`${k}_disabled`]; return `<label class="ct-check${off ? ' off' : ''}"><input type="checkbox" data-tt="${k}"${t[k] && !off ? ' checked' : ''}${off ? ' disabled' : ''}> ${esc(tx(k))}${off ? ` <small class="muted">(${esc(tx('off'))})</small>` : ''}</label>`; }).join('')}
    </fieldset>
    <div class="ct-tt-cc">
      <label class="ct-switch"><input type="checkbox" data-tt="commercial"${t.commercial ? ' checked' : ''}><span><b>${esc(tx('disclose'))}</b><small class="muted">${esc(tx('discloseSub'))}</small></span></label>
      ${t.commercial ? `<div class="ct-tt-brands">
        <label class="ct-check"><input type="checkbox" data-tt="brand_own"${t.brand_own ? ' checked' : ''}> <span><b>${esc(tx('own'))}</b> <small class="muted">${esc(tx('ownSub'))}</small></span></label>
        <label class="ct-check"><input type="checkbox" data-tt="brand_paid"${t.brand_paid ? ' checked' : ''}> <span><b>${esc(tx('paid'))}</b> <small class="muted">${esc(tx('paidSub'))}</small></span></label>
        ${!t.brand_own && !t.brand_paid ? `<p class="ct-meta bad">${esc(tx('pickOne'))}</p>` : `<p class="ct-meta">${esc(tx(t.brand_paid ? 'labelPaid' : 'labelOwn'))}</p>`}
      </div>` : ''}
    </div>
    <p class="ct-tt-consent">${esc(tx('consent'))} ${t.commercial && t.brand_paid ? `${bc}${esc(tx('and'))}${music}` : music}${esc(tx('tail'))}</p>
    <p class="muted ct-tt-later">${esc(tx('later'))}</p>`;
  const saveTT = async (patch) => {
    const cur = current(); const next = { ...(cur.tiktok || {}), ...patch };
    if (!next.commercial) { next.brand_own = false; next.brand_paid = false; }
    if (next.brand_paid && next.privacy === 'SELF_ONLY') next.privacy = '';
    cur.tiktok = next; drawSchedule(cur); // at once, then saved
    try { absorb(await act('tiktok-settings', { id: cur.id, tiktok: next })); } catch (e) { toast(errText(e), true); }
  };
  $('ttPrivacy').onchange = (e) => saveTT({ privacy: e.target.value });
  box.querySelectorAll('[data-tt]').forEach((el) => el.addEventListener('change', () => saveTT({ [el.dataset.tt]: el.checked })));
}

// ---------- boot ----------
document.querySelectorAll('.ct-views button').forEach((b) => b.addEventListener('click', () => {
  state.view = b.dataset.view;
  try { localStorage.setItem('nawa.ct.view', state.view); } catch {}
  render();
}));
$('ctNew').addEventListener('click', () => newPost(''));
window.addEventListener('nawa:content', () => { if (state.busy) return; if (!state.loaded) load(); else { render(); routeHash(); } });
window.addEventListener('nawa:clients', (e) => { state.clients = e.detail; if (state.loaded && !state.busy && !CLIENT_MODE) render(); });
// the admin's «العملاء» section opens a client's content here
window.addEventListener('nawa:tenant', (e) => { switchTenant(e.detail || ''); });
function switchTenant(id) {
  if (CLIENT_MODE || id === tenant) return;
  if ($('ctDialog').open) { state.open = null; state.dirty = false; $('ctDialog').close(); }
  tenant = id; state.month = null; state.filter = 'all';
  if (state.loaded && state.status?.connected) loadContent(); // otherwise opening the section loads it
}
window.addEventListener('hashchange', () => { if (state.loaded && location.hash.startsWith('#content')) routeHash(); });
