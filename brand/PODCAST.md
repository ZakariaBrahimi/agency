# «نبض» · Nabd: Nawa's podcast

**Name:** نبض (Nabd, "pulse").
**Tagline:** ما يحدث بعد الإطلاق (What happens after launch).
**Signed as:** بودكاست من نواة. It lives at `/madar/podcast` as part of Madar.

## Why «نبض»
- Every product has a pulse after launch: usage, growth, problems. The podcast takes that pulse with the people who built the product.
- It's short (3 letters), easy to say in Arabic, English and French, and it means sound/rhythm, which suits audio.
- It keeps the "after launch" idea from the first name as the tagline, and it continues Nawa's tagline «نطلق المنتجات الرقمية».
- Before announcing it, search Spotify, Apple Podcasts and Instagram for «نبض» / "Nabd" to check how close existing shows are.

Alternatives:
- **تردّد** (Taraddud): "frequency", and also "hesitation" (the doubts before a product decision).
- **صدى** (Sada): "echo", what stays after the launch.
- **شرارة** (Shirara): "spark", the idea that becomes a product.
- **بعد الإطلاق** (After Launch): the first name, now the tagline.

## Mark
Nawa's ن, unchanged in shape: the same bowl and the same lime dot. The bowl is drawn as 8 sound bars, and the dot pulses with a ring.
- Files: `exports/podcast/logo/nabd-mark.png` (indigo tile), `nabd-mark-ink.png` (ink tile), `nabd-mark-free.png` (no tile, ink bars).
- Smallest size: 24 px. Below 48 px, drop the ring.
- Don't change the bar heights, recolor the dot, or put the mark on a busy photo.

## Colors and type
- Indigo `#5B4BFF`: show background.
- Lime `#C6F432`: the dot, episode numbers, played part of the waveform.
- Ink `#0B1220`: episode covers.
- White: text.
- Each episode carries its topic color as a top band and a chip: product `#5B4BFF`, Agile `#E8674D`, dev `#1E9E6A`, design `#D946A8`, social `#F2A516`, IT `#2F86D1`.
- Type: IBM Plex Sans Arabic Bold for Arabic, Bricolage Grotesque ExtraBold for numbers and Latin.

## Format
- One guest per episode: a founder, product manager, designer or marketer who has built something real.
- 30 to 45 minutes, every two weeks, in Arabic.
- Every episode has chapters and a full written transcript, published on its page on the site.
- Suggested segments:
  - **القصة**: the idea and the launch.
  - **ماذا حدث بعدها**: the numbers and the surprises.
  - **لو بدأنا من جديد**: 3 lessons.
  - **نبض سريع**: 5 quick questions.

## Artwork
`design/templates/podcast.html`, rendered by `node scripts/render-podcast.cjs`:

| File | Size | Use |
|---|---|---|
| `nabd-cover-3000.png` | 3000×3000 | Show cover for Spotify, Apple Podcasts and YouTube |
| `episode-XX-cover-3000.png` | 3000×3000 | Episode cover |
| `episode-XX-story.png` | 1080×1920 | Instagram/Facebook story and TikTok announcement |
| `episode-XX-youtube.png` | 1280×720 | YouTube thumbnail |

To make one episode's set:

```
node scripts/render-podcast.cjs n=2 title="عنوان الحلقة" guest="اسم الضيف" role="صفته" topic=dev
```
