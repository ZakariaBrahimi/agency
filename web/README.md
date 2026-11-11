# Nawa web app (Next.js + React + Tailwind + shadcn/ui)

The client portal (`/portal`) is built here. The server stays in `site/api` (Vercel functions); this app only
builds the screens, as static pages.

- `npm run dev`: develop (point API calls at a running `scripts/dev-site.mjs`, or open the built page there)
- `npm run export`: build (`out/`) and copy `portal.html` and `_next/` into `../site`, which Vercel serves

Languages: Arabic (default), English and French, in `src/i18n/` (`portal.ts`, `content.ts`). Every label
on screen comes from these files; the shared rules (platforms, limits, statuses) come from
`../site/assets/js/*-schema.js`, the same files the API uses.
