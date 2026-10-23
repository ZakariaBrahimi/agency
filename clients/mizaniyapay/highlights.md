# Mizaniya Pay: Instagram highlights

Eight highlights, in this order on the profile. Names are short (Instagram cuts them at about 15
characters) and mix Darija and English like the posts. Covers are in `exports/highlights/covers/`
(1080×1920, the icon sits in the middle so Instagram's circle crop keeps it).

| # | Highlight name | Cover | What goes in it | Ready-made content to reuse |
| --- | --- | --- | --- | --- |
| 1 | ابدأ هنا | `start.png` (lightning) | What the app is, how to open an account, saving a card, merchants, download link | **Done:** `exports/highlights/start/story-1…6.png` |
| 2 | QR | `qr.png` | Scan to pay, scan to send, how a shop's QR works | Week 1 QR reel, app carousel slide 3 |
| 3 | فليكسي | `recharge.png` (phone) | Mobile recharge and internet top-up how-tos | Week 1 recharge reel, week 3 internet reel |
| 4 | الفواتير | `bills.png` | How to pay bills, which bills are supported | App carousel slide 5, the queue reel (week 2) |
| 5 | Partners | `partners.png` (shop) | For merchants: Virtual TPE, the 4 steps, dashboard, shop-owner stories | Shop carousel (week 1), partner reel (week 2), shop-owner video (week 3) |
| 6 | الأمان | `safety.png` (shield) | Safety tips and myth vs fact | Safety carousel (week 2), tips carousel (week 3) |
| 7 | FAQ | `faq.png` (?) | Answers to the questions people ask in comments and messages | Collect from the story question boxes each week |
| 8 | Offers | `offers.png` (%) | Current promotions and cashback; remove expired ones | Add when MizaniyaPay runs an offer |

To add a carousel to a highlight, share its slides as stories one by one (or the post itself as a story),
then add each story to the highlight.

## "ابدأ هنا" stories (post these 6 in order)

| # | File | Content | Link sticker |
| --- | --- | --- | --- |
| 1 | `story-1.png` | Welcome: logo, «مرحبا بيك في Mizaniya Pay» | — |
| 2 | `story-2.png` | What it does: send, request, scan, recharge, internet, bills | — |
| 3 | `story-3.png` | Open your account in 4 steps | — |
| 4 | `story-4.png` | Save your CIB or Edahabia card once | — |
| 5 | `story-5.png` | Own a shop? QR payments, no hardware, live in under 24h | Put a link sticker over the dashed box: `https://partner.mizaniyapay.dz/sign-up` |
| 6 | `story-6.png` | Download the app | Put a link sticker over the dashed box: the Google Play or App Store link (or a link page with both) |

The dashed boxes mark where the link sticker goes; the sticker covers them. Post all 6, then add them
to a new highlight named «ابدأ هنا» with `covers/start.png` as its cover.

Keep text and buttons between 260 px from the top and 330 px from the bottom: Instagram puts its own
bars and reply box there. Re-render with `node clients/mizaniyapay/render.cjs highlights`.

## To confirm with MizaniyaPay

- The 4 sign-up steps on story 3 (same as the week 2 reel).
