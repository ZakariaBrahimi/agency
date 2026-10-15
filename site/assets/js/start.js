// /start: the project brief builder.
// Step 1 picks services; step 2 shows only the follow-up questions for those services;
// steps 3 and 4 collect project and contact details. The preview card mirrors every answer.
import { LANGS, SERVICES, PROJECT, CONTACT, CURRENCIES, DEFAULT_CURRENCY, CURRENCY_SHORT, CURRENCY_NAME, t, serviceById, formatAnswer, optionText, validateBrief } from './brief-schema.js';

const UI = {
  ar: {
    title: 'ابدأ مشروعك | نواة', brand: 'نواة', back: 'العودة إلى الموقع',
    s1: 'الخدمات', s2: 'التفاصيل', s3: 'المشروع', s4: 'التواصل',
    t1: 'بماذا نساعدك؟', l1: 'اختر خدمة أو أكثر. ستظهر لك أسئلة قصيرة عن كل خدمة تختارها.',
    full: 'أريد الرحلة كاملة', fullOn: 'تم اختيار الرحلة كاملة',
    t2: 'أخبرنا بالتفاصيل', l2: 'أسئلة قصيرة حسب الخدمات التي اخترتها. الحقول المعلّمة بنجمة مطلوبة.',
    t3: 'عن مشروعك', l3: 'حتى نفهم حجم العمل وتوقيته.',
    t4: 'كيف نتواصل معك؟', l4: 'نردّ خلال يومي عمل، بالطريقة التي تفضّلها.',
    prev: 'السابق', next: 'التالي', submit: 'أرسل الطلب', sending: 'جارٍ الإرسال…',
    required: 'هذا الحقل مطلوب', email: 'أدخل بريدًا إلكترونيًا صحيحًا', whatsapp: 'أضف رقم واتساب لنتواصل معك عليه',
    pickOne: 'اختر خدمة واحدة على الأقل', fix: 'راجع الحقول المعلّمة ثم أكمل.',
    failed: 'تعذّر إرسال الطلب. تحقّق من الاتصال وحاول مرة أخرى، أو راسلنا على hello@nawa.studio',
    tooFast: 'لحظة من فضلك، ثم أعد المحاولة.', limited: 'أرسلت عدة طلبات خلال وقت قصير. حاول بعد قليل.',
    doneT: 'وصلنا طلبك. شكرًا!', doneL: 'سيراجعه فريقنا ونتواصل معك خلال يومي عمل.', ref: 'رقم الطلب:',
    home: 'العودة إلى الموقع', again: 'إرسال طلب آخر',
    pvTitle: 'ملخّص طلبك', pvSub: 'هذا ما سيصلنا عند الإرسال.', pvEmpty: 'اختر خدمة لتبدأ ملخّص طلبك.',
    currency: 'العملة', pvProject: 'المشروع', pvContact: 'التواصل', pvShow: 'معاينة الطلب', optional: 'اختياري',
  },
  en: {
    title: 'Start your project | Nawa', brand: 'Nawa', back: 'Back to the site',
    s1: 'Services', s2: 'Details', s3: 'Project', s4: 'Contact',
    t1: 'What can we help with?', l1: 'Pick one service or more. You’ll get a few short questions for each one.',
    full: 'I want the full journey', fullOn: 'Full journey selected',
    t2: 'Tell us the details', l2: 'A few short questions for the services you picked. Fields with a star are required.',
    t3: 'About your project', l3: 'So we understand the scope and timing.',
    t4: 'How do we reach you?', l4: 'We reply within two working days, the way you prefer.',
    prev: 'Back', next: 'Next', submit: 'Send request', sending: 'Sending…',
    required: 'This field is required', email: 'Enter a valid email address', whatsapp: 'Add a WhatsApp number so we can reach you there',
    pickOne: 'Pick at least one service', fix: 'Check the highlighted fields, then continue.',
    failed: 'We couldn’t send your request. Check your connection and try again, or email hello@nawa.studio',
    tooFast: 'One moment please, then try again.', limited: 'Several requests were sent in a short time. Please try again shortly.',
    doneT: 'We got your request. Thank you!', doneL: 'Our team will review it and get back to you within two working days.', ref: 'Request number:',
    home: 'Back to the site', again: 'Send another request',
    pvTitle: 'Your request', pvSub: 'This is what we’ll receive when you send it.', pvEmpty: 'Pick a service to start your summary.',
    currency: 'Currency', pvProject: 'Project', pvContact: 'Contact', pvShow: 'Preview request', optional: 'optional',
  },
  fr: {
    title: 'Lancer votre projet | Nawa', brand: 'Nawa', back: 'Retour au site',
    s1: 'Services', s2: 'Détails', s3: 'Projet', s4: 'Contact',
    t1: 'Comment pouvons-nous vous aider ?', l1: 'Choisissez un ou plusieurs services. Quelques questions courtes suivront pour chacun.',
    full: 'Je veux le parcours complet', fullOn: 'Parcours complet sélectionné',
    t2: 'Donnez-nous les détails', l2: 'Quelques questions selon les services choisis. Les champs marqués d’une étoile sont obligatoires.',
    t3: 'À propos de votre projet', l3: 'Pour comprendre l’ampleur et le calendrier.',
    t4: 'Comment vous joindre ?', l4: 'Nous répondons sous deux jours ouvrés, comme vous le préférez.',
    prev: 'Retour', next: 'Suivant', submit: 'Envoyer la demande', sending: 'Envoi…',
    required: 'Ce champ est obligatoire', email: 'Saisissez une adresse e-mail valide', whatsapp: 'Ajoutez un numéro WhatsApp pour que nous puissions vous joindre',
    pickOne: 'Choisissez au moins un service', fix: 'Vérifiez les champs signalés, puis continuez.',
    failed: 'Impossible d’envoyer votre demande. Vérifiez votre connexion et réessayez, ou écrivez à hello@nawa.studio',
    tooFast: 'Un instant, puis réessayez.', limited: 'Plusieurs demandes ont été envoyées en peu de temps. Réessayez bientôt.',
    doneT: 'Demande bien reçue. Merci !', doneL: 'Notre équipe l’étudie et vous répond sous deux jours ouvrés.', ref: 'Numéro de demande :',
    home: 'Retour au site', again: 'Envoyer une autre demande',
    pvTitle: 'Votre demande', pvSub: 'Voici ce que nous recevrons à l’envoi.', pvEmpty: 'Choisissez un service pour commencer le résumé.',
    currency: 'Devise', pvProject: 'Projet', pvContact: 'Contact', pvShow: 'Voir la demande', optional: 'facultatif',
  },
};

const ICONS = {
  product: '<path d="M4 6h16v10H4z M8 20h8 M12 16v4" />',
  identity: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="8.5" r="1.8" fill="currentColor"/><path d="M8 12.5a4 4 0 0 0 8 0"/>',
  social: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  ads: '<path d="M4 10v4h3l6 4V6L7 10z M16 9a4 4 0 0 1 0 6 M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
  results: '<path d="M4 20V10 M10 20V4 M16 20v-7 M22 20H2"/>',
};

const $ = (id) => document.getElementById(id);
const html = document.documentElement;
const STORE = 'nawa.brief.draft';
const SECTION = { 1: 'services', 2: 'details', 3: 'project', 4: 'contact' };
const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fullBtn = document.getElementById('fullJourney'); // lives in the services grid as its last cell

let lang = 'ar';
let step = 1;
const blank = () => ({ currency: DEFAULT_CURRENCY, services: [], answers: {}, project: {}, contact: {} });
let state = blank();
const startedAt = Date.now();

try { const d = JSON.parse(localStorage.getItem(STORE) || 'null'); if (d && Array.isArray(d.services)) state = { ...state, ...d, currency: CURRENCIES.includes(d.currency) ? d.currency : DEFAULT_CURRENCY }; } catch {}
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch {} };
const ui = (k) => UI[lang][k] ?? UI.ar[k] ?? '';

// ---------- field rendering ----------

function fieldId(path) { return 'f-' + path.replace(/\./g, '-'); }

function renderField(q, value, path, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  wrap.dataset.path = path;
  const labelId = fieldId(path) + '-l';
  const req = q.required ? ' <span class="req" aria-hidden="true">*</span>' : '';
  const opt = !q.required && (q.kind === 'input' || q.kind === 'text') ? ` <span class="opt">(${ui('optional')})</span>` : '';

  if (q.kind === 'single' || q.kind === 'multi') {
    const cur = q.money ? `<span class="cur" role="group" aria-label="${esc(ui('currency'))}">${CURRENCIES.map((c) => `<button type="button" data-cur="${c}" aria-pressed="${state.currency === c}" title="${esc(t(CURRENCY_NAME[c], lang))}">${esc(t(CURRENCY_SHORT[c], lang))}</button>`).join('')}</span>` : '';
    wrap.innerHTML = `<span class="label-row"><span class="label" id="${labelId}">${esc(t(q.label, lang))}${req}</span>${cur}</span><div class="picks" role="${q.kind === 'single' ? 'radiogroup' : 'group'}" aria-labelledby="${labelId}"></div><span class="msg" aria-live="polite"></span>`;
    const box = wrap.querySelector('.picks');
    wrap.querySelectorAll('[data-cur]').forEach((cb) => cb.addEventListener('click', () => {
      if (state.currency === cb.dataset.cur) return;
      state.currency = cb.dataset.cur;
      save();
      // Re-draw the current step so every budget question shows the new ranges, keeping focus here.
      goTo(step, false);
      renderPreview();
      document.querySelector(`.field[data-path="${path}"] [data-cur="${state.currency}"]`)?.focus();
    }));
    for (const o of q.options) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pick';
      b.textContent = optionText(o, lang, state.currency);
      const on = q.kind === 'single' ? value === o.id : Array.isArray(value) && value.includes(o.id);
      b.setAttribute(q.kind === 'single' ? 'aria-checked' : 'aria-pressed', String(on));
      if (q.kind === 'single') b.setAttribute('role', 'radio');
      b.addEventListener('click', () => {
        let next;
        if (q.kind === 'single') next = value === o.id && !q.required ? undefined : o.id;
        else { const cur = Array.isArray(value) ? value : []; next = cur.includes(o.id) ? cur.filter((x) => x !== o.id) : [...cur, o.id]; }
        value = next;
        box.querySelectorAll('.pick').forEach((c, i) => {
          const id = q.options[i].id;
          const sel = q.kind === 'single' ? next === id : (next || []).includes(id);
          c.setAttribute(q.kind === 'single' ? 'aria-checked' : 'aria-pressed', String(sel));
        });
        if (!calm) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
        clearError(wrap);
        onChange(next);
      });
      box.appendChild(b);
    }
  } else {
    const id = fieldId(path);
    const tag = q.kind === 'text' ? 'textarea' : 'input';
    wrap.innerHTML = `<label class="label" for="${id}">${esc(t(q.label, lang))}${req}${opt}</label><span class="msg" aria-live="polite"></span>`;
    const el = document.createElement(tag);
    el.id = id;
    if (tag === 'input') el.type = q.type || 'text';
    if (tag === 'textarea') el.rows = 3;
    if (q.max) el.maxLength = q.max;
    if (q.autocomplete) el.autocomplete = q.autocomplete;
    if (q.dir) el.dir = q.dir;
    if (q.placeholder) el.placeholder = t(q.placeholder, lang);
    if (q.required) el.required = true;
    el.value = value || '';
    el.addEventListener('input', () => { clearError(wrap); onChange(el.value); });
    wrap.insertBefore(el, wrap.querySelector('.msg'));
  }
  return wrap;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function clearError(wrap) { wrap.classList.remove('err'); const m = wrap.querySelector('.msg'); if (m) m.textContent = ''; }

// ---------- steps ----------

function renderServices() {
  const box = $('services');
  box.innerHTML = '';
  for (const s of SERVICES) {
    const on = state.services.includes(s.id);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'service';
    b.setAttribute('aria-pressed', String(on));
    b.innerHTML = `<span class="svc-ico"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[s.id]}</svg></span>
      <span class="svc-txt"><span class="svc-step" dir="ltr">${s.step}</span><b>${esc(t(s.title, lang))}</b><small>${esc(t(s.hint, lang))}</small></span>
      <span class="svc-check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></span>`;
    b.addEventListener('click', () => {
      state.services = on ? state.services.filter((x) => x !== s.id) : [...state.services, s.id].sort((a, c) => serviceById(a).step - serviceById(c).step);
      save(); renderServices(); renderPreview(); hideError();
    });
    box.appendChild(b);
  }
  box.appendChild(fullBtn);
  const all = SERVICES.every((s) => state.services.includes(s.id));
  $('fullJourney').setAttribute('aria-pressed', String(all));
  $('fullJourney').querySelector('[data-ui]').textContent = ui(all ? 'fullOn' : 'full');
}

function renderDetails() {
  const box = $('details');
  box.innerHTML = '';
  for (const id of state.services) {
    const s = serviceById(id);
    const set = document.createElement('fieldset');
    set.className = 'svc-set';
    set.innerHTML = `<legend><span class="svc-ico sm"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[id]}</svg></span>${esc(t(s.title, lang))}</legend>`;
    const answers = (state.answers[id] ||= {});
    for (const q of s.questions) {
      set.appendChild(renderField(q, answers[q.id], `${id}.${q.id}`, (v) => {
        if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) delete answers[q.id]; else answers[q.id] = v;
        save(); renderPreview();
      }));
    }
    box.appendChild(set);
  }
}

function renderGroup(boxId, list, bucket, prefix) {
  const box = $(boxId);
  box.innerHTML = '';
  for (const q of list) {
    const f = renderField(q, state[bucket][q.id], `${prefix}.${q.id}`, (v) => {
      if (v === undefined || v === '') delete state[bucket][q.id]; else state[bucket][q.id] = v;
      save(); renderPreview();
    });
    if (q.kind === 'input' && ['business', 'country', 'name', 'email', 'whatsapp'].includes(q.id)) f.classList.add('half');
    box.appendChild(f);
  }
}

function goTo(n, focus = true) {
  const prev = step;
  step = n;
  document.querySelectorAll('.step').forEach((el) => {
    const on = Number(el.dataset.step) === n;
    el.hidden = !on;
    if (on && !calm) { el.classList.remove('enter-fwd', 'enter-back'); void el.offsetWidth; el.classList.add(n >= prev ? 'enter-fwd' : 'enter-back'); }
  });
  if (n === 2) renderDetails();
  if (n === 3) renderGroup('project', PROJECT, 'project', 'project');
  if (n === 4) renderGroup('contact', CONTACT, 'contact', 'contact');
  document.querySelectorAll('.progress li').forEach((li) => {
    const k = Number(li.dataset.step);
    li.classList.toggle('done', k < n);
    li.classList.toggle('cur', k === n);
    if (k === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
  });
  $('barFill').style.width = `${((n - 1) / 3) * 100}%`;
  $('backBtn').hidden = n === 1;
  $('nextLabel').textContent = ui(n === 4 ? 'submit' : 'next');
  hideError();
  if (focus) {
    const h = document.querySelector(`.step[data-step="${n}"] h1, .step[data-step="${n}"] h2`);
    if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
    document.querySelector('.form-card').scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
  }
}

function showErrors(paths) {
  let first = null;
  for (const p of paths) {
    if (p === 'services') { showError(ui('pickOne')); continue; }
    const wrap = document.querySelector(`.field[data-path="${p}"]`);
    if (!wrap) continue;
    wrap.classList.add('err');
    const val = p.endsWith('.email') && (state.contact.email || '') ? 'email' : p === 'contact.whatsapp' ? 'whatsapp' : 'required';
    wrap.querySelector('.msg').textContent = ui(val);
    if (!calm) { wrap.classList.remove('shake'); void wrap.offsetWidth; wrap.classList.add('shake'); }
    first ||= wrap;
  }
  if (first) {
    showError(ui('fix'));
    first.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
    (first.querySelector('input, textarea, .pick'))?.focus({ preventScroll: true });
  }
}
function showError(msg) { const e = $('formError'); e.textContent = msg; e.hidden = false; }
function hideError() { $('formError').hidden = true; }

// ---------- preview ----------

let lastKeys = new Set();
function renderPreview() {
  const body = $('pvBody');
  const rows = [];
  const keys = new Set();
  const row = (key, label, value) => { keys.add(key); rows.push(`<div class="pv-row${lastKeys.has(key) ? '' : ' new'}"><span>${esc(label)}</span><b>${esc(value)}</b></div>`); };

  if (!state.services.length) {
    body.innerHTML = `<p class="pv-empty">${esc(ui('pvEmpty'))}</p>`;
  } else {
    const p = state.project, c = state.contact;
    let out = '';
    if (p.business) out += `<p class="pv-biz">${esc(p.business)}</p>`;
    out += `<div class="pv-tags">${state.services.map((id) => `<span class="pv-tag">${esc(t(serviceById(id).title, lang))}</span>`).join('')}</div>`;
    for (const id of state.services) {
      const s = serviceById(id);
      rows.length = 0;
      for (const q of s.questions) {
        const v = formatAnswer(q, state.answers[id]?.[q.id], lang, state.currency);
        if (v) row(`${id}.${q.id}`, t(q.label, lang).replace(/[؟?]\s*$/, ''), v);
      }
      out += `<section class="pv-sec"><h3>${esc(t(s.title, lang))}</h3>${rows.join('') || '<p class="pv-dim">…</p>'}</section>`;
    }
    rows.length = 0;
    for (const q of PROJECT) { const v = formatAnswer(q, p[q.id], lang, state.currency); if (v && q.id !== 'business') row(`p.${q.id}`, t(q.label, lang).replace(/[؟?]\s*$/, ''), v); }
    if (rows.length) out += `<section class="pv-sec"><h3>${esc(ui('pvProject'))}</h3>${rows.join('')}</section>`;
    rows.length = 0;
    for (const q of CONTACT) { const v = formatAnswer(q, c[q.id], lang); if (v) row(`c.${q.id}`, t(q.label, lang).replace(/[؟?]\s*$/, ''), v); }
    if (rows.length) out += `<section class="pv-sec"><h3>${esc(ui('pvContact'))}</h3>${rows.join('')}</section>`;
    body.innerHTML = out;
  }
  lastKeys = keys;
  const n = state.services.length;
  $('pvCount').textContent = n ? `(${n})` : '';
}

// ---------- language ----------

function setLang(next, persist) {
  lang = LANGS.includes(next) ? next : 'ar';
  html.lang = lang;
  html.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.title = ui('title');
  document.querySelectorAll('[data-ui]').forEach((el) => { el.textContent = ui(el.dataset.ui); });
  document.querySelectorAll('.langs button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  document.querySelectorAll('a.back-link, .done-actions a, a.brand').forEach((a) => { a.href = lang === 'ar' ? '/' : '/' + lang; });
  renderServices();
  goTo(step, false);
  renderPreview();
  if (persist) {
    try { localStorage.setItem('nawa.lang', lang); } catch {}
    try { history.replaceState(null, '', lang === 'ar' ? location.pathname : '#' + lang); } catch {}
  }
}

// ---------- submit ----------

async function submit() {
  const btn = $('nextBtn');
  btn.disabled = true;
  $('nextLabel').textContent = ui('sending');
  try {
    const r = await fetch('/api/brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...state, lang, startedAt, website: $('website').value }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok && data.ok) return showDone(data.id);
    if (r.status === 422 && data.fields?.length) {
      const first = data.fields[0];
      const target = first === 'services' ? 1 : first.startsWith('project.') ? 3 : first.startsWith('contact.') ? 4 : 2;
      goTo(target);
      return showErrors(data.fields);
    }
    showError(ui(data.error === 'too_fast' ? 'tooFast' : data.error === 'rate_limited' ? 'limited' : 'failed'));
  } catch {
    showError(ui('failed'));
  } finally {
    btn.disabled = false;
    $('nextLabel').textContent = ui(step === 4 ? 'submit' : 'next');
  }
}

function showDone(id) {
  try { localStorage.removeItem(STORE); } catch {}
  $('briefForm').hidden = true;
  document.querySelector('.progress').hidden = true;
  document.querySelector('.bar').hidden = true;
  $('refNo').textContent = '#' + String(id).slice(0, 8);
  $('done').hidden = false;
  $('done').focus();
  document.body.classList.add('submitted');
}

// ---------- wiring ----------

$('briefForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const { errors } = validateBrief({ ...state, lang }, SECTION[step]);
  if (errors.length) return showErrors(errors);
  if (step < 4) goTo(step + 1); else submit();
});
$('backBtn').addEventListener('click', () => goTo(step - 1));
$('fullJourney').addEventListener('click', () => {
  const all = SERVICES.every((s) => state.services.includes(s.id));
  state.services = all ? [] : SERVICES.map((s) => s.id);
  save(); renderServices(); renderPreview(); hideError();
});
$('again').addEventListener('click', () => {
  state = blank();
  $('done').hidden = true; $('briefForm').hidden = false;
  document.querySelector('.progress').hidden = false; document.querySelector('.bar').hidden = false;
  document.body.classList.remove('submitted');
  renderServices(); renderPreview(); goTo(1);
});
document.querySelectorAll('.langs button').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang, true)));
$('pvToggle').addEventListener('click', () => {
  const open = document.body.classList.toggle('pv-open');
  $('pvToggle').setAttribute('aria-expanded', String(open));
});

// Arabic first; #en / #fr or the language chosen on the main site switches it.
let start = 'ar';
const h = location.hash.slice(1);
if (LANGS.includes(h)) start = h;
else { try { start = localStorage.getItem('nawa.lang') || 'ar'; } catch {} }
setLang(start, false);
