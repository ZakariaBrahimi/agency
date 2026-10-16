"""Soundtrack for the services video (design/templates/services-motion.html).

A soft 120 BPM beat, plus one sound effect per cue. The cues come from the animation itself
(window.SERVICES_MOTION.CUES, saved as JSON by the render script), so sound and picture stay in sync.

Usage: python3 scripts/services-sound.py <cues.json> <out.wav>   (needs numpy)
"""
import json
import sys
import wave

import numpy as np

SR = 44100
spec = json.load(open(sys.argv[1]))
DUR = spec['duration']
N = int(SR * DUR)
rng = np.random.default_rng(11)
music = np.zeros((N, 2))
sfx = np.zeros((N, 2))


def place(buf, sig, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= N:
        return
    sig = sig[: N - i] * gain
    buf[i : i + len(sig), 0] += sig * np.sqrt((1 - pan) / 2)
    buf[i : i + len(sig), 1] += sig * np.sqrt((1 + pan) / 2)


def ta(d):
    return np.arange(int(d * SR)) / SR


def glide(f0, f1, d, total=None):
    """Sine gliding from f0 to f1 over d seconds, then holding f1 until `total`."""
    t = ta(total or d)
    f = f0 * (f1 / f0) ** (np.minimum(t, d) / d)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def dec(d, k, attack=0.002):
    t = ta(d)
    return np.clip(t / attack, 0, 1) * np.exp(-k * t)


def lowpass(x, a):
    """One-pole low-pass; a near 1 = darker."""
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = a * acc + (1 - a) * v
        y[i] = acc
    return y


def bandpass(x, f0, f1, q=2.5):
    n = len(x)
    fc = f0 * (f1 / f0) ** (np.arange(n) / n)
    out = np.zeros(n)
    low = band = 0.0
    for i in range(n):
        f = 2 * np.sin(np.pi * fc[i] / SR)
        high = x[i] - low - band / q
        band += f * high
        low += f * band
        out[i] = band
    return out


def norm(x):
    return x / (np.abs(x).max() + 1e-9)


# ---- Sound effects
PENTA = [523.3, 587.3, 659.3, 784.0, 880.0, 1046.5, 1174.7, 1318.5]  # C major pentatonic, rising


def pop(p):
    f = PENTA[int(p) % len(PENTA)]
    return glide(f * 1.5, f, 0.09, 0.16) * dec(0.16, 30) * 0.8


def click():
    n = int(0.012 * SR)
    c = rng.standard_normal(n) * np.linspace(1, 0, n) ** 2
    return np.concatenate([c, glide(2400, 1600, 0.03) * dec(0.03, 120) * .5]) * 0.9


def tick():
    n = int(0.03 * SR)
    return norm(np.diff(rng.standard_normal(n + 1))) * np.exp(-np.arange(n) / (0.004 * SR)) * 0.35


def whoosh(d=0.45, f0=500, f1=2800):
    n = int(d * SR)
    w = norm(bandpass(rng.standard_normal(n), f0, f1, q=1.4))
    return w * np.sin(np.pi * np.arange(n) / n) ** 2 * 0.45


def swoosh():
    return whoosh(0.32, 3000, 600)


def swish():
    d = 0.6
    n = int(d * SR)
    s = norm(bandpass(rng.standard_normal(n), 800, 3600, q=3)) * np.sin(np.pi * np.arange(n) / n) ** 1.5
    return s * 0.4 + glide(330, 660, d) * np.sin(np.pi * np.arange(n) / n) ** 2 * 0.1


def thump():
    t = glide(160, 50, 0.3) * dec(0.3, 14) * 0.9
    p = pop(0) * 0.25
    t[: len(p)] += p
    return t


def ding():
    t = ta(1.2)
    return sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t / dk)
               for f, a, dk in ((1318.5, 1, .5), (1975.5, .5, .3), (2637, .2, .15))) * np.clip(t / .003, 0, 1) * 0.35


def chime():
    t = ta(2.0)
    return sum(a * np.sin(2 * np.pi * f * t + .6 * np.sin(2 * np.pi * 5.5 * t)) * np.exp(-t / dk)
               for f, a, dk in ((1046.5, 1, 1.3), (1568, .55, .8), (2093, .35, .45))) * np.clip(t / .004, 0, 1) * 0.32


def bubble(p):
    f = 700 + 160 * p
    return glide(f, f * 1.9, 0.07, 0.12) * dec(0.12, 32) * 0.55


def toggle():
    return np.concatenate([click() * .6, np.zeros(int(.03 * SR)), glide(900, 1300, .05, .08) * dec(.08, 50) * .5])


def slide():
    d = 0.75
    return glide(300, 900, d) * np.sin(np.pi * ta(d) / d) ** 2 * 0.12 + whoosh(d, 400, 1600) * 0.4


def rise(p):
    f = PENTA[int(p) % len(PENTA)] / 2
    return glide(f, f * 1.06, 0.18, 0.25) * dec(0.25, 14) * 0.45


SOUNDS = dict(pop=pop, click=click, tick=tick, whoosh=whoosh, swoosh=swoosh, swish=swish, thump=thump,
              ding=ding, chime=chime, bubble=bubble, toggle=toggle, slide=slide, rise=rise)
for at, name, p in spec['cues']:
    sig = SOUNDS[name](p) if name in ('pop', 'bubble', 'rise') else SOUNDS[name]()
    place(sfx, sig, at, pan=float(np.clip(rng.normal(0, .25), -.5, .5)))

# ---- Music: 120 BPM; Am - F - C - G, one chord per bar
BEAT = 0.5
CHORDS = [(220.0, 261.6, 329.6), (174.6, 220.0, 261.6), (130.8, 164.8, 196.0), (196.0, 246.9, 293.7)]
ROOTS = [110.0, 87.3, 65.4, 98.0]
END = DUR - 1.5  # music stops under the logo chime, leaving the outro clean
kick_env = np.zeros(N)
beats = int(END / BEAT)
for b in range(beats):
    at = b * BEAT
    bar = (b // 4) % 4
    kick = glide(130, 42, 0.28) * dec(0.28, 12)
    if at >= 2.7 or b % 2 == 0:  # half-time in the hook, full beat from the first service
        place(music, kick, at, 0.8)
        i = int(at * SR)
        kick_env[i : i + int(.25 * SR)] = np.maximum(kick_env[i : i + int(.25 * SR)], np.exp(-np.arange(min(int(.25 * SR), N - i)) / (.08 * SR)))
    if at >= 2.7:  # hats on the off-beats
        n = int(0.05 * SR)
        hat = norm(np.diff(rng.standard_normal(n + 1))) * np.exp(-np.arange(n) / (0.012 * SR))
        place(music, hat, at + BEAT / 2, 0.12, pan=0.3)
    # bass: root on every beat
    bass = np.sin(2 * np.pi * ROOTS[bar] * ta(BEAT * .9)) * dec(BEAT * .9, 5, .01)
    place(music, bass, at, 0.35)
    if b % 4 == 0:  # pad: a soft chord held for the bar
        d = BEAT * 4
        t = ta(d)
        pad = sum(np.sin(2 * np.pi * f * t) + .25 * np.sin(2 * np.pi * 2.003 * f * t) for f in CHORDS[bar])
        pad *= np.clip(t / .25, 0, 1) * np.clip((d - t) / .3, 0, 1)
        place(music, lowpass(pad, .6), at, 0.06, pan=-.1)
# side-chain: the pad and bass duck under each kick
music *= (1 - 0.45 * kick_env)[:, None]
fade_in = int(.4 * SR)
music[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
i_end = int(END * SR)
music[i_end - int(.6 * SR) : i_end] *= np.linspace(1, 0, int(.6 * SR))[:, None]
music[i_end:] = 0

mix = music * 0.55 + sfx
mix = np.tanh(mix * 1.1)
mix *= 10 ** (-1 / 20) / np.abs(mix).max()
f = int(0.01 * SR)
mix[-f:] *= np.linspace(1, 0, f)[:, None]
with wave.open(sys.argv[2], 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
