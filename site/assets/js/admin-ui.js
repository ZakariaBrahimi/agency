// Loading feedback for the whole admin, so nothing ever waits silently:
// · a thin bar at the top while any /api/ request is running;
// · the button that started a request shows a spinner and is disabled until every request it
//   started has finished (sequential requests from one click count as one action);
// · NawaUI.loading(text, kind) gives a placeholder for sections that are still loading.
(() => {
  const bar = document.createElement('div');
  bar.className = 'api-bar'; bar.setAttribute('aria-hidden', 'true');
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(bar));

  let pending = 0;
  let lastClick = null; // { btn, at }
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button, .btn');
    if (btn && !btn.matches('[data-nobusy], [aria-pressed], [role="tab"]')) lastClick = { btn, at: Date.now() };
  }, true);

  const owners = new Map(); // button -> running requests
  function hold(btn) {
    if (!btn || !btn.isConnected) return null;
    owners.set(btn, (owners.get(btn) || 0) + 1);
    clearTimeout(btn._busyOff);
    if (btn.getAttribute('aria-busy') !== 'true') {
      btn._wasDisabled = btn.disabled;
      btn.setAttribute('aria-busy', 'true');
      if ('disabled' in btn) btn.disabled = true;
    }
    return btn;
  }
  function release(btn) {
    if (!btn) return;
    const n = (owners.get(btn) || 1) - 1;
    if (n > 0) return owners.set(btn, n);
    owners.delete(btn);
    // a short grace period, so a follow-up request from the same action keeps the spinner on
    btn._busyOff = setTimeout(() => {
      if (owners.has(btn)) return;
      btn.removeAttribute('aria-busy');
      if ('disabled' in btn && !btn._wasDisabled) btn.disabled = false;
    }, 250);
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (!/^\/api\/|\/api\//.test(url)) return nativeFetch(input, init);
    pending++; bar.classList.add('on');
    const owner = lastClick && Date.now() - lastClick.at < 1500 ? hold(lastClick.btn) : null;
    if (owner) lastClick.at = Date.now(); // keeps chained requests attached to the same click
    return nativeFetch(input, init).finally(() => {
      pending = Math.max(0, pending - 1);
      if (!pending) setTimeout(() => { if (!pending) bar.classList.remove('on'); }, 200);
      release(owner);
    });
  };

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  window.NawaUI = {
    /** kind: 'calendar' | 'rows' | 'cards' */
    loading(text, kind = 'rows') {
      const skel = kind === 'calendar'
        ? `<div class="skel-stats">${'<i class="skel"></i>'.repeat(4)}</div><div class="skel-cal">${'<i class="skel"></i>'.repeat(14)}</div>`
        : kind === 'cards' ? `<div class="skel-stats">${'<i class="skel"></i>'.repeat(4)}</div>${'<i class="skel skel-row"></i>'.repeat(5)}`
          : '<i class="skel skel-row"></i>'.repeat(4);
      return `<div class="loading-block" role="status" aria-live="polite"><p class="loading-msg"><span class="spin on"></span>${esc(text)}</p>${skel}</div>`;
    },
  };
})();
