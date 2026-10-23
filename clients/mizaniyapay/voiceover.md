# Mizaniya Pay hero reel: voice-over

The hero reel (`design/hero.html`, 20 s) has three versions:

| Version | File | Status |
| --- | --- | --- |
| No voice-over (music, sound effects, Darija on-screen text) | `exports/hero/hero-no-voiceover.mp4` | Ready |
| Darija voice-over (Darija on-screen text) | `exports/hero/hero-voiceover-darija.mp4` | Needs the 6 Darija voice files |
| Arabic voice-over (Modern Standard Arabic on-screen text) | `exports/hero/hero-voiceover-arabic.mp4` | Needs the 6 Arabic voice files |

Put the voice files in `design/vo/` with these names, then run
`node clients/mizaniyapay/render.cjs hero`. Each line is placed at the start of its scene and the
music ducks under the voice automatically.

**Delivery:** energetic, warm, smiling, like a young presenter on a sports or tech channel. Fast but clear.
Punch the last word of each line. Same voice for all 6 lines of a language.

## Darija (`design/vo/dz-1.mp3` … `dz-6.mp3`)

| # | Starts at | Max length | Line |
| --- | --- | --- | --- |
| 1 | 0:00.25 | 2.7 s | مازال تحبس في الصف؟ |
| 2 | 0:03.35 | 2.6 s | مع ميزانية باي، ابعث الدراهم في ثانية! |
| 3 | 0:06.35 | 2.6 s | سكاني الكيو آر… وخلّص! |
| 4 | 0:09.35 | 2.6 s | شارجي التيليفون والانترنت، وقتما تحب! |
| 5 | 0:12.35 | 2.7 s | والفواتير؟ خلّصهم من دارك! |
| 6 | 0:15.6 | 4.0 s | ميزانية باي… كلش في تطبيق واحد. حمّلو دركا! |

## Modern Standard Arabic (`design/vo/ar-1.mp3` … `ar-6.mp3`)

| # | Starts at | Max length | Line |
| --- | --- | --- | --- |
| 1 | 0:00.25 | 2.7 s | هل ما زلت تنتظر في الطابور؟ |
| 2 | 0:03.35 | 2.6 s | مع ميزانية باي، أرسل أموالك في ثانية! |
| 3 | 0:06.35 | 2.6 s | امسح رمز الكيو آر… وادفع فوراً! |
| 4 | 0:09.35 | 2.6 s | اشحن هاتفك وأنترنتك، متى شئت! |
| 5 | 0:12.35 | 2.7 s | وفواتيرك؟ ادفعها من بيتك! |
| 6 | 0:15.6 | 4.0 s | ميزانية باي… كل شيء في تطبيق واحد. حمّله الآن! |

"ميزانية باي" is written in Arabic letters so a text-to-speech voice says the brand name correctly.

## Ways to get the voice files

1. **A real voice actor (best for Darija).** Send them this page; ask for one dry WAV or MP3 per line,
   no music, 44.1 kHz.
2. **Higgsfield (connected to this workspace).** Its ElevenLabs voices speak Arabic; about 0.6 credits per
   take (checked 23 Oct 2026). The account currently has 0 credits. Once topped up, Claude can generate
   all 12 lines and render both versions.
3. **Free Microsoft neural voices**, including Algerian Arabic voices (ar-DZ Ismael and Amina) and Arabic
   voices (ar-SA Hamed). They need `speech.platform.bing.com` added to this environment's allowed network
   hosts; then Claude can generate the lines with `edge-tts`.

Text-to-speech Darija will sound closer to standard Arabic than a native speaker; a human voice is the
safer choice for the Darija version.
