# Nawa website

A static site with no build step, deployed on Vercel (project `nawa-studio`, root directory `site/`).
Every push to the production branch redeploys it automatically.

Live: https://nawa-studio-six.vercel.app (Arabic) · `/en` · `/fr`

```
site/
  index.html            the landing page (the six-step journey)
  assets/css/styles.css all styles, including the motion
  assets/js/i18n.js     all page text: ar (default), en, fr
  assets/js/main.js     language switch, contact chooser, scroll and hero animations
  assets/img/           favicon, apple-touch icon, og.png (share image)
  404.html              not-found page
  vercel.json           clean URLs, /en and /fr routes, cache and security headers
  robots.txt, sitemap.xml
  variant-a.html        the earlier "two sides" version, kept for reference
```

## Languages

Arabic is the default at `/`. Visitors switch with the ع / EN / FR control, and the address
changes to `/en` or `/fr`, which you can share directly. On `/`, a visitor's last choice is
remembered. Opened as a local file, the same switch uses `#en` / `#fr`.

To change any wording, edit `assets/js/i18n.js`. Each key exists in `ar`, `en` and `fr`.

## Motion

- On load, the hero text rises in and the six steps of the cycle pop in one after another. The
  steps then light up in turn, pausing while the pointer is over the cycle.
- On scroll, sections slide in, the report bars and progress bars grow, the ad sparkline and the
  idea-to-launch timeline draw themselves, and the sprint tasks tick in.
- Visitors who ask their device to reduce motion get the static page, and so does any browser
  without IntersectionObserver. Nothing is hidden for them.

## Before going live

- `assets/js/main.js` → `SITE`: the real contact email (currently `hello@nawa.studio`) and the
  social profile links.
- **Custom domain:** add `nawa.studio` in Vercel (Project → Settings → Domains), then replace
  `https://nawa-studio-six.vercel.app` in `index.html`, `robots.txt` and `sitemap.xml`.
- **Share image:** `assets/img/og.png` is rendered from the brand with
  `node scripts/render.cjs og` from the repo root.

## Thmanyah font

The page asks for Thmanyah Sans first, and visitors who have it installed see it. To serve it to
everyone, copy the original font files, unchanged, into `site/assets/fonts/`. Then add
`url("../fonts/<exact file name>")` after `local(...)` in the three `@font-face` rules at the top
of `assets/css/styles.css`. The license allows using the font on your own site, but not
modifying or redistributing it. `site/assets/fonts/` is git-ignored, so the files never land in
the repo; upload them through your own deploy (for example `vercel deploy` from your machine).
Without them, Arabic falls back to IBM Plex Sans Arabic, and English and French use Inter.
