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

// «التخزين»: Google Drive (free, up to 15 GB) and «تخزين نواة» (paid per GB-month, in DZD).
const TS = {
  ar: {
    tabStorage: 'التخزين', stTitle: 'أين تُحفظ صورك وفيديوهاتك', stLead: 'نحفظ ملفاتك في Google Drive الخاص بك مجانًا حتى 15 غيغابايت. عند امتلائه تُحفظ الملفات الجديدة في «تخزين نواة» إذا فعّلته، وتبقى الملفات القديمة في مكانها.',
    driveTitle: 'Google Drive', free: 'مجاني', notConnected: 'غير مربوط', connectedAs: (e) => `مربوط بـ ${e}`,
    driveUse: (a, b) => `ملفات نواة: ${a} من ${b}`, accountLeft: (a) => `المساحة الحرة في حسابك على Google: ${a}`,
    driveCapNote: 'مساحة Google المجانية 15 غيغابايت، وتشاركها مع Gmail وصور Google. لا نستعمل أكثر من 15 غيغابايت حتى لو كان لديك اشتراك Google مدفوع.',
    fits: (p, v) => `تكفي تقريبًا لـ ${p} صورة أو ${v} فيديو قصير (تقدير: صورة ≈ 1 م.ب، ريل 30 ثانية ≈ 50 م.ب).`,
    driveFull: 'مساحة Google Drive المجانية ممتلئة. فعّل «تخزين نواة» لمتابعة الرفع.',
    stepsDrive: ['اضغط «ربط Google Drive».', 'اختر حسابك على Google ووافق.', 'ننشئ مجلد «نواة» في Drive الخاص بك. لا نرى إلا الملفات التي ترفعها من هنا، ولا نصل إلى بقية ملفاتك.'],
    driveCatch: 'مهم: الملفات التي تضيفها إلى مجلد «نواة» مباشرة من Google Drive لا تظهر هنا. ارفع ملفاتك دائمًا من هذه المساحة.',
    connectDrive: 'ربط Google Drive', disconnect: 'فصل Google Drive', confirmDisconnect: 'تأكيد الفصل (تبقى ملفاتك في Drive)',
    cloudTitle: 'تخزين نواة', payg: 'حسب الاستهلاك', perGb: (n) => `${n} دج لكل غيغابايت في الشهر`,
    cloudExplain: 'تدفع فقط مقابل ما تخزّنه: سعر الغيغابايت لشهر كامل، محسوبًا على متوسط ما خزّنته خلال الشهر. مثال: 2 غيغابايت نصف الشهر ثم 4 غيغابايت النصف الآخر = 3 غيغابايت.',
    storedNow: (a) => `مخزّن الآن: ${a}`, monthSoFar: (n) => `هذا الشهر حتى الآن: ${n} دج`, monthProjected: (n) => `المتوقع لنهاية الشهر: ${n} دج`,
    cloudOn: 'مفعّل', cloudOff: 'غير مفعّل', enableCloud: 'تفعيل «تخزين نواة»', disableCloud: 'إيقاف «تخزين نواة»', confirmEnable: (n) => `تأكيد: ${n} دج لكل غيغابايت شهريًا`,
    cloudSoon: 'قريبًا: تواصل مع نواة لتفعيله.', cloudNotEmpty: 'لا يمكن الإيقاف وفيه ملفات. احذفها أولًا.',
    invoices: 'الفواتير', noInvoices: 'لا توجد فواتير بعد. تصدر فاتورة في بداية كل شهر عن الشهر السابق.',
    invMonth: 'الشهر', invGb: 'متوسط التخزين', invAmount: 'المبلغ', invStatus: 'الحالة', paid: 'مدفوعة', unpaid: 'غير مدفوعة', void: 'ملغاة',
    payTitle: 'طرق الدفع', payLead: 'ادفع بإحدى الطرق التالية، ثم أرسل لنا وصل الدفع مع رقم الشهر.',
    baridimob: 'بريدي موب (RIP)', ccp: 'الحساب البريدي الجاري (CCP)', ccpName: 'الاسم', ccpAccount: 'رقم الحساب', ccpKey: 'المفتاح', redotpay: 'RedotPay', uid: 'UID', email2: 'البريد',
    copy: 'نسخ', copied: 'نُسخ', d_connected: 'رُبط Google Drive.', d_denied: 'لم تكتمل الموافقة على Google Drive.', d_failed: 'تعذّر ربط Google Drive. حاول مرة أخرى.',
  },
  en: {
    tabStorage: 'Storage', stTitle: 'Where your photos and videos are kept', stLead: 'We keep your files in your own Google Drive for free, up to 15 GB. Once it’s full, new files go to “Nawa storage” if you turn it on; older files stay where they are.',
    driveTitle: 'Google Drive', free: 'Free', notConnected: 'Not connected', connectedAs: (e) => `Connected as ${e}`,
    driveUse: (a, b) => `Nawa files: ${a} of ${b}`, accountLeft: (a) => `Free space left in your Google account: ${a}`,
    driveCapNote: 'Google’s free space is 15 GB, shared with Gmail and Google Photos. We never use more than 15 GB, even if you pay Google for more.',
    fits: (p, v) => `Enough for about ${p} photos or ${v} short videos (estimate: photo ≈ 1 MB, 30-second reel ≈ 50 MB).`,
    driveFull: 'Your free Google Drive space is full. Turn on “Nawa storage” to keep uploading.',
    stepsDrive: ['Press “Connect Google Drive”.', 'Choose your Google account and approve.', 'We create a “Nawa” folder in your Drive. We only see the files you upload here, never the rest of your Drive.'],
    driveCatch: 'Important: files you add to the “Nawa” folder directly in Google Drive won’t show up here. Always upload from this space.',
    connectDrive: 'Connect Google Drive', disconnect: 'Disconnect Google Drive', confirmDisconnect: 'Confirm (your files stay in Drive)',
    cloudTitle: 'Nawa storage', payg: 'Pay as you go', perGb: (n) => `${n} DZD per GB per month`,
    cloudExplain: 'You pay only for what you store: the price of one GB for a full month, based on your average over the month. Example: 2 GB for half the month, then 4 GB = 3 GB.',
    storedNow: (a) => `Stored now: ${a}`, monthSoFar: (n) => `This month so far: ${n} DZD`, monthProjected: (n) => `Expected by month end: ${n} DZD`,
    cloudOn: 'On', cloudOff: 'Off', enableCloud: 'Turn on Nawa storage', disableCloud: 'Turn off Nawa storage', confirmEnable: (n) => `Confirm: ${n} DZD per GB per month`,
    cloudSoon: 'Coming soon: contact Nawa to turn it on.', cloudNotEmpty: 'It can’t be turned off while files are stored. Delete them first.',
    invoices: 'Invoices', noInvoices: 'No invoices yet. An invoice is issued at the start of each month for the month before.',
    invMonth: 'Month', invGb: 'Average stored', invAmount: 'Amount', invStatus: 'Status', paid: 'Paid', unpaid: 'Unpaid', void: 'Void',
    payTitle: 'How to pay', payLead: 'Pay with one of these, then send us the payment receipt with the month.',
    baridimob: 'BaridiMob (RIP)', ccp: 'Postal account (CCP)', ccpName: 'Name', ccpAccount: 'Account number', ccpKey: 'Key', redotpay: 'RedotPay', uid: 'UID', email2: 'Email',
    copy: 'Copy', copied: 'Copied', d_connected: 'Google Drive connected.', d_denied: 'Google Drive approval wasn’t completed.', d_failed: 'Couldn’t connect Google Drive. Please try again.',
  },
  fr: {
    tabStorage: 'Stockage', stTitle: 'Où sont gardées vos photos et vidéos', stLead: 'Nous gardons vos fichiers dans votre propre Google Drive gratuitement, jusqu’à 15 Go. Une fois plein, les nouveaux fichiers vont dans « Stockage Nawa » si vous l’activez ; les anciens restent en place.',
    driveTitle: 'Google Drive', free: 'Gratuit', notConnected: 'Non connecté', connectedAs: (e) => `Connecté : ${e}`,
    driveUse: (a, b) => `Fichiers Nawa : ${a} sur ${b}`, accountLeft: (a) => `Espace libre sur votre compte Google : ${a}`,
    driveCapNote: 'L’espace gratuit de Google est de 15 Go, partagé avec Gmail et Google Photos. Nous n’utilisons jamais plus de 15 Go, même avec un abonnement Google payant.',
    fits: (p, v) => `Suffisant pour environ ${p} photos ou ${v} vidéos courtes (estimation : photo ≈ 1 Mo, reel de 30 s ≈ 50 Mo).`,
    driveFull: 'Votre espace Google Drive gratuit est plein. Activez « Stockage Nawa » pour continuer.',
    stepsDrive: ['Appuyez sur « Connecter Google Drive ».', 'Choisissez votre compte Google et acceptez.', 'Nous créons un dossier « Nawa » dans votre Drive. Nous ne voyons que les fichiers envoyés ici, jamais le reste de votre Drive.'],
    driveCatch: 'Important : les fichiers ajoutés directement au dossier « Nawa » dans Google Drive n’apparaissent pas ici. Envoyez toujours vos fichiers depuis cet espace.',
    connectDrive: 'Connecter Google Drive', disconnect: 'Déconnecter Google Drive', confirmDisconnect: 'Confirmer (vos fichiers restent dans Drive)',
    cloudTitle: 'Stockage Nawa', payg: 'Paiement à l’usage', perGb: (n) => `${n} DA par Go et par mois`,
    cloudExplain: 'Vous payez seulement ce que vous stockez : le prix d’un Go pour un mois entier, selon votre moyenne du mois. Exemple : 2 Go la moitié du mois puis 4 Go = 3 Go.',
    storedNow: (a) => `Stocké maintenant : ${a}`, monthSoFar: (n) => `Ce mois jusqu’ici : ${n} DA`, monthProjected: (n) => `Prévu en fin de mois : ${n} DA`,
    cloudOn: 'Activé', cloudOff: 'Désactivé', enableCloud: 'Activer le stockage Nawa', disableCloud: 'Désactiver le stockage Nawa', confirmEnable: (n) => `Confirmer : ${n} DA par Go et par mois`,
    cloudSoon: 'Bientôt : contactez Nawa pour l’activer.', cloudNotEmpty: 'Impossible de le désactiver tant que des fichiers y sont stockés.',
    invoices: 'Factures', noInvoices: 'Aucune facture pour l’instant. Une facture est émise au début de chaque mois pour le mois précédent.',
    invMonth: 'Mois', invGb: 'Stockage moyen', invAmount: 'Montant', invStatus: 'Statut', paid: 'Payée', unpaid: 'Non payée', void: 'Annulée',
    payTitle: 'Comment payer', payLead: 'Payez avec l’un de ces moyens, puis envoyez-nous le reçu avec le mois concerné.',
    baridimob: 'BaridiMob (RIP)', ccp: 'Compte postal (CCP)', ccpName: 'Nom', ccpAccount: 'Numéro de compte', ccpKey: 'Clé', redotpay: 'RedotPay', uid: 'UID', email2: 'E-mail',
    copy: 'Copier', copied: 'Copié', d_connected: 'Google Drive connecté.', d_denied: 'L’autorisation Google Drive n’a pas abouti.', d_failed: 'Connexion à Google Drive impossible. Réessayez.',
  },
};
for (const l of Object.keys(TS)) Object.assign(T[l], TS[l]);

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
  if (state.me) { drawHello(); drawPlatforms(); drawStorage(); }
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

// ---------- storage ----------
const fmtGb = (bytes) => { const gb = bytes / 1e9; return `${gb < 10 ? gb.toFixed(gb < 1 ? 2 : 1) : Math.round(gb)} ${lang === 'en' ? 'GB' : lang === 'fr' ? 'Go' : 'غ.ب'}`; };
const num = (n) => Math.max(0, Math.floor(n)).toLocaleString(lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-FR' : 'en-US');
const PHOTO = 1e6, REEL = 50e6;

async function loadStorage(msg) {
  const box = $('ptStorage');
  if (!state.storage) box.innerHTML = NawaUI.loading(t('loading'), 'list');
  try { state.storage = await call('storage'); } catch (e) { box.innerHTML = `<p class="empty">${esc(errMsg(e))}</p>`; return; }
  drawStorage(msg);
}

function drawStorage(msg = '') {
  const s = state.storage; if (!s) return;
  const d = s.drive, c = s.cloud, e = s.estimate;
  const q = d.quota;
  const accountRoom = q?.limit ? Math.max(0, Math.min(d.cap, q.limit) - q.usage) : null;
  const room = Math.max(0, Math.min(d.cap - d.bytes, accountRoom ?? Infinity));
  const full = d.connected && room < PHOTO;
  const pctDrive = Math.min(100, (d.bytes / d.cap) * 100);
  const row = (label, value) => `<div class="pt-payrow"><span>${esc(label)}</span><b dir="ltr">${esc(value)}</b><button type="button" class="link-btn" data-copy="${esc(value)}">${esc(t('copy'))}</button></div>`;
  const pay = s.payment || {};
  $('ptStorage').innerHTML = `
    ${msg ? `<p class="ct-card pt-msg">${esc(msg)}</p>` : ''}
    <div class="pt-st-head"><h2>${esc(t('stTitle'))}</h2><p class="muted">${esc(t('stLead'))}</p></div>
    <div class="pt-st-grid">
      <article class="pt-card pt-st">
        <div class="pt-card-head"><i class="pt-logo" style="--c:#1A73E8"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M8.2 3h7.6l6 10.4-3.8 6.6H6l-3.8-6.6zM9.4 5l-4.9 8.4L6.8 17l4.9-8.4zm5.2 0h-2.4l6.1 10.6h2.3zM8 18h9.8l1.2-2H9.2z"/></svg></i>
          <div><b>${esc(t('driveTitle'))}</b><span class="muted">${esc(d.connected ? t('connectedAs', d.email) : t('notConnected'))}</span></div>
          <span class="cl-st tone-ok">${esc(t('free'))}</span></div>
        ${d.connected ? `
          <div><div class="pt-meter-label">${esc(t('driveUse', fmtGb(d.bytes), fmtGb(d.cap)))}</div>
          <div class="pt-bar"><i style="inline-size:${pctDrive.toFixed(1)}%"></i></div></div>
          ${accountRoom !== null ? `<p class="muted pt-small">${esc(t('accountLeft', fmtGb(accountRoom)))}</p>` : ''}
          ${full ? `<p class="pt-warn">${esc(t('driveFull'))}</p>` : `<p class="pt-small">${esc(t('fits', num(room / PHOTO), num(room / REEL)))}</p>`}`
        : `<ol class="pt-steps">${t('stepsDrive').map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
           <p class="pt-small">${esc(t('fits', num(d.cap / PHOTO), num(d.cap / REEL)))}</p>`}
        <p class="muted pt-small">${esc(t('driveCapNote'))}</p>
        <p class="pt-note">${esc(t('driveCatch'))}</p>
        <div class="pt-st-btns">${d.connected
          ? `<button type="button" class="btn btn-ghost-dark" id="ptDriveOff">${esc(t('disconnect'))}</button>`
          : `<a class="btn btn-dark" href="/api/portal?action=drive-connect" data-nobusy>${esc(t('connectDrive'))}</a>`}</div>
      </article>

      <article class="pt-card pt-st">
        <div class="pt-card-head"><i class="pt-logo" style="--c:#5B4BFF"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M7 18a5 5 0 0 1-.6-10A6 6 0 0 1 18 8.5a4.5 4.5 0 0 1-.5 9.5z"/></svg></i>
          <div><b>${esc(t('cloudTitle'))}</b><span class="muted">${esc(t('payg'))}</span></div>
          <span class="cl-st tone-${c.enabled ? 'ok' : 'idle'}">${esc(t(c.enabled ? 'cloudOn' : 'cloudOff'))}</span></div>
        <p class="pt-price"><b>${esc(t('perGb', num(e.price_dzd)))}</b></p>
        <p class="muted pt-small">${esc(t('cloudExplain'))}</p>
        <div class="pt-figs">
          <div><span>${esc(t('storedNow', fmtGb(c.bytes)))}</span></div>
          <div><span>${esc(t('monthSoFar', num(e.so_far_dzd)))}</span></div>
          <div><span>${esc(t('monthProjected', num(e.projected_dzd)))}</span></div>
        </div>
        <div class="pt-st-btns">${!c.available && !c.enabled ? `<p class="muted pt-small">${esc(t('cloudSoon'))}</p>`
          : c.enabled ? `<button type="button" class="btn btn-ghost-dark" id="ptCloudOff">${esc(t('disableCloud'))}</button>`
          : `<button type="button" class="btn btn-lime" id="ptCloudOn">${esc(t('enableCloud'))}</button>`}</div>
      </article>
    </div>

    <section class="ct-card pt-inv">
      <h3>${esc(t('invoices'))}</h3>
      ${s.invoices.length ? `<div class="pt-table"><table><thead><tr><th>${esc(t('invMonth'))}</th><th>${esc(t('invGb'))}</th><th>${esc(t('invAmount'))}</th><th>${esc(t('invStatus'))}</th></tr></thead><tbody>
        ${s.invoices.map((i) => `<tr><td dir="ltr">${esc(i.month)}</td><td>${esc(fmtGb(Number(i.avg_gb) * 1e9))}</td><td><b>${esc(num(i.amount_dzd))} ${lang === 'ar' ? 'دج' : lang === 'fr' ? 'DA' : 'DZD'}</b></td><td><span class="cl-st tone-${i.status === 'paid' ? 'ok' : i.status === 'void' ? 'idle' : 'wait'}">${esc(t(i.status))}</span></td></tr>`).join('')}
      </tbody></table></div>` : `<p class="muted">${esc(t('noInvoices'))}</p>`}
    </section>

    <section class="ct-card pt-pay">
      <h3>${esc(t('payTitle'))}</h3>
      <p class="muted pt-small">${esc(t('payLead'))}</p>
      ${pay.baridimob_rip ? `<div class="pt-paybox"><b>${esc(t('baridimob'))}</b>${row('RIP', pay.baridimob_rip)}</div>` : ''}
      ${pay.ccp_account ? `<div class="pt-paybox"><b>${esc(t('ccp'))}</b>${row(t('ccpName'), pay.ccp_name)}${row(t('ccpAccount'), pay.ccp_account)}${row(t('ccpKey'), pay.ccp_key)}</div>` : ''}
      ${pay.redotpay_uid || pay.redotpay_email ? `<div class="pt-paybox"><b>${esc(t('redotpay'))}</b>${pay.redotpay_uid ? row(t('uid'), pay.redotpay_uid) : ''}${pay.redotpay_email ? row(t('email2'), pay.redotpay_email) : ''}</div>` : ''}
    </section>`;

  $('ptStorage').querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = t('copied'); setTimeout(() => (b.textContent = t('copy')), 1500); } catch {}
  }));
  const arm = (b, label, fn) => b && b.addEventListener('click', async () => {
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = label; b.classList.add('armed'); return; }
    b.disabled = true;
    try { await fn(); await loadStorage(); } catch (err) { drawStorage(err.code === 'cloud_not_empty' ? t('cloudNotEmpty') : errMsg(err)); }
  });
  arm($('ptDriveOff'), t('confirmDisconnect'), () => call('drive-disconnect', {}));
  arm($('ptCloudOn'), t('confirmEnable', num(e.price_dzd)), () => call('cloud', { enabled: true }));
  arm($('ptCloudOff'), t('disableCloud') + ' ✓', () => call('cloud', { enabled: false }));
}

function showTab(tab) {
  state.tab = tab;
  document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
  $('ptPlatforms').hidden = tab !== 'platforms';
  $('content').hidden = tab !== 'content';
  $('ptStorage').hidden = tab !== 'storage';
  if (tab === 'storage') loadStorage();
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
  const sm = { 'storage/drive-connected': 'd_connected', 'storage/drive-denied': 'd_denied', 'storage/drive-failed': 'd_failed' }[h];
  if (h.startsWith('storage')) {
    history.replaceState(null, '', location.pathname);
    showTab('storage');
    if (sm) loadStorage(t(sm));
    return;
  }
  showTab(location.hash.startsWith('#content') ? 'content' : 'platforms');
}

applyLang();
boot();
