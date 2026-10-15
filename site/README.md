# Nawa landing page

There are two variants, each a complete page in a single file with no build step:

- `index.html` (variant A) presents the studio's two sides: products we launch, and stories we tell.
- `variant-b.html` (variant B) leads with the two client offers: **social media ads** (Meta and
  TikTok) and a **product team** (product owners, designers and developers who dig into your idea
  and build it). It also has engagement models, and a contact box where visitors pick what they
  need, which fills in the email subject.

Both pages share the same brand, base styles and language behavior. To publish variant B as the
home page, rename it to `index.html`. Arabic is the default
(right-to-left). Visitors can switch to English or French with the ع / EN / FR switch. The choice
is remembered, and you can link straight to a language with `#en` or `#fr`.

## Before going live

Edit the `SITE` settings at the top of the script in each page:

- `email`: the contact address (currently `hello@nawa.studio`).
- `mizanUrl`: Mizan's website. The "Visit Mizan" button stays hidden until this is set.
- `socials`: the real profile links, once the handles are confirmed.

All page text lives in the `T` object (`ar`, `en`, `fr`), so wording changes happen there.

## Thmanyah font

The page asks for Thmanyah Sans first. It works for any visitor who has the font installed, and
for everyone once you self-host the font with the site:

1. Copy your Thmanyah Sans files, unchanged, into `site/fonts/`, and set the three `@font-face`
   `url(...)` values in `index.html` to their exact file names. Don't convert or rename the font
   itself, because the license forbids modifying it.
2. Deploy them with the site. Using the font on your own website is allowed. Don't commit the files
   to a public repo, and don't offer them for download. `site/fonts/` is git-ignored for that reason.

Without the font, Arabic falls back to IBM Plex Sans Arabic, and English and French use Inter.

## Hosting

The folder is static, so any static host works (Vercel, Netlify, Cloudflare Pages, GitHub Pages).
Point the `nawa.studio` domain at it.
