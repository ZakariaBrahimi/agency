# Brand Guide

## 1. What we are

An agency that does two things under one roof:

1. **Builds its own SaaS products** (e.g. **Mizan**) and ships them to market.
2. **Designs social media for clients**: posts, covers, campaigns, brand kits.

The brand has to work as a **parent brand**. When we post about our own product we say
"this is ours" and tag the product page. The pattern is **"Mizan — by &lt;Agency&gt;"**.

---

## ✅ Final brand: نواة (Arabic)

Decided: the recommended Arabic brand.

| | |
|---|---|
| Name | **نواة** (Nawa), handle and domain `nawa.studio` |
| Logo | Signature **ن** (white), with its dot in Lime as the "core" |
| Colors | Ink `#0B1220` · Indigo `#5B4BFF` · Lime `#C6F432` · Paper `#F6F5F2` |
| Font | **Thmanyah Sans** (Arabic) · **Bricolage Grotesque** (English and French headlines and big numbers) · **Instrument Sans** (English and French text and UI) |
| Tagline | «نطلق المنتجات الرقمية. ونروي القصص.» |
| Profile photo | Indigo background |

These values live in `brand/brand.json`. The brand is Arabic-only, and every design is right-to-left.

- **Logo:** the signature mark is the letter **ن**. Its dot is drawn in Lime and *is* the "core" (النواة).
- **Tagline:** «نطلق المنتجات الرقمية. ونروي القصص.»
- **Product posts:** they carry the badge «من تطوير نواة» and end with «أحد منتجات نواة».
- **Rules:** never add letter-spacing to Arabic text, since it breaks the joins between letters.
  Use Western digits (12,480) in UI mockups.
- **Font license:** Thmanyah is free for commercial work but may not be redistributed. Keep the files
  out of git (see `fonts/thmanyah/README.md`).

Use the Arabic Brand Picker (`design/templates/brand-picker-ar.html`) to explore the other names,
logos, colors and taglines.

The sections below document the earlier English exploration.

## 2. Name options

| # | Name | Meaning | Feel | Product line-up reads as | Palette direction |
|---|------|---------|------|--------------------------|-------------------|
| **1** | **Nawa** (نواة) | *the core, the seed* — the thing everything grows from | Modern, techy, warm | **Mizan by Nawa** | Ink · Indigo · Lime |
| 2 | **Sanaa** (صنعة) | *craft, making something by hand* | Premium, craft studio | Mizan by Sanaa | Charcoal · Terracotta · Sand |
| 3 | **Zawaya** (زوايا) | *angles / perspectives* | Creative, design-first | Mizan by Zawaya | Black · Coral · Cream |
| 4 | **Bina** (بناء) | *building, construction* | Solid, engineering-first | Mizan by Bina | Navy · Cyan · White |

### ✅ Recommendation: **Nawa**

- **The meaning fits the business model.** A *nawa* is the core that products grow out of,
  and the agency is the core that Mizan (and the next products) grow out of.
- **It works as a parent brand.** "Mizan by Nawa" sounds like one family, because both are short
  Arabic-root words that are easy to say in English and French.
- **It's short.** 4 letters, 2 syllables, and it stays readable as a tiny profile picture.
- **It covers both halves of the business.** *Sanaa* and *Zawaya* lean toward design and *Bina*
  leans toward engineering. *Nawa* fits SaaS and design equally.
- Suggested handles: `@nawa.studio` / `nawastudio` · domain: `nawa.studio`.
  **Check that these are free before you commit** (Instagram, Facebook, LinkedIn, X, domain registrar).
  Fallbacks: `@nawahq`, `@wearenawa`, `nawa.agency`.

Tagline options:
- **"We build products. We design brands."** ← recommended (used on the covers)
- "Where products grow."
- "SaaS & social, from the core."

---

## 3. Logo

Files: [`brand/logo/`](logo/) (SVG marks) and `exports/logo/` (transparent PNGs). All of them are generated from
`brand/brand.json` by `npm run render`. To try other names, logo styles, colors and fonts, use the Brand Picker
(`design/templates/brand-picker.html`).

| File | Use |
|------|-----|
| `brand/logo/mark.svg` | App icon / favicon / small spaces |
| `brand/logo/mark-mono-white.svg`, `mark-mono-dark.svg` | One-color versions |
| `exports/logo/logo-horizontal.png` | Mark + wordmark, on light backgrounds |
| `exports/logo/logo-horizontal-dark.png` | Mark + wordmark, on dark backgrounds |

**Concept:** a single-stroke **N** whose last stroke stops short. In its place is a lime dot,
the *nawa* (the core or seed). The idea is that the line is the product being built and the dot
is where it started.

Rules:
- Keep clear space around the logo equal to the dot's diameter on every side.
- The smallest size for the mark is 24 px. Below that, use the mark without the wordmark.
- Never recolor the dot to anything except Lime, White, or Ink.
- Don't stretch the logo, add shadows, or put it on busy photos without an Ink overlay.

---

## 4. Colors

| Token | Hex | Role |
|-------|-----|------|
| **Ink** | `#0B1220` | Primary dark, backgrounds, text |
| **Indigo** | `#5B4BFF` | Primary brand color, the mark, CTAs |
| **Lime** | `#C6F432` | Accent: the "core" dot, highlights. Use sparingly (≤10% of a design) |
| **Paper** | `#F6F5F2` | Light backgrounds |
| **Slate** | `#64748B` | Secondary text |
| **Indigo Soft** | `#ECEAFF` | Tints, cards on light backgrounds |

Contrast: White on Indigo is 5.4:1 (AA). Ink on Lime is 14:1. Lime on Ink is 14:1.
**Never put Lime text on Paper or white**, because the contrast is too low.

## 5. Typography

- **Headlines:** Inter Display, Bold/ExtraBold, tracking −2 to −3%.
- **Body:** Inter, Regular/Medium.
- **Arabic:** IBM Plex Sans Arabic or Tajawal for Arabic-language posts.

## 6. Voice

Confident, clear, a little playful. We *show* the work and keep adjectives to a minimum.
Write "We shipped Mizan 2.0", not "We're thrilled and excited to announce…".

## 7. Product posts (the "this is ours" pattern)

Every post about our own product:
1. Uses the **product post template** (`design/templates/product-post.html`), which shows a
   "Built by Nawa" badge.
2. Tags the product account. The publisher swaps `{{mention}}` for the right tag on each
   platform (see `config/products.json`).
3. Ends with the line **"A Nawa product."**
