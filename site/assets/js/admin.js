// /admin: requests dashboard. Talks to /api/admin/* (session cookie set by /api/admin/login).
import { SERVICES, PROJECT, CONTACT, CURRENCY_NAME, DEFAULT_CURRENCY, t, serviceById, formatAnswer } from './brief-schema.js?v=20261017d';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const STATUS = {
  new: { label: 'جديد', cls: 'st-new' },
  contacted: { label: 'تم التواصل', cls: 'st-contacted' },
  in_progress: { label: 'قيد العمل', cls: 'st-progress' },
  won: { label: 'تم الاتفاق', cls: 'st-won' },
  closed: { label: 'مغلق', cls: 'st-closed' },
};
const LANG_NAME = { ar: 'العربية', en: 'English', fr: 'Français' };

let briefs = [];
let filter = 'all';
const SECTION_HASH = /^#(content|madar)/;
let selected = (!SECTION_HASH.test(location.hash) && location.hash.slice(1)) || null;

async function api(path, opts = {}) {
  const r = await fetch(path, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...opts });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401) { showLogin(); throw new Error('signed_out'); }
  if (!r.ok || data.ok === false) throw Object.assign(new Error(data.error || 'error'), { data, status: r.status });
  return data;
}

// ---------- auth ----------

function showLogin(msg = '') {
  $('booting').hidden = true;
  $('login').hidden = false; $('dash').hidden = true; $('logout').hidden = true; $('setup').hidden = true;
  $('sections').hidden = true; $('content').hidden = true; $('madar').hidden = true;
  $('loginMsg').textContent = msg;
  setTimeout(() => $('pw').focus(), 50);
}

function setBusy(on) {
  const btn = $('loginBtn');
  btn.disabled = on;
  btn.setAttribute('aria-busy', String(on));
  btn.querySelector('.btn-label').textContent = on ? 'جارٍ الدخول…' : 'دخول';
  $('pw').readOnly = on;
}

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if ($('loginBtn').disabled) return;
  $('loginMsg').textContent = '';
  setBusy(true);
  try {
    const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('pw').value }) });
    const data = await r.json().catch(() => ({}));
    if (r.ok) { await boot(); $('pw').value = ''; return; }
    $('loginMsg').textContent = data.error === 'not_configured'
      ? 'لم تُضبط كلمة المرور بعد: أضف ADMIN_PASSWORD في إعدادات Vercel ثم أعد النشر.'
      : r.status === 429 ? 'محاولات كثيرة. انتظر دقيقة ثم حاول مجددًا.' : 'كلمة المرور غير صحيحة.';
  } catch {
    $('loginMsg').textContent = 'تعذّر الاتصال. تحقّق من الإنترنت وحاول مرة أخرى.';
  } finally {
    setBusy(false);
  }
});

$('logout').addEventListener('click', async () => {
  await fetch('/api/admin/login', { method: 'DELETE' });
  showLogin();
});

// ---------- data ----------

async function load() {
  const data = await api('/api/admin/briefs');
  briefs = data.briefs || [];
  $('updated').textContent = 'آخر تحديث: ' + new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });
  render();
}

// ---------- sections: requests | content ----------

let setupNeeded = false;
let section = 'requests';

function showSection(name) {
  section = name;
  $('sections').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.section === name)));
  $('dash').hidden = name !== 'requests' || setupNeeded;
  $('setup').hidden = name !== 'requests' || !setupNeeded;
  $('content').hidden = name !== 'content';
  $('madar').hidden = name !== 'madar';
  document.title = ({ content: 'المحتوى', madar: 'مدار' }[name] || 'الطلبات') + ' | نواة';
  if (name === 'content' || name === 'madar') window.dispatchEvent(new CustomEvent('nawa:' + name));
  else if (SECTION_HASH.test(location.hash)) history.replaceState(null, '', location.pathname + (selected ? '#' + selected : ''));
}
$('sections').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
  const s = b.dataset.section;
  if (s !== 'requests' && !location.hash.startsWith('#' + s)) history.replaceState(null, '', '#' + s);
  showSection(b.dataset.section);
}));
window.addEventListener('hashchange', () => {
  const m = location.hash.match(SECTION_HASH);
  if (!$('sections').hidden && m && section !== m[1]) showSection(m[1]);
});

async function boot() {
  setupNeeded = false;
  try {
    await load();
  } catch (e) {
    if (e.message === 'signed_out') return;
    if (e.message !== 'service_key_missing') return showLogin('تعذّر تحميل الطلبات. حاول مرة أخرى.');
    setupNeeded = true;
    $('setup').innerHTML = `<h1>خطوة أخيرة</h1><p>تسجيل الدخول يعمل، لكن قراءة الطلبات تحتاج مفتاح الخدمة من Supabase. قسم «المحتوى» يعمل بدونه.</p>
      <ol><li>افتح مشروع <b>nawa</b> في Supabase ← Project Settings ← API Keys، وانسخ مفتاح <b dir="ltr">service_role</b> (أو secret).</li>
      <li>في Vercel ← nawa-studio ← Settings ← Environment Variables أضف <code dir="ltr">SUPABASE_SERVICE_ROLE_KEY</code> بهذه القيمة.</li>
      <li>أعد النشر، ثم حدّث هذه الصفحة.</li></ol>`;
  }
  $('booting').hidden = true;
  $('login').hidden = true; $('logout').hidden = false; $('sections').hidden = false;
  showSection(location.hash.match(SECTION_HASH)?.[1] || 'requests');
  if (!setupNeeded) loadTelegram();
}

// ---------- render ----------

const fmtDate = (s) => new Date(s).toLocaleString('ar-DZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const ago = (s) => {
  const m = Math.round((Date.now() - new Date(s)) / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return `قبل ${m} د`;
  const h = Math.round(m / 60);
  if (h < 24) return `قبل ${h} س`;
  return `قبل ${Math.round(h / 24)} يوم`;
};

function render() {
  const counts = Object.fromEntries(Object.keys(STATUS).map((k) => [k, briefs.filter((b) => b.status === k).length]));
  $('stats').innerHTML = [
    ['الكل', briefs.length, ''], ['جديدة', counts.new, 'hl'],
    ['هذا الأسبوع', briefs.filter((b) => Date.now() - new Date(b.created_at) < 7 * 864e5).length, ''],
    ['تم الاتفاق', counts.won, ''],
  ].map(([l, n, c]) => `<div class="stat ${c}"><b dir="ltr">${n}</b><span>${l}</span></div>`).join('');

  $('tabs').innerHTML = [['all', 'الكل', briefs.length], ...Object.entries(STATUS).map(([k, v]) => [k, v.label, counts[k]])]
    .map(([k, l, n]) => `<button type="button" role="tab" data-f="${k}" aria-selected="${filter === k}">${l} <span dir="ltr">${n}</span></button>`).join('');
  $('tabs').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.f; render(); }));

  const shown = briefs.filter((b) => filter === 'all' || b.status === filter);
  $('list').innerHTML = shown.length ? shown.map((b) => {
    const s = STATUS[b.status] || STATUS.new;
    const svc = (b.services || []).map((id) => t(serviceById(id)?.title, 'ar')).filter(Boolean).join(' · ');
    return `<button type="button" class="item${b.id === selected ? ' on' : ''}${b.status === 'new' ? ' unread' : ''}" data-id="${b.id}">
      <span class="item-top"><b>${esc(b.business?.business || '—')}</b><span class="pill ${s.cls}">${s.label}</span></span>
      <span class="item-who">${esc(b.contact?.name || '')}</span>
      <span class="item-svc">${esc(svc)}</span>
      <span class="item-time" title="${esc(fmtDate(b.created_at))}">${ago(b.created_at)}</span>
    </button>`;
  }).join('') : `<p class="empty">لا توجد طلبات ${filter === 'all' ? 'بعد' : 'بهذه الحالة'}.</p>`;
  $('list').querySelectorAll('.item').forEach((el) => el.addEventListener('click', () => select(el.dataset.id)));

  renderDetail();
}

function select(id) {
  selected = id;
  history.replaceState(null, '', '#' + id);
  render();
  if (window.matchMedia('(max-width: 900px)').matches) $('detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function rows(list, values, currency, lang = 'ar') {
  return list.map((q) => [q, formatAnswer(q, values?.[q.id], lang, currency)]).filter(([, v]) => v)
    .map(([q, v]) => `<div class="kv"><span>${esc(t(q.label, lang).replace(/[؟?]\s*$/, ''))}</span><b>${esc(v)}</b></div>`).join('');
}

function renderDetail() {
  const b = briefs.find((x) => x.id === selected);
  const box = $('detail');
  if (!b) { box.innerHTML = '<p class="empty">اختر طلبًا لعرض تفاصيله.</p>'; return; }
  const c = b.contact || {};
  const wa = (c.whatsapp || '').replace(/[^\d]/g, '');
  const services = (b.services || []).map((id) => serviceById(id)).filter(Boolean);
  const currency = b.business?.currency || DEFAULT_CURRENCY;
  box.innerHTML = `
    <div class="d-head">
      <div>
        <span class="muted" dir="ltr">#${b.id.slice(0, 8)}</span>
        <h2>${esc(b.business?.business || '—')}</h2>
        <p class="muted">${esc(fmtDate(b.created_at))} · لغة الطلب: ${LANG_NAME[b.lang] || b.lang}</p>
      </div>
      <label class="status-pick"><span>الحالة</span>
        <select id="statusSel">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${b.status === k ? ' selected' : ''}>${v.label}</option>`).join('')}</select>
      </label>
    </div>

    <div class="d-contact">
      <div><b>${esc(c.name)}</b><span dir="ltr">${esc(c.email)}</span>${c.whatsapp ? `<span dir="ltr">${esc(c.whatsapp)}</span>` : ''}</div>
      <div class="d-actions">
        ${wa ? `<a class="btn btn-lime" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent(`مرحبًا ${c.name || ''}، معك فريق نواة بخصوص طلبك (${b.business?.business || ''}).`)}">واتساب</a>` : ''}
        <a class="btn btn-ghost-dark" href="mailto:${esc(c.email)}?subject=${encodeURIComponent('نواة · طلبك ' + (b.business?.business || ''))}">بريد</a>
      </div>
    </div>
    <p class="prefer">يفضّل التواصل عبر: <b>${esc(formatAnswer(CONTACT.find((q) => q.id === 'prefer'), c.prefer, 'ar'))}</b></p>

    <div class="d-tags">${services.map((s) => `<span class="pv-tag">${esc(t(s.title, 'ar'))}</span>`).join('')}</div>

    ${services.map((s) => `<section class="d-sec"><h3>${esc(t(s.title, 'ar'))}</h3>${rows(s.questions, b.answers?.[s.id], currency) || '<p class="muted">لا توجد إجابات.</p>'}</section>`).join('')}
    <section class="d-sec"><h3>المشروع</h3>${rows(PROJECT, b.business, currency)}<div class="kv"><span>العملة</span><b>${esc(t(CURRENCY_NAME[currency], 'ar'))}</b></div></section>
    ${c.notes ? `<section class="d-sec"><h3>ملاحظات العميل</h3><p class="notes">${esc(c.notes)}</p></section>` : ''}

    <section class="d-sec">
      <h3>ملاحظاتك الداخلية</h3>
      <textarea id="noteBox" rows="3" placeholder="مثال: اتصلت به يوم الأحد، يريد عرض سعر قبل نهاية الشهر">${esc(b.admin_note || '')}</textarea>
      <div class="note-row"><button type="button" class="btn btn-ghost-dark" id="saveNote">حفظ الملاحظة</button><span class="muted" id="noteMsg" role="status"></span></div>
    </section>`;

  $('statusSel').addEventListener('change', (e) => patch(b.id, { status: e.target.value }));
  $('saveNote').addEventListener('click', async () => {
    await patch(b.id, { admin_note: $('noteBox').value });
    $('noteMsg').textContent = 'تم الحفظ.';
  });
}

async function patch(id, body) {
  try {
    const { brief } = await api('/api/admin/briefs', { method: 'PATCH', body: JSON.stringify({ id, ...body }) });
    briefs = briefs.map((b) => (b.id === id ? brief : b));
    render();
  } catch (e) { if (e.message !== 'signed_out') alertBox('تعذّر الحفظ. حاول مرة أخرى.'); }
}
function alertBox(msg) { const n = $('noteMsg'); if (n) n.textContent = msg; }

// ---------- Telegram setup ----------

async function loadTelegram() {
  const box = $('tgBody');
  try {
    const d = await api('/api/admin/telegram');
    if (!d.token) {
      box.innerHTML = `<p>لم يُضبط البوت بعد.</p><ol>
        <li>افتح تيليغرام وراسل <b dir="ltr">@BotFather</b>، أرسل <code dir="ltr">/newbot</code> واختر اسمًا، وانسخ الـ token.</li>
        <li>في Vercel ← Settings ← Environment Variables أضف <code dir="ltr">TELEGRAM_BOT_TOKEN</code>، ثم أعد النشر.</li>
        <li>أرسل أي رسالة لبوتك، ثم عد إلى هنا لتحديد المحادثة.</li></ol>`;
      $('tg').open = true;
      return;
    }
    const chats = d.chats.map((c) => `<li><b>${esc(c.name || c.type)}</b> · <code dir="ltr">${c.id}</code>
      <button type="button" class="link-btn" data-test="${c.id}">إرسال رسالة تجريبية</button></li>`).join('');
    box.innerHTML = `<p>البوت: <b dir="ltr">@${esc(d.bot)}</b> · المحادثة المضبوطة: ${d.chatId ? `<code dir="ltr">${esc(d.chatId)}</code> ✅` : '<b>لم تُضبط بعد</b>'}</p>
      ${d.chatId ? '<p><button type="button" class="btn btn-ghost-dark" data-test="">إرسال رسالة تجريبية</button></p>' : ''}
      ${!d.chatId ? `<p>أرسل رسالة لبوتك على تيليغرام، ثم حدّث. انسخ رقم المحادثة وأضفه في Vercel باسم <code dir="ltr">TELEGRAM_CHAT_ID</code> ثم أعد النشر.</p>` : ''}
      ${chats ? `<p class="muted">محادثات راسلت البوت مؤخرًا:</p><ul>${chats}</ul>` : ''}
      <p class="muted" id="tgMsg" role="status"></p>`;
    if (!d.chatId) $('tg').open = true;
    box.querySelectorAll('[data-test]').forEach((btn) => btn.addEventListener('click', async () => {
      try { await api('/api/admin/telegram', { method: 'POST', body: JSON.stringify({ chatId: btn.dataset.test || undefined }) }); $('tgMsg').textContent = 'أُرسلت الرسالة. تحقّق من تيليغرام.'; }
      catch (e) { $('tgMsg').textContent = 'تعذّر الإرسال: ' + (e.data?.error || e.message); }
    }));
  } catch (e) {
    if (e.message !== 'signed_out') box.textContent = 'تعذّر التحقق من إعدادات تيليغرام.';
  }
}

$('refresh').addEventListener('click', () => load().catch(() => {}));
setInterval(() => { if (!$('dash').hidden && !document.hidden) load().catch(() => {}); }, 60000);
window.addEventListener('nawa:signed-out', () => showLogin());
boot();
