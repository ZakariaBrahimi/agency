# Thmanyah font (خط ثمانية)

All designs use **Thmanyah Sans** (and optionally **Thmanyah Serif Display**).

The font is free for personal and commercial use, but its license does not allow redistributing
or hosting the files. That's why the files are **not committed** and this folder is git-ignored.

1. Download the font from Thmanyah's official page. You enter your email and the files arrive by email.
2. Put the font files (`.otf`, `.ttf`, `.woff` or `.woff2`) in this folder. Subfolders are fine.
3. Run `npm run render`. The script finds the files, tells you which ones it picked up, and
   renders every design with them.

If you install the font on your computer instead, renders and the Brand Picker use it automatically.
Without the font, designs fall back to IBM Plex Sans Arabic, and `npm run render` prints a warning.
