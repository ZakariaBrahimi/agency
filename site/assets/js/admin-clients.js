// /admin → «العملاء»: companies Nawa manages. Create a client with its first contact (who can then
// sign in at /portal), follow each platform's activation, add or remove people, open its content.
import { PLATFORMS, PLATFORM_ORDER, STATUS, MANUAL_STATUS, icon, L } from './portal-schema.js?v=20261023b';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const API = '/api/admin/content';
const ERR = {
  name_required: 'اكتب اسم الشركة.',
  bad_email: 'تحقّق من البريد الإلكتروني.',
  email_taken: 'هذا البريد مسجّل لدى عميل آخر.',
  client_not_found: 'هذا العميل غير موجود.',
  bad_page: 'معرّف الصفحة غير صحيح.',
  storage_not_configured: 'قاعدة البيانات غير مربوطة (Supabase).',
};
const errText = (e) => ERR[e?.code] || 'حدث خطأ. حاول مرة أخرى.';

const state = { loaded: false, clients: [], pages: null, mail: true, meta: true, open: null };

async function call(action, body) {
  const r = await fetch(`${API}?action=${action}`, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) { window.dispatchEvent(new Event('nawa:signed-out')); throw Object.assign(new Error('signed_out'), { code: 'signed_out' }); }
  if (!r.ok || d.ok === false) throw Object.assign(new Error(d.error || 'error'), { code: d.error || 'error' });
  return d;
}
function absorb(d) {
  state.clients = d.clients || []; state.pages = d.pages; state.mail = d.mail; state.meta = d.meta;
  window.dispatchEvent(new CustomEvent('nawa:clients', { detail: state.clients }));
}
function toast(msg, bad = false) {
  const t = $('ctToast');
  const host = $('clDialog').open ? $('clDialog') : document.body;
  if (t.parentNode !== host) host.appendChild(t);
  t.textContent = msg; t.classList.toggle('bad', bad); t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 3200);
}
const gb = (b) => { const v = Number(b || 0) / 1e9; return `${v < 10 ? v.toFixed(v < 1 ? 2 : 1) : Math.round(v)} غ.ب`; };
const dzd = (n) => `${Math.round(Number(n || 0)).toLocaleString('en-US')} دج`;
const METHODS = { baridimob: 'بريدي موب', ccp: 'CCP', redotpay: 'RedotPay', cash: 'نقدًا', other: 'أخرى' };
const INV = { paid: 'مدفوعة', unpaid: 'غير مدفوعة', void: 'ملغاة' };
/** One line per client: where the files are, how much, this month, unpaid invoices. */
function storageLine(c) {
  const s = c.storage; if (!s) return '';
  const unpaid = s.invoices.filter((i) => i.status === 'unpaid');
  return `<div class="cl-storage">
    <span title="Google Drive الخاص بالعميل">${s.drive.connected ? `Drive ${gb(s.drive.bytes)}` : 'Drive غير مربوط'}</span>
    <span title="«تخزين نواة»">${s.cloud.enabled ? `سحابة ${gb(s.cloud.bytes)}${s.cloud.pref === 'cloud' ? ' · الملفات الجديدة هنا دائمًا' : ''}` : 'سحابة متوقفة'}</span>
    ${s.wallet ? `<span title="رصيد «تخزين نواة» المسبق">الرصيد ${dzd(s.wallet.balance)}${s.wallet.state === 'low' ? ` · يكفي ${s.wallet.daysLeft} أيام` : s.wallet.state === 'grace' ? ' · مهلة' : s.wallet.state === 'paused' ? ' · متوقف' : ''}</span>` : ''}
    ${unpaid.length ? `<span class="cl-st tone-wait">${unpaid.length} غير مدفوعة · ${dzd(unpaid.reduce((a, i) => a + i.amount_dzd, 0))}</span>` : ''}
  </div>`;
}
const pill = (st) => `<span class="cl-st tone-${STATUS[st]?.tone || 'idle'}">${esc(L(STATUS[st]?.label) || st)}</span>`;
const activeCount = (c) => PLATFORM_ORDER.filter((k) => c.status?.[k]?.status === 'active').length;

async function load(fresh) {
  const body = $('clBody');
  if (!state.loaded) body.innerHTML = NawaUI.loading('جارٍ تحميل العملاء…', 'list');
  try { absorb(await call(fresh ? 'clients&fresh=1' : 'clients')); state.loaded = true; }
  catch (e) { if (e.code !== 'signed_out') body.innerHTML = `<p class="empty">${esc(errText(e))}</p>`; return; }
  render();
}

function render() {
  const body = $('clBody');
  const notices = [];
  if (!state.mail) notices.push(`<div class="ct-card cl-note"><b>إرسال رموز الدخول غير مضبوط بعد.</b> أضف في Vercel ← Environment Variables: <code dir="ltr">SMTP_USER</code> (بريد Gmail لنواة) و<code dir="ltr">SMTP_PASS</code> (كلمة مرور تطبيق من Google، وليست كلمة المرور العادية)، ثم أعد النشر. الدخول عبر Google يعمل الآن.</div>`);
  if (!state.meta) notices.push('<div class="ct-card cl-note"><b>Meta غير مربوطة:</b> لا يمكن التحقق من فيسبوك وإنستغرام تلقائيًا.</div>');
  const free = (state.pages || []).filter((p) => !p.used);
  if (free.length) notices.push(`<div class="ct-card cl-note ok"><b>صفحات وصلنا الوصول إليها ولم تُربط بعميل:</b> ${free.map((p) => `<bdi>${esc(p.name)}</bdi>${p.ig ? ` <span class="muted" dir="ltr">@${esc(p.ig.username)}</span>` : ''}`).join(' · ')}. افتح العميل واختر صفحته.</div>`);

  body.innerHTML = `${notices.join('')}
    ${state.clients.length ? `<ul class="cl-list">${state.clients.map((c) => `
      <li class="cl-card${c.active ? '' : ' off'}">
        <div class="cl-head"><b>${esc(c.name)}</b>${c.active ? '' : '<span class="pill">موقوف</span>'}<span class="muted">${esc([c.industry, c.city].filter(Boolean).join(' · '))}</span></div>
        <div class="cl-pfs">${PLATFORM_ORDER.map((k) => `<span class="cl-pf" title="${esc(L(PLATFORMS[k].name))} · ${esc(L(STATUS[c.status[k].status]?.label))}"><i class="cl-ic tone-${STATUS[c.status[k].status]?.tone}">${icon(k, 16)}</i></span>`).join('')}
          <span class="muted">${activeCount(c)} من 4 مفعّلة</span></div>
        <div class="muted cl-users">${c.users.map((u) => `<bdi>${esc(u.name || u.email)}</bdi>`).join('، ') || 'لا أحد'}</div>
        ${storageLine(c)}
        <div class="cl-btns">
          <button type="button" class="btn btn-dark" data-manage="${c.id}">إدارة</button>
          <button type="button" class="btn btn-ghost-dark" data-content="${c.id}">المحتوى</button>
        </div>
      </li>`).join('')}</ul>`
    : `<div class="ct-card cl-empty"><b>لا يوجد عملاء بعد.</b><p class="muted">أضف أول عميل: اسم الشركة وبريد الشخص الذي سيدخل. يدخل بعدها من <a href="/portal" target="_blank" rel="noopener" dir="ltr">/portal ↗</a> برمز يصله على بريده أو بحساب Google.</p></div>`}`;
  body.querySelectorAll('[data-manage]').forEach((b) => b.addEventListener('click', () => openClient(b.dataset.manage)));
  body.querySelectorAll('[data-content]').forEach((b) => b.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('nawa:tenant', { detail: b.dataset.content }));
    history.replaceState(null, '', '#content');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }));
}

// ---------- create ----------
function openCreate() {
  state.open = null;
  $('clForm').innerHTML = `
    <div class="ct-dlg-head"><h2 id="clDlgTitle">عميل جديد</h2><button type="button" class="ct-x" data-close aria-label="إغلاق">✕</button></div>
    <fieldset class="cl-fs"><legend>الشركة</legend>
      <label class="ct-field"><span>اسم الشركة *</span><input name="name" required maxlength="200" autocomplete="organization"></label>
      <div class="ct-row"><label class="ct-field"><span>المجال</span><input name="industry" maxlength="200" placeholder="مطعم، متجر ملابس، عيادة…"></label>
      <label class="ct-field"><span>المدينة</span><input name="city" maxlength="200"></label></div>
      <div class="ct-row"><label class="ct-field"><span>الهاتف</span><input name="phone" maxlength="40" dir="ltr" inputmode="tel"></label>
      <label class="ct-field"><span>الموقع</span><input name="website" maxlength="200" dir="ltr" placeholder="https://"></label></div>
    </fieldset>
    <fieldset class="cl-fs"><legend>الشخص الذي يدخل</legend>
      <div class="ct-row"><label class="ct-field"><span>الاسم</span><input name="u_name" maxlength="120" autocomplete="name"></label>
      <label class="ct-field"><span>البريد الإلكتروني *</span><input name="u_email" type="email" required dir="ltr" autocomplete="email"></label></div>
      <label class="ct-field"><span>الهاتف</span><input name="u_phone" maxlength="40" dir="ltr" inputmode="tel"></label>
      <p class="muted">يدخل من <b dir="ltr">/portal</b> برمز يصل إلى هذا البريد، أو بحساب Google بنفس البريد.</p>
    </fieldset>
    <div class="ct-save"><button type="submit" class="btn btn-lime">إضافة العميل</button></div>`;
  bindClose();
  $('clForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData($('clForm'));
    const v = (k) => String(f.get(k) || '');
    try {
      const d = await call('client-create', { client: { name: v('name'), industry: v('industry'), city: v('city'), phone: v('phone'), website: v('website') }, user: { name: v('u_name'), email: v('u_email'), phone: v('u_phone') } });
      absorb(d); render(); openClient(d.created); toast('أُضيف العميل. يمكنه الدخول الآن من /portal.');
    } catch (err) { toast(errText(err), true); }
  };
  if (!$('clDialog').open) $('clDialog').showModal();
  setTimeout(() => $('clForm').querySelector('[name=name]').focus(), 30);
}

// ---------- manage ----------
function openClient(id) {
  const c = state.clients.find((x) => x.id === id);
  if (!c) return;
  state.open = id;
  const pages = state.pages;
  const pageOpts = pages ? pages.filter((p) => !p.used || p.id === c.fb_page_id) : [];
  $('clForm').innerHTML = `
    <div class="ct-dlg-head"><h2 id="clDlgTitle">${esc(c.name)}</h2><button type="button" class="ct-x" data-close aria-label="إغلاق">✕</button></div>

    <section class="ct-sec"><div class="ct-sec-head"><h3>المنصات</h3><button type="button" class="link-btn" id="clCheck">تحقق الآن</button></div>
      <ul class="cl-pfrows">${PLATFORM_ORDER.map((k) => {
        const s = c.status[k]; const p = PLATFORMS[k];
        return `<li class="cl-pfrow">
          <div class="cl-pfname"><i class="cl-ic tone-${STATUS[s.status]?.tone}">${icon(k, 16)}</i><b>${L(p.name)}</b>${pill(s.status)}${s.name ? ` <a href="${esc(s.url)}" target="_blank" rel="noopener" class="muted">${esc(s.name)} ↗</a>` : ''}<span class="muted cl-auto">${p.auto ? 'تحقق تلقائي' : 'تحديث يدوي'}</span></div>
          ${k === 'facebook' ? `<label class="ct-field"><span>صفحة العميل</span>${pages ? `<select data-page>
              <option value="">— لم تُحدَّد —</option>${pageOpts.map((pg) => `<option value="${esc(pg.id)}"${pg.id === c.fb_page_id ? ' selected' : ''}>${esc(pg.name)}${pg.ig ? ` · @${esc(pg.ig.username)}` : ''}</option>`).join('')}
              ${c.fb_page_id && !pageOpts.some((pg) => pg.id === c.fb_page_id) ? `<option value="${esc(c.fb_page_id)}" selected>${esc(c.fb_page_id)} (لا وصول بعد)</option>` : ''}
            </select>` : `<input data-page dir="ltr" value="${esc(c.fb_page_id || '')}" placeholder="Page ID">`}</label>
            <p class="muted">تظهر هنا الصفحات التي وصلنا الوصول إليها. بعد قبول طلب الشراكة: Business Settings ← System users ← أضف الصفحة لمستخدم النظام، ثم «تحقق الآن».</p>` : ''}
          ${k === 'instagram' ? '<p class="muted">يُقرأ من صفحة فيسبوك تلقائيًا.</p>' : ''}
          ${!p.auto ? `<div class="ct-row"><label class="ct-field"><span>الحالة</span><select data-status="${k}">${MANUAL_STATUS.map((st) => `<option value="${st}"${st === s.status ? ' selected' : ''}>${L(STATUS[st].label)}</option>`).join('')}</select></label>
            <label class="ct-field"><span>رابط الحساب</span><input data-url="${k}" dir="ltr" value="${esc(s.url || '')}" placeholder="https://"></label></div>` : ''}
          <label class="ct-field"><span>ملاحظة يراها العميل</span><input data-note="${k}" maxlength="500" value="${esc(s.note || '')}"></label>
        </li>`;
      }).join('')}</ul>
      <div class="ct-save"><button type="button" class="btn btn-dark" id="clSavePf">حفظ المنصات</button></div>
    </section>

    ${c.storage ? `<section class="ct-sec"><div class="ct-sec-head"><h3>التخزين والفواتير</h3></div>
      <div class="cl-stgrid">
        <div class="cl-stbox"><b>Google Drive (مجاني)</b><span class="muted">${c.storage.drive.connected ? `مربوط: <bdi dir="ltr">${esc(c.storage.drive.email)}</bdi>` : 'لم يربطه العميل بعد'}</span><span>${gb(c.storage.drive.bytes)} من ${gb(c.storage.drive.cap)}</span></div>
        <div class="cl-stbox"><b>«تخزين نواة»</b><span class="muted">${c.storage.cloud.enabled ? 'مفعّل' : 'متوقف'}${c.storage.cloud.available ? '' : ' · غير مضبوط بعد (R2)'}</span><span>${gb(c.storage.cloud.bytes)} · ${dzd(c.storage.estimate.price_dzd)}/غ.ب</span>
          <button type="button" class="link-btn" id="clCloud">${c.storage.cloud.enabled ? 'إيقاف' : 'تفعيل'}</button></div>
        <div class="cl-stbox"><b>هذا الشهر</b><span>حتى الآن: ${dzd(c.storage.estimate.so_far_dzd)}</span><span>المتوقع: ${dzd(c.storage.estimate.projected_dzd)}</span></div>
      </div>
      ${c.storage.invoices.length ? `<ul class="cl-invs">${c.storage.invoices.map((i) => `<li>
        <span dir="ltr">${esc(i.month)}</span><span>${gb(Number(i.avg_gb) * 1e9)}</span><b>${dzd(i.amount_dzd)}</b>
        <span class="cl-st tone-${i.status === 'paid' ? 'ok' : i.status === 'void' ? 'idle' : 'wait'}">${INV[i.status]}${i.status === 'paid' && i.method ? ' · ' + esc(METHODS[i.method] || i.method) : ''}</span>
        ${i.status === 'paid' ? `<button type="button" class="link-btn" data-inv="${i.id}" data-st="unpaid">إلغاء الدفع</button>`
          : `<select data-method="${i.id}" aria-label="طريقة الدفع">${Object.entries(METHODS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
             <button type="button" class="btn btn-ghost-dark" data-inv="${i.id}" data-st="paid">تم الدفع</button>
             ${i.status === 'unpaid' ? `<button type="button" class="link-btn ct-danger" data-inv="${i.id}" data-st="void">إلغاء الفاتورة</button>` : ''}`}
      </li>`).join('')}</ul>` : '<p class="muted">لا فواتير بعد. تصدر تلقائيًا أول كل شهر عن الشهر السابق.</p>'}
    </section>` : ''}

    <section class="ct-sec"><div class="ct-sec-head"><h3>الأشخاص</h3></div>
      <ul class="cl-people">${c.users.map((u) => `<li><span><b>${esc(u.name || '—')}</b> <span dir="ltr" class="muted">${esc(u.email)}</span>${u.role === 'owner' ? ' <span class="pill">المسؤول</span>' : ''}<br><span class="muted">${u.last_login_at ? 'آخر دخول: ' + new Date(u.last_login_at).toLocaleString('ar-DZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'لم يدخل بعد'}</span></span>
        <button type="button" class="link-btn ct-danger" data-rmuser="${u.id}" data-email="${esc(u.email)}">إزالة</button></li>`).join('')}</ul>
      <div class="ct-row cl-adduser"><input id="clUName" placeholder="الاسم" maxlength="120"><input id="clUEmail" type="email" dir="ltr" placeholder="email@example.com"><button type="button" class="btn btn-ghost-dark" id="clAddUser">إضافة شخص</button></div>
    </section>

    <section class="ct-sec"><div class="ct-sec-head"><h3>بيانات الشركة</h3></div>
      <label class="ct-field"><span>اسم الشركة</span><input name="name" maxlength="200" value="${esc(c.name)}"></label>
      <div class="ct-row"><label class="ct-field"><span>المجال</span><input name="industry" maxlength="200" value="${esc(c.industry)}"></label>
      <label class="ct-field"><span>المدينة</span><input name="city" maxlength="200" value="${esc(c.city)}"></label></div>
      <div class="ct-row"><label class="ct-field"><span>الهاتف</span><input name="phone" dir="ltr" maxlength="40" value="${esc(c.phone)}"></label>
      <label class="ct-field"><span>الموقع</span><input name="website" dir="ltr" maxlength="200" value="${esc(c.website)}"></label></div>
      <label class="ct-field"><span>ملاحظات داخلية</span><textarea name="notes" rows="2" maxlength="2000">${esc(c.notes)}</textarea></label>
      <div class="ct-save"><button type="button" class="btn btn-dark" id="clSaveInfo">حفظ البيانات</button></div>
    </section>

    <div class="ct-dlg-foot cl-danger">
      <button type="button" class="link-btn" id="clToggle">${c.active ? 'إيقاف الدخول مؤقتًا' : 'إعادة تفعيل الدخول'}</button>
      <button type="button" class="link-btn ct-danger" id="clDelete">حذف العميل</button>
    </div>`;
  bindClose();
  const form = $('clForm');
  const run = async (action, body, msg) => {
    form.querySelectorAll('button').forEach((b) => (b.disabled = true));
    try { absorb(await call(action, body)); render(); if (state.clients.some((x) => x.id === id)) openClient(id); else close(); toast(msg); }
    catch (e) { toast(errText(e), true); form.querySelectorAll('button').forEach((b) => (b.disabled = false)); }
  };
  $('clCheck').onclick = async () => { $('clCheck').disabled = true; await load(true); openClient(id); toast('تم التحقق من فيسبوك وإنستغرام.'); };
  if ($('clCloud')) $('clCloud').onclick = () => run('client-cloud', { id, enabled: !c.storage.cloud.enabled }, c.storage.cloud.enabled ? 'أُوقف «تخزين نواة» لهذا العميل.' : 'فُعّل «تخزين نواة» لهذا العميل.');
  form.querySelectorAll('[data-inv]').forEach((b) => b.addEventListener('click', () => {
    const st = b.dataset.st;
    run('invoice-mark', { id: b.dataset.inv, status: st, method: st === 'paid' ? form.querySelector(`[data-method="${b.dataset.inv}"]`)?.value : undefined },
      st === 'paid' ? 'سُجّلت الفاتورة مدفوعة.' : st === 'void' ? 'أُلغيت الفاتورة.' : 'أُعيدت إلى غير مدفوعة.');
  }));
  $('clSavePf').onclick = () => {
    const platforms = {};
    for (const k of PLATFORM_ORDER) {
      platforms[k] = { note: form.querySelector(`[data-note="${k}"]`).value };
      if (form.querySelector(`[data-status="${k}"]`)) { platforms[k].status = form.querySelector(`[data-status="${k}"]`).value; platforms[k].url = form.querySelector(`[data-url="${k}"]`).value; }
    }
    run('client-update', { id, platforms, fb_page_id: form.querySelector('[data-page]').value }, 'حُفظت المنصات.');
  };
  $('clSaveInfo').onclick = () => {
    const v = (n) => form.querySelector(`[name="${n}"]`).value;
    run('client-update', { id, name: v('name'), industry: v('industry'), city: v('city'), phone: v('phone'), website: v('website'), notes: v('notes') }, 'حُفظت البيانات.');
  };
  $('clAddUser').onclick = () => run('client-user-add', { client_id: id, name: $('clUName').value, email: $('clUEmail').value }, 'أُضيف الشخص. يمكنه الدخول الآن.');
  form.querySelectorAll('[data-rmuser]').forEach((b) => b.addEventListener('click', () => {
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'تأكيد الإزالة'; return; }
    run('client-user-remove', { id: b.dataset.rmuser, email: b.dataset.email }, 'أُزيل الشخص وخرج من حسابه.');
  }));
  $('clToggle').onclick = () => run('client-update', { id, active: !c.active }, c.active ? 'أُوقف دخول العميل.' : 'أُعيد تفعيل الدخول.');
  $('clDelete').onclick = (e) => {
    if (!e.target.dataset.armed) { e.target.dataset.armed = '1'; e.target.textContent = 'اضغط مرة أخرى للحذف (المنشورات تبقى في Drive)'; return; }
    run('client-delete', { id }, 'حُذف العميل.');
  };
  if (!$('clDialog').open) $('clDialog').showModal();
}

function bindClose() { $('clForm').querySelectorAll('[data-close]').forEach((b) => (b.onclick = close)); }
function close() { state.open = null; $('clDialog').close(); }
$('clDialog').addEventListener('cancel', (e) => { e.preventDefault(); close(); });

$('clNew').addEventListener('click', openCreate);
$('clRefresh').addEventListener('click', () => load(true));
window.addEventListener('nawa:clients-section', () => { if (!state.loaded) load(); });
