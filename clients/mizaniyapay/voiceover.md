# Mizaniya Pay hero reel: voice-over

The hero reel (`design/hero.html`) has three versions, all in `exports/hero/`:

| Version | File | Length |
| --- | --- | --- |
| No voice-over (music, sound effects, Darija on-screen text) | `hero-no-voiceover.mp4` | 20 s |
| Darija voice-over (Darija on-screen text) | `hero-voiceover-darija.mp4` | 21.2 s |
| Arabic voice-over (Modern Standard Arabic on-screen text) | `hero-voiceover-arabic.mp4` | 21.2 s |

The voice versions hold the end card 1.2 s longer so the last line can finish.

## Current voices (text-to-speech)

Generated with Microsoft neural voices through `edge-tts`, 22% faster and slightly higher pitch for
energy, silence trimmed and lightly compressed:

- Darija: `ar-DZ-IsmaelNeural` (Algerian Arabic, male)
- Arabic: `ar-SA-HamedNeural` (Modern Standard Arabic, male)

A text-to-speech voice reads Darija closer to standard Arabic than a native speaker would. For the final
Darija version, a real voice actor reading the lines below is still the better choice.

## Lines

Files: `design/vo/<lang>-<n>.mp3`. Each line starts at the beginning of its scene and the music ducks
under it. To replace the voices (for example with a voice actor), drop new files in with the same names
and run `node clients/mizaniyapay/render.cjs hero-voiceover`.

| # | Starts at | Max length | Darija (`dz-n`) | Arabic (`ar-n`) |
| --- | --- | --- | --- | --- |
| 1 | 0:00.3 | 2.7 s | مازال تحبس في الصف؟ | هل ما زلت تنتظر في الطابور؟ |
| 2 | 0:03.4 | 2.6 s | ابعث الدراهم في ثانية! | أرسل أموالك في ثانية! |
| 3 | 0:06.4 | 2.6 s | سكاني الكيو آر، وخلّص! | امسح الرمز، وادفع فوراً! |
| 4 | 0:09.4 | 2.6 s | شارجي التيليفون والانترنت! | اشحن هاتفك وأنترنتك! |
| 5 | 0:12.3 | 2.8 s | الفواتير؟ خلّصهم من دارك! | فواتيرك؟ ادفعها من بيتك! |
| 6 | 0:15.6 | 5.4 s | ميزانية باي! كلش في تطبيق واحد. حمّلو دركا! | ميزانية باي! كل شيء في تطبيق واحد. حمّله الآن! |

**Delivery for a voice actor:** energetic, warm, smiling, like a young presenter on a sports or tech
channel. Fast but clear. Punch the last word of each line.

To regenerate the text-to-speech lines, this environment needs `speech.platform.bing.com` in its allowed
network hosts.
