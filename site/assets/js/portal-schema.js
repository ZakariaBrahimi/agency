// Client platforms: names, statuses and the activation steps a client follows, in Arabic (default),
// English and French. Shared by the client portal (/portal) and the admin's «العملاء» section.

/** Nawa's Meta Business Portfolio: clients add it as a partner on their Page. */
export const NAWA_BUSINESS_ID = '1151568320532118';

export const LANGS = ['ar', 'en', 'fr'];
/** Picks the text for a language from { ar, en, fr } (Arabic when missing). */
export const L = (v, lang = 'ar') => (v && typeof v === 'object' && !Array.isArray(v) ? v[lang] ?? v.ar : v);

export const PLATFORM_ORDER = ['facebook', 'instagram', 'linkedin', 'tiktok'];

export const STATUS = {
  not_started: { tone: 'idle', label: { ar: 'لم يبدأ', en: 'Not started', fr: 'Pas commencé' } },
  waiting_access: { tone: 'wait', label: { ar: 'بانتظار منح الوصول', en: 'Waiting for access', fr: 'En attente d’accès' } },
  waiting_client: { tone: 'wait', label: { ar: 'بانتظار خطوة منك', en: 'Waiting for you', fr: 'Action requise de votre part' } },
  in_review: { tone: 'review', label: { ar: 'قيد المراجعة', en: 'In review', fr: 'En vérification' } },
  active: { tone: 'ok', label: { ar: 'مفعّل', en: 'Active', fr: 'Activé' } },
  issue: { tone: 'bad', label: { ar: 'يحتاج تدخّلًا', en: 'Needs attention', fr: 'À corriger' } },
  unknown: { tone: 'idle', label: { ar: 'تعذّر التحقق الآن', en: 'Can’t check right now', fr: 'Vérification impossible' } },
};
/** The statuses Nawa can set by hand (LinkedIn, TikTok). */
export const MANUAL_STATUS = ['not_started', 'waiting_client', 'in_review', 'active', 'issue'];

/** Copy icon (swaps to a tick once copied); the page sets each button's label in its language. */
export const COPY_ICON = '<svg class="i-copy" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><svg class="i-done" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const copyButton = (value) => `<button type="button" class="copy-ico" data-clip="${value}" aria-label="Copy" title="Copy">${COPY_ICON}</button>`;

const ID = `<span class="pt-copyval"><code dir="ltr">${NAWA_BUSINESS_ID}</code>${copyButton(NAWA_BUSINESS_ID)}</span>`;
export const PLATFORMS = {
  facebook: {
    color: '#1877F2', auto: true,
    shots: ['facebook-1', 'facebook-2', 'facebook-3', null], // illustrations in /assets/guides/<name>.webp, one per step
    name: { ar: 'فيسبوك', en: 'Facebook', fr: 'Facebook' },
    steps: {
      ar: [
        'افتح <b>Meta Business Suite</b> ← الإعدادات ← <b>الشركاء</b> (Partners).',
        `اضغط «إضافة» ← «منح شريك حق الوصول إلى أصولك»، وأدخل معرّف نواة: ${ID}`,
        'اختر صفحتك وفعّل صلاحية <b>المحتوى</b> و<b>الرسائل</b> (أو التحكم الكامل).',
        'هذا كل شيء: تتحدّث الحالة هنا تلقائيًا عندما يصلنا الوصول.',
      ],
      en: [
        'Open <b>Meta Business Suite</b> → Settings → <b>Partners</b>.',
        `Click “Add” → “Give a partner access to your assets” and enter Nawa’s ID: ${ID}`,
        'Choose your Page and allow <b>Content</b> and <b>Messages</b> (or full control).',
        'That’s it: the status here updates on its own once we have access.',
      ],
      fr: [
        'Ouvrez <b>Meta Business Suite</b> → Paramètres → <b>Partenaires</b>.',
        `Cliquez sur « Ajouter » → « Donner à un partenaire l’accès à vos ressources » et saisissez l’ID de Nawa : ${ID}`,
        'Choisissez votre Page et autorisez <b>Contenu</b> et <b>Messages</b> (ou le contrôle total).',
        'C’est tout : le statut se met à jour ici dès que nous avons l’accès.',
      ],
    },
  },
  instagram: {
    color: '#E1306C', auto: true,
    shots: ['instagram-1', 'instagram-2', null], // illustrations in /assets/guides/<name>.webp, one per step
    name: { ar: 'إنستغرام', en: 'Instagram', fr: 'Instagram' },
    steps: {
      ar: [
        'في إنستغرام: الإعدادات ← نوع الحساب ← حوّله إلى <b>حساب احترافي</b> (أعمال أو صانع محتوى).',
        'اربطه بصفحتك على فيسبوك: إعدادات الصفحة ← <b>الحسابات المرتبطة</b> ← إنستغرام.',
        'يُفعَّل تلقائيًا هنا بعد تفعيل فيسبوك، لأن إنستغرام يمر عبر صفحتك.',
      ],
      en: [
        'In Instagram: Settings → Account type → switch to a <b>professional account</b> (Business or Creator).',
        'Link it to your Facebook Page: Page settings → <b>Linked accounts</b> → Instagram.',
        'It turns active here on its own once Facebook is active, since Instagram goes through your Page.',
      ],
      fr: [
        'Dans Instagram : Paramètres → Type de compte → passez à un <b>compte professionnel</b> (Entreprise ou Créateur).',
        'Liez-le à votre Page Facebook : Paramètres de la Page → <b>Comptes liés</b> → Instagram.',
        'Il s’active ici automatiquement dès que Facebook est activé, car Instagram passe par votre Page.',
      ],
    },
  },
  linkedin: {
    color: '#0A66C2', auto: false,
    shots: ['linkedin-1', 'linkedin-2', null], // illustrations in /assets/guides/<name>.webp, one per step
    name: { ar: 'لينكدإن', en: 'LinkedIn', fr: 'LinkedIn' },
    steps: {
      ar: [
        'افتح صفحة شركتك على لينكدإن كمسؤول ← <b>أدوات المسؤول</b> ← إدارة المسؤولين.',
        'أضف حساب نواة الذي نرسله لك بصلاحية <b>مسؤول المحتوى</b>.',
        'أخبرنا عند الانتهاء: نتحقق ونفعّل المنصة.',
      ],
      en: [
        'Open your LinkedIn company page as an admin → <b>Admin tools</b> → Manage admins.',
        'Add the Nawa account we send you as a <b>Content admin</b>.',
        'Let us know when it’s done: we check and turn the platform on.',
      ],
      fr: [
        'Ouvrez la page de votre entreprise sur LinkedIn en tant qu’admin → <b>Outils d’administration</b> → Gérer les admins.',
        'Ajoutez le compte Nawa que nous vous envoyons comme <b>admin de contenu</b>.',
        'Prévenez-nous une fois terminé : nous vérifions et activons la plateforme.',
      ],
    },
  },
  tiktok: {
    color: '#111111', auto: false,
    shots: ['tiktok-1', 'tiktok-2', null], // illustrations in /assets/guides/<name>.webp, one per step
    name: { ar: 'تيك توك', en: 'TikTok', fr: 'TikTok' },
    steps: {
      ar: [
        'في تيك توك: الإعدادات ← الحساب ← حوّله إلى <b>حساب أعمال</b>.',
        'نرسل لك طلب انضمام من <b>TikTok Business Center</b>: وافق عليه من الإشعارات.',
        'أخبرنا عند الموافقة: نتحقق ونفعّل المنصة.',
      ],
      en: [
        'In TikTok: Settings → Account → switch to a <b>Business account</b>.',
        'We send you a request from <b>TikTok Business Center</b>: accept it from your notifications.',
        'Let us know once accepted: we check and turn the platform on.',
      ],
      fr: [
        'Dans TikTok : Paramètres → Compte → passez à un <b>compte Business</b>.',
        'Nous vous envoyons une demande depuis <b>TikTok Business Center</b> : acceptez-la dans vos notifications.',
        'Prévenez-nous une fois acceptée : nous vérifions et activons la plateforme.',
      ],
    },
  },
};

/** Small logos (inline SVG paths in a 24-unit box). */
export const ICONS = {
  facebook: '<path fill="currentColor" d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3z"/>',
  instagram: '<rect x="4" y="4" width="16" height="16" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.6" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17" cy="7" r="1.2" fill="currentColor"/>',
  linkedin: '<path fill="currentColor" d="M5 9h3v10H5zM6.5 4.5a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5zM10 9h2.9v1.4h.1c.4-.8 1.4-1.6 2.9-1.6 3.1 0 3.6 2 3.6 4.6V19h-3v-4.9c0-1.2 0-2.7-1.6-2.7s-1.9 1.3-1.9 2.6v5H10z"/>',
  tiktok: '<path fill="currentColor" d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3v12.1a2.6 2.6 0 1 1-1.8-2.5V9.5a5.6 5.6 0 1 0 4.8 5.6V9.2a7.3 7.3 0 0 0 4.3 1.4V7.6c-1.2 0-2.4-.6-3.2-1.8z"/>',
};
export const icon = (k, size = 22) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${ICONS[k]}</svg>`;
