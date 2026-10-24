// /portal: the client's space. Sign in with a code by email or with Google, follow the activation
// of Facebook, Instagram, LinkedIn and TikTok, and manage content with Nawa's own tools
// (assets/js/admin-content.js, loaded by the page in client mode).
// Arabic by default; English and French from the switcher (remembered on this device).
import { PLATFORMS, PLATFORM_ORDER, STATUS, LANGS, L, icon, copyButton } from './portal-schema.js?v=20261023b';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const API = '/api/portal';

const T = {
  ar: {
    title: 'مساحة العميل | نواة', tag: 'مساحة العميل', logout: 'تسجيل الخروج', loading: 'جارٍ التحميل…',
    loginTitle: 'تسجيل الدخول', privacy: 'سياسة الخصوصية', loginLead: 'أدخل البريد الذي سجّلته لدى نواة، ونرسل لك رمز دخول.', email: 'البريد الإلكتروني',
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
    loginTitle: 'Sign in', privacy: 'Privacy policy', loginLead: 'Enter the email you registered with Nawa and we’ll send you a sign-in code.', email: 'Email',
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
    loginTitle: 'Connexion', privacy: 'Politique de confidentialité', loginLead: 'Saisissez l’e-mail enregistré chez Nawa et nous vous enverrons un code de connexion.', email: 'E-mail',
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
    driveFull: 'مساحة Google Drive المجانية ممتلئة. اختر خطة «تخزين نواة» لمتابعة الرفع.',
    stepsDrive: ['اضغط «ربط Google Drive».', 'اختر حسابك على Google ووافق.', 'ننشئ مجلد «نواة» في Drive الخاص بك. لا نرى إلا الملفات التي ترفعها من هنا، ولا نصل إلى بقية ملفاتك.'],
    driveCatch: 'مهم: الملفات التي تضيفها إلى مجلد «نواة» مباشرة من Google Drive لا تظهر هنا. ارفع ملفاتك دائمًا من هذه المساحة.',
    connectDrive: 'ربط Google Drive', disconnect: 'فصل Google Drive', confirmDisconnect: 'تأكيد الفصل (تبقى ملفاتك في Drive)',
    cloudTitle: 'تخزين نواة', perGb: (n) => `${n} دج لكل غيغابايت في الشهر`,
    planSub: 'خطة مساحة شهرية', ps_none: 'بلا خطة', ps_active: 'نشطة', ps_expiring: 'تنتهي قريبًا', ps_grace: 'انتهت', ps_paused: 'متوقفة', planExplain: 'اختر المساحة التي تحتاجها والمدة، وادفع مرة واحدة. تبقى المساحة لك حتى نهاية المدة.', planLine: (g) => `خطة ${g} غيغابايت`, until: (d) => `حتى ${d}`, usedOf: (u, g) => `${u} من ${g} غ.ب مستخدمة`, daysLeft: (n) => `${n} يومًا متبقية`, nextSize: (g, d) => `تصبح ${g} غيغابايت ابتداءً من ${d}`, pw_expiring: (n) => `تنتهي خطتك بعد ${n} أيام. جدّدها حتى يستمر حفظ الملفات الجديدة.`, pw_grace: (n, g) => `انتهت خطتك. يستمر الحفظ في «تخزين نواة» ${g} أيام أخرى، ثم يتوقف حتى تجدّد. ملفاتك لا تُحذف.`, pw_paused: 'توقّف حفظ الملفات الجديدة في «تخزين نواة» لأن الخطة انتهت. ملفاتك المحفوظة باقية ومنشوراتك تُنشر كالمعتاد. جدّد لتعود.', pw_full: 'امتلأت مساحة خطتك. رقِّها لمتابعة الحفظ في «تخزين نواة».', pw_almost: 'مساحة خطتك قاربت على الامتلاء. رقِّها حتى لا يتوقف الحفظ.', planPending: 'لديك طلب قيد التحقق. نفعّله بعد تأكيد الدفع وتصلك رسالة.', choosePlan: 'اختر مساحتك', upgrade: 'ترقية المساحة', renew: 'تجديد', pt_new: 'اختر مساحتك', pt_renew: 'تجديد الخطة', pt_upgrade: 'ترقية المساحة', howMuch: 'كم تحتاج من المساحة؟', gbWord: 'غيغابايت', usedNow: 'ما تخزّنه الآن', duration: 'المدة', upgradeOnly: 'ترقية فقط', mo_1: 'شهر', mo_3: '3 أشهر', mo_6: '6 أشهر', mo_12: 'سنة', planFits: (p, v) => `≈ ${p} صورة · أو ≈ ${v} فيديو قصير (30 ثانية)`, perMonthTotal: (x) => `${x} في الشهر`, total: 'المجموع', upgradePart: (g, d, x) => `+${g} غ.ب للأيام المتبقية (${d} يومًا): ${x}`, periodPart: (g, m, x) => `${g} غ.ب × ${m}: ${x}`, saved: (x) => `وفّرت ${x}`, planShort: (g, m) => `${g} غ.ب${m ? ` × ${m === 1 ? 'شهر' : m === 12 ? 'سنة' : `${m} أشهر`}` : ' · ترقية'}`, planPayments: 'مدفوعاتك', planSent: (x) => `أرسلنا طلبك (${x}). نفعّل الخطة بعد تأكيد الدفع، وتصلك رسالة.`, payWith: 'طريقة الدفع', m_baridimob: 'بريدي موب', m_ccp: 'CCP', m_redotpay: 'RedotPay', m_cash: 'نقدًا', m_other: 'أخرى', receipt: 'صورة الوصل', proofNote: 'صورة واضحة للوصل تظهر فيها العملية والمبلغ.', sendForCheck: 'أرسل للتحقق', noMethods: 'طرق الدفع غير متاحة الآن. تواصل مع نواة.', p_pending: 'قيد التحقق', p_approved: 'مفعّلة', p_rejected: 'مرفوضة', reasonLabel: 'السبب', pastInvoices: 'فواتير سابقة', e_bad_method: 'اختر طريقة الدفع.', e_proof_required: 'أرفق صورة الوصل.', e_bad_receipt: 'تعذّرت قراءة الصورة. جرّب صورة أخرى.', e_too_many_pending: 'لديك طلبات قيد التحقق. انتظر حتى نراجعها.', e_bad_gb: 'اختر مساحة ضمن المتاح.', e_below_usage: 'لا يمكن اختيار مساحة أقل مما تخزّنه الآن.', e_bad_months: 'اختر المدة.', e_plan_full: 'امتلأت مساحة خطتك. رقِّها من «التخزين».', e_plan_ended: 'خطة «تخزين نواة» غير نشطة. جدّدها من «التخزين».',
    storedNow: (a) => `مخزّن الآن: ${a}`,
    cloudSoon: 'قريبًا: تواصل مع نواة لتفعيله.', cloudNotEmpty: 'لا يمكن الإيقاف وفيه ملفات. احذفها أولًا.',
    invMonth: 'الشهر', invGb: 'متوسط التخزين', invAmount: 'المبلغ', invStatus: 'الحالة', paid: 'مدفوعة', unpaid: 'غير مدفوعة', void: 'ملغاة',
    baridimob: 'بريدي موب (RIP)', ccp: 'الحساب البريدي الجاري (CCP)', ccpName: 'الاسم', ccpAccount: 'رقم الحساب', ccpKey: 'المفتاح', redotpay: 'RedotPay', uid: 'UID', email2: 'البريد',
    copy: 'نسخ', copied: 'نُسخ', prefTitle: 'أين تُحفظ الملفات الجديدة؟', prefAuto: 'تلقائي', prefAutoNote: 'Google Drive أولًا مجانًا، ثم «تخزين نواة» عند امتلائه.', prefCloud: '«تخزين نواة» دائمًا', prefCloudNote: 'كل الملفات الجديدة تُحفظ في تخزين نواة.', recommended: 'موصى به', whyTitle: 'لماذا نوصي به؟', why: ['نشر لا يتعطّل: منشوراتك المجدولة لا تتأثر بفصل Google Drive أو حذف ملف منه أو انتهاء صلاحية حساب Google.', 'مساحة Google تبقى لك: الـ15 غيغابايت المجانية مشتركة مع Gmail وصور Google.', 'كل ملفاتك في مكان واحد، وتدفع فقط مقابل ما تخزّنه.'], prefSavedAuto: 'تُحفظ الملفات الجديدة في Google Drive أولًا.', prefSavedCloud: 'تُحفظ الملفات الجديدة في «تخزين نواة».', driveAlmostCloud: (p) => `مساحة Google Drive شارفت على الامتلاء. ستُحفظ الملفات الجديدة في «تخزين نواة» بسعر ${p} دج لكل غيغابايت شهريًا.`, driveAlmostOff: 'مساحة Google Drive شارفت على الامتلاء. اختر خطة «تخزين نواة» لتواصل الرفع بعد امتلائها.', moveTitle: 'نقل ملفاتك إلى «تخزين نواة»', moveLead: (n) => `${n} ملف في Google Drive. ننسخها إلى تخزين نواة ثم ننقلها إلى سلة Drive (تبقى قابلة للاسترجاع 30 يومًا).`, moveBtn: 'انقل ملفاتي', moveConfirm: 'تأكيد النقل', moving: (a, b) => `نُقل ${a}، وبقي ${b}…`, moveDone: (n) => `نُقل ${n} ملف إلى «تخزين نواة».`, moveSome: (a, b) => `نُقل ${a} ملف، وتعذّر نقل ${b}. حاول مرة أخرى لاحقًا.`, e_cloud_off: 'فعّل «تخزين نواة» أولًا.', mark: (n) => `علّم الخطوة ${n} كمنجزة`, unmark: (n) => `ألغِ إنجاز الخطوة ${n}`, stepsCount: (a, b) => `${a} من ${b} خطوات منجزة`, afterFb: 'يُفعَّل إنستغرام عبر صفحتك على فيسبوك، فابدأ بفيسبوك أولًا.', afterFbShort: 'بعد فيسبوك', goFb: 'اذهب إلى فيسبوك', tellLead: 'أنهيت الخطوات؟ أخبرنا لنتحقق ونفعّل المنصة.', tellNawa: 'أنهيت، أخبر نواة', reviewing: 'وصلنا إشعارك ✓ نتحقق الآن ونفعّل المنصة قريبًا.', activeLine: (n) => `${n} مفعّل`, stepsAgain: 'عرض الخطوات من جديد', allSetTitle: 'كل منصاتك جاهزة 🎉', goContent: 'اذهب إلى «المحتوى»', shotOpen: 'تكبير الصورة', shotNote: 'صورة توضيحية، وقد تختلف الواجهة قليلًا.', close: 'إغلاق', d_connected: 'رُبط Google Drive.', d_denied: 'لم تكتمل الموافقة على Google Drive.', d_failed: 'تعذّر ربط Google Drive. حاول مرة أخرى.',
  },
  en: {
    tabStorage: 'Storage', stTitle: 'Where your photos and videos are kept', stLead: 'We keep your files in your own Google Drive for free, up to 15 GB. Once it’s full, new files go to “Nawa storage” if you turn it on; older files stay where they are.',
    driveTitle: 'Google Drive', free: 'Free', notConnected: 'Not connected', connectedAs: (e) => `Connected as ${e}`,
    driveUse: (a, b) => `Nawa files: ${a} of ${b}`, accountLeft: (a) => `Free space left in your Google account: ${a}`,
    driveCapNote: 'Google’s free space is 15 GB, shared with Gmail and Google Photos. We never use more than 15 GB, even if you pay Google for more.',
    fits: (p, v) => `Enough for about ${p} photos or ${v} short videos (estimate: photo ≈ 1 MB, 30-second reel ≈ 50 MB).`,
    driveFull: 'Your free Google Drive space is full. Choose a Nawa Storage plan to keep uploading.',
    stepsDrive: ['Press “Connect Google Drive”.', 'Choose your Google account and approve.', 'We create a “Nawa” folder in your Drive. We only see the files you upload here, never the rest of your Drive.'],
    driveCatch: 'Important: files you add to the “Nawa” folder directly in Google Drive won’t show up here. Always upload from this space.',
    connectDrive: 'Connect Google Drive', disconnect: 'Disconnect Google Drive', confirmDisconnect: 'Confirm (your files stay in Drive)',
    cloudTitle: 'Nawa storage', perGb: (n) => `${n} DZD per GB per month`,
    planSub: 'Monthly space plan', ps_none: 'No plan', ps_active: 'Active', ps_expiring: 'Ending soon', ps_grace: 'Ended', ps_paused: 'Paused', planExplain: 'Choose the space you need and for how long, and pay once. The space is yours until the end of the period.', planLine: (g) => `${g} GB plan`, until: (d) => `until ${d}`, usedOf: (u, g) => `${u} of ${g} GB used`, daysLeft: (n) => `${n} days left`, nextSize: (g, d) => `becomes ${g} GB from ${d}`, pw_expiring: (n) => `Your plan ends in ${n} days. Renew it so new files keep saving.`, pw_grace: (n, g) => `Your plan has ended. Saving to Nawa Storage continues for ${g} more days, then pauses until you renew. Your files are never deleted.`, pw_paused: 'New files are no longer saved to Nawa Storage because the plan ended. Your stored files stay and your posts publish as usual. Renew to resume.', pw_full: 'Your plan is full. Upgrade it to keep saving to Nawa Storage.', pw_almost: 'Your plan is almost full. Upgrade it so saving doesn’t stop.', planPending: 'You have a request being checked. We turn it on once the payment is confirmed and email you.', choosePlan: 'Choose your space', upgrade: 'Upgrade space', renew: 'Renew', pt_new: 'Choose your space', pt_renew: 'Renew your plan', pt_upgrade: 'Upgrade your space', howMuch: 'How much space do you need?', gbWord: 'GB', usedNow: 'What you store now', duration: 'Duration', upgradeOnly: 'Upgrade only', mo_1: '1 month', mo_3: '3 months', mo_6: '6 months', mo_12: '1 year', planFits: (p, v) => `≈ ${p} photos · or ≈ ${v} short videos (30 s)`, perMonthTotal: (x) => `${x} per month`, total: 'Total', upgradePart: (g, d, x) => `+${g} GB for the days left (${d}): ${x}`, periodPart: (g, m, x) => `${g} GB × ${m}: ${x}`, saved: (x) => `you save ${x}`, planShort: (g, m) => `${g} GB${m ? ` × ${m === 1 ? '1 month' : m === 12 ? '1 year' : `${m} months`}` : ' · upgrade'}`, planPayments: 'Your payments', planSent: (x) => `Your request (${x}) was sent. We turn the plan on once the payment is confirmed, and email you.`, payWith: 'Pay with', m_baridimob: 'BaridiMob', m_ccp: 'CCP', m_redotpay: 'RedotPay', m_cash: 'Cash', m_other: 'Other', receipt: 'Receipt photo', proofNote: 'A clear photo of the receipt showing the transfer and the amount.', sendForCheck: 'Send for checking', noMethods: 'Payment methods aren’t available right now. Contact Nawa.', p_pending: 'Being checked', p_approved: 'Active', p_rejected: 'Rejected', reasonLabel: 'Reason', pastInvoices: 'Past invoices', e_bad_method: 'Choose how you paid.', e_proof_required: 'Attach a photo of the receipt.', e_bad_receipt: 'That image couldn’t be read. Try another one.', e_too_many_pending: 'You have requests being checked. Please wait until we review them.', e_bad_gb: 'Choose a size within the range.', e_below_usage: 'You can’t choose less space than you already store.', e_bad_months: 'Choose a duration.', e_plan_full: 'Your plan is full. Upgrade it in “Storage”.', e_plan_ended: 'Your Nawa Storage plan isn’t active. Renew it in “Storage”.',
    storedNow: (a) => `Stored now: ${a}`,
    cloudSoon: 'Coming soon: contact Nawa to turn it on.', cloudNotEmpty: 'It can’t be turned off while files are stored. Delete them first.',
    invMonth: 'Month', invGb: 'Average stored', invAmount: 'Amount', invStatus: 'Status', paid: 'Paid', unpaid: 'Unpaid', void: 'Void',
    baridimob: 'BaridiMob (RIP)', ccp: 'Postal account (CCP)', ccpName: 'Name', ccpAccount: 'Account number', ccpKey: 'Key', redotpay: 'RedotPay', uid: 'UID', email2: 'Email',
    copy: 'Copy', copied: 'Copied', prefTitle: 'Where should new files go?', prefAuto: 'Automatic', prefAutoNote: 'Google Drive first, for free, then Nawa Storage once it’s full.', prefCloud: 'Always Nawa Storage', prefCloudNote: 'Every new file is saved in Nawa Storage.', recommended: 'Recommended', whyTitle: 'Why we recommend it', why: ['Publishing never breaks: scheduled posts aren’t affected if Google Drive is disconnected, a file is deleted there, or the Google sign-in expires.', 'Your Google space stays yours: the free 15 GB is shared with Gmail and Google Photos.', 'All your files in one place, and you only pay for what you store.'], prefSavedAuto: 'New files go to Google Drive first.', prefSavedCloud: 'New files go to Nawa Storage.', driveAlmostCloud: (p) => `Your Google Drive is almost full. New files will go to Nawa Storage at ${p} DZD per GB per month.`, driveAlmostOff: 'Your Google Drive is almost full. Choose a Nawa Storage plan to keep uploading once it’s full.', moveTitle: 'Move your files to Nawa Storage', moveLead: (n) => `${n} files are in Google Drive. We copy them to Nawa Storage, then move them to your Drive trash (recoverable for 30 days).`, moveBtn: 'Move my files', moveConfirm: 'Confirm move', moving: (a, b) => `${a} moved, ${b} left…`, moveDone: (n) => `${n} files moved to Nawa Storage.`, moveSome: (a, b) => `${a} files moved, ${b} couldn’t be moved. Please try again later.`, e_cloud_off: 'Turn on Nawa Storage first.', mark: (n) => `Mark step ${n} as done`, unmark: (n) => `Mark step ${n} as not done`, stepsCount: (a, b) => `${a} of ${b} steps done`, afterFb: 'Instagram is activated through your Facebook Page, so start with Facebook first.', afterFbShort: 'After Facebook', goFb: 'Go to Facebook', tellLead: 'Finished the steps? Let us know and we’ll check and turn it on.', tellNawa: 'I’m done, tell Nawa', reviewing: 'We got your note ✓ We’re checking and will turn it on soon.', activeLine: (n) => `${n} is active`, stepsAgain: 'Show the steps again', allSetTitle: 'All your platforms are ready 🎉', goContent: 'Go to “Content”', shotOpen: 'Enlarge picture', shotNote: 'Illustration: the real screen may look slightly different.', close: 'Close', d_connected: 'Google Drive connected.', d_denied: 'Google Drive approval wasn’t completed.', d_failed: 'Couldn’t connect Google Drive. Please try again.',
  },
  fr: {
    tabStorage: 'Stockage', stTitle: 'Où sont gardées vos photos et vidéos', stLead: 'Nous gardons vos fichiers dans votre propre Google Drive gratuitement, jusqu’à 15 Go. Une fois plein, les nouveaux fichiers vont dans « Stockage Nawa » si vous l’activez ; les anciens restent en place.',
    driveTitle: 'Google Drive', free: 'Gratuit', notConnected: 'Non connecté', connectedAs: (e) => `Connecté : ${e}`,
    driveUse: (a, b) => `Fichiers Nawa : ${a} sur ${b}`, accountLeft: (a) => `Espace libre sur votre compte Google : ${a}`,
    driveCapNote: 'L’espace gratuit de Google est de 15 Go, partagé avec Gmail et Google Photos. Nous n’utilisons jamais plus de 15 Go, même avec un abonnement Google payant.',
    fits: (p, v) => `Suffisant pour environ ${p} photos ou ${v} vidéos courtes (estimation : photo ≈ 1 Mo, reel de 30 s ≈ 50 Mo).`,
    driveFull: 'Votre espace Google Drive gratuit est plein. Choisissez un forfait Stockage Nawa pour continuer.',
    stepsDrive: ['Appuyez sur « Connecter Google Drive ».', 'Choisissez votre compte Google et acceptez.', 'Nous créons un dossier « Nawa » dans votre Drive. Nous ne voyons que les fichiers envoyés ici, jamais le reste de votre Drive.'],
    driveCatch: 'Important : les fichiers ajoutés directement au dossier « Nawa » dans Google Drive n’apparaissent pas ici. Envoyez toujours vos fichiers depuis cet espace.',
    connectDrive: 'Connecter Google Drive', disconnect: 'Déconnecter Google Drive', confirmDisconnect: 'Confirmer (vos fichiers restent dans Drive)',
    cloudTitle: 'Stockage Nawa', perGb: (n) => `${n} DA par Go et par mois`,
    planSub: 'Forfait d’espace mensuel', ps_none: 'Aucun forfait', ps_active: 'Actif', ps_expiring: 'Bientôt fini', ps_grace: 'Terminé', ps_paused: 'En pause', planExplain: 'Choisissez l’espace dont vous avez besoin et la durée, et payez une fois. L’espace est à vous jusqu’à la fin de la période.', planLine: (g) => `Forfait ${g} Go`, until: (d) => `jusqu’au ${d}`, usedOf: (u, g) => `${u} sur ${g} Go utilisés`, daysLeft: (n) => `${n} jours restants`, nextSize: (g, d) => `passe à ${g} Go à partir du ${d}`, pw_expiring: (n) => `Votre forfait se termine dans ${n} jours. Renouvelez-le pour continuer à enregistrer.`, pw_grace: (n, g) => `Votre forfait est terminé. L’enregistrement continue encore ${g} jours, puis se met en pause jusqu’au renouvellement. Vos fichiers ne sont jamais supprimés.`, pw_paused: 'Les nouveaux fichiers ne sont plus enregistrés dans le Stockage Nawa car le forfait est terminé. Vos fichiers restent et vos publications partent normalement. Renouvelez pour reprendre.', pw_full: 'Votre forfait est plein. Augmentez-le pour continuer.', pw_almost: 'Votre forfait est presque plein. Augmentez-le pour ne pas être bloqué.', planPending: 'Une demande est en vérification. Nous l’activons après confirmation du paiement et vous prévenons.', choosePlan: 'Choisir mon espace', upgrade: 'Augmenter l’espace', renew: 'Renouveler', pt_new: 'Choisir mon espace', pt_renew: 'Renouveler le forfait', pt_upgrade: 'Augmenter l’espace', howMuch: 'De combien d’espace avez-vous besoin ?', gbWord: 'Go', usedNow: 'Ce que vous stockez', duration: 'Durée', upgradeOnly: 'Augmentation seule', mo_1: '1 mois', mo_3: '3 mois', mo_6: '6 mois', mo_12: '1 an', planFits: (p, v) => `≈ ${p} photos · ou ≈ ${v} vidéos courtes (30 s)`, perMonthTotal: (x) => `${x} par mois`, total: 'Total', upgradePart: (g, d, x) => `+${g} Go pour les jours restants (${d}) : ${x}`, periodPart: (g, m, x) => `${g} Go × ${m} : ${x}`, saved: (x) => `vous économisez ${x}`, planShort: (g, m) => `${g} Go${m ? ` × ${m === 12 ? '1 an' : `${m} mois`}` : ' · augmentation'}`, planPayments: 'Vos paiements', planSent: (x) => `Votre demande (${x}) a été envoyée. Nous activons le forfait après confirmation et vous prévenons par e-mail.`, payWith: 'Payer avec', m_baridimob: 'BaridiMob', m_ccp: 'CCP', m_redotpay: 'RedotPay', m_cash: 'Espèces', m_other: 'Autre', receipt: 'Photo du reçu', proofNote: 'Une photo nette du reçu montrant le virement et le montant.', sendForCheck: 'Envoyer pour vérification', noMethods: 'Les moyens de paiement ne sont pas disponibles. Contactez Nawa.', p_pending: 'En vérification', p_approved: 'Activé', p_rejected: 'Refusé', reasonLabel: 'Motif', pastInvoices: 'Factures précédentes', e_bad_method: 'Choisissez le moyen de paiement.', e_proof_required: 'Joignez une photo du reçu.', e_bad_receipt: 'Image illisible. Essayez-en une autre.', e_too_many_pending: 'Des demandes sont en vérification. Attendez notre retour.', e_bad_gb: 'Choisissez une taille dans la plage proposée.', e_below_usage: 'Impossible de choisir moins que ce que vous stockez déjà.', e_bad_months: 'Choisissez une durée.', e_plan_full: 'Votre forfait est plein. Augmentez-le dans « Stockage ».', e_plan_ended: 'Votre forfait Stockage Nawa n’est pas actif. Renouvelez-le dans « Stockage ».',
    storedNow: (a) => `Stocké maintenant : ${a}`,
    cloudSoon: 'Bientôt : contactez Nawa pour l’activer.', cloudNotEmpty: 'Impossible de le désactiver tant que des fichiers y sont stockés.',
    invMonth: 'Mois', invGb: 'Stockage moyen', invAmount: 'Montant', invStatus: 'Statut', paid: 'Payée', unpaid: 'Non payée', void: 'Annulée',
    baridimob: 'BaridiMob (RIP)', ccp: 'Compte postal (CCP)', ccpName: 'Nom', ccpAccount: 'Numéro de compte', ccpKey: 'Clé', redotpay: 'RedotPay', uid: 'UID', email2: 'E-mail',
    copy: 'Copier', copied: 'Copié', prefTitle: 'Où enregistrer les nouveaux fichiers ?', prefAuto: 'Automatique', prefAutoNote: 'Google Drive d’abord, gratuitement, puis le Stockage Nawa quand il est plein.', prefCloud: 'Toujours le Stockage Nawa', prefCloudNote: 'Tous les nouveaux fichiers sont enregistrés dans le Stockage Nawa.', recommended: 'Recommandé', whyTitle: 'Pourquoi nous le recommandons', why: ['Une publication qui ne casse pas : vos publications planifiées ne sont pas touchées si Google Drive est déconnecté, si un fichier y est supprimé ou si la connexion Google expire.', 'Votre espace Google reste à vous : les 15 Go gratuits sont partagés avec Gmail et Google Photos.', 'Tous vos fichiers au même endroit, et vous ne payez que ce que vous stockez.'], prefSavedAuto: 'Les nouveaux fichiers vont d’abord dans Google Drive.', prefSavedCloud: 'Les nouveaux fichiers vont dans le Stockage Nawa.', driveAlmostCloud: (p) => `Votre Google Drive est presque plein. Les nouveaux fichiers iront dans le Stockage Nawa à ${p} DA par Go et par mois.`, driveAlmostOff: 'Votre Google Drive est presque plein. Choisissez un forfait Stockage Nawa pour continuer une fois plein.', moveTitle: 'Déplacer vos fichiers vers le Stockage Nawa', moveLead: (n) => `${n} fichiers sont dans Google Drive. Nous les copions dans le Stockage Nawa, puis les mettons dans la corbeille de Drive (récupérables 30 jours).`, moveBtn: 'Déplacer mes fichiers', moveConfirm: 'Confirmer le déplacement', moving: (a, b) => `${a} déplacés, ${b} restants…`, moveDone: (n) => `${n} fichiers déplacés vers le Stockage Nawa.`, moveSome: (a, b) => `${a} fichiers déplacés, ${b} n’ont pas pu l’être. Réessayez plus tard.`, e_cloud_off: 'Activez d’abord le Stockage Nawa.', mark: (n) => `Marquer l’étape ${n} comme faite`, unmark: (n) => `Marquer l’étape ${n} comme non faite`, stepsCount: (a, b) => `${a} étapes faites sur ${b}`, afterFb: 'Instagram s’active via votre Page Facebook : commencez par Facebook.', afterFbShort: 'Après Facebook', goFb: 'Aller à Facebook', tellLead: 'Étapes terminées ? Prévenez-nous, nous vérifions et activons la plateforme.', tellNawa: 'C’est fait, prévenir Nawa', reviewing: 'Bien reçu ✓ Nous vérifions et activons la plateforme bientôt.', activeLine: (n) => `${n} est activé`, stepsAgain: 'Revoir les étapes', allSetTitle: 'Toutes vos plateformes sont prêtes 🎉', goContent: 'Aller à « Contenu »', shotOpen: 'Agrandir l’image', shotNote: 'Illustration : l’écran réel peut légèrement différer.', close: 'Fermer', d_connected: 'Google Drive connecté.', d_denied: 'L’autorisation Google Drive n’a pas abouti.', d_failed: 'Connexion à Google Drive impossible. Réessayez.',
  },
};
for (const l of Object.keys(TS)) Object.assign(T[l], TS[l]);

let lang = 'ar';
try { const q = new URLSearchParams(location.search).get('lang'); lang = LANGS.includes(q) ? q : (localStorage.getItem('nawa.lang') || 'ar'); } catch {}
if (!LANGS.includes(lang)) lang = 'ar';
const t = (k, ...a) => { const v = T[lang][k] ?? T.ar[k]; return typeof v === 'function' ? v(...a) : v; };

const state = { me: null, tab: 'platforms', email: '', plan: { method: '' }, planOpen: null };

function applyLang() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.title = t('title');
  document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
  document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  $('ptPrivacy').href = `/privacy#${lang}`;
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

// One platform at a time: tiles on top, the chosen platform's steps below. Clients tick steps off
// (remembered on this device); LinkedIn/TikTok end with "tell Nawa", which sets «قيد المراجعة».
// Instagram goes through the Facebook Page, so it waits for Facebook.
const ticksKey = () => `nawa.steps.${state.me?.user?.email || ''}`;
const getTicks = () => { try { return JSON.parse(localStorage.getItem(ticksKey()) || '{}'); } catch { return {}; } };
const setTick = (k, i, on) => { const all = getTicks(); (all[k] ||= [])[i] = on; try { localStorage.setItem(ticksKey(), JSON.stringify(all)); } catch {} };
const blockedBy = (k, st) => (k === 'instagram' && st.facebook?.status !== 'active' ? 'facebook' : null);
const nextPlatform = (st) => PLATFORM_ORDER.find((k) => st[k]?.status !== 'active' && !blockedBy(k, st)) || null;

function stepList(k, p, interactive) {
  const ticks = getTicks()[k] || [];
  return `<ol class="pt-steps">${L(p.steps, lang).map((x, i) => {
    const shot = p.shots?.[i];
    const alt = `${L(p.name, lang)} · ${i + 1}`;
    const on = Boolean(ticks[i]);
    const num = interactive
      ? `<button type="button" class="pt-num${on ? ' on' : ''}" data-tick="${i}" aria-pressed="${on}" aria-label="${esc(t(on ? 'unmark' : 'mark', i + 1))}" title="${esc(t(on ? 'unmark' : 'mark', i + 1))}"><span>${i + 1}</span></button>`
      : `<span class="pt-num"><span>${i + 1}</span></span>`;
    return `<li class="${on && interactive ? 'ticked' : ''}">${num}<div class="pt-stepbody">${x}${shot ? `<button type="button" class="pt-shot" data-shot="/assets/guides/${shot}.webp" data-alt="${esc(alt)}" aria-label="${esc(t('shotOpen'))}: ${esc(alt)}"><img src="/assets/guides/${shot}.webp" alt="${esc(alt)}" width="720" height="450" loading="lazy" decoding="async"></button>` : ''}</div></li>`;
  }).join('')}</ol>${p.shots?.some(Boolean) ? `<p class="pt-shotnote">${esc(t('shotNote'))}</p>` : ''}`;
}

function drawPlatforms() {
  const st = state.me.status;
  const active = PLATFORM_ORDER.filter((k) => st[k]?.status === 'active').length;
  const allActive = active === PLATFORM_ORDER.length;
  const pct = Math.round((active / PLATFORM_ORDER.length) * 100);
  if (!PLATFORM_ORDER.includes(state.pf)) state.pf = nextPlatform(st);
  const k = state.pf, p = k && PLATFORMS[k], s = k ? st[k] || { status: 'not_started' } : null;

  let panel;
  if (!k) {
    panel = `<div class="ct-card pt-panel pt-allset"><b>${esc(t('allSetTitle'))}</b><p class="muted">${esc(t('allActive'))}</p><button type="button" class="btn btn-lime" data-go="content">${esc(t('goContent'))}</button></div>`;
  } else if (s.status === 'active') {
    panel = `<div class="ct-card pt-panel">
      ${panelHead(k, p, s)}
      <p class="pt-doneline">✓ ${esc(t('activeLine', L(p.name, lang)))}${s.name ? ` · <a href="${esc(s.url)}" target="_blank" rel="noopener" dir="ltr">${esc(s.name)} ↗</a>` : ''}</p>
      <details><summary>${esc(t('stepsAgain'))}</summary>${stepList(k, p, false)}</details>
    </div>`;
  } else {
    const blocker = blockedBy(k, st);
    const n = L(p.steps, lang).length, ticked = (getTicks()[k] || []).filter(Boolean).length;
    const manualDone = !p.auto && ['in_review'].includes(s.status);
    panel = `<div class="ct-card pt-panel">
      ${panelHead(k, p, s)}
      ${blocker ? `<div class="pt-wait"><span>${esc(t('afterFb'))}</span><button type="button" class="btn btn-ghost-dark" data-pf="${blocker}">${esc(t('goFb'))}</button></div>` : ''}
      <div class="${blocker ? 'pt-faded' : ''}">
        <div class="pt-stepcount"><b>${esc(t('stepsTitle'))}</b><span class="muted">${esc(t('stepsCount', ticked, n))}</span></div>
        ${stepList(k, p, !blocker)}
      </div>
      ${p.auto ? `<p class="muted pt-foot">${esc(t('autoNote'))}</p>`
        : manualDone ? `<p class="pt-reviewing">${esc(t('reviewing'))}</p>`
        : `<div class="pt-tell${ticked >= n ? ' ready' : ''}"><p class="muted">${esc(t('tellLead'))}</p><button type="button" class="btn ${ticked >= n ? 'btn-lime' : 'btn-ghost-dark'}" id="ptTell"><span class="btn-label">${esc(t('tellNawa'))}</span></button></div>`}
    </div>`;
  }

  $('ptPlatforms').innerHTML = `
    <div class="ct-card pt-progress">
      <div class="pt-progress-top"><b>${esc(t('progress', active, PLATFORM_ORDER.length))}</b><button type="button" class="link-btn" id="ptCheck">${esc(t('checkNow'))}</button></div>
      <div class="pt-bar" role="progressbar" aria-valuenow="${active}" aria-valuemin="0" aria-valuemax="${PLATFORM_ORDER.length}"><i style="inline-size:${pct}%"></i></div>
      <p class="muted">${esc(allActive ? t('allActive') : t('platformsLead'))}</p>
    </div>
    <div class="pt-tiles" role="tablist" aria-label="${esc(t('tabPlatforms'))}">${PLATFORM_ORDER.map((x) => {
      const xs = st[x] || { status: 'not_started' }; const tone = STATUS[xs.status]?.tone || 'idle';
      const waiting = blockedBy(x, st) && xs.status !== 'active';
      return `<button type="button" role="tab" class="pt-tile${x === k ? ' on' : ''}${waiting ? ' waiting' : ''}" data-pf="${x}" aria-selected="${x === k}">
        <i class="pt-logo" style="--c:${PLATFORMS[x].color}">${icon(x, 20)}</i>
        <b>${esc(L(PLATFORMS[x].name, lang))}</b>
        <span class="pt-dot tone-${tone}">${esc(waiting ? t('afterFbShort') : L(STATUS[xs.status]?.label, lang))}</span>
      </button>`;
    }).join('')}</div>
    ${panel}`;

  labelCopies($('ptPlatforms'));
  $('ptPlatforms').querySelectorAll('[data-pf]').forEach((b) => b.addEventListener('click', () => { state.pf = b.dataset.pf; drawPlatforms(); }));
  $('ptPlatforms').querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => document.querySelector(`[data-tab="${b.dataset.go}"]`)?.click()));
  $('ptPlatforms').querySelectorAll('[data-tick]').forEach((b) => b.addEventListener('click', () => {
    setTick(k, Number(b.dataset.tick), b.getAttribute('aria-pressed') !== 'true'); drawPlatforms();
    $('ptPlatforms').querySelector(`[data-tick="${b.dataset.tick}"]`)?.focus();
  }));
  const tell = $('ptTell');
  if (tell) tell.onclick = async () => {
    tell.disabled = true;
    try { state.me.status = (await call('platform-done', { platform: k })).status; drawPlatforms(); }
    catch { tell.disabled = false; }
  };
  $('ptCheck').onclick = async (e) => {
    e.target.disabled = true;
    try { state.me = await call('me&fresh=1'); drawPlatforms(); } catch {}
  };
}

function panelHead(k, p, s) {
  const tone = STATUS[s.status]?.tone || 'idle';
  return `<div class="pt-card-head">
      <i class="pt-logo" style="--c:${p.color}">${icon(k, 22)}</i>
      <div><b>${esc(L(p.name, lang))}</b>${s.name && s.status !== 'active' ? `<a class="muted" href="${esc(s.url)}" target="_blank" rel="noopener" dir="ltr">${esc(s.name)} ↗</a>` : ''}</div>
      <span class="cl-st tone-${tone}">${esc(L(STATUS[s.status]?.label, lang))}</span>
    </div>
    ${s.note ? `<p class="pt-note"><b>${esc(t('nawaNote'))}:</b> ${esc(s.note)}</p>` : ''}`;
}

// Copy icons (Nawa's business ID, payment details): one handler for the whole page.
function labelCopies(root) { root.querySelectorAll('[data-clip]').forEach((b) => { b.setAttribute('aria-label', t('copy')); b.title = t('copy'); }); }
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-clip]'); if (!b) return;
  try {
    await navigator.clipboard.writeText(b.dataset.clip);
    b.classList.add('done'); b.title = t('copied'); b.setAttribute('aria-label', t('copied'));
    clearTimeout(b._t); b._t = setTimeout(() => { b.classList.remove('done'); b.title = t('copy'); b.setAttribute('aria-label', t('copy')); }, 1600);
  } catch {}
});

// Step pictures open larger in a dialog.
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-shot]'); if (!b) return;
  const d = $('ptShotView');
  d.querySelector('img').src = b.dataset.shot; d.querySelector('img').alt = b.dataset.alt;
  d.querySelector('button').setAttribute('aria-label', t('close'));
  d.showModal();
});
$('ptShotView').addEventListener('click', (e) => { if (e.target === e.currentTarget || e.target.closest('button')) e.currentTarget.close(); });

// ---------- storage ----------
const fmtGb = (bytes) => { const gb = bytes / 1e9; return `${gb < 10 ? gb.toFixed(gb < 1 ? 2 : 1) : Math.round(gb)} ${lang === 'en' ? 'GB' : lang === 'fr' ? 'Go' : 'غ.ب'}`; };
// 14,997: ar-DZ would write 14.997, which reads like a decimal
const num = (n) => Math.max(0, Math.floor(n)).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US');
const PHOTO = 1e6, REEL = 50e6;

async function loadStorage(msg) {
  const box = $('ptStorage');
  if (!state.storage) box.innerHTML = NawaUI.loading(t('loading'), 'list');
  try { state.storage = await call('storage'); } catch (e) { box.innerHTML = `<p class="empty">${esc(errMsg(e))}</p>`; return; }
  drawStorage(msg);
}

const whyList = () => `<div class="pt-why"><b>${esc(t('whyTitle'))}</b><ul>${t('why').map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`;

function drawStorage(msg = '') {
  const s = state.storage; if (!s) return;
  const d = s.drive, c = s.cloud, e = s.estimate;
  const q = d.quota;
  const accountRoom = q?.limit ? Math.max(0, Math.min(d.cap, q.limit) - q.usage) : null;
  const room = Math.max(0, Math.min(d.cap - d.bytes, accountRoom ?? Infinity));
  const full = d.connected && room < PHOTO;
  const pctDrive = Math.min(100, (d.bytes / d.cap) * 100);
  // "almost full" at 90% of what Drive can hold for us (the 15 GB cap, or less if the account has less room)
  const usable = Math.min(d.cap, q?.limit || d.cap), almost = d.connected && usable > 0 && (usable - room) / usable >= 0.9;
  const pl = s.plan;
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
          ${full ? `<p class="pt-warn">${esc(t('driveFull'))}</p>` : `<p class="pt-small">${esc(t('fits', num(room / PHOTO), num(room / REEL)))}</p>`}
          ${!full && almost ? `<p class="pt-warn">${esc(['active', 'expiring', 'grace'].includes(s.plan.state) ? t('driveAlmostCloud', num(e.price_dzd)) : t('driveAlmostOff'))}</p>` : ''}`
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
          <div><b>${esc(t('cloudTitle'))} <i class="pt-rec">${esc(t('recommended'))}</i></b><span class="muted">${esc(t('planSub'))}</span></div>
          <span class="cl-st tone-${{ none: 'idle', active: 'ok', expiring: 'wait', grace: 'wait', paused: 'bad' }[pl.state]}">${esc(t('ps_' + pl.state))}</span></div>
        <p class="pt-price"><b>${esc(t('perGb', num(pl.unit)))}</b></p>
        ${pl.state === 'none' ? `
          <p class="muted pt-small">${esc(t('planExplain'))}</p>
          ${whyList()}`
        : `
          <div class="pt-plan">
            <div class="pt-plan-top"><b>${esc(t('planLine', pl.gb))}</b><span>${esc(t('until', pl.until))}</span></div>
            <div class="pt-bar${pl.almost ? ' warn' : ''}"><i style="inline-size:${Math.min(100, (pl.usedGb / pl.gb) * 100).toFixed(1)}%"></i></div>
            <small>${esc(t('usedOf', fmtGb(c.bytes), pl.gb))}${['active', 'expiring'].includes(pl.state) ? ' · ' + esc(t('daysLeft', num(pl.daysLeft))) : ''}</small>
            ${pl.next ? `<small>${esc(t('nextSize', pl.next.gb, pl.next.from))}</small>` : ''}
          </div>
          ${pl.state !== 'active' ? `<p class="pt-warn">${esc(t('pw_' + pl.state, num(pl.daysLeft), num(pl.graceLeft || 0)))}</p>` : pl.full ? `<p class="pt-warn">${esc(t('pw_full'))}</p>` : pl.almost ? `<p class="pt-warn">${esc(t('pw_almost'))}</p>` : ''}`}
        ${pl.pending ? `<p class="pt-note">${esc(t('planPending'))}</p>` : ''}
        <div class="pt-st-btns">${!c.available && pl.state === 'none' ? `<p class="muted pt-small">${esc(t('cloudSoon'))}</p>`
          : pl.state === 'none' ? `<button type="button" class="btn btn-lime" data-plan="new">${esc(t('choosePlan'))}</button>`
          : `${['active', 'expiring'].includes(pl.state) && pl.gb < pl.options.max_gb ? `<button type="button" class="btn btn-lime" data-plan="upgrade">${esc(t('upgrade'))}</button>` : ''}<button type="button" class="btn ${['active'].includes(pl.state) ? 'btn-ghost-dark' : 'btn-lime'}" data-plan="renew">${esc(t('renew'))}</button>`}</div>
        ${pl.state !== 'none' ? `
          <fieldset class="pt-pref"><legend>${esc(t('prefTitle'))}</legend>
            ${['cloud', 'auto'].map((v) => `<label class="pt-prefopt${c.pref === v ? ' on' : ''}"><input type="radio" name="ptPref" value="${v}"${c.pref === v ? ' checked' : ''}><span><b>${esc(t(v === 'auto' ? 'prefAuto' : 'prefCloud'))}${v === 'cloud' ? ` <i class="pt-rec">${esc(t('recommended'))}</i>` : ''}</b><small>${esc(t(v === 'auto' ? 'prefAutoNote' : 'prefCloudNote'))}</small>${v === 'cloud' ? whyList() : ''}</span></label>`).join('')}
          </fieldset>
          ${d.connected && s.driveFiles ? `<div class="pt-move"><b>${esc(t('moveTitle'))}</b><p class="muted pt-small">${esc(t('moveLead', num(s.driveFiles)))}</p><button type="button" class="btn btn-ghost-dark" id="ptMove">${esc(t('moveBtn'))}</button><p class="pt-small" id="ptMoveMsg" aria-live="polite"></p></div>` : ''}` : ''}
      </article>
    </div>

    <dialog class="pt-sheet pt-planbox" id="ptPlan" aria-labelledby="ptPlanTitle">
      <div class="pt-sheet-head"><h3 id="ptPlanTitle"></h3><button type="button" class="pt-sheet-x" id="ptPlanClose" aria-label="${esc(t('close'))}">✕</button></div>
      <form id="ptPlanForm" novalidate>
        <label class="pt-gb-label" for="ptGb">${esc(t('howMuch'))}</label>
        <div class="pt-gb-big"><b id="ptGbVal" dir="ltr"></b> <span>${esc(t('gbWord'))}</span></div>
        <div class="pt-range-wrap">
          <input type="range" id="ptGb" min="${pl.options.min_gb}" max="${pl.options.max_gb}" step="${pl.options.step_gb}" dir="ltr">
          <i class="pt-used-mark" id="ptUsedMark" title="${esc(t('usedNow'))}"></i>
        </div>
        <div class="pt-range-ends" dir="ltr"><span id="ptGbMin"></span><span>${pl.options.max_gb} GB</span></div>
        <p class="pt-fits" id="ptFits"></p>
        <p class="pt-month" id="ptMonth"></p>
        <fieldset class="pt-durations" id="ptDurations"><legend>${esc(t('duration'))}</legend></fieldset>
        <div class="pt-total" id="ptTotal" aria-live="polite"></div>
        ${pl.methods.length ? `
        <fieldset class="pt-methods"><legend>${esc(t('payWith'))}</legend>
          ${pl.methods.map((m) => `<label class="pt-chip"><input type="radio" name="method" value="${m}"${state.plan.method === m ? ' checked' : ''}><span>${esc(t('m_' + m))}</span></label>`).join('')}
        </fieldset>
        <div id="ptPayDetails"></div>
        <label class="ct-field"><span>${esc(t('receipt'))}</span><input id="ptReceipt" type="file" accept="image/*"></label>
        <img class="pt-receipt-prev" id="ptReceiptPrev" alt="" hidden>
        <p class="muted pt-small">${esc(t('proofNote'))}</p>
        <div class="pt-st-btns"><button type="submit" class="btn btn-dark" id="ptPlanSend"><span class="btn-label">${esc(t('sendForCheck'))}</span></button></div>
        <p class="login-msg" id="ptPlanMsg" role="alert"></p>` : `<p class="muted">${esc(t('noMethods'))}</p>`}
      </form>
    </dialog>

    ${pl.payments.length ? `
    <section class="ct-card pt-inv">
      <h3>${esc(t('planPayments'))}</h3>
      <ul class="pt-paylist">${pl.payments.map((p) => `<li>
          <b>${esc(dzd(p.amount_dzd))}</b>
          <span class="muted">${p.gb ? `${esc(t('planShort', p.gb, p.months))} · ` : ''}${esc(t('m_' + p.method))} · <span dir="ltr">${esc(String(p.created_at).slice(0, 10))}</span></span>
          <span class="cl-st tone-${p.status === 'approved' ? 'ok' : p.status === 'rejected' ? 'bad' : 'wait'}">${esc(t('p_' + p.status))}</span>
          ${p.status === 'rejected' && p.reason ? `<small class="pt-reason">${esc(t('reasonLabel'))}: ${esc(p.reason)}</small>` : ''}
        </li>`).join('')}</ul>
    </section>` : ''}

    ${s.invoices.length ? `
    <section class="ct-card pt-inv">
      <h3>${esc(t('pastInvoices'))}</h3>
      <div class="pt-table"><table><thead><tr><th>${esc(t('invMonth'))}</th><th>${esc(t('invGb'))}</th><th>${esc(t('invAmount'))}</th><th>${esc(t('invStatus'))}</th></tr></thead><tbody>
        ${s.invoices.map((i) => `<tr><td dir="ltr">${esc(i.month)}</td><td>${esc(fmtGb(Number(i.avg_gb) * 1e9))}</td><td><b>${esc(dzd(i.amount_dzd))}</b></td><td><span class="cl-st tone-${i.status === 'paid' ? 'ok' : i.status === 'void' ? 'idle' : 'wait'}">${esc(t(i.status))}</span></td></tr>`).join('')}
      </tbody></table></div>
    </section>` : ''}`;

  labelCopies($('ptStorage'));
  const arm = (b, label, fn) => b && b.addEventListener('click', async () => {
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = label; b.classList.add('armed'); return; }
    b.disabled = true;
    try { await fn(); await loadStorage(); } catch (err) { drawStorage(err.code === 'cloud_not_empty' ? t('cloudNotEmpty') : errMsg(err)); }
  });
  arm($('ptDriveOff'), t('confirmDisconnect'), () => call('drive-disconnect', {}));
  $('ptStorage').querySelectorAll('input[name="ptPref"]').forEach((r) => r.addEventListener('change', async () => {
    try { await call('storage-pref', { pref: r.value }); state.storage.cloud.pref = r.value; drawStorage(t(r.value === 'cloud' ? 'prefSavedCloud' : 'prefSavedAuto')); }
    catch (err) { drawStorage(errMsg(err)); }
  }));
  const mv = $('ptMove');
  if (mv) mv.addEventListener('click', async () => {
    if (!mv.dataset.armed) { mv.dataset.armed = '1'; mv.textContent = t('moveConfirm'); mv.classList.add('armed'); return; }
    mv.disabled = true; let moved = 0, failed = 0;
    try {
      for (;;) { // the server moves a batch per call
        const r = await call('move-to-cloud', {});
        moved += r.moved; failed = r.failed;
        $('ptMoveMsg').textContent = t('moving', num(moved), num(r.remaining));
        if (!r.remaining || !r.moved) break;
      }
      await loadStorage(failed ? t('moveSome', num(moved), num(failed)) : t('moveDone', num(moved)));
    } catch (err) { drawStorage(errMsg(err)); }
  });
  bindPlan(s);
}

// ---------- the plan window («تخزين نواة»: GB × months) ----------
const dzd = (n) => `${Math.round(Number(n || 0)).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} ${lang === 'ar' ? 'دج' : lang === 'fr' ? 'DA' : 'DZD'}`;
const payRow = (label, value) => `<div class="pt-payrow"><span>${esc(label)}</span><b dir="ltr">${esc(value)}</b>${copyButton(esc(value))}</div>`;
function payDetails(method, pay) {
  if (method === 'baridimob') return payRow('RIP', pay.baridimob_rip);
  if (method === 'ccp') return payRow(t('ccpName'), pay.ccp_name) + payRow(t('ccpAccount'), pay.ccp_account) + payRow(t('ccpKey'), pay.ccp_key);
  if (method === 'redotpay') return (pay.redotpay_uid ? payRow(t('uid'), pay.redotpay_uid) : '') + (pay.redotpay_email ? payRow(t('email2'), pay.redotpay_email) : '');
  return '';
}
// receipts are shrunk in the browser (≤ 1600 px JPEG) so they stay small
async function shrinkImage(file) {
  const bmp = await createImageBitmap(file);
  for (const [max, q] of [[1600, 0.8], [1200, 0.7], [900, 0.6]]) {
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    const url = cv.toDataURL('image/jpeg', q);
    if (url.length < 1.3e6) return url;
  }
  throw Object.assign(new Error('bad_receipt'), { code: 'bad_receipt' });
}

/**
 * The same price rules as the server (_lib/plans.js quote), so the window updates instantly while
 * the slider moves; the server recomputes the price when the request is sent.
 */
function priceOf(pl, gb, months) {
  const active = ['active', 'expiring'].includes(pl.state);
  const dur = pl.options.durations.find((d) => d.months === months);
  const discount = dur?.discount || 0;
  const upgrade = active && gb > pl.gb ? Math.round((gb - pl.gb) * pl.unit * pl.daysLeft / 30) : 0;
  const period = months ? Math.round(gb * pl.unit * months * (1 - discount / 100)) : 0;
  return { upgrade, period, total: upgrade + period, discount };
}

function bindPlan(s) {
  const pl = s.plan, dlg = $('ptPlan'), f = $('ptPlanForm'), sp = state.plan; if (!dlg) return;
  const O = pl.options, usedGb = Math.ceil(s.cloud.bytes / 1e9 * 10) / 10;
  const minGb = Math.max(O.min_gb, Math.ceil(s.cloud.bytes / 1e9)); // never below what is stored
  const active = ['active', 'expiring'].includes(pl.state);
  const open = (mode) => {
    sp.mode = mode;
    sp.gb = Math.max(minGb, mode === 'upgrade' ? Math.min(O.max_gb, pl.gb + O.step_gb) : (pl.gb || Math.max(minGb, 10)));
    sp.months = mode === 'upgrade' ? 0 : (sp.months || 1);
    $('ptPlanTitle').textContent = t('pt_' + mode);
    $('ptGb').min = mode === 'upgrade' ? Math.min(O.max_gb, pl.gb + O.step_gb) : minGb;
    $('ptGb').value = sp.gb;
    drawDurations(); update(); state.planOpen = mode; dlg.showModal();
  };
  $('ptStorage').querySelectorAll('[data-plan]').forEach((b) => b.addEventListener('click', () => open(b.dataset.plan)));
  $('ptPlanClose').addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', () => { state.planOpen = null; });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  function drawDurations() {
    const durs = O.durations.filter((d) => d.on);
    const opts = [...(active && sp.gb > pl.gb ? [{ months: 0, discount: 0 }] : []), ...(sp.mode === 'upgrade' ? [] : durs)];
    if (sp.mode === 'upgrade') opts.push(...durs);
    if (!opts.some((o) => o.months === sp.months)) sp.months = opts[0]?.months ?? 1;
    $('ptDurations').innerHTML = `<legend>${esc(t('duration'))}</legend>` + opts.map((o) => `<label class="pt-chip"><input type="radio" name="months" value="${o.months}"${o.months === sp.months ? ' checked' : ''}><span>${esc(o.months === 0 ? t('upgradeOnly') : t('mo_' + o.months))}${o.discount ? ` <i class="pt-disc" dir="ltr">−${o.discount}%</i>` : ''}</span></label>`).join('');
    $('ptDurations').querySelectorAll('input').forEach((r) => r.addEventListener('change', () => { sp.months = Number(r.value); update(); }));
  }
  function update() {
    const gb = Number($('ptGb').value); const hadUp = active && sp.gb > pl.gb; sp.gb = gb;
    if (hadUp !== (active && gb > pl.gb)) drawDurations(); // "upgrade only" appears/disappears
    $('ptGbVal').textContent = gb;
    const photos = Math.floor(gb * 1000 / O.photo_mb), videos = Math.floor(gb * 1000 / O.video_mb);
    $('ptFits').textContent = t('planFits', num(photos), num(videos));
    $('ptMonth').textContent = t('perMonthTotal', dzd(gb * pl.unit));
    const pr = priceOf(pl, gb, sp.months);
    $('ptTotal').innerHTML = `<span>${esc(t('total'))}</span><b>${esc(dzd(pr.total))}</b>
      ${pr.upgrade ? `<small>${esc(t('upgradePart', gb - pl.gb, num(pl.daysLeft), dzd(pr.upgrade)))}</small>` : ''}
      ${sp.months ? `<small>${esc(t('periodPart', gb, t('mo_' + sp.months), dzd(pr.period)))}${pr.discount ? ` · ${esc(t('saved', dzd(gb * pl.unit * sp.months - pr.period)))}` : ''}</small>` : ''}`;
    // the used part of the slider is marked
    const r = $('ptGb'), lo = Number(r.min), hi = Number(r.max);
    $('ptUsedMark').hidden = !(s.cloud.bytes > 0) || sp.mode === 'upgrade';
    $('ptUsedMark').style.insetInlineStart = `${Math.max(0, Math.min(100, ((usedGb - lo) / ((hi - lo) || 1)) * 100))}%`;
    r.style.setProperty('--fill', `${((gb - lo) / ((hi - lo) || 1)) * 100}%`);
    $('ptGbMin').textContent = `${lo} GB`;
  }
  $('ptGb').addEventListener('input', update);
  const showDetails = () => { if (!$('ptPayDetails')) return; $('ptPayDetails').innerHTML = sp.method ? `<div class="pt-paybox">${payDetails(sp.method, s.payment || {})}</div>` : ''; labelCopies(dlg); };
  f.querySelectorAll('input[name="method"]').forEach((r) => r.addEventListener('change', () => { sp.method = r.value; showDetails(); }));
  if (!sp.method && pl.methods.length === 1) { sp.method = pl.methods[0]; f.querySelector('input[name="method"]').checked = true; }
  showDetails();
  $('ptReceipt')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0]; sp.receipt = '';
    if (!file) { $('ptReceiptPrev').hidden = true; return; }
    try { sp.receipt = await shrinkImage(file); $('ptReceiptPrev').src = sp.receipt; $('ptReceiptPrev').hidden = false; $('ptPlanMsg').textContent = ''; }
    catch { $('ptPlanMsg').textContent = t('e_bad_receipt'); }
  });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('ptPlanMsg');
    if (!sp.method) { msg.textContent = t('e_bad_method'); return; }
    if (!sp.receipt) { msg.textContent = t('e_proof_required'); return; }
    const btn = $('ptPlanSend'); btn.disabled = true; btn.setAttribute('aria-busy', 'true');
    try {
      const total = priceOf(pl, sp.gb, sp.months).total;
      await call('plan-request', { gb: sp.gb, months: sp.months, method: sp.method, receipt: sp.receipt });
      sp.receipt = ''; dlg.close();
      await loadStorage(t('planSent', dzd(total)));
    } catch (err) { msg.textContent = errMsg(err); btn.disabled = false; btn.removeAttribute('aria-busy'); }
  });
  if (state.planOpen && !dlg.open) open(state.planOpen); // kept open across a redraw
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
