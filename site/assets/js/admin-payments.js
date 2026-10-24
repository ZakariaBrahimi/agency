// /admin → «المدفوعات»: prepaid «تخزين نواة» top-ups. Receipts waiting to be checked (approve /
// reject with a reason), every client's balance (with a manual top-up for cash), the month's payments
// with filters and a CSV export, and the month's totals (received, used, storage cost, margin).
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const API = '/api/admin/content';
const METHOD = { baridimob: 'بريدي موب', ccp: 'CCP', redotpay: 'RedotPay', cash: 'نقدًا', other: 'أخرى' };
const STATE = { ok: ['ok', 'جيد'], low: ['wait', 'منخفض'], empty: ['idle', 'بلا رصيد'], grace: ['wait', 'مهلة'], paused: ['bad', 'متوقف'] };
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
      <div class="stat"><b>${esc(dzd(t.used))}</b><span>استهلاك العملاء</span></div>
      <div class="stat"><b>${esc(dzd(t.cost))}</b><span>تكلفة التخزين (تقديرية)</span></div>
      <div class="stat"><b>${esc(dzd(t.margin))}</b><span>هامشك</span></div>
      <div class="stat"><b>${esc(dzd(t.balances))}</b><span>مجموع الأرصدة الحالية</span></div>
    </div>

    <section class="ct-card pay-sec">
      <h2>للتحقق ${d.pending.length ? `<span class="cl-st tone-wait">${d.pending.length}</span>` : ''}</h2>
      ${d.pending.length ? `<ul class="pay-pending">${d.pending.map((p) => `
        <li data-id="${esc(p.id)}">
          ${p.has_receipt ? `<a class="pay-receipt" href="${API}?action=payment-receipt&id=${encodeURIComponent(p.id)}" target="_blank" rel="noopener" title="افتح الوصل"><img src="${API}?action=payment-receipt&id=${encodeURIComponent(p.id)}" alt="وصل ${esc(p.client)}" loading="lazy"></a>` : '<span class="pay-receipt none">بلا صورة</span>'}
          <div class="pay-info">
            <b>${esc(p.client)} · ${esc(dzd(p.amount_dzd))}</b>
            <span class="muted">${esc(METHOD[p.method] || p.method)} · <span dir="ltr">${esc(day(p.created_at))}</span></span>
            ${p.reference ? `<span class="pay-ref">المرجع: <code dir="ltr">${esc(p.reference)}</code></span>` : '<span class="muted">بلا مرجع</span>'}
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
      <h2>الأرصدة</h2>
      ${d.balances.length ? `<div class="pt-table"><table class="pay-table"><thead><tr><th>العميل</th><th>الرصيد</th><th>يكفي لـ</th><th>يوميًا</th><th>الحالة</th><th></th></tr></thead><tbody>
        ${d.balances.map((b) => `<tr>
          <td><b>${esc(b.name)}</b>${b.cloud_enabled ? '' : ' <span class="muted">(«تخزين نواة» متوقف)</span>'}</td>
          <td dir="auto"><b>${esc(dzd(b.balance))}</b></td>
          <td>${b.daysLeft == null ? '—' : b.balance > 0 ? `${b.daysLeft} يومًا` : b.state === 'grace' ? `مهلة ${b.graceLeft} أيام` : '—'}</td>
          <td>${b.daily > 0 ? esc(dzd(b.daily)) : '—'}</td>
          <td><span class="cl-st tone-${STATE[b.state]?.[0] || 'idle'}">${esc(STATE[b.state]?.[1] || b.state)}</span></td>
          <td><button type="button" class="link-btn" data-manual="${esc(b.id)}">إضافة رصيد</button></td>
        </tr>
        <tr class="pay-manual-row" data-manual-row="${esc(b.id)}" hidden><td colspan="6">
          <form class="pay-manual" data-client="${esc(b.id)}">
            <label class="ct-field"><span>المبلغ (دج)</span><input name="amount" type="number" min="1" step="1" required dir="ltr"></label>
            <label class="ct-field"><span>الطريقة</span><select name="method">${Object.entries(METHOD).map(([k, v]) => `<option value="${k}"${k === 'cash' ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
            <label class="ct-field"><span>ملاحظة</span><input name="note" maxlength="80" placeholder="اختياري"></label>
            <button type="submit" class="btn btn-dark">أضف للرصيد</button>
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
      ${list.length ? `<div class="pt-table"><table class="pay-table"><thead><tr><th>التاريخ</th><th>العميل</th><th>المبلغ</th><th>الطريقة</th><th>المرجع</th><th>الحالة</th></tr></thead><tbody>
        ${list.map((p) => `<tr>
          <td dir="ltr">${esc(day(p.reviewed_at || p.created_at))}</td>
          <td>${esc(p.client)}</td>
          <td><b>${esc(dzd(p.amount_dzd))}</b></td>
          <td>${esc(METHOD[p.method] || p.method)}${p.source === 'admin' ? ' <span class="muted">(يدوي)</span>' : ''}</td>
          <td dir="ltr">${esc(p.reference || '—')}${p.has_receipt ? ` · <a href="${API}?action=payment-receipt&id=${encodeURIComponent(p.id)}" target="_blank" rel="noopener">الوصل</a>` : ''}</td>
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
    try { await call('payment-review', { id: b.dataset.approve, approve: true }); toast('أُضيف المبلغ إلى رصيد العميل.'); await load(); }
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
  body.querySelectorAll('form.pay-manual').forEach((f) => f.addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = f.querySelector('button'); btn.disabled = true;
    try { await call('payment-manual', { client_id: f.dataset.client, amount: Number(f.amount.value), method: f.method.value, note: f.note.value }); toast('أُضيف الرصيد.'); await load(); }
    catch (err) { btn.disabled = false; toast(err.code === 'bad_amount' ? 'تحقّق من المبلغ.' : 'تعذّرت الإضافة.', true); }
  }));
  $('payMethod').onchange = (e) => { state.method = e.target.value; render(); };
  $('payCsv').onclick = () => {
    const rows = [['date', 'client', 'amount_dzd', 'method', 'reference', 'status', 'source', 'reason'],
      ...list.map((p) => [day(p.reviewed_at || p.created_at), p.client, p.amount_dzd, METHOD[p.method] || p.method, p.reference, p.status, p.source, p.reason])];
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
