// /admin → «الإعدادات»: what clients pay for «تخزين نواة» and how they pay.
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
const dzd = (n) => Math.round(n).toLocaleString('ar-DZ');

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
  $('stPay').onsubmit = async (e) => {
    e.preventDefault();
    const payment = Object.fromEntries(PAY.map(([k]) => [k, $('stPay')[k].value]));
    try { state.settings = (await call({ payment })).settings; render(); toast('حُفظت معلومات الدفع.'); }
    catch { toast('تعذّر الحفظ.', true); }
  };
}

window.addEventListener('nawa:settings', () => { if (!state.loaded) load(); });
