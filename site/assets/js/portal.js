// /portal: the client's space. Sign in with a code by email or with Google, follow the activation
// of Facebook, Instagram, LinkedIn and TikTok, and manage content with Nawa's own tools
// (assets/js/admin-content.js, loaded by the page in client mode).
// Arabic by default; English and French from the switcher (remembered on this device).
import { PLATFORMS, PLATFORM_ORDER, STATUS, LANGS, L, icon } from './portal-schema.js?v=20261023a';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const API = '/api/portal';

const T = {
  ar: {
    title: 'مساحة العميل | نواة', tag: 'مساحة العميل', logout: 'تسجيل الخروج', loading: 'جارٍ التحميل…',
    loginTitle: 'تسجيل الدخول', loginLead: 'أدخل البريد الذي سجّلته لدى نواة، ونرسل لك رمز دخول.', email: 'البريد الإلكتروني',
    sendCode: 'أرسل الرمز', or: 'أو', google: 'المتابعة بحساب Google', codeTitle: 'أدخل الرمز', codeLead: 'إذا كان البريد مسجّلًا لدى نواة، أرسلنا رمزًا من 6 أرقام إلى',
    code: 'الرمز', signIn: 'دخول', resend: 'إعادة الإرسال', changeEmail: 'تغيير البريد', sending: 'جارٍ الإرسال…', checking: 'جارٍ التحقق…',
    tabPlatforms: 'المنصات', tabContent: 'المحتوى', calendar: 'التقويم', list: 'القائمة', newPost: '+ منشور جديد',
    hello: (n) => `مرحبًا ${n}`, progress: (a, b) => `${a} من ${b} منصات مفعّلة`, checkNow: 'تحقق الآن', checked: 'تم التحقق.',
    stepsTitle: 'خطوات التفعيل', autoNote: 'نتحقق من هذه المنصة تلقائيًا.', manualNote: 'نحدّث هذه الحالة بعد التحقق.', nawaNote: 'ملاحظة من نواة',
    platformsLead: 'فعّل منصاتك لننشر عليها مباشرة من التقويم. اتبع خطوات كل منصة.', allActive: 'كل منصاتك مفعّلة. يمكنك النشر مباشرة من «المحتوى».',
    e_bad_email: 'تحقّق من البريد الإلكتروني.', e_wait: 'طلبت رموزًا كثيرة. انتظر دقيقة ثم أعد المحاولة.', e_bad_code: 'الرمز غير صحيح أو انتهت صلاحيته.',
    e_mail_not_configured: 'إرسال الرموز غير متاح الآن. استعمل الدخول بحساب Google أو تواصل مع نواة.', e_error: 'حدث خطأ. حاول مرة أخرى.',
    g_unknown: 'لا يوجد حساب لدى نواة بهذا البريد في Google. استعمل البريد الذي سجّلته لدينا.', g_denied: 'لم تكتمل الموافقة على Google.', g_failed: 'تعذّر الدخول بحساب Google. حاول مرة أخرى.',
  },
  en: {
    title: 'Client space | Nawa', tag: 'Client space', logout: 'Sign out', loading: 'Loading…',
    loginTitle: 'Sign in', loginLead: 'Enter the email you registered with Nawa and we’ll send you a sign-in code.', email: 'Email',
    sendCode: 'Send code', or: 'or', google: 'Continue with Google', codeTitle: 'Enter the code', codeLead: 'If this email is registered with Nawa, we sent a 6-digit code to',
    code: 'Code', signIn: 'Sign in', resend: 'Resend', changeEmail: 'Change email', sending: 'Sending…', checking: 'Checking…',
    tabPlatforms: 'Platforms', tabContent: 'Content', calendar: 'Calendar', list: 'List', newPost: '+ New post',
    hello: (n) => `Hello ${n}`, progress: (a, b) => `${a} of ${b} platforms active`, checkNow: 'Check now', checked: 'Checked.',
    stepsTitle: 'How to activate', autoNote: 'We check this platform automatically.', manualNote: 'We update this status once we’ve checked.', nawaNote: 'Note from Nawa',
    platformsLead: 'Activate your platforms so we can publish to them straight from the calendar. Follow the steps for each one.', allActive: 'All your platforms are active. You can publish straight from “Content”.',
    e_bad_email: 'Check the email address.', e_wait: 'Too many codes requested. Wait a minute and try again.', e_bad_code: 'The code is wrong or has expired.',
    e_mail_not_configured: 'Email codes aren’t available right now. Use Google or contact Nawa.', e_error: 'Something went wrong. Please try again.',
    g_unknown: 'No Nawa account uses this Google email. Use the email you registered with us.', g_denied: 'Google sign-in wasn’t completed.', g_failed: 'Google sign-in failed. Please try again.',
  },
  fr: {
    title: 'Espace client | Nawa', tag: 'Espace client', logout: 'Se déconnecter', loading: 'Chargement…',
    loginTitle: 'Connexion', loginLead: 'Saisissez l’e-mail enregistré chez Nawa et nous vous enverrons un code de connexion.', email: 'E-mail',
    sendCode: 'Envoyer le code', or: 'ou', google: 'Continuer avec Google', codeTitle: 'Saisissez le code', codeLead: 'Si cet e-mail est enregistré chez Nawa, nous avons envoyé un code à 6 chiffres à',
    code: 'Code', signIn: 'Se connecter', resend: 'Renvoyer', changeEmail: 'Changer d’e-mail', sending: 'Envoi…', checking: 'Vérification…',
    tabPlatforms: 'Plateformes', tabContent: 'Contenu', calendar: 'Calendrier', list: 'Liste', newPost: '+ Nouvelle publication',
    hello: (n) => `Bonjour ${n}`, progress: (a, b) => `${a} plateformes actives sur ${b}`, checkNow: 'Vérifier', checked: 'Vérifié.',
    stepsTitle: 'Comment l’activer', autoNote: 'Nous vérifions cette plateforme automatiquement.', manualNote: 'Nous mettons ce statut à jour après vérification.', nawaNote: 'Note de Nawa',
    platformsLead: 'Activez vos plateformes pour que nous publiions directement depuis le calendrier. Suivez les étapes de chacune.', allActive: 'Toutes vos plateformes sont actives. Vous pouvez publier depuis « Contenu ».',
    e_bad_email: 'Vérifiez l’adresse e-mail.', e_wait: 'Trop de codes demandés. Attendez une minute puis réessayez.', e_bad_code: 'Le code est incorrect ou a expiré.',
    e_mail_not_configured: 'L’envoi de codes n’est pas disponible. Utilisez Google ou contactez Nawa.', e_error: 'Une erreur est survenue. Réessayez.',
    g_unknown: 'Aucun compte Nawa n’utilise cet e-mail Google. Utilisez l’e-mail enregistré chez nous.', g_denied: 'La connexion Google n’a pas abouti.', g_failed: 'La connexion Google a échoué. Réessayez.',
  },
};

let lang = 'ar';
try { const q = new URLSearchParams(location.search).get('lang'); lang = LANGS.includes(q) ? q : (localStorage.getItem('nawa.lang') || 'ar'); } catch {}
if (!LANGS.includes(lang)) lang = 'ar';
const t = (k, ...a) => { const v = T[lang][k] ?? T.ar[k]; return typeof v === 'function' ? v(...a) : v; };

const state = { me: null, tab: 'platforms', email: '' };

function applyLang() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.title = t('title');
  document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
  document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  if (state.me) { drawHello(); drawPlatforms(); }
}
document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => {
  lang = b.dataset.lang;
  try { localStorage.setItem('nawa.lang', lang); } catch {}
  applyLang();
}));

async function call(action, body) {
  const r = await fetch(`${API}?action=${action}`, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.ok === false) throw Object.assign(new Error(d.error || 'error'), { code: d.error || 'error', status: r.status });
  return d;
}
const errMsg = (e) => t('e_' + e.code) || t('e_error');

// ---------- sign in ----------
function showLogin(msg = '') {
  state.me = null;
  $('booting').hidden = true; $('ptApp').hidden = true; $('ptLogout').hidden = true;
  $('ptLogin').hidden = false; $('ptEmailForm').hidden = false; $('ptCodeForm').hidden = true;
  $('ptEmailMsg').textContent = msg;
  setTimeout(() => $('ptEmail').focus(), 50);
}
function busy(form, on, label) {
  const b = form.querySelector('button[type=submit]');
  b.disabled = on; b.setAttribute('aria-busy', String(on));
  b.querySelector('.btn-label').textContent = on ? label : t(b.querySelector('.btn-label').dataset.t);
}
async function sendCode(email) {
  await call('otp-send', { email });
  state.email = email;
  $('ptSentTo').textContent = email;
  $('ptEmailForm').hidden = true; $('ptCodeForm').hidden = false; $('ptCodeMsg').textContent = '';
  $('ptCode').value = ''; setTimeout(() => $('ptCode').focus(), 50);
}
$('ptEmailForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('ptEmail').value.trim().toLowerCase();
  $('ptEmailMsg').textContent = '';
  busy($('ptEmailForm'), true, t('sending'));
  try { await sendCode(email); } catch (err) { $('ptEmailMsg').textContent = errMsg(err); }
  busy($('ptEmailForm'), false);
});
$('ptCodeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('ptCodeMsg').textContent = '';
  busy($('ptCodeForm'), true, t('checking'));
  try { await call('otp-verify', { email: state.email, code: $('ptCode').value }); await boot(); }
  catch (err) { $('ptCodeMsg').textContent = errMsg(err); }
  busy($('ptCodeForm'), false);
});
$('ptCode').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
  if (e.target.value.length === 6) $('ptCodeForm').requestSubmit();
});
$('ptResend').addEventListener('click', async () => {
  try { await sendCode(state.email); $('ptCodeMsg').textContent = ''; } catch (err) { $('ptCodeMsg').textContent = errMsg(err); }
});
$('ptChange').addEventListener('click', () => showLogin());
$('ptLogout').addEventListener('click', async () => { await call('logout', {}).catch(() => {}); location.hash = ''; showLogin(); });
window.addEventListener('nawa:signed-out', () => showLogin());

// ---------- signed in ----------
function drawHello() {
  const { user, client } = state.me;
  $('ptCompany').textContent = client.name;
  $('ptUser').textContent = t('hello', user.name || user.email);
}

function drawPlatforms() {
  const st = state.me.status;
  const active = PLATFORM_ORDER.filter((k) => st[k]?.status === 'active').length;
  const pct = Math.round((active / PLATFORM_ORDER.length) * 100);
  $('ptPlatforms').innerHTML = `
    <div class="ct-card pt-progress">
      <div class="pt-progress-top"><b>${esc(t('progress', active, PLATFORM_ORDER.length))}</b><button type="button" class="link-btn" id="ptCheck">${esc(t('checkNow'))}</button></div>
      <div class="pt-bar" role="progressbar" aria-valuenow="${active}" aria-valuemin="0" aria-valuemax="${PLATFORM_ORDER.length}"><i style="inline-size:${pct}%"></i></div>
      <p class="muted">${esc(active === PLATFORM_ORDER.length ? t('allActive') : t('platformsLead'))}</p>
    </div>
    <ul class="pt-cards">${PLATFORM_ORDER.map((k) => {
      const s = st[k] || { status: 'not_started' }; const p = PLATFORMS[k]; const done = s.status === 'active';
      const tone = STATUS[s.status]?.tone || 'idle';
      return `<li class="pt-card${done ? ' done' : ''}">
        <div class="pt-card-head">
          <i class="pt-logo" style="--c:${p.color}">${icon(k, 22)}</i>
          <div><b>${esc(L(p.name, lang))}</b>${s.name ? `<a class="muted" href="${esc(s.url)}" target="_blank" rel="noopener" dir="ltr">${esc(s.name)} ↗</a>` : ''}</div>
          <span class="cl-st tone-${tone}">${esc(L(STATUS[s.status]?.label, lang))}</span>
        </div>
        ${s.note ? `<p class="pt-note"><b>${esc(t('nawaNote'))}:</b> ${esc(s.note)}</p>` : ''}
        <details${done ? '' : ' open'}><summary>${esc(t('stepsTitle'))}</summary>
          <ol class="pt-steps">${L(p.steps, lang).map((x) => `<li>${x}</li>`).join('')}</ol>
          <p class="muted">${esc(t(p.auto ? 'autoNote' : 'manualNote'))}</p>
        </details>
      </li>`;
    }).join('')}</ul>`;
  $('ptCheck').onclick = async (e) => {
    e.target.disabled = true;
    try { state.me = await call('me&fresh=1'); drawPlatforms(); } catch {}
  };
}

function showTab(tab) {
  state.tab = tab;
  document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
  $('ptPlatforms').hidden = tab !== 'platforms';
  $('content').hidden = tab !== 'content';
  if (tab === 'content') window.dispatchEvent(new CustomEvent('nawa:content'));
  else if (location.hash.startsWith('#content')) history.replaceState(null, '', location.pathname);
}
document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.tab === 'content' && !location.hash.startsWith('#content')) history.replaceState(null, '', '#content');
  showTab(b.dataset.tab);
}));

async function boot() {
  const h = location.hash.slice(1);
  const gmsg = { 'google-unknown': 'g_unknown', 'google-denied': 'g_denied', 'google-failed': 'g_failed' }[h];
  if (gmsg) history.replaceState(null, '', location.pathname);
  try { state.me = await call('me'); }
  catch (e) { return showLogin(gmsg ? t(gmsg) : ''); }
  $('booting').hidden = true; $('ptLogin').hidden = true; $('ptApp').hidden = false; $('ptLogout').hidden = false;
  drawHello(); drawPlatforms();
  showTab(location.hash.startsWith('#content') ? 'content' : 'platforms');
}

applyLang();
boot();
