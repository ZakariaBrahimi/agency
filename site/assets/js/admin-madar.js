// /admin → «مدار»: write and publish articles, tips and podcast episodes; read newsletter sign-ups and
// "write with us" pitches. Data lives in Supabase (madar_* tables) through /api/admin/madar.
import { TOPICS, topicById, KINDS, renderMarkdown, readingMinutes, slugify, SLUG, esc } from './madar-schema.js?v=20261017d';

const $ = (id) => document.getElementById(id);
const API = '/api/admin/madar';
const ERR = {
  title_required: 'اكتب عنوانًا.', bad_slug: 'الرابط: حروف إنجليزية صغيرة وأرقام وشرطات فقط.', slug_taken: 'هذا الرابط مستخدم. اختر رابطًا آخر.',
  reserved_slug: 'هذا الرابط محجوز لصفحات مدار. اختر رابطًا آخر.', bad_audio_url: 'رابط الصوت يجب أن يبدأ بـ https://', bad_topic: 'اختر المسار.',
  service_key_missing: 'أضف SUPABASE_SERVICE_ROLE_KEY في Vercel.',
};
const state = { loaded: false, tab: 'posts', kind: 'all', posts: [], subscribers: [], pitches: [], edit: null, dirty: false };

async function call(path, { method = 'GET', body } = {}) {
  const r = await fetch(path, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) { window.dispatchEvent(new Event('nawa:signed-out')); throw Object.assign(new Error('signed_out'), { code: 'signed_out' }); }
  if (!r.ok || d.ok === false) throw Object.assign(new Error(d.error || 'error'), { code: d.error || 'error' });
  return d;
}
const toast = (msg, bad = false) => {
  const t = $('mdToast'); t.textContent = msg; t.classList.toggle('bad', bad); t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 3200);
};
const fmt = (s) => (s ? new Date(s).toLocaleString('ar-DZ', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const publicUrl = (p) => (p.kind === 'article' ? `/madar/${p.slug}` : p.kind === 'tip' ? `/madar/tips/${p.number ?? p.slug}` : `/madar/podcast/${p.slug}`);
const isLive = (p) => p.status === 'published' && p.published_at && new Date(p.published_at) <= new Date();

async function load() {
  const body = $('mdBody');
  body.innerHTML = NawaUI.loading('جارٍ تحميل مدار…', 'cards');
  try {
    const [a, b, c] = await Promise.all([call(`${API}?what=posts`), call(`${API}?what=subscribers`), call(`${API}?what=pitches`)]);
    state.posts = a.posts; state.subscribers = b.subscribers; state.pitches = c.pitches; state.loaded = true;
    render();
  } catch (e) {
    if (e.code !== 'signed_out') body.innerHTML = `<p class="empty">${esc(ERR[e.code] || 'تعذّر التحميل. حاول مرة أخرى.')}</p>`;
  }
}

// ---------- lists ----------
function render() {
  if (state.edit) return renderEditor();
  const newPitches = state.pitches.filter((p) => p.status === 'new').length;
  const tabs = [['posts', 'المحتوى', state.posts.length], ['subscribers', 'المشتركون', state.subscribers.length], ['pitches', 'أفكار الكتّاب', state.pitches.length]];
  $('mdHeadActions').hidden = false;
  $('mdBody').innerHTML = `
    <div class="stats">
      <div class="stat"><b dir="ltr">${state.posts.filter((p) => p.kind === 'article' && isLive(p)).length}</b><span>مقالات منشورة</span></div>
      <div class="stat"><b dir="ltr">${state.posts.filter((p) => p.kind === 'tip' && isLive(p)).length}</b><span>نصائح</span></div>
      <div class="stat"><b dir="ltr">${state.subscribers.length}</b><span>مشتركو رسالة الخميس</span></div>
      <div class="stat${newPitches ? ' hl' : ''}"><b dir="ltr">${newPitches}</b><span>أفكار جديدة من الكتّاب</span></div>
    </div>
    <div class="tabs" role="tablist">${tabs.map(([k, l, n]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${state.tab === k}">${l} <span dir="ltr">${n}</span></button>`).join('')}</div>
    <div id="mdTab"></div>`;
  $('mdBody').querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { state.tab = b.dataset.tab; render(); }));
  ({ posts: renderPosts, subscribers: renderSubscribers, pitches: renderPitches })[state.tab]();
}

function renderPosts() {
  const kinds = [['all', 'الكل'], ['article', 'المقالات'], ['tip', 'النصائح'], ['episode', 'الحلقات']];
  const list = state.posts.filter((p) => state.kind === 'all' || p.kind === state.kind);
  $('mdTab').innerHTML = `
    <div class="md-kinds">${kinds.map(([k, l]) => `<button type="button" data-kind="${k}" aria-pressed="${state.kind === k}">${l}</button>`).join('')}</div>
    ${list.length ? `<div class="md-rows">${list.map((p) => {
      const t = topicById(p.topic);
      const st = p.status === 'draft' ? ['مسودة', 'st-closed'] : isLive(p) ? ['منشور', 'st-won'] : ['مجدول', 'st-progress'];
      return `<button type="button" class="md-row" data-id="${p.id}">
        <span class="md-row-k" style="--tc:${t.color}">${KINDS[p.kind]}${p.number ? ` #${p.number}` : ''}</span>
        <span class="md-row-t"><b>${esc(p.title)}</b><span class="muted">${t.ar}${p.featured ? ' · ★ مميّز' : ''} · ${p.status === 'draft' ? 'آخر تعديل ' + fmt(p.updated_at) : fmt(p.published_at)}</span></span>
        <span class="pill ${st[1]}">${st[0]}</span></button>`;
    }).join('')}</div>` : '<p class="empty">لا شيء هنا بعد. ابدأ بـ «+ جديد».</p>'}`;
  $('mdTab').querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => { state.kind = b.dataset.kind; renderPosts(); }));
  $('mdTab').querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => openEditor(state.posts.find((p) => p.id === b.dataset.id))));
}

function renderSubscribers() {
  const s = state.subscribers;
  $('mdTab').innerHTML = s.length ? `
    <div class="md-sub-actions"><button type="button" class="btn btn-ghost-dark" id="mdCopyEmails">نسخ كل العناوين</button><span class="muted">الصقها في أداة البريد (Gmail، Mailchimp…) لإرسال رسالة الخميس.</span></div>
    <div class="md-table-wrap"><table class="md-table"><thead><tr><th>البريد</th><th>من صفحة</th><th>التاريخ</th></tr></thead>
    <tbody>${s.map((r) => `<tr><td dir="ltr">${esc(r.email)}</td><td>${esc(r.source || '—')}</td><td>${fmt(r.created_at)}</td></tr>`).join('')}</tbody></table></div>`
    : '<p class="empty">لا مشتركين بعد. نموذج الاشتراك موجود في رئيسية مدار وفي نهاية كل مقال.</p>';
  const btn = $('mdCopyEmails');
  if (btn) btn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(s.map((r) => r.email).join(', ')); toast(`تم نسخ ${s.length} عنوان.`); } catch { toast('تعذّر النسخ.', true); }
  });
}

function renderPitches() {
  const P = { new: ['جديدة', 'st-new'], accepted: ['مقبولة', 'st-won'], declined: ['مرفوضة', 'st-closed'] };
  $('mdTab').innerHTML = state.pitches.length ? `<div class="md-pitches">${state.pitches.map((p) => `
    <article class="md-pitch">
      <div class="item-top"><b>${esc(p.title)}</b><span class="pill ${P[p.status][1]}">${P[p.status][0]}</span></div>
      <span class="muted">${topicById(p.topic).ar} · ${esc(p.name)} · <span dir="ltr">${esc(p.email)}</span> · ${fmt(p.created_at)}</span>
      ${p.outline ? `<p>${esc(p.outline).replace(/\n/g, '<br>')}</p>` : ''}
      ${p.links ? `<p class="muted" dir="auto">${esc(p.links)}</p>` : ''}
      <div class="md-pitch-actions">
        ${p.status !== 'accepted' ? `<button type="button" class="btn btn-lime" data-pitch="${p.id}" data-st="accepted">قبول</button>` : ''}
        ${p.status !== 'declined' ? `<button type="button" class="btn btn-ghost-dark" data-pitch="${p.id}" data-st="declined">رفض</button>` : ''}
        ${p.status !== 'new' ? `<button type="button" class="link-btn" data-pitch="${p.id}" data-st="new">إعادة إلى «جديدة»</button>` : ''}
        <button type="button" class="link-btn" data-copy="${esc(p.email)}">نسخ البريد</button>
      </div>
    </article>`).join('')}</div>` : '<p class="empty">لا أفكار بعد. صفحة «اكتب معنا» على <span dir="ltr">/madar/write</span>.</p>';
  $('mdTab').querySelectorAll('[data-pitch]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    try {
      const d = await call(API, { method: 'PATCH', body: { pitch: b.dataset.pitch, status: b.dataset.st } });
      state.pitches = state.pitches.map((p) => (p.id === d.pitch.id ? d.pitch : p)); render();
    } catch (e) { b.disabled = false; if (e.code !== 'signed_out') toast('تعذّر الحفظ.', true); }
  }));
  $('mdTab').querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast('تم نسخ البريد.'); } catch { toast(b.dataset.copy); }
  }));
}

// ---------- editor ----------
const blank = (kind) => ({ kind, status: 'draft', title: '', slug: '', topic: 'product', excerpt: '', body: '', author_name: 'فريق نواة', author_role: '', series: '', series_part: null, featured: false, number: null, audio_url: '', duration_min: null, chapters: [], published_at: null });
const localDT = (iso) => { if (!iso) return ''; const d = new Date(iso); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };

function openEditor(post) {
  state.edit = JSON.parse(JSON.stringify(post)); state.dirty = false; state.preview = false;
  history.replaceState(null, '', '#madar');
  render(); scrollTo({ top: 0 });
}
function closeEditor() {
  if (state.dirty && !closeEditor.armed) { closeEditor.armed = true; toast('لديك تغييرات غير محفوظة. اضغط «رجوع» مرة أخرى للخروج دون حفظ.', true); setTimeout(() => { closeEditor.armed = false; }, 4000); return; }
  closeEditor.armed = false; state.edit = null; render();
}

function renderEditor() {
  const p = state.edit; const isNew = !p.id;
  $('mdHeadActions').hidden = true;
  const f = (label, html, hint = '') => `<label class="md-f"><span>${label}</span>${html}${hint ? `<small>${hint}</small>` : ''}</label>`;
  const chapters = (p.chapters || []).map((c) => `${c.t} ${c.title}`).join('\n');
  $('mdBody').innerHTML = `
  <form class="md-editor" id="mdForm" novalidate>
    <div class="md-ed-bar">
      <button type="button" class="link-btn" id="mdBack">→ رجوع إلى القائمة</button>
      <span class="muted">${isNew ? 'جديد' : 'تعديل'} · ${KINDS[p.kind]}${p.id && isLive(p) ? ` · <a href="${publicUrl(p)}" target="_blank" rel="noopener">عرض الصفحة ↗</a>` : ''}</span>
      <span class="md-ed-actions">
        <button type="submit" class="btn btn-ghost-dark" data-status="draft">حفظ كمسودة</button>
        <button type="submit" class="btn btn-lime" data-status="published">${p.status === 'published' ? 'حفظ التعديلات' : 'نشر'}</button>
      </span>
    </div>
    <p class="md-ed-msg" id="mdMsg" role="alert"></p>
    <div class="md-ed-grid">
      <div class="md-ed-main">
        ${f(p.kind === 'tip' ? 'النصيحة (جملة واحدة)' : 'العنوان', `<input name="title" value="${esc(p.title)}" maxlength="200" required class="md-ed-title">`)}
        ${p.kind !== 'tip' ? f('المقدمة', `<textarea name="excerpt" rows="2" maxlength="400">${esc(p.excerpt)}</textarea>`, 'تظهر تحت العنوان وفي جوجل والبطاقات.') : ''}
        <div class="md-f">
          <div class="md-body-head"><span>${p.kind === 'tip' ? 'مثال أو شرح قصير' : p.kind === 'episode' ? 'ملاحظات الحلقة والنص الكامل' : 'نص المقال'}</span>
            <div class="md-tools" role="toolbar">
              <button type="button" data-md="h2" title="عنوان">ع</button><button type="button" data-md="b" title="عريض"><b>B</b></button>
              <button type="button" data-md="ul" title="قائمة">•</button><button type="button" data-md="ol" title="قائمة مرقمة">1.</button>
              <button type="button" data-md="quote" title="ملاحظة بارزة">💡</button><button type="button" data-md="link" title="رابط">🔗</button>
              <button type="button" data-md="code" title="كود">&lt;/&gt;</button>
              <span class="md-sw" role="group"><button type="button" data-view="write" aria-pressed="${!state.preview}">كتابة</button><button type="button" data-view="preview" aria-pressed="${!!state.preview}">معاينة</button></span>
            </div></div>
          <textarea name="body" id="mdBodyText" rows="${p.kind === 'tip' ? 5 : 22}" dir="rtl" ${state.preview ? 'hidden' : ''}>${esc(p.body)}</textarea>
          <div class="md-preview md-prose" id="mdPreview" ${state.preview ? '' : 'hidden'}></div>
          <small id="mdCount"></small>
          <details class="md-help"><summary>طريقة الكتابة</summary>
            <div><code>## عنوان</code> · <code>**عريض**</code> · <code>- عنصر</code> · <code>1. عنصر</code> · <code>&gt; 💡 ملاحظة</code> (تبدأ برمز تعبيري فتصبح بطاقة ملوّنة) · <code>[نص](https://…)</code> · <code>![وصف](https://…صورة)</code> · <code>- [ ] مهمة</code> · <code>==تمييز==</code> · سطر فارغ بين الفقرات.</div></details>
        </div>
      </div>
      <aside class="md-ed-side">
        ${f('المسار', `<select name="topic">${TOPICS.map((t) => `<option value="${t.id}"${p.topic === t.id ? ' selected' : ''}>${t.ar}</option>`).join('')}</select>`)}
        ${f('الرابط', `<div class="md-slug"><span dir="ltr">${p.kind === 'article' ? '/madar/' : p.kind === 'tip' ? '/madar/tips/' : '/madar/podcast/'}</span><input name="slug" value="${esc(p.slug)}" dir="ltr" maxlength="80" placeholder="honest-roadmap"></div>`, p.kind === 'tip' ? 'صفحة النصيحة تستخدم رقمها، والرابط للتمييز فقط.' : 'بالإنجليزية: كلمات قصيرة بشرطات. لا تغيّره بعد النشر.')}
        ${p.kind !== 'article' ? f(p.kind === 'tip' ? 'رقم النصيحة' : 'رقم الحلقة', `<input name="number" type="number" min="1" value="${p.number ?? ''}" dir="ltr">`, 'اتركه فارغًا ليُعطى الرقم التالي تلقائيًا.') : ''}
        ${p.kind === 'article' ? f('', `<span class="md-check"><input type="checkbox" name="featured" ${p.featured ? 'checked' : ''}> مقال مميّز في رئيسية مدار</span>`) : ''}
        ${p.kind === 'article' ? `<div class="md-two">${f('سلسلة', `<input name="series" value="${esc(p.series)}" placeholder="أساسيات المنتج">`)}${f('الجزء', `<input name="series_part" type="number" min="1" value="${p.series_part ?? ''}" dir="ltr">`)}</div>` : ''}
        ${p.kind === 'episode' ? `
          ${f('رابط ملف الصوت', `<input name="audio_url" value="${esc(p.audio_url)}" dir="ltr" placeholder="https://…/episode-1.mp3">`, 'MP3 مستضاف (Spotify for Creators، Archive.org…).')}
          ${f('المدة بالدقائق', `<input name="duration_min" type="number" min="1" value="${p.duration_min ?? ''}" dir="ltr">`)}
          ${f('الفصول', `<textarea name="chapters" rows="5" placeholder="0:00 البداية والفكرة&#10;9:40 يوم الإطلاق">${esc(chapters)}</textarea>`, 'سطر لكل فصل: الوقت ثم العنوان.')}` : ''}
        <div class="md-two">${f('الكاتب', `<input name="author_name" value="${esc(p.author_name)}" maxlength="80">`)}${f('الصفة', `<input name="author_role" value="${esc(p.author_role)}" maxlength="80" placeholder="Product Manager">`)}</div>
        ${f('تاريخ النشر', `<input name="published_at" type="datetime-local" value="${localDT(p.published_at)}">`, 'فارغ = الآن عند النشر. تاريخ لاحق = يُنشر تلقائيًا في وقته.')}
        ${p.id ? `<div class="md-danger"><button type="button" class="link-btn danger" id="mdDelete">حذف نهائي</button></div>` : ''}
      </aside>
    </div>
  </form>`;

  const form = $('mdForm'); const ta = $('mdBodyText');
  const count = () => { $('mdCount').textContent = p.kind === 'article' ? `${readingMinutes(ta.value)} دقائق قراءة تقريبًا` : ''; };
  const preview = () => { $('mdPreview').innerHTML = renderMarkdown(ta.value).html || '<p class="muted">لا شيء بعد.</p>'; };
  count(); if (state.preview) preview();
  form.addEventListener('input', (e) => { state.dirty = true; if (e.target === ta) count(); });
  const title = form.elements.title; const slug = form.elements.slug;
  title.addEventListener('input', () => { if (!p.id && !slug.dataset.touched) { const s = slugify(title.value); if (s) slug.value = s; } });
  slug.addEventListener('input', () => { slug.dataset.touched = '1'; slug.value = slug.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-{2,}/g, '-'); });
  $('mdBack').addEventListener('click', closeEditor);
  form.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
    state.preview = b.dataset.view === 'preview';
    form.querySelectorAll('[data-view]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    ta.hidden = state.preview; $('mdPreview').hidden = !state.preview; if (state.preview) preview();
  }));
  form.querySelectorAll('[data-md]').forEach((b) => b.addEventListener('click', () => insertMd(ta, b.dataset.md)));
  form.addEventListener('submit', (e) => { e.preventDefault(); save(e.submitter?.dataset.status || 'draft'); });
  const del = $('mdDelete');
  if (del) del.addEventListener('click', async () => {
    if (!del.dataset.armed) { del.dataset.armed = '1'; del.textContent = 'اضغط مرة أخرى لتأكيد الحذف'; setTimeout(() => { delete del.dataset.armed; del.textContent = 'حذف نهائي'; }, 4000); return; }
    try { await call(`${API}?id=${p.id}`, { method: 'DELETE' }); state.posts = state.posts.filter((x) => x.id !== p.id); state.edit = null; state.dirty = false; render(); toast('تم الحذف.'); }
    catch (err) { if (err.code !== 'signed_out') toast('تعذّر الحذف.', true); }
  });
}

function insertMd(ta, kind) {
  const [s, e] = [ta.selectionStart, ta.selectionEnd]; const sel = ta.value.slice(s, e);
  const lineStart = ta.value.lastIndexOf('\n', s - 1) + 1;
  const wrap = { b: ['**', '**', 'نص عريض'], link: ['[', '](https://)', 'نص الرابط'], code: ['`', '`', 'code'] }[kind];
  if (wrap) {
    const text = sel || wrap[2];
    ta.setRangeText(wrap[0] + text + wrap[1], s, e, 'end');
  } else {
    const prefix = { h2: '## ', ul: '- ', ol: '1. ', quote: '> 💡 ' }[kind];
    ta.setRangeText(prefix, lineStart, lineStart, 'end');
  }
  ta.focus(); ta.dispatchEvent(new Event('input', { bubbles: true }));
}

async function save(status) {
  const form = $('mdForm'); const p = state.edit; const v = (n) => form.elements[n]?.value ?? '';
  const post = {
    ...p, status,
    title: v('title'), slug: v('slug').replace(/^-+|-+$/g, ''), topic: v('topic'), excerpt: v('excerpt'), body: v('body'),
    author_name: v('author_name'), author_role: v('author_role'),
    series: v('series'), series_part: v('series_part'), featured: form.elements.featured?.checked || false,
    number: v('number'), audio_url: v('audio_url'), duration_min: v('duration_min'),
    chapters: v('chapters').split('\n').map((l) => l.trim().match(/^(\d{1,2}(?::\d{2}){1,2})\s+(.+)$/)).filter(Boolean).map((m) => ({ t: m[1], title: m[2] })),
    published_at: v('published_at') ? new Date(v('published_at')).toISOString() : (status === 'published' ? p.published_at : null),
  };
  if (!post.slug) post.slug = `${p.kind}-${Date.now().toString(36)}`;
  const msg = $('mdMsg');
  if (!post.title.trim()) { msg.textContent = ERR.title_required; return; }
  if (!SLUG.test(post.slug)) { msg.textContent = ERR.bad_slug; return; }
  form.querySelectorAll('button[type=submit]').forEach((b) => { b.disabled = true; });
  msg.textContent = '';
  try {
    const d = await call(API, { method: p.id ? 'PUT' : 'POST', body: p.id ? { id: p.id, post } : { post } });
    state.posts = p.id ? state.posts.map((x) => (x.id === d.post.id ? d.post : x)) : [d.post, ...state.posts];
    state.edit = JSON.parse(JSON.stringify(d.post)); state.dirty = false;
    renderEditor();
    toast(status === 'draft' ? 'تم حفظ المسودة.' : isLive(d.post) ? 'تم النشر. تظهر على الموقع خلال دقيقتين.' : 'تمت الجدولة في التاريخ المحدد.');
  } catch (e) {
    form.querySelectorAll('button[type=submit]').forEach((b) => { b.disabled = false; });
    if (e.code !== 'signed_out') msg.textContent = ERR[e.code] || 'تعذّر الحفظ. حاول مرة أخرى.';
  }
}

// ---------- wiring ----------
// «+ جديد»: a menu in Nawa's style (not the browser's dropdown), usable by mouse and keyboard.
const newBtn = $('mdNew'); const newMenu = $('mdNewMenu');
const items = () => [...newMenu.querySelectorAll('[role=menuitem]')];
function toggleNew(open, focusFirst) {
  newMenu.hidden = !open; newBtn.setAttribute('aria-expanded', String(open));
  if (open && focusFirst) items()[0].focus();
}
newBtn.addEventListener('click', () => toggleNew(newMenu.hidden, false));
newBtn.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleNew(true, true); } });
newMenu.addEventListener('click', (e) => { const it = e.target.closest('[data-kind]'); if (!it) return; toggleNew(false); openEditor(blank(it.dataset.kind)); });
newMenu.addEventListener('keydown', (e) => {
  const list = items(); const i = list.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length].focus(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
  else if (e.key === 'Tab') toggleNew(false);
});
document.addEventListener('click', (e) => { if (!newMenu.hidden && !e.target.closest('.md-new')) toggleNew(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !newMenu.hidden) { toggleNew(false); newBtn.focus(); } });
$('mdRefresh').addEventListener('click', load);
window.addEventListener('beforeunload', (e) => { if (state.edit && state.dirty) e.preventDefault(); });
window.addEventListener('nawa:madar', () => { if (!state.loaded) load(); else render(); });
