// Content dashboard: platforms, post rules and the starter plan.
// Shared by the browser (/admin) and the API (/api/admin/content) so both apply the same limits.

export const PLATFORMS = {
  instagram: { name: 'إنستغرام', short: 'IG', limit: 2200 },
  facebook: { name: 'فيسبوك', short: 'FB', limit: 63206 },
  tiktok: { name: 'تيك توك', short: 'TT', limit: 4000 },
  linkedin: { name: 'لينكدإن', short: 'IN', limit: 3000 },
};
export const PLATFORM_IDS = Object.keys(PLATFORMS);

export const KINDS = {
  image: 'صورة',
  carousel: 'كاروسيل',
  video: 'فيديو / ريل',
  text: 'نص فقط',
};

export const STATUS = {
  draft: 'مسودة',
  scheduled: 'مجدول',
  published: 'منشور',
};

const AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
export const isAt = (s) => typeof s === 'string' && AT.test(s);

/** The caption a platform will use: its own text if set, otherwise the shared one. */
export const captionFor = (post, platform) => (post.captions?.[platform] || '').trim() || (post.captions?.all || '').trim();

/** Status of one platform on a post. */
export const platformStatus = (post, platform) => post.schedule?.[platform]?.status || 'draft';

/** Overall status: published only when every chosen platform is published, scheduled when any is. */
export function postStatus(post) {
  const ps = (post.platforms || []).map((p) => platformStatus(post, p));
  if (ps.length && ps.every((s) => s === 'published')) return 'published';
  if (ps.some((s) => s !== 'draft')) return 'scheduled';
  return 'draft';
}

/** Checks a post (or a patch to one). Returns an error code, or '' when valid. */
export function checkPost(p, partial = false) {
  if (!partial || p.title !== undefined) {
    if (typeof p.title !== 'string' || !p.title.trim()) return 'title_required';
    if (p.title.length > 200) return 'title_too_long';
  }
  if (p.kind !== undefined && !KINDS[p.kind]) return 'bad_kind';
  if (p.date !== undefined && p.date !== '' && !isAt(p.date)) return 'bad_date';
  if (p.platforms !== undefined && (!Array.isArray(p.platforms) || p.platforms.some((x) => !PLATFORMS[x]))) return 'bad_platforms';
  if (p.notes !== undefined && (typeof p.notes !== 'string' || p.notes.length > 4000)) return 'notes_too_long';
  if (p.captions !== undefined) {
    if (typeof p.captions !== 'object' || !p.captions) return 'bad_captions';
    for (const [k, v] of Object.entries(p.captions)) {
      if (k !== 'all' && !PLATFORMS[k]) return 'bad_captions';
      if (typeof v !== 'string') return 'bad_captions';
      const limit = k === 'all' ? 63206 : PLATFORMS[k].limit;
      if ([...v].length > limit) return 'caption_too_long:' + k;
    }
  }
  return '';
}

// ---------- Starter plan: the first four weeks (titles; captions where they already exist) ----------
const ALL = ['instagram', 'facebook', 'linkedin', 'tiktok'];
const LINK = 'https://nawa-studio-six.vercel.app/start';
const p = (date, title, kind, platforms, captions = {}) => ({ date: date + 'T20:00', title, kind, platforms, captions });

export const STARTER_PLAN = [
  // Week 1 · launch
  p('2026-10-18', 'مرحبًا، نحن نواة · منشور الشبكة 1', 'image', ['instagram', 'facebook'], {
    all: 'مرحبًا، نحن نواة.\nاستوديو يطوّر المنتجات الرقمية ويصنع حضورها على السوشل ميديا.\nتابعونا، والقصة تبدأ من هنا.\n\n#نواة #منتجات_رقمية #سوشل_ميديا',
  }),
  p('2026-10-19', 'من الفكرة إلى النمو · منشور الشبكة 2', 'image', ['instagram', 'facebook'], {
    all: 'من الفكرة إلى النمو، في 6 خطوات:\n1. نطوّر المنتج\n2. نبني الهوية البصرية\n3. نصمّم محتوى السوشل ميديا\n4. نروّج له بالإعلانات\n5. ندرس النتائج\n6. نطوّر ونعيد الدورة\n\n#نواة #تطوير_المنتجات #تسويق_رقمي',
  }),
  p('2026-10-20', 'ونروي القصص · منشور الشبكة 3', 'image', ['instagram', 'facebook'], {
    all: 'ونروي القصص.\nعندك فكرة أو منتج يحتاج حضورًا؟ أخبرنا بما تحتاجه في دقيقتين، ونعود إليك بخطة واضحة.\nالرابط في البايو.\n\n#نواة #ابدأ_مشروعك',
    facebook: `ونروي القصص.\nعندك فكرة أو منتج يحتاج حضورًا؟ أخبرنا بما تحتاجه في دقيقتين، ونعود إليك بخطة واضحة.\n\n👈 ${LINK}\n\n#نواة #ابدأ_مشروعك`,
  }),
  p('2026-10-24', 'Showreel: لكل فكرة نواة', 'video', ALL, {
    all: 'لكل فكرة نواة. 🟢\n\nنحن نواة، استوديو رقمي يرافق فكرتك من أول سطر كود إلى أول عميل:\nنطوّر المنتج ← نبني الهوية ← نصمّم المحتوى ← نروّج بالإعلانات ← ندرس النتائج ← ونحسّن\n\nEvery idea has a core. We build it, brand it, and grow it.\n\nعندك فكرة؟ ابدأ مشروعك من الرابط في البايو 👆\n\n#نواة #NawaStudio #منتجات_رقمية #تصميم #موشن_جرافيك #تسويق_رقمي #ريادة_الأعمال #الجزائر',
    tiktok: 'لكل فكرة نواة 🟢 Every idea has a core.\nمن الفكرة إلى منتج ينمو: تطوير، هوية، محتوى، إعلانات، ونتائج.\nابدأ مشروعك، الرابط في البايو.\n\n#نواة #NawaStudio #موشن_جرافيك #تصميم #برمجة #تسويق_رقمي #الجزائر #fyp',
    facebook: `لكل فكرة نواة.\n\nنواة استوديو رقمي يجمع المطوّرين والمصمّمين وصنّاع المحتوى في فريق واحد، ويرافق مشروعك خطوة بخطوة:\n\n1. نطوّر لك المنتج: موقع، تطبيق أو منصة SaaS\n2. نصنع له هوية بصرية وحضورًا\n3. نصمّم محتوى السوشل ميديا\n4. نروّج له بالإعلانات\n5. ندرس النتائج بالأرقام\n6. نطوّر ونحسّن باستمرار\n\nEvery idea has a core. We build it, brand it, and grow it.\n\n👈 ابدأ مشروعك في دقيقتين: ${LINK}\n\n#نواة #NawaStudio #منتجات_رقمية #تسويق_رقمي`,
    linkedin: `Every idea has a core. لكل فكرة نواة.\n\nWe're Nawa Studio: developers, designers and content creators in one team. We take products from the first line of code to the first customers: build, brand, content, ads, results, and improve.\n\nThis showreel was made entirely in code, from the motion to the sound.\n\nHave an idea? Start here: ${LINK}\n\n#ProductDevelopment #Branding #MotionDesign #DigitalMarketing #Algeria`,
  }),
  // Week 2 · building the product
  p('2026-10-25', '5 أسئلة قبل أن تبرمج تطبيقك', 'carousel', ['instagram', 'facebook', 'linkedin']),
  p('2026-10-27', 'تعرّفوا على ميزان', 'image', ALL.filter((x) => x !== 'tiktok')),
  p('2026-10-29', 'كيف نحوّل فكرتك إلى نموذج أولي في أسبوعين', 'image', ['instagram', 'facebook']),
  p('2026-10-31', 'من الفكرة إلى الإطلاق في 30 ثانية', 'video', ['instagram', 'facebook', 'tiktok']),
  // Week 3 · visual identity
  p('2026-11-01', 'شعار ≠ هوية: ما الفرق؟', 'carousel', ['instagram', 'facebook', 'linkedin']),
  p('2026-11-03', 'قصة شعار نواة: لماذا النقطة؟', 'carousel', ALL.filter((x) => x !== 'tiktok')),
  p('2026-11-05', 'أيّ لون يناسب مشروعك؟', 'image', ['instagram', 'facebook']),
  p('2026-11-07', 'الشعار يتحرّك', 'video', ['instagram', 'facebook', 'tiktok']),
  // Week 4 · content and ads
  p('2026-11-08', '4 أخطاء تقتل وصول منشوراتك', 'carousel', ['instagram', 'facebook', 'linkedin']),
  p('2026-11-10', 'منشور قبل وبعد: نفس الفكرة، تصميم مختلف', 'image', ALL.filter((x) => x !== 'tiktok')),
  p('2026-11-12', 'كم تحتاج ميزانية لإعلانك الأول؟', 'image', ['instagram', 'facebook']),
  p('2026-11-14', 'خدماتنا في 28 ثانية', 'video', ['instagram', 'facebook', 'tiktok']),
];
