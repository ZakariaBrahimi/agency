# Nawa: brand, social designs, and auto-publishing

**Nawa** (نواة, "the core") is a studio that builds its own SaaS products (like **Mizan**) and
designs social media for clients. This repo holds the brand, the design templates, and a
publisher that posts to social media on a schedule.

```
brand/BRAND.md          name options + recommendation, colors, type, voice, logo rules
brand/brand.json        THE chosen brand (name, palette, font, logo style, tagline); every design reads it
brand/logo/*.svg        logo marks, generated from brand.json
design/templates/brand-picker-ar.html  Arabic picker (RTL, Thmanyah font): the active direction
design/templates/brand-picker.html     earlier English picker
fonts/thmanyah/         put your own copy of the Thmanyah font here (git-ignored, see its README)
design/templates/*.html designs as HTML (edit text/colors here, then re-render)
exports/                ready-to-upload PNGs (profile photos, covers, posts, logos)
content/queue.json      the content calendar the publisher reads
config/products.json    our products + their handles on each platform (for tagging)
publisher/              auto-publisher (Facebook, Instagram, LinkedIn, X); Node 20+, no dependencies
.github/workflows/      runs the publisher every hour
```

## Ready-to-upload files

| Where | File | Size |
|-------|------|------|
| Profile photo (all platforms) | `exports/profile/profile-primary.png` (or `-dark`) | 1080×1080 |
| Facebook Page cover | `exports/covers/facebook-cover.png` | 1640×624 |
| LinkedIn Page cover | `exports/covers/linkedin-cover.png` | 1584×396 |
| X header | `exports/covers/x-header.png` | 1500×500 |
| YouTube banner | `exports/covers/youtube-banner.png` | 2560×1440 |
| First post: Mizan intro | `exports/posts/mizan-intro.png` | 1080×1350 |
| Logo (transparent PNG) | `exports/logo/` | — |

Upload the profile photos and covers once, by hand. The platforms don't let a Page's profile or
cover image be changed reliably through their APIs.

## Choosing or changing the brand

The brand is **Arabic-only** (`"lang": "ar"` in `brand/brand.json`). All designs are right-to-left with
Arabic copy, and they use the **Thmanyah** font (خط ثمانية).

**Thmanyah font:** its license forbids redistributing the files, so they are not in this repo. Download
the font from Thmanyah's official page and put the files in `fonts/thmanyah/`, or install them on your
computer. Without them, renders fall back to IBM Plex Sans Arabic and `npm run render` prints a warning.

Open the **Arabic Brand Picker** (`design/templates/brand-picker-ar.html`, also published as an artifact).
There are 8 Arabic names (or type your own), 5 logo styles, 6 palettes (or custom colors), Thmanyah Sans or
Thmanyah Serif, and 4 taglines (or your own).
Save the combinations you like to the shortlist and mark one as final, or use **Copy settings** and paste the
result into `brand/brand.json`. Then run `npm run render` and every logo, cover, profile photo and post is
redrawn with that brand.

## Editing designs

```bash
npm install            # installs Playwright (headless Chromium) for rendering
npm run render         # re-renders everything into exports/
npm run render cover   # only jobs whose name contains "cover"
```

To post about a different product, copy the `posts/mizan-intro` job in `scripts/render.cjs` and
pass query parameters to the template:
`product-post.html?product=Mizan&tagline=...&handle=@mizan&kicker=New%20feature`.

## Auto-publishing

1. Add a post to `content/queue.json`:
   ```json
   {
     "id": "2026-11-03-mizan-invoices",
     "status": "scheduled",
     "publish_at": "2026-11-03T10:00:00+01:00",
     "platforms": ["facebook", "instagram", "linkedin", "x"],
     "image": "exports/posts/mizan-invoices.png",
     "alt": "Describe the image for screen readers",
     "mention": "mizan",
     "caption": "Invoices just got easier in {{mention}}. A Nawa product.",
     "captions": { "x": "Optional shorter caption for X (280 chars max)" }
   }
   ```
   `{{mention}}` becomes the right tag on each platform: `@[pageid]` on Facebook, `@handle` on
   Instagram (which also photo-tags the account), a company mention on LinkedIn, and `@handle` on X.
   Fill in the handles and ids in `config/products.json`.
2. Commit and push. The **Publish social posts** workflow runs every hour, posts anything that is due,
   and commits the post ids back to the queue. Each platform is tracked separately: if one fails,
   it is retried on the next run (up to 3 attempts), and the platforms that already succeeded are
   never posted twice.
3. To post one item right away, go to **Actions → Publish social posts → Run workflow** and enter the post id.
   This also works for `draft` posts. Tick *Dry run* to preview the captions first.

Locally: `node --env-file=.env publisher/publish.mjs --dry-run`.

### Credentials (GitHub → Settings → Secrets and variables → Actions)

| Platform | Secrets | Variables | How to get them |
|----------|---------|-----------|-----------------|
| Facebook | `FB_PAGE_ACCESS_TOKEN` | `FB_PAGE_ID` | Create a Meta app (Business type) and add the *Facebook Login for Business* product. Grant `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`, then exchange for a **long-lived Page token**. |
| Instagram | (same Page token) | `IG_USER_ID`, `PUBLIC_ASSET_BASE_URL` | The IG account must be a Business/Creator account linked to the Page. Add the `instagram_basic` and `instagram_content_publish` permissions. Get `IG_USER_ID` from `GET /{page-id}?fields=instagram_business_account`. |
| LinkedIn | `LINKEDIN_ACCESS_TOKEN` | `LINKEDIN_ORG_ID` | Create a LinkedIn app, request the *Community Management API*, and use OAuth with the `w_organization_social` scope as a Page admin. The org id is the number in your company admin URL. Tokens last 60 days, so refresh them. |
| X | `X_ACCESS_TOKEN` | — | Create an X developer app and use the OAuth 2.0 user flow with the `tweet.read tweet.write users.read media.write offline.access` scopes. The free tier has very low posting limits. |

**Instagram needs a public image URL.** Instagram downloads the image itself, so
`PUBLIC_ASSET_BASE_URL` must serve this repo's files publicly. Options:
- If the repo is public: `https://raw.githubusercontent.com/<owner>/<repo>/main`
- GitHub Pages (`https://<owner>.github.io/<repo>`). For a private repo this requires a paid plan.
- Any CDN or bucket (Cloudflare R2, S3, Supabase Storage) that you sync `exports/` to.

Platforms that have no credentials set are skipped with a notice. Nothing fails, so you can
connect platforms one at a time.

## Logo animation

`design/templates/logo-motion.html` animates the mark on one seekable timeline, and
`scripts/logo-sound.py` synthesizes the matching sound effects. The rendered videos (with sound) are in
`exports/motion/`: `logo-square.mp4` (1080×1080) and `logo-vertical.mp4` (1080×1920, stories and reels).

## Services video

`design/templates/services-motion.html` is a 28-second vertical reel (1080×1920) that walks through the six
services with animated UI components. `scripts/services-sound.py` builds its soundtrack (a 120 BPM beat plus
one effect per animation cue). Output: `exports/motion/services-vertical.mp4`.
To change wording, numbers or timing, edit the HTML; the sound cues live next to the keyframes, so they follow.

## Showreel

`design/templates/showreel.html` draws a 19-second vertical showreel on one canvas (13 scenes cut on a
128 BPM beat, English and Arabic). `scripts/showreel-sound.py` builds the beat and the sound effects from
the cues the page exports. Output: `exports/motion/showreel-vertical.mp4`.
