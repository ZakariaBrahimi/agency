// /admin → «المدفوعات»: «تخزين نواة» plans. Requests waiting to be checked (what was ordered and the
// receipt; approve / reject with a reason), every client's plan (with «منح خطة» for cash), the
// month's payments with a filter and CSV export, and the month's figures (received, active plans,
// monthly income, space sold vs used, storage cost, margin).
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const API = '/api/admin/content';
const METHOD = { baridimob: 'بريدي موب', ccp: 'CCP', redotpay: 'RedotPay', cash: 'نقدًا', other: 'أخرى' };
const STATE = { none: ['idle', 'بلا خطة'], active: ['ok', 'نشطة'], expiring: ['wait', 'تنتهي قريبًا'], grace: ['wait', 'مهلة'], paused: ['bad', 'متوقفة'] };
const KIND = { new: 'جديدة', renew: 'تجديد', upgrade: 'ترقية', topup: 'شحن' };
const MONTHS = { 0: 'ترقية فقط', 1: 'شهر', 3: '3 أشهر', 6: '6 أشهر', 12: 'سنة' };
const planText = (p) => p.gb ? `${p.gb} غ.ب${p.months ? ` × ${MONTHS[p.months]}` : ' · ترقية'}${Number(p.discount_pct) ? ` (\u2066−${Number(p.discount_pct)}%\u2069)` : ''}` : '—';
const dzd = (n) => `${Math.round(Number(n || 0)).toLocaleString('en-US')} دج`;
const day = (iso) => String(iso || '').slice(0, 10);
const state = { loaded: false, data: null, method: '', open: null };

async function call(action, body, qs = '') {
  const r = await fetch(`${API}?action=${action}${qs}`, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
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
  if (!$('payMonth').value) $('payMonth').value = new Date(Date.now() + 3600e3).toISOString().slice(0, 7);
  if (!state.data) $('payBody').innerHTML = NawaUI.loading('جارٍ التحميل…', 'list');
  try { state.data = await call('payments', null, `&month=${encodeURIComponent($('payMonth').value)}`); state.loaded = true; }
  catch (e) { if (e.code !== 'signed_out') $('payBody').innerHTML = '<p class="empty">تعذّر التحميل.</p>'; return; }
  render();
}

function render() {
  const d = state.data, t = d.totals;
  const list = d.payments.filter((p) => !state.method || p.method === state.method);
  $('payBody').innerHTML = `
    <div class="stats pay-stats">
      <div class="stat"><b>${esc(dzd(t.received))}</b><span>استُلم هذا الشهر · ${t.count} دفعة</span></div>
      <div class="stat"><b>${t.active}</b><span>خطط نشطة</span></div>
      <div class="stat"><b>${esc(dzd(t.mrr))}</b><span>الدخل الشهري المتكرر</span></div>
      <div class="stat"><b dir="ltr">${t.usedGb} / ${t.soldGb}</b><span>غ.ب مستخدمة / مباعة</span></div>
      <div class="stat"><b>${esc(dzd(t.cost))}</b><span>تكلفة التخزين شهريًا (تقديرية)</span></div>
      <div class="stat"><b>${esc(dzd(t.margin))}</b><span>هامشك الشهري</span></div>
    </div>

    <section class="ct-card pay-sec">
      <h2>للتحقق ${d.pending.length ? `<span class="cl-st tone-wait">${d.pending.length}</span>` : ''}</h2>
      ${d.pending.length ? `<ul class="pay-pending">${d.pending.map((p) => `
        <li data-id="${esc(p.id)}">
          ${p.has_receipt ? `<a class="pay-receipt" href="${API}?action=payment-receipt&id=${encodeURIComponent(p.id)}" target="_blank" rel="noopener" title="افتح الوصل"><img src="${API}?action=payment-receipt&id=${encodeURIComponent(p.id)}" alt="وصل ${esc(p.client)}" loading="lazy"></a>` : '<span class="pay-receipt none">بلا صورة</span>'}
          <div class="pay-info">
            <b>${esc(p.client)} · ${esc(dzd(p.amount_dzd))}</b>
            <span class="pay-plan">${esc(planText(p))} <span class="cl-st">${esc(KIND[p.kind] || '')}</span></span>
            <span class="muted">${esc(METHOD[p.method] || p.method)} · <span dir="ltr">${esc(day(p.created_at))}</span>${p.upgrade_dzd ? ` · منها ${esc(dzd(p.upgrade_dzd))} للأيام المتبقية` : ''}</span>
            ${p.reference ? `<span class="pay-ref">المرجع: <code dir="ltr">${esc(p.reference)}</code></span>` : ''}
          </div>
          <div class="pay-acts">
            <button type="button" class="btn btn-dark" data-approve="${esc(p.id)}">قبول</button>
            <button type="button" class="btn btn-ghost-dark" data-reject="${esc(p.id)}">رفض</button>
          </div>
          <form class="pay-reason" data-reason="${esc(p.id)}" hidden>
            <input name="reason" maxlength="200" placeholder="سبب الرفض (يصل للعميل)، مثل: المبلغ لم يصل بعد">
            <button type="submit" class="btn btn-dark">تأكيد الرفض</button>
          </form>
        </li>`).join('')}</ul>` : '<p class="muted">لا وصولات تنتظر التحقق.</p>'}
    </section>

    <section class="ct-card pay-sec">
      <h2>الخطط</h2>
      ${d.plans.length ? `<div class="pt-table"><table class="pay-table"><thead><tr><th>العميل</th><th>الخطة</th><th>المستخدم</th><th>حتى</th><th>الحالة</th><th></th></tr></thead><tbody>
        ${d.plans.map((b) => `<tr>
          <td><b>${esc(b.name)}</b></td>
          <td>${b.gb ? `${b.gb} غ.ب` : '—'}${b.next ? ` <span class="muted">→ ${b.next.gb} من ${esc(b.next.from)}</span>` : ''}</td>
          <td dir="ltr">${(Math.round(b.usedGb * 100) / 100)} GB${b.gb ? ` · ${Math.round((b.usedGb / b.gb) * 100)}%` : ''}</td>
          <td dir="ltr">${esc(b.until || '—')}${['active', 'expiring'].includes(b.state) ? ` <span class="muted">(${b.daysLeft} يومًا)</span>` : b.state === 'grace' ? ` <span class="muted">(مهلة ${b.graceLeft})</span>` : ''}</td>
          <td><span class="cl-st tone-${STATE[b.state]?.[0] || 'idle'}">${esc(STATE[b.state]?.[1] || b.state)}</span></td>
          <td><button type="button" class="link-btn" data-manual="${esc(b.id)}">منح خطة</button></td>
        </tr>
        <tr class="pay-manual-row" data-manual-row="${esc(b.id)}" hidden><td colspan="6">
          <form class="pay-manual" data-client="${esc(b.id)}" data-gb="${b.gb}" data-days="${b.daysLeft || 0}" data-active="${['active', 'expiring'].includes(b.state)}">
            <label class="ct-field"><span>المساحة (غ.ب)</span><input name="gb" type="number" min="${d.options.min_gb}" max="${d.options.max_gb}" step="${d.options.step_gb}" value="${b.gb || 10}" required dir="ltr"></label>
            <label class="ct-field"><span>المدة</span><select name="months">${['active', 'expiring'].includes(b.state) ? '<option value="0">ترقية فقط</option>' : ''}${d.options.durations.filter((x) => x.on).map((x) => `<option value="${x.months}"${x.months === 1 ? ' selected' : ''}>${MONTHS[x.months]}${x.discount ? ` (\u2066−${x.discount}%\u2069)` : ''}</option>`).join('')}</select></label>
            <label class="ct-field"><span>المبلغ المستلم (دج)</span><input name="amount" type="number" min="0" step="1" dir="ltr" placeholder="يُحسب تلقائيًا"></label>
            <label class="ct-field"><span>الطريقة</span><select name="method">${Object.entries(METHOD).map(([k, v]) => `<option value="${k}"${k === 'cash' ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
            <label class="ct-field"><span>ملاحظة</span><input name="note" maxlength="80" placeholder="اختياري"></label>
            <button type="submit" class="btn btn-dark">فعّل الخطة</button>
            <small class="muted pay-calc" data-calc></small>
          </form>
        </td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted">لا عملاء بعد.</p>'}
    </section>

    <section class="ct-card pay-sec">
      <div class="pay-head"><h2>سجل الدفعات · <span dir="ltr">${esc(d.month)}</span></h2>
        <div class="pay-tools">
          <select id="payMethod" aria-label="الطريقة"><option value="">كل الطرق</option>${Object.entries(METHOD).map(([k, v]) => `<option value="${k}"${state.method === k ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>
          <button type="button" class="btn btn-ghost-dark" id="payCsv"${list.length ? '' : ' disabled'}>تصدير Excel (CSV)</button>
        </div></div>
      ${list.length ? `<div class="pt-table"><table class="pay-table"><thead><tr><th>التاريخ</th><th>العميل</th><th>الخطة</th><th>المبلغ</th><th>الطريقة</th><th>الوصل</th><th>الحالة</th></tr></thead><tbody>
        ${list.map((p) => `<tr>
          <td dir="ltr">${esc(day(p.reviewed_at || p.created_at))}</td>
          <td>${esc(p.client)}</td>
          <td>${esc(planText(p))}${p.kind && p.kind !== 'topup' ? ` <span class="muted">· ${esc(KIND[p.kind])}</span>` : ''}</td>
          <td><b>${esc(dzd(p.amount_dzd))}</b></td>
          <td>${esc(METHOD[p.method] || p.method)}${p.source === 'admin' ? ' <span class="muted">(يدوي)</span>' : ''}</td>
          <td>${p.has_receipt ? `<a href="${API}?action=payment-receipt&id=${encodeURIComponent(p.id)}" target="_blank" rel="noopener">عرض</a>` : p.reference ? `<span dir="ltr">${esc(p.reference)}</span>` : '—'}</td>
          <td><span class="cl-st tone-${p.status === 'approved' ? 'ok' : 'bad'}">${p.status === 'approved' ? 'مقبولة' : 'مرفوضة'}</span>${p.reason ? `<small class="muted pay-why">${esc(p.reason)}</small>` : ''}</td>
        </tr>`).join('')}
      </tbody></table></div>` : '<p class="muted">لا دفعات في هذا الشهر.</p>'}
    </section>`;
  bind(list);
}

function bind(list) {
  const body = $('payBody');
  body.querySelectorAll('[data-approve]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    try { await call('payment-review', { id: b.dataset.approve, approve: true }); toast('فُعّلت الخطة، ووصلت رسالة للعميل.'); await load(); }
    catch (e) { b.disabled = false; toast(e.code === 'already_reviewed' ? 'رُوجعت هذه الدفعة من قبل.' : 'تعذّر القبول.', true); }
  }));
  body.querySelectorAll('[data-reject]').forEach((b) => b.addEventListener('click', () => {
    const f = body.querySelector(`[data-reason="${CSS.escape(b.dataset.reject)}"]`); f.hidden = !f.hidden; if (!f.hidden) f.reason.focus();
  }));
  body.querySelectorAll('form[data-reason]').forEach((f) => f.addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = f.querySelector('button'); btn.disabled = true;
    try { await call('payment-review', { id: f.dataset.reason, approve: false, reason: f.reason.value }); toast('رُفضت الدفعة، ووصل السبب للعميل.'); await load(); }
    catch { btn.disabled = false; toast('تعذّر الرفض.', true); }
  }));
  body.querySelectorAll('[data-manual]').forEach((b) => b.addEventListener('click', () => {
    const row = body.querySelector(`[data-manual-row="${CSS.escape(b.dataset.manual)}"]`); row.hidden = !row.hidden; if (!row.hidden) row.querySelector('input').focus();
  }));
  // «منح خطة»: the price the client would pay (same rules as the portal), editable for cash deals
  const calc = (f) => {
    const gb = Number(f.gb.value), months = Number(f.months.value), cur = Number(f.dataset.gb), days = Number(f.dataset.days), active = f.dataset.active === 'true';
    const disc = state.data.options.durations.find((x) => x.months === months)?.discount || 0, unit = state.data.unit;
    const total = (active && gb > cur ? Math.round((gb - cur) * unit * days / 30) : 0) + (months ? Math.round(gb * unit * months * (1 - disc / 100)) : 0);
    f.amount.placeholder = String(total);
    f.querySelector('[data-calc]').textContent = `السعر حسب الخطة: ${dzd(total)}. اترك المبلغ فارغًا لاستعماله، أو اكتب ما استلمته فعلًا.`;
  };
  body.querySelectorAll('form.pay-manual').forEach((f) => {
    f.addEventListener('input', () => calc(f)); calc(f);
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); const btn = f.querySelector('button'); btn.disabled = true;
      try { await call('payment-manual', { client_id: f.dataset.client, gb: Number(f.gb.value), months: Number(f.months.value), amount: f.amount.value, method: f.method.value, note: f.note.value }); toast('فُعّلت الخطة.'); await load(); }
      catch (err) {
        btn.disabled = false;
        toast({ bad_amount: 'تحقّق من المبلغ.', bad_gb: 'المساحة خارج المتاح.', below_usage: 'المساحة أقل مما يخزّنه العميل.', bad_months: 'اختر مدة متاحة (الترقية فقط لمساحة أكبر خلال خطة نشطة).' }[err.code] || 'تعذّر التفعيل.', true);
      }
    });
  });
  $('payMethod').onchange = (e) => { state.method = e.target.value; render(); };
  $('payCsv').onclick = () => {
    const rows = [['date', 'client', 'gb', 'months', 'discount_pct', 'kind', 'amount_dzd', 'method', 'status', 'source', 'note', 'reason'],
      ...list.map((p) => [day(p.reviewed_at || p.created_at), p.client, p.gb ?? '', p.months ?? '', p.discount_pct ?? 0, p.kind, p.amount_dzd, METHOD[p.method] || p.method, p.status, p.source, p.reference, p.reason])];
    const csv = '﻿' + rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `nawa-payments-${state.data.month}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
}

$('payMonth').addEventListener('change', load);
$('payRefresh').addEventListener('click', load);
window.addEventListener('nawa:payments', () => load());
