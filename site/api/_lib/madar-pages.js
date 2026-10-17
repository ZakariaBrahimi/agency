// Madar pages, rendered on the server so every article, tip and episode is a real, indexable page.
// Layout: Nawa's own header and footer, with Madar's sub-bar under the header.
import { TOPICS, topicById, esc, renderMarkdown, readingMinutes, plain, toSeconds, PODCAST } from '../../assets/js/madar-schema.js';
import { siteUrl } from './http.js';

const NAWA_MARK = '<svg viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="120" fill="#5B4BFF"/><path d="M146 236 A110 110 0 0 0 366 236" fill="none" stroke="#FFFFFF" stroke-width="62" stroke-linecap="round"/><circle cx="256" cy="148" r="40" fill="#C6F432"/></svg>';
export const ORBIT = (ink = '#0B1220') => `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="none" stroke="${ink}" stroke-width="10" stroke-dasharray="200 52" transform="rotate(-60 50 50)"/><circle cx="50" cy="50" r="13" fill="#C6F432"/><circle cx="84" cy="30" r="7" fill="#5B4BFF"/></svg>`;
// The podcast mark: Nawa's nun bowl drawn as sound bars, the lime dot pulsing above (design/templates/podcast.html).
export const PODMARK = (tile = true, bars = '#FFFFFF') => `<svg viewBox="0 0 512 512" aria-hidden="true">${tile ? '<rect width="512" height="512" rx="120" fill="#5B4BFF"/>' : ''}<circle cx="256" cy="148" r="64" fill="none" stroke="#C6F432" stroke-opacity=".45" stroke-width="6"/><g stroke="${bars}" stroke-width="24" stroke-linecap="round"><line x1="160" y1="263.2" x2="160" y2="307.2"/><line x1="187.4" y1="279.9" x2="187.4" y2="365.9"/><line x1="214.9" y1="309.0" x2="214.9" y2="369.0"/><line x1="242.3" y1="286.1" x2="242.3" y2="404.1"/><line x1="269.7" y1="306.1" x2="269.7" y2="384.1"/><line x1="297.1" y1="287.0" x2="297.1" y2="391.0"/><line x1="324.6" y1="292.7" x2="324.6" y2="350.7"/><line x1="352" y1="262.7" x2="352" y2="308.7"/></g><circle cx="256" cy="148" r="40" fill="#C6F432"/></svg>`;
const ARR = '<span class="arr" aria-hidden="true">→</span>'; // mirrored in RTL by madar.css

const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('ar-DZ', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const initial = (name) => esc(String(name || 'ن').trim().charAt(0));
const href = {
  article: (p) => `/madar/${p.slug}`,
  tip: (p) => `/madar/tips/${p.number ?? p.slug}`,
  episode: (p) => `/madar/podcast/${p.slug}`,
};
export const postUrl = (p) => href[p.kind](p);

// ---------- layout ----------

export function layout({ title, description, path, body, active = 'home', type = 'website', jsonLd, noindex, image = '/assets/img/og.png' }) {
  const url = siteUrl() + path;
  const nav = [['home', '/madar', 'الرئيسية'], ['articles', '/madar/articles', 'المقالات'], ['tips', '/madar/tips', 'نصائح'], ['podcast', '/madar/podcast', 'البودكاست'], ['write', '/madar/write', 'اكتب معنا']];
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#0B1220">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
<link rel="canonical" href="${esc(url)}">
<link rel="alternate" type="application/rss+xml" title="مدار من نواة" href="/madar/rss.xml">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="مدار · نواة">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${siteUrl()}${image}">
<meta property="og:locale" content="ar_AR">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;700&family=Noto+Naskh+Arabic:wght@500;600;700&family=Bricolage+Grotesque:opsz,wght@12..96,600..800&family=Instrument+Sans:wght@400..700&display=swap">
<link rel="stylesheet" href="/assets/css/styles.css">
<link rel="stylesheet" href="/assets/css/madar.css">
<script src="/assets/js/madar.js" defer></script>
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body class="madar">
<header class="top">
  <div class="wrap nav">
    <a class="brand" href="/" aria-label="نواة">${NAWA_MARK}<span>نواة</span></a>
    <nav class="links" aria-label="نواة">
      <a href="/#journey">كيف نعمل</a>
      <a href="/#s1">فريق المنتج</a>
      <a href="/#models">طرق العمل</a>
      <a href="/madar" class="on" aria-current="true">مدار</a>
      <a href="/#contact">تواصل</a>
    </nav>
    <div class="nav-end"><a class="btn btn-lime" href="/start">ابدأ مشروعك</a><button type="button" class="md-burger" aria-expanded="false" aria-controls="mdMenu" aria-label="قائمة نواة"><i></i><i></i><i></i></button></div>
  </div>
  <nav class="md-menu" id="mdMenu" aria-label="نواة" hidden>
    <div class="wrap"><a href="/#journey">كيف نعمل</a><a href="/#s1">فريق المنتج</a><a href="/#models">طرق العمل</a><a href="/madar" aria-current="true">مدار</a><a href="/#contact">تواصل</a><a class="btn btn-lime" href="/start">ابدأ مشروعك</a></div>
  </nav>
</header>
<div class="md-bar">
  <div class="wrap md-bar-in">
    <a class="md-lock" href="/madar" aria-label="مدار من نواة">${ORBIT()}<b>مدار</b><small>من نواة</small></a>
    <nav class="md-nav" aria-label="مدار">${nav.map(([k, h, l]) => `<a href="${h}"${k === active ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
    <button type="button" class="md-search-btn" aria-expanded="false" aria-controls="mdSearch" aria-label="ابحث في مدار"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg></button>
    <form class="md-search" id="mdSearch" action="/madar/articles" method="get" role="search">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input type="search" name="q" placeholder="ابحث في مدار: Roadmap، سكرم، Figma…" aria-label="ابحث في مدار">
    </form>
  </div>
</div>
<main class="md-main">
${body}
</main>
<footer>
  <div class="wrap foot md-foot">
    <a class="brand" href="/" aria-label="نواة">${NAWA_MARK}<span>نواة</span></a>
    <span class="tl">مدار: ما نتعلّمه أثناء البناء، نشاركه معك.</span>
    <nav class="md-foot-links"><a href="/madar/articles">المقالات</a><a href="/madar/tips">النصائح</a><a href="/madar/podcast">${PODCAST.ar}</a><a href="/madar/write">اكتب معنا</a><a href="/madar/rss.xml">RSS</a><a href="/privacy">الخصوصية</a></nav>
  </div>
</footer>
</body>
</html>`;
}

// ---------- pieces ----------

const topicTag = (id) => { const t = topicById(id); return `<a class="md-tag" href="/madar/topics/${t.id}" style="--tc:${t.color}"><i></i>${t.ar}</a>`; };
const topicTagStatic = (id, label) => { const t = topicById(id); return `<span class="md-tag" style="--tc:${t.color}"><i></i>${label || t.ar}</span>`; };

export function chips(active, base = '/madar/topics/') {
  return `<nav class="md-chips" aria-label="المسارات">
    <a href="/madar/articles"${!active ? ' aria-current="page"' : ''}>الكل</a>
    ${TOPICS.map((t) => `<a href="${base}${t.id}" style="--tc:${t.color}"${active === t.id ? ' aria-current="page"' : ''}><i></i>${t.ar}</a>`).join('')}
  </nav>`;
}

// Generated cover art: the topic color with Nawa's orbit, so no stock images are needed.
// Each post gets its own composition (ring size, dot position) from its slug.
const hash = (s) => [...String(s || '')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const cover = (topic, cls = '', seed = '') => {
  const t = topicById(topic); const h = hash(seed);
  const vars = seed ? `;--rx:${8 + (h % 30)}%;--ry:${8 + ((h >> 5) % 28)}%;--rs:${52 + ((h >> 10) % 22)}%;--dx:${22 + ((h >> 15) % 50)}%;--dy:${30 + ((h >> 20) % 30)}%` : '';
  return `<div class="md-cover ${cls}" style="--tc:${t.color};--ts:${t.soft}${vars}" aria-hidden="true"><span class="o1"></span><span class="o2"></span><span class="d"></span></div>`;
};

const byline = (p, extra = '') => `<span class="md-by"><span class="md-av" style="--tc:${topicById(p.topic).color}">${initial(p.author_name)}</span><b>${esc(p.author_name)}</b>${extra}</span>`;

export function postCard(p) {
  const mins = readingMinutes(p.body);
  return `<article class="md-card">
    <a href="${postUrl(p)}" class="md-card-link" aria-label="${esc(p.title)}"></a>
    ${cover(p.topic, '', p.slug)}
    <div class="md-card-body">
      ${topicTagStatic(p.topic, p.series ? `${topicById(p.topic).short} · ${esc(p.series)}` : '')}
      <h3>${esc(p.title)}</h3>
      ${p.excerpt ? `<p>${esc(p.excerpt)}</p>` : ''}
      <div class="md-meta">${byline(p)}<span>· ${mins} د قراءة</span></div>
    </div>
  </article>`;
}

export function tipCard(p, { big = false } = {}) {
  const t = topicById(p.topic);
  return `<article class="md-tip${big ? ' big' : ''}" style="--ts:${t.soft};--tc:${t.color}" data-tip="${p.number ?? ''}">
    <div class="md-tip-top"><span class="md-tip-n">#${p.number ?? ''} · ${t.short}</span>${big ? '' : `<a href="${postUrl(p)}" class="md-tip-open" aria-label="افتح النصيحة">↗</a>`}</div>
    <b class="md-tip-q">${esc(p.title)}</b>
    ${big && p.body ? `<div class="md-tip-ex">${renderMarkdown(p.body).html}</div>` : ''}
    ${big ? `<span class="md-tip-by">من ${esc(p.author_name)}${p.author_role ? ' · ' + esc(p.author_role) : ''}</span>` : ''}
  </article>`;
}

function episodePanel(e) {
  if (!e) {
    return `<div class="md-pod soon">
      <div class="md-pod-row"><div class="md-pod-cover">${PODMARK(false)}</div><div><span class="md-kicker">Podcast · ${PODCAST.en}</span><b class="md-pod-name">${PODCAST.ar}</b></div></div>
      <p>${PODCAST.tagline}: حوارات صريحة عن النمو والأخطاء والدروس. أول حلقة قريبًا، اشترك في رسالة الخميس لتصلك.</p>
      <a class="btn btn-lime" href="/madar/podcast">عن البودكاست ${ARR}</a>
    </div>`;
  }
  return `<a class="md-pod" href="${postUrl(e)}">
    <span class="md-kicker">Podcast · ${PODCAST.en}</span>
    <div class="md-pod-row"><div class="md-pod-cover">${PODMARK(false)}</div>
      <div><b>الحلقة ${e.number ?? ''}: ${esc(e.title)}</b><span>${e.duration_min ? e.duration_min + ' دقيقة' : ''}</span></div></div>
    <span class="md-pod-play"><span class="pl">▶</span> استمع الآن</span>
  </a>`;
}

export const newsletter = (source) => `<form class="md-news" data-form="subscribe" action="/api/madar/subscribe" method="post">
    <input type="hidden" name="source" value="${esc(source)}">
    <b>رسالة الخميس</b>
    <p>أفضل ما نُشر في مدار خلال الأسبوع، في بريدك. بلا إزعاج.</p>
    <label class="sr" for="nl-${esc(source)}">بريدك الإلكتروني</label>
    <input id="nl-${esc(source)}" type="email" name="email" required placeholder="بريدك الإلكتروني" autocomplete="email" dir="auto">
    <button class="btn btn-dark" type="submit">اشترك</button>
    <p class="md-form-msg" role="status"></p>
  </form>`;

export const bridge = (title = 'قرأت شيئًا مفيدًا؟ نبنيه معك.') => `<section class="wrap"><div class="md-bridge">
    <div><h2>${esc(title)}</h2><p>فريق نواة نفسه الذي يكتب في مدار يبني المنتجات الرقمية ويديرها على السوشل ميديا.</p></div>
    <a class="btn btn-dark" href="/start">ابدأ مشروعك ${ARR}</a>
  </div></section>`;

// ---------- pages ----------

export function homePage({ articles, tips, episode }) {
  const featured = articles.find((a) => a.featured) || articles[0];
  const rest = articles.filter((a) => a !== featured).slice(0, 6);
  const hero = featured ? `<article class="md-hero">
      <a class="md-card-link" href="${postUrl(featured)}" aria-label="${esc(featured.title)}"></a>
      <div class="md-hero-txt">
        <span class="md-kicker lime">مقال الأسبوع · ${topicById(featured.topic).ar}</span>
        <h1>${esc(featured.title)}</h1>
        ${featured.excerpt ? `<p>${esc(featured.excerpt)}</p>` : ''}
        <div class="md-meta on-ink">${byline(featured)}<span>· ${readingMinutes(featured.body)} دقائق قراءة</span></div>
      </div>
      ${cover(featured.topic, 'hero')}
    </article>` : `<div class="md-hero empty"><div class="md-hero-txt"><span class="md-kicker lime">مدار من نواة</span><h1>أول المقالات في الطريق</h1><p>اشترك في رسالة الخميس لتصلك فور نشرها.</p></div></div>`;

  return `<div class="wrap md-home">
    <div class="md-intro">
      <h1 class="sr">مدار: مجتمع نواة للمنتجات الرقمية</h1>
      <p class="md-lede">مقالات ونصائح وبودكاست في <b>إدارة المنتجات وAgile والتطوير والتصميم والسوشل ميديا وIT</b>. بالعربية أولًا، يكتبه فريق نواة والمجتمع.</p>
    </div>
    ${chips(null)}
    <div class="md-home-grid">
      <div class="md-col">
        ${hero}
        ${rest.length ? `<div class="md-row-head"><h2>أحدث المقالات</h2><a href="/madar/articles">عرض الكل ${ARR}</a></div><div class="md-cards">${rest.map(postCard).join('')}</div>` : ''}
        ${tips.length ? `<div class="md-row-head"><h2>نصائح سريعة</h2><a href="/madar/tips">كل النصائح ${ARR}</a></div><div class="md-tips">${tips.map((t) => tipCard(t)).join('')}</div>` : ''}
      </div>
      <aside class="md-side">
        ${episodePanel(episode)}
        ${newsletter('home')}
        <div class="md-panel md-write-cta">
          <b>عندك خبرة تشاركها؟</b>
          <p>اكتب في مدار. نراجع معك المقال قبل النشر، وتحصل على صفحة كاتب باسمك.</p>
          <a class="btn btn-ghost-ink" href="/madar/write">اكتب معنا ${ARR}</a>
        </div>
      </aside>
    </div>
  </div>
  ${bridge()}`;
}

export function listPage({ articles, topic, q }) {
  const t = topic ? topicById(topic) : null;
  const heading = q ? `نتائج البحث عن «${esc(q)}»` : t ? t.ar : 'كل المقالات';
  return `<div class="wrap md-list">
    <header class="md-page-head"${t ? ` style="--tc:${t.color}"` : ''}>
      <span class="md-kicker">${t ? 'مسار' : 'المقالات'}</span>
      <h1>${t ? '<i class="md-dot"></i>' : ''}${heading}</h1>
      <p>${articles.length ? `${articles.length} ${articles.length > 10 ? 'مقالًا' : articles.length > 2 ? 'مقالات' : articles.length === 2 ? 'مقالان' : 'مقال'}` : q ? 'لا نتائج. جرّب كلمة أخرى.' : 'لا مقالات في هذا المسار بعد.'}</p>
    </header>
    ${chips(topic)}
    ${articles.length ? `<div class="md-cards three">${articles.map(postCard).join('')}</div>` : `<div class="md-empty">${ORBIT()}<p>${q ? 'لم نجد مقالًا بهذه الكلمة.' : 'نكتب أول مقال في هذا المسار الآن.'} <a href="/madar/write">اقترح موضوعًا</a></p></div>`}
  </div>
  ${bridge()}`;
}

export function articlePage({ post, related, series }) {
  const { html, toc } = renderMarkdown(post.body);
  const t = topicById(post.topic);
  const parts = series.length > 1 ? `<nav class="md-series" aria-label="السلسلة"><span class="md-kicker">سلسلة · ${esc(post.series)}</span><ol>${series.map((s) => `<li${s.id === post.id ? ' aria-current="true"' : ''}><a href="${postUrl(s)}"><span>${s.series_part ?? ''}</span>${esc(s.title)}</a></li>`).join('')}</ol></nav>` : '';
  return `<div class="md-progress" aria-hidden="true"><i></i></div>
  <article class="wrap md-article" style="--tc:${t.color};--ts:${t.soft}">
    <header class="md-art-head">
      <nav class="md-crumbs" aria-label="المسار"><a href="/madar">مدار</a> / <a href="/madar/topics/${t.id}">${t.ar}</a></nav>
      ${topicTag(post.topic)}${post.series ? ` <span class="md-series-tag">سلسلة «${esc(post.series)}»${post.series_part && series.length > 1 ? ` · الجزء ${post.series_part} من ${series.length}` : ''}</span>` : ''}
      <h1>${esc(post.title)}</h1>
      ${post.excerpt ? `<p class="md-art-ex">${esc(post.excerpt)}</p>` : ''}
      <div class="md-meta">${byline(post, post.author_role ? `<span class="md-role">${esc(post.author_role)}</span>` : '')}<span>· ${fmtDate(post.published_at)}</span><span>· ${readingMinutes(post.body)} دقائق قراءة</span></div>
    </header>
    <div class="md-art-grid">
      <div class="md-prose">${html}</div>
      <aside class="md-art-side">
        ${toc.length > 1 ? `<details class="md-toc" open><summary>في هذا المقال</summary><nav aria-label="المحتويات"><ol>${toc.map((h) => `<li><a href="#${h.id}">${esc(h.text)}</a></li>`).join('')}</ol></nav></details>` : ''}
        ${parts}
        <div class="md-share"><button type="button" class="btn btn-ghost-ink" data-share>شارك المقال</button><span class="md-form-msg" role="status"></span></div>
      </aside>
    </div>
    <div class="md-art-end">
      <div class="md-end-cta"><b>تحتاج من يطبّق هذا على منتجك؟</b><p>فريق نواة يبني المنتجات الرقمية من الفكرة إلى النمو.</p><a class="btn btn-lime" href="/start">ابدأ مشروعك ${ARR}</a></div>
      ${newsletter('article')}
    </div>
    ${related.length ? `<section class="md-related"><div class="md-row-head"><h2>اقرأ أيضًا</h2><a href="/madar/topics/${t.id}">${t.ar} ${ARR}</a></div><div class="md-cards three">${related.map(postCard).join('')}</div></section>` : ''}
  </article>`;
}

export function tipsPage({ tips }) {
  const today = tips.length ? tips[Math.floor(Date.now() / 864e5) % tips.length] : null;
  return `<div class="wrap md-tipsp">
    <header class="md-page-head"><span class="md-kicker">نصائح سريعة</span><h1>نصيحة في 15 ثانية</h1><p>بطاقة واحدة كل يوم. احفظ ما يفيدك وعد غدًا لتحافظ على سلسلة أيامك.</p></header>
    ${today ? `<section class="md-today" data-today="${today.number ?? ''}">
      <div class="md-today-head"><b>نصيحة اليوم</b><span class="md-streak" data-streak hidden>🔥 <span></span> أيام متتالية</span></div>
      <div class="md-stack">${tipCard(today, { big: true })}</div>
      <div class="md-swipe">
        <button type="button" data-tip-next aria-label="نصيحة أخرى">↻</button>
        <button type="button" class="save" data-tip-save aria-pressed="false" aria-label="احفظ النصيحة">★</button>
        <a href="${postUrl(today)}" aria-label="افتح وشارك">↗</a>
      </div>
    </section>` : ''}
    <div class="md-row-head"><h2>كل النصائح</h2><div class="md-tip-filter" role="group" aria-label="عرض"><button type="button" data-tips-filter="all" aria-pressed="true">الكل</button><button type="button" data-tips-filter="saved" aria-pressed="false">المحفوظة</button></div></div>
    ${tips.length ? `<div class="md-tips four" data-tips>${tips.map((t) => tipCard(t)).join('')}</div><p class="md-empty-saved" hidden>لم تحفظ نصيحة بعد. اضغط ★ على نصيحة اليوم.</p>` : `<div class="md-empty">${ORBIT()}<p>أول النصائح قريبًا.</p></div>`}
    <script type="application/json" id="md-tips-data">${JSON.stringify(tips.map((t) => ({ n: t.number, html: tipCard(t, { big: true }), url: postUrl(t) }))).replace(/</g, '\\u003c')}</script>
  </div>
  ${bridge('نصيحة واحدة لا تكفي؟ نبني معك المنتج كاملًا.')}`;
}

export function tipPage({ tip, more }) {
  return `<div class="wrap md-tip-page">
    <nav class="md-crumbs" aria-label="المسار"><a href="/madar">مدار</a> / <a href="/madar/tips">النصائح</a></nav>
    <div class="md-stack single">${tipCard(tip, { big: true })}</div>
    <div class="md-share center"><button type="button" class="btn btn-ghost-ink" data-share>شارك النصيحة</button><span class="md-form-msg" role="status"></span></div>
    ${more.length ? `<div class="md-row-head"><h2>نصائح أخرى</h2><a href="/madar/tips">كل النصائح ${ARR}</a></div><div class="md-tips four">${more.map((t) => tipCard(t)).join('')}</div>` : ''}
  </div>`;
}

export function podcastPage({ episodes }) {
  return `<div class="wrap md-podp">
    <header class="md-pod-hero">
      <span class="md-pod-rings" aria-hidden="true"><i></i><i></i><i></i></span>
      <div class="md-pod-art">${PODMARK(false)}</div>
      <div class="md-pod-txt">
        <span class="md-kicker lime">Podcast · ${PODCAST.en}</span>
        <h1>${PODCAST.ar}</h1>
        <p class="md-pod-tag">${PODCAST.tagline}. بودكاست من نواة.</p>
        <p>الإطلاق ليس النهاية. حوارات صريحة مع من بنوا منتجات رقمية: ماذا حدث بعد الإطلاق، ما الذي نجح، وما الذي لن يكرروه.</p>
      </div>
    </header>
    <ul class="md-pod-facts">
      <li><b>ضيف واحد</b><span>مؤسس، مدير منتج، مصمم أو مسوّق بنى شيئًا حقيقيًا.</span></li>
      <li><b>30 إلى 45 دقيقة</b><span>حلقة كل أسبوعين، بالعربية.</span></li>
      <li><b>فصول ونص كامل</b><span>تقفز إلى ما يهمك، أو تقرأ بدل أن تسمع.</span></li>
    </ul>
    ${episodes.length ? `<div class="md-eps">${episodes.map((e) => `<a class="md-ep" href="${postUrl(e)}">
        <span class="md-ep-n">${String(e.number ?? '').padStart(2, '0')}</span>
        <div><b>${esc(e.title)}</b>${e.excerpt ? `<p>${esc(e.excerpt)}</p>` : ''}<span class="md-meta">${fmtDate(e.published_at)}${e.duration_min ? ` · ${e.duration_min} دقيقة` : ''} · ${topicById(e.topic).short}</span></div>
        <span class="md-ep-play" aria-hidden="true">▶</span></a>`).join('')}</div>`
      : `<div class="md-soon"><b>أول حلقة قريبًا</b><p>نسجّل الآن. اشترك في رسالة الخميس لتصلك فور نشرها.</p>${newsletter('podcast')}</div>`}
  </div>`;
}

export function episodePage({ ep, more }) {
  const { html } = renderMarkdown(ep.body);
  const chapters = (ep.chapters || []).map((c) => ({ ...c, s: toSeconds(c.t) })).filter((c) => c.s != null);
  return `<article class="wrap md-episode">
    <nav class="md-crumbs" aria-label="المسار"><a href="/madar">مدار</a> / <a href="/madar/podcast">${PODCAST.ar}</a></nav>
    <div class="md-ep-grid">
      <div class="md-player" data-player>
        <div class="md-ep-cover"><span class="band" style="background:${topicById(ep.topic).color}"></span><span class="num">${String(ep.number ?? '').padStart(2, '0')}</span><span class="show">${PODMARK()}${PODCAST.ar}</span><span class="wave">${Array.from({ length: 36 }, (_, i) => `<i style="height:${Math.round(25 + Math.abs(Math.sin(i * 1.7 + 3) * 60 + Math.sin(i * 0.6) * 15)) % 101}%"></i>`).join('')}</span><span class="lbl">${esc(ep.title)}</span></div>
        <div class="md-ep-titles"><span class="md-kicker">${PODCAST.ar} · الحلقة ${ep.number ?? ''}</span><h1>${esc(ep.title)}</h1><span class="md-meta">${fmtDate(ep.published_at)}${ep.duration_min ? ` · ${ep.duration_min} دقيقة` : ''}</span></div>
        ${ep.audio_url ? `<audio src="${esc(ep.audio_url)}" preload="metadata" controls></audio>
        <div class="md-ctrls"><button type="button" data-skip="-15">-15</button><button type="button" class="play" data-play aria-label="تشغيل">▶</button><button type="button" data-skip="30">+30</button><button type="button" class="rate" data-rate>1×</button></div>`
          : '<p class="md-note">الصوت يُضاف قريبًا.</p>'}
        ${chapters.length ? `<ol class="md-chapters">${chapters.map((c) => `<li><button type="button" data-seek="${c.s}"><span>${esc(c.title)}</span><span class="t" dir="ltr">${esc(c.t)}</span></button></li>`).join('')}</ol>` : ''}
      </div>
      <div class="md-prose md-transcript">${ep.excerpt ? `<p class="md-art-ex">${esc(ep.excerpt)}</p>` : ''}${html}</div>
    </div>
    ${more.length ? `<section class="md-related"><div class="md-row-head"><h2>حلقات أخرى</h2><a href="/madar/podcast">كل الحلقات ${ARR}</a></div><div class="md-eps">${more.map((e) => `<a class="md-ep" href="${postUrl(e)}"><span class="md-ep-n">${String(e.number ?? '').padStart(2, '0')}</span><div><b>${esc(e.title)}</b></div><span class="md-ep-play" aria-hidden="true">▶</span></a>`).join('')}</div></section>` : ''}
  </article>`;
}

export function writePage() {
  return `<div class="wrap md-writep">
    <header class="md-page-head"><span class="md-kicker">اكتب معنا</span><h1>شارك ما تعلّمته أثناء البناء</h1><p>نبحث عن تجارب حقيقية في المنتج وAgile والتطوير والتصميم والسوشل ميديا وIT. أرسل فكرتك، ويراجع فريق نواة المقال معك قبل النشر.</p></header>
    <div class="md-write-grid">
      <form class="md-form" data-form="pitch" action="/api/madar/pitch" method="post">
        <div class="two"><label>اسمك<input name="name" required maxlength="120" autocomplete="name"></label>
        <label>بريدك<input name="email" type="email" required maxlength="200" autocomplete="email" dir="auto"></label></div>
        <label>المسار<select name="topic" required>${TOPICS.map((t) => `<option value="${t.id}">${t.ar}</option>`).join('')}</select></label>
        <label>عنوان مقترح<input name="title" required maxlength="200" placeholder="مثال: كيف خفّضنا وقت التسليم إلى النصف"></label>
        <label>الفكرة في بضعة أسطر<textarea name="outline" rows="6" maxlength="4000" placeholder="ما المشكلة؟ ماذا جرّبتم؟ ما الذي تعلّمتموه؟"></textarea></label>
        <label>روابط أعمالك (اختياري)<input name="links" maxlength="1000" placeholder="LinkedIn، مدونة، GitHub…" dir="auto"></label>
        <button class="btn btn-lime" type="submit">أرسل الفكرة ${ARR}</button>
        <p class="md-form-msg" role="status"></p>
      </form>
      <aside class="md-write-how">
        <b>كيف يعمل؟</b>
        <ol><li><b>ترسل الفكرة</b><span>بضعة أسطر تكفي.</span></li><li><b>نرد خلال أسبوع</b><span>بالموافقة أو باقتراح زاوية أفضل.</span></li><li><b>تكتب ونراجع معك</b><span>تحرير لغوي وتقني من فريق نواة.</span></li><li><b>ننشر باسمك</b><span>ونشارك المقال على حسابات نواة.</span></li></ol>
      </aside>
    </div>
  </div>`;
}

export const notFoundPage = () => `<div class="wrap md-404"><div class="md-empty">${ORBIT()}<h1>هذه الصفحة خارج المدار</h1><p>ربما نُقلت أو لم تُنشر بعد.</p><a class="btn btn-dark" href="/madar">إلى رئيسية مدار</a></div></div>`;

// ---------- feeds ----------

export function rss(posts) {
  const base = siteUrl();
  const items = posts.map((p) => `<item><title>${esc(p.title)}</title><link>${base}${postUrl(p)}</link><guid>${base}${postUrl(p)}</guid><pubDate>${new Date(p.published_at).toUTCString()}</pubDate><category>${esc(topicById(p.topic).ar)}</category><description>${esc(p.excerpt || plain(p.body))}</description></item>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>مدار من نواة</title><link>${base}/madar</link><description>مقالات ونصائح وبودكاست في المنتجات الرقمية</description><language>ar</language>${items}</channel></rss>`;
}

export function sitemap(posts) {
  const base = siteUrl();
  const fixed = ['/madar', '/madar/articles', '/madar/tips', '/madar/podcast', '/madar/write', ...TOPICS.map((t) => `/madar/topics/${t.id}`)];
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${fixed.map((u) => `<url><loc>${base}${u}</loc></url>`).join('')}${posts.map((p) => `<url><loc>${base}${postUrl(p)}</loc><lastmod>${(p.updated_at || p.published_at).slice(0, 10)}</lastmod></url>`).join('')}</urlset>`;
}
