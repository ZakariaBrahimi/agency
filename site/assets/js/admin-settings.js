// /admin → «الإعدادات»: the site's contact email, what clients pay for «تخزين نواة» (price per GB,
// the plans' sizes, durations and discounts) and how they pay.
// Clients only ever see the DZD price and the payment details; the dollar figures stay here.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const API = '/api/admin/content?action=billing';
const PAY = [
  ['baridimob_rip', 'بريدي موب: RIP', 'ltr'],
  ['ccp_name', 'CCP: الاسم واللقب', 'ltr'],
  ['ccp_account', 'CCP: رقم الحساب', 'ltr'],
  ['ccp_key', 'CCP: المفتاح (Clé)', 'ltr'],
  ['redotpay_uid', 'RedotPay: UID', 'ltr'],
  ['redotpay_email', 'RedotPay: البريد', 'ltr'],
];
const state = { loaded: false, settings: null };
const price = (s) => Math.ceil((Number(s.cost_usd) + Number(s.fee_usd)) * Number(s.rate_dzd) - 1e-9);
const dzd = (n) => Math.round(n).toLocaleString('en-US'); // 1,290 (ar-DZ writes 1.290, which reads like a decimal)

async function call(body) {
  const r = await fetch(API, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) { window.dispatchEvent(new Event('nawa:signed-out')); throw Object.assign(new Error('signed_out'), { code: 'signed_out' }); }
  if (!r.ok || d.ok === false) throw Object.assign(new Error(d.error || 'error'), { code: d.error || 'error' });
  return d;
}
function toast(msg, bad = false) {
  const t = $('ctToast');
  if (t.parentNode !== document.body) document.body.appendChild(t);
  t.textContent = msg; t.classList.toggle('bad', bad); t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 3200);
}

async function load() {
  $('stBody').innerHTML = NawaUI.loading('جارٍ التحميل…', 'list');
  try { state.settings = (await call()).settings; state.loaded = true; } catch (e) { if (e.code !== 'signed_out') $('stBody').innerHTML = '<p class="empty">تعذّر التحميل.</p>'; return; }
  render();
}

function render() {
  const s = state.settings;
  $('stBody').innerHTML = `
    <form class="ct-card st-card" id="stContact">
      <h2>معلومات التواصل</h2>
      <p class="muted">البريد الذي يظهر للزوار في الموقع (زر «راسلنا» ونسخ البريد)، وفي نموذج الطلب وسياسة الخصوصية.</p>
      <div class="st-grid"><label class="ct-field"><span>بريد التواصل</span><input name="email" type="email" dir="ltr" maxlength="120" required value="${esc(s.contact?.email || '')}"></label></div>
      <p class="muted st-small">قد يستغرق ظهور التغيير في الموقع حتى 5 دقائق.</p>
      <div class="ct-save"><button type="submit" class="btn btn-dark">حفظ البريد</button></div>
    </form>

    <form class="ct-card st-card" id="stPrice">
      <h2>التخزين والأسعار</h2>
      <p class="muted">سعر «تخزين نواة» للعميل لكل غيغابايت في الشهر = (تكلفة التخزين + رسومك) × سعر الصرف، مقرّبًا إلى الدينار. يرى العميل السعر بالدينار فقط.</p>
      <div class="st-grid">
        <label class="ct-field"><span>تكلفة التخزين (دولار / غ.ب / شهر)</span><input name="cost_usd" type="number" step="0.001" min="0" dir="ltr" value="${esc(s.cost_usd)}"></label>
        <label class="ct-field"><span>رسوم نواة (دولار / غ.ب / شهر)</span><input name="fee_usd" type="number" step="0.01" min="0" dir="ltr" value="${esc(s.fee_usd)}"></label>
        <label class="ct-field"><span>سعر الصرف (دج لكل 1 دولار)</span><input name="rate_dzd" type="number" step="1" min="1" dir="ltr" value="${esc(s.rate_dzd)}"></label>
      </div>
      <div class="st-preview" id="stPreview" aria-live="polite"></div>
      <p class="muted st-small">التغيير يُطبَّق على الحسابات من الآن، وكل فاتورة صادرة تحتفظ بالسعر الذي صدرت به.</p>
      <div class="ct-save"><button type="submit" class="btn btn-dark">حفظ الأسعار</button></div>
    </form>

    <form class="ct-card st-card" id="stPlans">
      <h2>خطط «تخزين نواة»</h2>
      <p class="muted">ما يختاره العميل في نافذة الخطة: المساحة بالمؤشر، والمدة، وتخفيض كل مدة. السعر الشهري للغيغابايت يأتي من «التخزين والأسعار» أعلاه.</p>
      <div class="st-grid">
        <label class="ct-field"><span>أقل مساحة (غ.ب)</span><input name="min_gb" type="number" min="1" step="1" dir="ltr" value="${esc(s.plans.min_gb)}"></label>
        <label class="ct-field"><span>أكبر مساحة (غ.ب)</span><input name="max_gb" type="number" min="1" step="1" dir="ltr" value="${esc(s.plans.max_gb)}"></label>
        <label class="ct-field"><span>خطوة المؤشر (غ.ب)</span><input name="step_gb" type="number" min="1" step="1" dir="ltr" value="${esc(s.plans.step_gb)}"></label>
      </div>
      <div class="st-durs">
        <div class="st-durs-head"><span>المدة</span><span>متاحة</span><span>التخفيض %</span></div>
        ${s.plans.durations.map((d) => `<div class="st-dur">
          <b>${{ 1: 'شهر', 3: '3 أشهر', 6: '6 أشهر', 12: 'سنة' }[d.months]}</b>
          <label class="st-switch"><input type="checkbox" name="on_${d.months}"${d.on ? ' checked' : ''}${d.months === 1 ? ' disabled title="الشهر متاح دائمًا"' : ''}><span></span></label>
          <input name="disc_${d.months}" type="number" min="0" max="90" step="0.5" dir="ltr" value="${esc(d.discount)}" aria-label="تخفيض ${d.months} أشهر">
        </div>`).join('')}
      </div>
      <div class="st-grid">
        <label class="ct-field"><span>حجم الصورة للتقدير (م.ب)</span><input name="photo_mb" type="number" min="0.05" step="0.05" dir="ltr" value="${esc(s.plans.photo_mb)}"></label>
        <label class="ct-field"><span>حجم الفيديو القصير للتقدير (م.ب)</span><input name="video_mb" type="number" min="1" step="1" dir="ltr" value="${esc(s.plans.video_mb)}"></label>
      </div>
      <div class="st-preview" id="stPlanPreview" aria-live="polite"></div>
      <div class="ct-save"><button type="submit" class="btn btn-dark">حفظ الخطط</button></div>
    </form>

    <section class="ct-card st-card" id="stCheck">
      <h2>فحص «تخزين نواة»</h2>
      <p class="muted">يتأكد من الاتصال بالتخزين، ومن إمكانية حفظ ملف، ومن السماح بالرفع من الموقع. لا يعرض أي مفاتيح.</p>
      <div id="stCheckOut" aria-live="polite"></div>
      <div class="ct-save"><button type="button" class="btn btn-ghost-dark" id="stCheckBtn">افحص الآن</button></div>
    </section>

    <form class="ct-card st-card" id="stPay">
      <h2>معلومات الدفع</h2>
      <p class="muted">تظهر للعملاء في «التخزين» تحت فواتيرهم. اترك أي حقل فارغًا لإخفائه.</p>
      <div class="st-grid">${PAY.map(([k, label, dir]) => `<label class="ct-field"><span>${esc(label)}</span><input name="${k}" dir="${dir}" maxlength="120" value="${esc(s.payment?.[k] || '')}"></label>`).join('')}</div>
      <div class="ct-save"><button type="submit" class="btn btn-dark">حفظ معلومات الدفع</button></div>
    </form>`;

  const form = $('stPrice');
  const preview = () => {
    const v = Object.fromEntries(['cost_usd', 'fee_usd', 'rate_dzd'].map((k) => [k, Number(form[k].value)]));
    const p = price(v);
    $('stPreview').innerHTML = Number.isFinite(p) && p >= 0
      ? `<b>سعر العميل: ${dzd(p)} دج لكل غيغابايت شهريًا</b><span>عميل يخزّن 10 غيغابايت يدفع ${dzd(p * 10)} دج شهريًا · 50 غيغابايت: ${dzd(p * 50)} دج</span>`
      : '<b>أدخل أرقامًا صحيحة.</b>';
  };
  form.addEventListener('input', preview); preview();
  form.onsubmit = async (e) => {
    e.preventDefault();
    try { state.settings = (await call(Object.fromEntries(['cost_usd', 'fee_usd', 'rate_dzd'].map((k) => [k, Number(form[k].value)])))).settings; render(); toast('حُفظت الأسعار.'); }
    catch (err) { toast(err.code === 'bad_number' ? 'تحقّق من الأرقام.' : 'تعذّر الحفظ.', true); }
  };
  const pf = $('stPlans');
  const planInput = () => ({
    min_gb: Number(pf.min_gb.value), max_gb: Number(pf.max_gb.value), step_gb: Number(pf.step_gb.value),
    photo_mb: Number(pf.photo_mb.value), video_mb: Number(pf.video_mb.value),
    durations: [1, 3, 6, 12].map((m) => ({ months: m, on: m === 1 || pf['on_' + m].checked, discount: Number(pf['disc_' + m].value) || 0 })),
  });
  const planPreview = () => {
    const p = planInput(), unit = price(Object.fromEntries(['cost_usd', 'fee_usd', 'rate_dzd'].map((k) => [k, Number(form[k].value)])));
    const year = p.durations.find((d) => d.months === 12), six = p.durations.find((d) => d.months === 6);
    const line = (gb, d) => `${gb} غ.ب × ${{ 1: 'شهر', 3: '3 أشهر', 6: '6 أشهر', 12: 'سنة' }[d.months]} = <b>${dzd(gb * unit * d.months * (1 - d.discount / 100))} دج</b>${d.discount ? ` <span class="muted">(بدل ${dzd(gb * unit * d.months)} دج)</span>` : ''}`;
    $('stPlanPreview').innerHTML = `<b>أمثلة بالسعر الحالي (${dzd(unit)} دج لكل غيغابايت شهريًا)</b>
      <span>${line(20, p.durations[0])}</span>${six.on ? `<span>${line(20, six)}</span>` : ''}${year.on ? `<span>${line(20, year)}</span>` : ''}
      <span>20 غ.ب ≈ ${dzd(Math.floor(20000 / (p.photo_mb || 1)))} صورة أو ${dzd(Math.floor(20000 / (p.video_mb || 1)))} فيديو قصير</span>`;
  };
  pf.addEventListener('input', planPreview); form.addEventListener('input', planPreview); planPreview();
  pf.onsubmit = async (e) => {
    e.preventDefault();
    try { state.settings = (await call({ plans: planInput() })).settings; render(); toast('حُفظت الخطط.'); }
    catch { toast('تعذّر الحفظ.', true); }
  };
  $('stCheckBtn').onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true; $('stCheckOut').innerHTML = '<p class="muted">جارٍ الفحص…</p>';
    try {
      const c = (await (await fetch('/api/admin/content?action=storage-check', { credentials: 'same-origin' })).json()).check;
      $('stCheckOut').innerHTML = checkLines(c);
    } catch { $('stCheckOut').innerHTML = '<p class="st-bad">تعذّر الفحص.</p>'; }
    b.disabled = false;
  };
  $('stContact').onsubmit = async (e) => {
    e.preventDefault();
    try { state.settings = (await call({ contact: { email: $('stContact').email.value } })).settings; render(); toast('حُفظ بريد التواصل.'); }
    catch (err) { toast(err.code === 'bad_email' ? 'تحقّق من البريد.' : 'تعذّر الحفظ.', true); }
  };
  $('stPay').onsubmit = async (e) => {
    e.preventDefault();
    const payment = Object.fromEntries(PAY.map(([k]) => [k, $('stPay')[k].value]));
    try { state.settings = (await call({ payment })).settings; render(); toast('حُفظت معلومات الدفع.'); }
    catch { toast('تعذّر الحفظ.', true); }
  };
}

// Plain-words result of the storage check, with what to fix for each failure.
const CHECK = {
  connect: {
    ok: 'الاتصال بالتخزين يعمل.',
    unreachable: 'تعذّر الوصول إلى التخزين: تأكد أن R2_ACCOUNT_ID هو معرّف الحساب فقط (32 حرفًا ورقمًا)، وليس رابطًا كاملًا.',
    InvalidAccessKeyId: 'مفتاح الوصول غير صحيح: تحقّق من R2_ACCESS_KEY_ID في Vercel.',
    SignatureDoesNotMatch: 'المفتاح السري لا يطابق مفتاح الوصول: تحقّق من R2_SECRET_ACCESS_KEY في Vercel.',
    NoSuchBucket: 'اسم الحاوية غير موجود: يجب أن يكون R2_BUCKET مطابقًا تمامًا لاسم الحاوية في Cloudflare.',
    AccessDenied: 'المفتاح لا يملك صلاحية هذه الحاوية: أنشئ مفتاحًا بصلاحية Object Read & Write على هذه الحاوية.',
    Unauthorized: 'المفتاح لا يملك صلاحية هذه الحاوية: أنشئ مفتاحًا بصلاحية Object Read & Write على هذه الحاوية.',
  },
  write: { ok: 'حفظ الملفات وقراءتها يعمل.', AccessDenied: 'المفتاح يقرأ فقط: يلزمه صلاحية Object Read & Write.' },
  cors: {
    ok: 'الرفع من الموقع مسموح (CORS).',
    missing: 'الرفع من الموقع غير مسموح: أضف قاعدة CORS للحاوية في Cloudflare (Settings ← CORS Policy) بعنوان الموقع.',
    other_origin: 'قاعدة CORS موجودة لكن بعنوان موقع آخر: أضف عنوان هذا الموقع في AllowedOrigins.',
  },
};
function checkLines(c) {
  if (!c?.configured) return '<p class="st-bad">✗ «تخزين نواة» غير مضبوط: أضف متغيرات R2 الأربعة في Vercel ثم أعد النشر.</p>';
  const line = (k) => {
    const v = c[k]; if (!v) return '';
    const ok = v === 'ok';
    return `<p class="${ok ? 'st-ok' : 'st-bad'}">${ok ? '✓' : '✗'} ${esc(CHECK[k][v] || `${k}: ${v}`)}</p>`;
  };
  const acct = c.account === 'bad_format' ? '<p class="st-bad">✗ R2_ACCOUNT_ID ليس بالشكل المتوقع: لا يحتوي على معرّف حساب (32 حرفًا ورقمًا من صفحة R2 في Cloudflare). صحّحه في Vercel ثم أعد النشر.</p>'
    : c.account === 'extracted' ? '<p class="st-ok">✓ استُخرج معرّف الحساب من قيمة R2_ACCOUNT_ID (يُفضّل أن تكون المعرّف وحده).</p>' : '';
  return acct + line('connect') + line('write') + line('cors');
}

window.addEventListener('nawa:settings', () => { if (!state.loaded) load(); });
