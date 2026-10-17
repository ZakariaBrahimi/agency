// GET /madar/* (rewritten here by vercel.json): server-rendered Madar pages, cached at the edge for a few minutes.
// GET /api/madar/render?json=latest: the newest posts for the «من مدار» block on the Nawa home page.
// (One function for all of Madar's reads keeps the project well under Vercel's function limit.)
import { madar } from '../_lib/supabase.js';
import { TOPICS, plain, PODCAST, readingMinutes } from '../../assets/js/madar-schema.js';
import * as P from '../_lib/madar-pages.js';

const CARD = 'id,kind,slug,topic,title,excerpt,body,author_name,author_role,series,series_part,featured,number,duration_min,published_at,updated_at';
const send = (res, status, body, type = 'text/html; charset=utf-8', cache = 's-maxage=120, stale-while-revalidate=600') => {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', status === 200 ? `public, max-age=0, ${cache}` : 'public, max-age=0, s-maxage=30');
  res.end(body);
};
const q = encodeURIComponent;
const list = (kind, extra = '', limit = 60, cols = CARD) => madar.posts(`select=${cols}&kind=eq.${kind}${extra}&order=published_at.desc&limit=${limit}`);
const one = async (kind, filter) => (await madar.posts(`select=*&kind=eq.${kind}&${filter}&limit=1`))[0];

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  let path = url.searchParams.get('p');
  if (path == null) path = url.pathname.replace(/^\/madar\/?/, '').replace(/^\/api\/madar\/render\/?/, '');
  const seg = path.split('/').filter(Boolean).map((s) => decodeURIComponent(s).toLowerCase());
  const page = (status, opts) => send(res, status, P.layout(opts));
  if (url.searchParams.get('json') === 'latest') return latest(res);
  if (!madar.ready()) return page(503, { title: 'مدار | نواة', description: '', path: '/madar', body: P.notFoundPage(), noindex: true });

  try {
    const [a, b] = seg;
    if (!a) {
      const [articles, tips, eps] = await Promise.all([list('article', '', 7), list('tip', '', 4), list('episode', '', 1)]);
      return page(200, { title: 'مدار من نواة | مقالات ونصائح وبودكاست في المنتجات الرقمية', description: 'مدار: مجتمع نواة لكل من يبني منتجًا رقميًا. مقالات ونصائح سريعة وبودكاست «نبض» في إدارة المنتجات وAgile والتطوير والتصميم والسوشل ميديا وIT.', path: '/madar', body: P.homePage({ articles, tips, episode: eps[0] }) });
    }
    if ((a === 'articles' || a === 'topics') && seg.length <= 2) {
      const topic = a === 'topics' ? b : null;
      if (a === 'topics' && !TOPICS.some((t) => t.id === topic)) return notFound();
      const term = (url.searchParams.get('q') || '').replace(/[^\p{L}\p{N}\s.-]/gu, ' ').trim().slice(0, 60);
      let extra = topic ? `&topic=eq.${topic}` : '';
      if (term) extra += `&or=(${['title', 'excerpt', 'body'].map((c) => `${c}.ilike.${q('*' + term + '*')}`).join(',')})`;
      const articles = await list('article', extra, 90);
      const t = TOPICS.find((x) => x.id === topic);
      return page(200, { title: `${term ? `بحث: ${term}` : t ? t.ar : 'كل المقالات'} | مدار من نواة`, description: t ? `مقالات مدار في ${t.ar}: خبرة عملية بالعربية من فريق نواة والمجتمع.` : 'كل مقالات مدار في المنتجات الرقمية.', path: topic ? `/madar/topics/${topic}` : '/madar/articles', active: 'articles', noindex: Boolean(term), body: P.listPage({ articles, topic, q: term }) });
    }
    if (a === 'tips' && !b) {
      const tips = await list('tip', '', 300);
      return page(200, { title: 'نصائح سريعة | مدار من نواة', description: 'نصيحة في 15 ثانية كل يوم: المنتج، Agile، التطوير، التصميم، السوشل ميديا وIT.', path: '/madar/tips', active: 'tips', body: P.tipsPage({ tips }) });
    }
    if (a === 'tips' && b && seg.length === 2) {
      const tip = /^\d+$/.test(b) ? await one('tip', `number=eq.${b}`) : await one('tip', `slug=eq.${q(b)}`);
      if (!tip) return notFound();
      const more = (await list('tip', `&id=neq.${tip.id}`, 4));
      return page(200, { title: `${tip.title} | نصائح مدار`, description: plain(tip.body) || tip.title, path: P.postUrl(tip), active: 'tips', type: 'article', body: P.tipPage({ tip, more }) });
    }
    if (a === 'podcast' && !b) {
      const episodes = await list('episode', '', 200);
      return page(200, { title: `${PODCAST.ar} (${PODCAST.en}) | بودكاست من نواة`, description: `بودكاست «${PODCAST.ar}» من نواة: ${PODCAST.tagline}. حوارات صريحة مع من بنوا منتجات رقمية، لكل حلقة فصول ونص مكتوب.`, path: '/madar/podcast', active: 'podcast', image: '/assets/img/nabd-cover.jpg', body: P.podcastPage({ episodes }) });
    }
    if (a === 'podcast' && b && seg.length === 2) {
      const ep = await one('episode', `slug=eq.${q(b)}`);
      if (!ep) return notFound();
      const more = await list('episode', `&id=neq.${ep.id}`, 3, 'id,kind,slug,topic,title,number,published_at');
      return page(200, { title: `${ep.title} | ${PODCAST.ar}`, description: ep.excerpt || plain(ep.body), path: P.postUrl(ep), active: 'podcast', type: 'article', image: '/assets/img/nabd-cover.jpg', body: P.episodePage({ ep, more }),
        jsonLd: { '@context': 'https://schema.org', '@type': 'PodcastEpisode', name: ep.title, episodeNumber: ep.number, datePublished: ep.published_at, description: ep.excerpt, partOfSeries: { '@type': 'PodcastSeries', name: PODCAST.ar }, ...(ep.audio_url ? { associatedMedia: { '@type': 'MediaObject', contentUrl: ep.audio_url } } : {}) } });
    }
    if (a === 'write' && !b) return page(200, { title: 'اكتب معنا | مدار من نواة', description: 'شارك خبرتك في المنتجات الرقمية مع مجتمع مدار. نراجع المقال معك قبل النشر.', path: '/madar/write', active: 'write', body: P.writePage() });
    if ((a === 'rss.xml' || a === 'sitemap.xml') && !b) {
      const posts = await madar.posts(`select=kind,slug,number,topic,title,excerpt,body,published_at,updated_at&order=published_at.desc&limit=${a === 'rss.xml' ? 40 : 1000}`);
      return send(res, 200, a === 'rss.xml' ? P.rss(posts) : P.sitemap(posts), a === 'rss.xml' ? 'application/rss+xml; charset=utf-8' : 'application/xml; charset=utf-8');
    }
    if (seg.length === 1) {
      const post = await one('article', `slug=eq.${q(a)}`);
      if (!post) return notFound();
      const [related, series] = await Promise.all([
        list('article', `&topic=eq.${post.topic}&id=neq.${post.id}`, 3),
        post.series ? madar.posts(`select=id,kind,slug,title,series_part&kind=eq.article&series=eq.${q(post.series)}&order=series_part.asc.nullslast,published_at.asc&limit=30`) : [],
      ]);
      return page(200, { title: `${post.title} | مدار من نواة`, description: post.excerpt || plain(post.body), path: P.postUrl(post), active: 'articles', type: 'article', body: P.articlePage({ post, related, series }),
        jsonLd: { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title, description: post.excerpt, datePublished: post.published_at, dateModified: post.updated_at, inLanguage: 'ar', author: { '@type': 'Person', name: post.author_name }, publisher: { '@type': 'Organization', name: 'Nawa Studio' } } });
    }
    return notFound();
  } catch (e) {
    console.error(e.message);
    return page(500, { title: 'مدار | نواة', description: '', path: '/madar', noindex: true, body: '<div class="wrap md-404"><div class="md-empty"><h1>حدث خطأ مؤقت</h1><p>حدّث الصفحة بعد لحظات.</p></div></div>' });
  }

  function notFound() { return page(404, { title: 'غير موجودة | مدار', description: '', path: '/madar', active: '', noindex: true, body: P.notFoundPage() }); }
}

async function latest(res) {
  const empty = { ok: true, articles: [], tip: null, episode: null };
  if (!madar.ready()) return send(res, 200, JSON.stringify(empty), 'application/json; charset=utf-8');
  try {
    const cols = 'kind,slug,topic,title,body,number,duration_min,published_at';
    const [articles, tips, eps] = await Promise.all([list('article', '', 2, cols), list('tip', '', 1, cols), list('episode', '', 1, cols)]);
    const slim = (p) => p && { kind: p.kind, topic: p.topic, title: p.title, url: P.postUrl(p), minutes: p.kind === 'article' ? readingMinutes(p.body) : undefined, number: p.number, duration: p.duration_min };
    return send(res, 200, JSON.stringify({ ok: true, articles: articles.map(slim), tip: slim(tips[0]), episode: slim(eps[0]) }), 'application/json; charset=utf-8', 's-maxage=300, stale-while-revalidate=900');
  } catch (e) {
    console.error(e.message);
    return send(res, 200, JSON.stringify(empty), 'application/json; charset=utf-8');
  }
}
