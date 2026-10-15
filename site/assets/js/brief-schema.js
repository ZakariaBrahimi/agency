// The project brief: every service, question and option, in Arabic, English and French.
// Shared by the form (browser), the API (validation + Telegram summary) and /admin.
// To add a question or option, edit this file only.

const L = (ar, en, fr) => ({ ar, en, fr });
const opt = (id, ar, en, fr) => ({ id, label: L(ar, en, fr) });

export const LANGS = ['ar', 'en', 'fr'];

// ---------- money ----------
// Budgets default to Algerian dinars; clients can switch to US dollars or euros.
// Each currency has its own round tiers (not a straight conversion), so the ranges read naturally.
export const CURRENCIES = ['DZD', 'USD', 'EUR'];
export const DEFAULT_CURRENCY = 'DZD';
export const CURRENCY_NAME = {
  DZD: L('دينار جزائري', 'Algerian dinar', 'Dinar algérien'),
  USD: L('دولار أمريكي', 'US dollar', 'Dollar américain'),
  EUR: L('يورو', 'Euro', 'Euro'),
};
const CURRENCY_UNIT = { DZD: L('دج', 'DZD', 'DA'), USD: L('دولار', 'USD', 'USD'), EUR: L('يورو', 'EUR', 'EUR') };
export const CURRENCY_SHORT = { DZD: L('دج', 'DZD', 'DA'), USD: L('$', '$', '$'), EUR: L('€', '€', '€') };
const TIERS = {
  project: { DZD: [150000, 700000, 2000000], USD: [1000, 5000, 15000], EUR: [1000, 5000, 15000] },
  ads: { DZD: [40000, 150000, 400000], USD: [300, 1000, 3000], EUR: [300, 1000, 3000] },
};
const num = (n, lang) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'fr' ? '\u202f' : ',');

/** Label of a budget tier (t1..t4) in a currency, e.g. "150,000 إلى 700,000 دج". */
export function moneyLabel(table, tier, currency, lang) {
  const cur = CURRENCIES.includes(currency) ? currency : DEFAULT_CURRENCY;
  const [a, b, c] = TIERS[table][cur].map((n) => num(n, lang));
  const unit = CURRENCY_UNIT[cur][lang] || CURRENCY_UNIT[cur].ar;
  const tpl = {
    t1: L(`أقل من ${a}`, `Under ${a}`, `Moins de ${a}`),
    t2: L(`${a} إلى ${b}`, `${a} to ${b}`, `${a} à ${b}`),
    t3: L(`${b} إلى ${c}`, `${b} to ${c}`, `${b} à ${c}`),
    t4: L(`أكثر من ${c}`, `Over ${c}`, `Plus de ${c}`),
  }[tier];
  return tpl ? `${tpl[lang] || tpl.ar} ${unit}` : '';
}
const money = (table, extra = []) => ['t1', 't2', 't3', 't4'].map((id) => ({ id, money: table })).concat(extra);

// Services follow the six-step journey ("results" covers studying results and improving).
export const SERVICES = [
  {
    id: 'product', step: 1,
    title: L('نطوّر لك المنتج', 'Build my product', 'Développer mon produit'),
    hint: L('منصة ويب، تطبيق، أو منتج SaaS', 'A web platform, app or SaaS product', 'Une plateforme web, une appli ou un SaaS'),
    questions: [
      { id: 'type', kind: 'single', required: true, label: L('ما نوع المنتج؟', 'What kind of product?', 'Quel type de produit ?'), options: [
        opt('web', 'منصة ويب', 'Web platform', 'Plateforme web'),
        opt('mobile', 'تطبيق جوال', 'Mobile app', 'Application mobile'),
        opt('saas', 'منتج SaaS', 'SaaS product', 'Produit SaaS'),
        opt('store', 'متجر إلكتروني', 'Online store', 'Boutique en ligne'),
        opt('internal', 'أداة داخلية لفريقك', 'Internal tool for your team', 'Outil interne'),
      ] },
      { id: 'stage', kind: 'single', required: true, label: L('أين وصلت؟', 'Where are you now?', 'Où en êtes-vous ?'), options: [
        opt('idea', 'مجرد فكرة', 'Just an idea', 'Juste une idée'),
        opt('designs', 'لدي تصاميم أو نموذج', 'I have designs or a prototype', 'J’ai des maquettes ou un prototype'),
        opt('live', 'المنتج موجود ويحتاج تطويرًا', 'The product exists and needs work', 'Le produit existe et doit évoluer'),
      ] },
      { id: 'features', kind: 'multi', label: L('ما الذي يحتاجه؟', 'What does it need?', 'De quoi a-t-il besoin ?'), options: [
        opt('accounts', 'حسابات المستخدمين', 'User accounts', 'Comptes utilisateurs'),
        opt('payments', 'الدفع الإلكتروني', 'Online payments', 'Paiement en ligne'),
        opt('dashboard', 'لوحة تحكم', 'Admin dashboard', 'Tableau de bord'),
        opt('booking', 'حجوزات ومواعيد', 'Bookings & appointments', 'Réservations et rendez-vous'),
        opt('notifications', 'إشعارات', 'Notifications', 'Notifications'),
        opt('multilang', 'عدة لغات', 'Several languages', 'Plusieurs langues'),
        opt('ai', 'ميزات ذكاء اصطناعي', 'AI features', 'Fonctions d’IA'),
        opt('integrations', 'ربط مع أنظمة أخرى', 'Integrations with other tools', 'Intégrations avec d’autres outils'),
      ] },
      { id: 'idea', kind: 'text', max: 600, label: L('صف فكرتك في سطرين', 'Describe your idea in two lines', 'Décrivez votre idée en deux lignes'),
        placeholder: L('مثال: منصة لحجز ملاعب كرة القدم في المدينة', 'e.g. A platform to book football pitches in the city', 'ex. Une plateforme pour réserver des terrains de foot en ville') },
    ],
  },
  {
    id: 'identity', step: 2,
    title: L('هوية بصرية وحضور', 'Visual identity & presence', 'Identité visuelle et présence'),
    hint: L('شعار، ألوان، حسابات، وصفحة هبوط', 'Logo, colors, accounts and a landing page', 'Logo, couleurs, comptes et page d’accueil'),
    questions: [
      { id: 'current', kind: 'single', required: true, label: L('هل لديك هوية حاليًا؟', 'Do you have a brand today?', 'Avez-vous déjà une identité ?'), options: [
        opt('none', 'لا، نبدأ من الصفر', 'No, starting from scratch', 'Non, on part de zéro'),
        opt('refresh', 'نعم، وأريد تجديدها', 'Yes, and I want a refresh', 'Oui, à rafraîchir'),
        opt('keep', 'نعم، وأريد البناء عليها', 'Yes, and I want to build on it', 'Oui, à développer'),
      ] },
      { id: 'items', kind: 'multi', required: true, label: L('ما الذي تحتاجه؟', 'What do you need?', 'De quoi avez-vous besoin ?'), options: [
        opt('logo', 'الشعار', 'Logo', 'Logo'),
        opt('palette', 'الألوان والخطوط', 'Colors & typography', 'Couleurs et typographies'),
        opt('guide', 'دليل الهوية', 'Brand guidelines', 'Charte de marque'),
        opt('accounts', 'تجهيز حسابات المنصات', 'Social accounts set up', 'Configuration des comptes'),
        opt('website', 'صفحة هبوط أو موقع', 'Landing page or website', 'Page d’atterrissage ou site'),
        opt('print', 'مطبوعات وبطاقات', 'Print & business cards', 'Imprimés et cartes de visite'),
      ] },
    ],
  },
  {
    id: 'social', step: 3,
    title: L('تصاميم السوشيال ميديا', 'Social media designs', 'Visuels pour les réseaux sociaux'),
    hint: L('محتوى شهري جاهز للنشر', 'Monthly content, ready to publish', 'Contenu mensuel prêt à publier'),
    questions: [
      { id: 'platforms', kind: 'multi', required: true, label: L('على أي منصات؟', 'Which platforms?', 'Sur quelles plateformes ?'), options: [
        opt('instagram', 'إنستغرام', 'Instagram', 'Instagram'),
        opt('facebook', 'فيسبوك', 'Facebook', 'Facebook'),
        opt('tiktok', 'تيك توك', 'TikTok', 'TikTok'),
        opt('linkedin', 'لينكدإن', 'LinkedIn', 'LinkedIn'),
        opt('x', 'إكس', 'X', 'X'),
        opt('youtube', 'يوتيوب', 'YouTube', 'YouTube'),
      ] },
      { id: 'volume', kind: 'single', required: true, label: L('كم منشورًا في الشهر؟', 'How many posts per month?', 'Combien de publications par mois ?'), options: [
        opt('8', '8 منشورات', '8 posts', '8 publications'),
        opt('12', '12 منشورًا', '12 posts', '12 publications'),
        opt('20', '20 منشورًا', '20 posts', '20 publications'),
        opt('30', '30 منشورًا', '30 posts', '30 publications'),
      ] },
      { id: 'formats', kind: 'multi', label: L('بأي صيغ؟', 'Which formats?', 'Quels formats ?'), options: [
        opt('posts', 'منشورات', 'Posts', 'Publications'),
        opt('carousels', 'كاروسيل', 'Carousels', 'Carrousels'),
        opt('reels', 'فيديو قصير', 'Short videos', 'Vidéos courtes'),
        opt('stories', 'قصص', 'Stories', 'Stories'),
      ] },
      { id: 'langs', kind: 'multi', required: true, label: L('بأي لغات؟', 'In which languages?', 'En quelles langues ?'), options: [
        opt('ar', 'العربية', 'Arabic', 'Arabe'),
        opt('en', 'الإنجليزية', 'English', 'Anglais'),
        opt('fr', 'الفرنسية', 'French', 'Français'),
      ] },
    ],
  },
  {
    id: 'ads', step: 4,
    title: L('الترويج بالإعلانات', 'Ads promotion', 'Promotion publicitaire'),
    hint: L('حملات على ميتا وتيك توك', 'Campaigns on Meta and TikTok', 'Campagnes sur Meta et TikTok'),
    questions: [
      { id: 'platforms', kind: 'multi', required: true, label: L('على أي منصات؟', 'Which platforms?', 'Sur quelles plateformes ?'), options: [
        opt('meta', 'ميتا (فيسبوك وإنستغرام)', 'Meta (Facebook & Instagram)', 'Meta (Facebook et Instagram)'),
        opt('tiktok', 'تيك توك', 'TikTok', 'TikTok'),
      ] },
      { id: 'goal', kind: 'single', required: true, label: L('ما الهدف الأول؟', 'What is the main goal?', 'Quel est l’objectif principal ?'), options: [
        opt('sales', 'مبيعات', 'Sales', 'Ventes'),
        opt('leads', 'عملاء محتملون', 'Leads', 'Prospects'),
        opt('awareness', 'انتشار ومعرفة بالعلامة', 'Brand awareness', 'Notoriété'),
        opt('installs', 'تحميل التطبيق', 'App installs', 'Installations d’appli'),
      ] },
      { id: 'budget', kind: 'single', required: true, money: 'ads', label: L('ميزانية الإعلانات الشهرية', 'Monthly ad budget', 'Budget publicitaire mensuel'), options: money('ads') },
    ],
  },
  {
    id: 'results', step: 5,
    title: L('دراسة النتائج والتطوير', 'Results & improvement', 'Résultats et amélioration'),
    hint: L('تتبّع، تقارير، وتحسين مستمر', 'Tracking, reports and continuous improvement', 'Suivi, rapports et amélioration continue'),
    questions: [
      { id: 'items', kind: 'multi', required: true, label: L('ما الذي تحتاجه؟', 'What do you need?', 'De quoi avez-vous besoin ?'), options: [
        opt('tracking', 'إعداد التتبّع والبكسل', 'Tracking & pixel setup', 'Configuration du suivi et des pixels'),
        opt('dashboard', 'لوحة متابعة', 'A live dashboard', 'Un tableau de bord'),
        opt('report', 'تقرير شهري بتوصيات', 'Monthly report with recommendations', 'Rapport mensuel avec recommandations'),
        opt('iterate', 'تحسين مستمر للمنتج والمحتوى', 'Ongoing product & content improvement', 'Amélioration continue du produit et des contenus'),
      ] },
    ],
  },
];

// Step 3 of the form: about the business and the project.
export const PROJECT = [
  { id: 'business', kind: 'input', required: true, max: 120, label: L('اسم النشاط أو المشروع', 'Business or project name', 'Nom de l’activité ou du projet'), placeholder: L('مثال: مخبزة الأمل', 'e.g. Amal Bakery', 'ex. Boulangerie Amal') },
  { id: 'sector', kind: 'single', required: true, label: L('القطاع', 'Sector', 'Secteur'), options: [
    opt('retail', 'تجارة', 'Retail', 'Commerce'),
    opt('food', 'مطاعم وأغذية', 'Food & restaurants', 'Restauration'),
    opt('education', 'تعليم', 'Education', 'Éducation'),
    opt('health', 'صحة', 'Health', 'Santé'),
    opt('tech', 'تقنية', 'Technology', 'Technologie'),
    opt('services', 'خدمات', 'Services', 'Services'),
    opt('other', 'أخرى', 'Other', 'Autre'),
  ] },
  { id: 'country', kind: 'input', max: 80, label: L('البلد / المدينة', 'Country / city', 'Pays / ville'), placeholder: L('مثال: الجزائر العاصمة', 'e.g. Algiers', 'ex. Alger') },
  { id: 'timeline', kind: 'single', required: true, label: L('متى تريد البدء؟', 'When do you want to start?', 'Quand voulez-vous commencer ?'), options: [
    opt('asap', 'في أقرب وقت', 'As soon as possible', 'Dès que possible'),
    opt('1m', 'خلال شهر', 'Within a month', 'D’ici un mois'),
    opt('3m', 'خلال 3 أشهر', 'Within 3 months', 'D’ici 3 mois'),
    opt('flex', 'مرن', 'Flexible', 'Flexible'),
  ] },
  { id: 'budget', kind: 'single', required: true, money: 'project', label: L('الميزانية التقريبية للمشروع', 'Approximate project budget', 'Budget approximatif du projet'), options: money('project', [
    opt('unsure', 'لم أحدد بعد', 'Not sure yet', 'Pas encore défini'),
  ]) },
];

// Step 4: how to reach the client.
export const CONTACT = [
  { id: 'name', kind: 'input', required: true, max: 100, label: L('الاسم', 'Your name', 'Votre nom'), autocomplete: 'name' },
  { id: 'email', kind: 'input', type: 'email', required: true, max: 160, label: L('البريد الإلكتروني', 'Email', 'E-mail'), autocomplete: 'email', dir: 'ltr' },
  { id: 'whatsapp', kind: 'input', type: 'tel', max: 30, label: L('رقم واتساب', 'WhatsApp number', 'Numéro WhatsApp'), autocomplete: 'tel', dir: 'ltr', placeholder: L('+213 …', '+213 …', '+213 …') },
  { id: 'prefer', kind: 'single', required: true, label: L('كيف تفضّل أن نتواصل؟', 'How should we reach you?', 'Comment vous joindre ?'), options: [
    opt('whatsapp', 'واتساب', 'WhatsApp', 'WhatsApp'),
    opt('email', 'البريد', 'Email', 'E-mail'),
    opt('call', 'مكالمة', 'Phone call', 'Appel'),
  ] },
  { id: 'notes', kind: 'text', max: 1000, label: L('أي شيء آخر نعرفه؟', 'Anything else we should know?', 'Autre chose à savoir ?') },
];

// ---------- helpers ----------

export const t = (label, lang) => (label ? label[lang] || label.ar : '');
export const serviceById = (id) => SERVICES.find((s) => s.id === id);
/** Text of one option; budget tiers depend on the chosen currency. */
export function optionText(o, lang, currency = DEFAULT_CURRENCY) {
  return o.money ? moneyLabel(o.money, o.id, currency, lang) : t(o.label, lang);
}
const optionLabel = (q, id, lang, currency) => {
  const o = q.options?.find((x) => x.id === id);
  return o ? optionText(o, lang, currency) : String(id);
};

/** Human-readable value of one answered question. */
export function formatAnswer(q, value, lang, currency = DEFAULT_CURRENCY) {
  if (value == null || value === '' || (Array.isArray(value) && !value.length)) return '';
  if (q.kind === 'single') return optionLabel(q, value, lang, currency);
  if (q.kind === 'multi') return value.map((v) => optionLabel(q, v, lang, currency)).join(lang === 'ar' ? '، ' : ', ');
  return String(value);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);

function checkQuestion(q, value, errors, path) {
  const empty = value == null || value === '' || (Array.isArray(value) && !value.length);
  if (q.required && empty) errors.push(path);
  if (empty) return undefined;
  if (q.kind === 'single') return q.options.some((o) => o.id === value) ? value : (errors.push(path), undefined);
  if (q.kind === 'multi') {
    const ok = Array.isArray(value) ? [...new Set(value)].filter((v) => q.options.some((o) => o.id === v)) : [];
    if (q.required && !ok.length) errors.push(path);
    return ok.length ? ok : undefined;
  }
  const s = clean(value, q.max || 500);
  if (q.type === 'email' && !EMAIL.test(s)) errors.push(path);
  return s || undefined;
}

/**
 * Validates a brief (from the form or the API) and returns a cleaned copy plus the list of
 * invalid field paths, e.g. ["product.type", "contact.email"]. Unknown fields are dropped.
 * Pass `only` to validate a single section ('services' | 'details' | 'project' | 'contact').
 */
export function validateBrief(input, only) {
  const errors = [];
  const src = input && typeof input === 'object' ? input : {};
  const out = {
    lang: LANGS.includes(src.lang) ? src.lang : 'ar',
    currency: CURRENCIES.includes(src.currency) ? src.currency : DEFAULT_CURRENCY,
    services: [], answers: {}, project: {}, contact: {},
  };

  out.services = Array.isArray(src.services) ? [...new Set(src.services)].filter((id) => serviceById(id)) : [];
  if ((!only || only === 'services') && !out.services.length) errors.push('services');

  if (!only || only === 'details') {
    for (const id of out.services) {
      const svc = serviceById(id);
      const given = (src.answers && src.answers[id]) || {};
      out.answers[id] = {};
      for (const q of svc.questions) {
        const v = checkQuestion(q, given[q.id], errors, `${id}.${q.id}`);
        if (v !== undefined) out.answers[id][q.id] = v;
      }
    }
  }
  if (!only || only === 'project') {
    for (const q of PROJECT) {
      const v = checkQuestion(q, src.project?.[q.id], errors, `project.${q.id}`);
      if (v !== undefined) out.project[q.id] = v;
    }
  }
  if (!only || only === 'contact') {
    for (const q of CONTACT) {
      const v = checkQuestion(q, src.contact?.[q.id], errors, `contact.${q.id}`);
      if (v !== undefined) out.contact[q.id] = v;
    }
    if (out.contact.prefer === 'whatsapp' && !out.contact.whatsapp) errors.push('contact.whatsapp');
  }
  return { brief: out, errors };
}

/** Plain-text summary of a brief, used in Telegram and stored with the request. */
export function summarize(brief, lang = 'ar') {
  const lines = [];
  const titles = brief.services.map((id) => t(serviceById(id).title, lang));
  lines.push(`${titles.join(' + ')}`);
  for (const id of brief.services) {
    const svc = serviceById(id);
    const parts = svc.questions
      .map((q) => [q, formatAnswer(q, brief.answers?.[id]?.[q.id], lang, brief.currency)])
      .filter(([, v]) => v)
      .map(([q, v]) => `${t(q.label, lang).replace(/[؟?]\s*$/, '')}: ${v}`);
    if (parts.length) lines.push(`• ${t(svc.title, lang)}\n  ${parts.join('\n  ')}`);
  }
  const p = brief.project || {};
  const proj = PROJECT.map((q) => [q, formatAnswer(q, p[q.id], lang, brief.currency)]).filter(([, v]) => v)
    .map(([q, v]) => `${t(q.label, lang).replace(/[؟?]\s*$/, '')}: ${v}`);
  if (proj.length) lines.push(proj.join('\n'));
  return lines.join('\n\n');
}
