// Madar (/madar): topics, post kinds and a small, safe Markdown renderer.
// Shared by the server pages (api/madar), the admin editor preview and the browser.

export const TOPICS = [
  { id: 'product', ar: 'إدارة المنتجات', short: 'المنتج', color: '#5B4BFF', soft: '#ECEAFF' },
  { id: 'agile', ar: 'Agile وسكرم', short: 'Agile', color: '#E8674D', soft: '#FBE3DD' },
  { id: 'dev', ar: 'التطوير', short: 'التطوير', color: '#1E9E6A', soft: '#DCF2E8' },
  { id: 'design', ar: 'التصميم وUX', short: 'التصميم', color: '#D946A8', soft: '#F9E0F1' },
  { id: 'social', ar: 'السوشل ميديا', short: 'السوشل', color: '#F2A516', soft: '#FDEBD0' },
  { id: 'it', ar: 'IT والبنية', short: 'IT', color: '#2F86D1', soft: '#DDEBF8' },
];
export const topicById = (id) => TOPICS.find((t) => t.id === id) || TOPICS[0];

export const KINDS = { article: 'مقال', tip: 'نصيحة', episode: 'حلقة بودكاست' };
export const PODCAST = { ar: 'بعد الإطلاق', en: 'After Launch' };

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function readingMinutes(md) {
  const words = String(md || '').replace(/[`#>*_\[\]()!-]/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 130)); // Arabic reads slower than English
}

// "12:30" or "1:02:03" -> seconds
export function toSeconds(t) {
  const p = String(t || '').trim().split(':').map(Number);
  if (!p.length || p.some((n) => !Number.isFinite(n))) return null;
  return p.reduce((a, n) => a * 60 + n, 0);
}

const safeUrl = (u, imagesOnly) => {
  u = String(u || '').trim();
  if (/^https:\/\//i.test(u)) return u;
  if (!imagesOnly && (/^http:\/\//i.test(u) || /^\/(?!\/)/.test(u) || /^#/.test(u) || /^mailto:/i.test(u))) return u;
  return null;
};

function inline(s) {
  // s is already escaped. Code spans first so their content is left alone.
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, url) => {
    const u = safeUrl(url.replace(/&amp;/g, '&'), true);
    return u ? `<img src="${esc(u)}" alt="${alt}" loading="lazy">` : m;
  });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) => {
    const u = safeUrl(url.replace(/&amp;/g, '&'));
    if (!u) return text;
    const ext = /^https?:/i.test(u) ? ' target="_blank" rel="noopener"' : '';
    return `<a href="${esc(u)}"${ext}>${text}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  s = s.replace(/==([^=]+)==/g, '<mark>$1</mark>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}

// Markdown subset: #/##/### headings, paragraphs, - and 1. lists, > quotes (a quote starting with an
// emoji renders as a callout), ``` code blocks, --- rules, images, links, **bold**, *italic*, ==mark==, `code`.
// Returns { html, toc } where toc lists the ## headings.
export function renderMarkdown(md) {
  const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  const out = []; const toc = [];
  let i = 0; let h = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre dir="ltr"><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }
    if (/^\s*$/.test(line)) { i++; continue; }
    let m;
    if ((m = line.match(/^(#{1,3})\s+(.+)$/))) {
      const level = Math.max(2, m[1].length);
      const id = `s-${++h}`;
      if (level === 2) toc.push({ id, text: m[2].replace(/[*`=]/g, '') });
      out.push(`<h${level} id="${id}">${inline(esc(m[2]))}</h${level}>`);
      i++; continue;
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      const text = buf.join('\n').trim();
      const callout = /^\p{Extended_Pictographic}/u.test(text);
      out.push(`<blockquote${callout ? ' class="callout"' : ''}>${text.split(/\n{2,}/).map((p) => `<p>${inline(esc(p)).replace(/\n/g, '<br>')}</p>`).join('')}</blockquote>`);
      continue;
    }
    if (/^\s*([-*])\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const re = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/;
      const items = [];
      while (i < lines.length && re.test(lines[i])) {
        let item = lines[i++].replace(re, '');
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !re.test(lines[i])) item += ' ' + lines[i++].trim();
        items.push(item);
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((it) => {
        const task = it.match(/^\[( |x)\]\s+(.*)$/i);
        return task ? `<li class="task${task[1] !== ' ' ? ' done' : ''}">${inline(esc(task[2]))}</li>` : `<li>${inline(esc(it))}</li>`;
      }).join('')}</${tag}>`);
      continue;
    }
    const buf = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,3}\s|```|>|\s*[-*]\s+|\s*\d+[.)]\s+|-{3,}\s*$)/.test(lines[i])) buf.push(lines[i++]);
    if (!buf.length) buf.push(lines[i++]);
    out.push(`<p>${inline(esc(buf.join('\n'))).replace(/\n/g, '<br>')}</p>`);
  }
  return { html: out.join('\n'), toc };
}

// Plain text for meta descriptions and RSS.
export const plain = (md, n = 180) => String(md || '').replace(/```[\s\S]*?```/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[#>*_`=|-]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

// Validates an admin edit. Returns { ok, row } or { ok: false, error }.
export function validatePost(p) {
  const kind = ['article', 'tip', 'episode'].includes(p.kind) ? p.kind : null;
  if (!kind) return { ok: false, error: 'bad_kind' };
  const title = String(p.title || '').trim().slice(0, 200);
  if (!title) return { ok: false, error: 'title_required' };
  const slug = String(p.slug || '').trim().toLowerCase();
  if (!SLUG.test(slug) || slug.length > 80) return { ok: false, error: 'bad_slug' };
  if (!TOPICS.some((t) => t.id === p.topic)) return { ok: false, error: 'bad_topic' };
  const int = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.round(Number(v))));
  const chapters = (Array.isArray(p.chapters) ? p.chapters : [])
    .map((c) => ({ t: String(c.t || '').trim().slice(0, 9), title: String(c.title || '').trim().slice(0, 140) }))
    .filter((c) => c.title && toSeconds(c.t) != null).slice(0, 40);
  const audio = String(p.audio_url || '').trim();
  if (audio && !/^https:\/\//i.test(audio)) return { ok: false, error: 'bad_audio_url' };
  const status = p.status === 'published' ? 'published' : 'draft';
  let published_at = p.published_at ? new Date(p.published_at) : null;
  if (published_at && isNaN(published_at)) published_at = null;
  if (status === 'published' && !published_at) published_at = new Date();
  return {
    ok: true,
    row: {
      kind, status, slug, title, topic: p.topic,
      excerpt: String(p.excerpt || '').trim().slice(0, 400),
      body: String(p.body || '').slice(0, 60000),
      author_name: String(p.author_name || '').trim().slice(0, 80) || 'فريق نواة',
      author_role: String(p.author_role || '').trim().slice(0, 80),
      series: String(p.series || '').trim().slice(0, 120),
      series_part: int(p.series_part),
      featured: Boolean(p.featured),
      number: int(p.number),
      audio_url: audio,
      duration_min: int(p.duration_min),
      chapters,
      published_at: published_at ? published_at.toISOString() : null,
      updated_at: new Date().toISOString(),
    },
  };
}
