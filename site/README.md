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

## Project brief form (`/start`) and requests dashboard (`/admin`)

```
start.html, assets/js/start.js, assets/css/start.css   the form clients fill in
assets/js/brief-schema.js     every service, question and option (ar/en/fr): edit this to change the form
api/brief.js                  saves a brief to Supabase and sends a Telegram notification
admin.html, assets/js/admin.js, assets/css/admin.css   your private dashboard
api/admin/*.js                sign-in, list/update briefs, Telegram setup (admin only)
```

**How it works:**
1. The client picks services. Follow-up questions appear only for those services.
2. They fill in the project and contact details, watching the "your request" preview update as they go.
3. When they submit, `/api/brief` validates the brief with the same rules as the form and saves it to the
   Supabase project **nawa** (table `briefs`). It then sends you a Telegram message with a summary and a link.
4. On `/admin` you sign in with your password, read each brief, change its status, add private notes, and
   reply on WhatsApp or by email in one tap.

**Currency:** budgets default to Algerian dinars (DZD). A دج / $ / € switch next to each budget question
changes both budget questions together. Each currency has its own round ranges, set in `TIERS` in
`brief-schema.js`. Clients can also pick «مبلغ آخر» and type an exact amount (stored as `custom:<digits>`;
Arabic-Indic digits are accepted). Ranges live in
`brief-schema.js`, and the chosen currency is saved with the request and shown in Telegram and `/admin`.

**Spam protection:** a hidden honeypot field, a minimum time on the form, a per-IP rate limit, and
server-side validation of every field.

**Database security:** the website's public key can only insert new briefs. Reading and updating
requires the service key, which is used only by the `/api/admin/*` functions after you sign in.

### Settings (Vercel → nawa-studio → Settings → Environment Variables)

| Variable | Set by | What it is |
|---|---|---|
| `SUPABASE_URL` | already set | The Supabase project address |
| `SUPABASE_PUBLISHABLE_KEY` | already set | Public key that can only add new briefs |
| `SITE_URL` | already set | Used for the link in Telegram messages |
| `ADMIN_PASSWORD` | **you** | Password for `/admin` (long and unique) |
| `SUPABASE_SERVICE_ROLE_KEY` | **you** | Supabase → nawa → Project Settings → API Keys → `service_role` / secret key. Lets `/admin` read briefs |
| `TELEGRAM_BOT_TOKEN` | **you** | From @BotFather (`/newbot`) |
| `TELEGRAM_CHAT_ID` | **you** | Your chat with the bot. `/admin` → "إشعارات تيليغرام" shows it after you message the bot |

Mark the last four as **Sensitive**. Redeploy after changing any of them (Deployments → ⋯ → Redeploy).

To test locally with a fake database: `node scripts/dev-site.mjs` from the repo root, with the variables above exported.

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
