"""Soundtrack for the showreel (design/templates/showreel.html).

A 128 BPM beat (kick, clap, hats, sub bass, a minor stab on each cut) that drops after the boot scene
and stops for the end card, plus one sound effect per animation cue. Cues and the music window come
from the page itself (window.SHOWREEL), saved as JSON by the render script.

Usage: python3 scripts/showreel-sound.py <cues.json> <out.wav>   (needs numpy)
"""
import json
import sys
import wave

import numpy as np

SR = 44100
spec = json.load(open(sys.argv[1]))
DUR = spec['duration']
M = spec['music']
N = int(SR * DUR)
rng = np.random.default_rng(5)
music = np.zeros((N, 2))
sfx = np.zeros((N, 2))


def place(buf, sig, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= N or i < 0:
        return
    sig = sig[: N - i] * gain
    buf[i : i + len(sig), 0] += sig * np.sqrt((1 - pan) / 2)
    buf[i : i + len(sig), 1] += sig * np.sqrt((1 + pan) / 2)


def ta(d):
    return np.arange(int(d * SR)) / SR


def glide(f0, f1, d, total=None):
    t = ta(total or d)
    f = f0 * (f1 / f0) ** (np.minimum(t, d) / d)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def dec(d, k, attack=0.002):
    t = ta(d)
    return np.clip(t / attack, 0, 1) * np.exp(-k * t)


def noise(d):
    return rng.standard_normal(int(d * SR))


def hp(x):
    return np.diff(x, prepend=0)


def lp(x, a):
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = a * acc + (1 - a) * v
        y[i] = acc
    return y


def bandpass(x, f0, f1, q=2.0):
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


def fit(a, b):
    """Adds two signals of different lengths."""
    out = np.zeros(max(len(a), len(b)))
    out[: len(a)] += a
    out[: len(b)] += b
    return out


# A minor pentatonic for anything pitched
SCALE = [440.0, 523.3, 587.3, 659.3, 784.0, 880.0, 1046.5, 1174.7]

FX = {
    'tick': lambda p: norm(hp(noise(.02))) * np.exp(-np.arange(int(.02 * SR)) / (.003 * SR)) * .3,
    'click': lambda p: fit(norm(hp(noise(.01))) * np.linspace(1, 0, int(.01 * SR)) ** 2 * .6, glide(2600, 1800, .025) * dec(.025, 150) * .4),
    'pop': lambda p: glide(SCALE[int(p) % 8] * 1.5, SCALE[int(p) % 8], .08, .15) * dec(.15, 32) * .7,
    'pluck': lambda p: (np.sin(2 * np.pi * SCALE[int(p) % 8] * ta(.4)) + .3 * np.sin(4 * np.pi * SCALE[int(p) % 8] * ta(.4))) * dec(.4, 12) * .4,
    'whoosh': lambda p: norm(bandpass(noise(.5), 400, 3200, 1.4)) * np.sin(np.pi * np.arange(int(.5 * SR)) / int(.5 * SR)) ** 2 * .45,
    'swish': lambda p: norm(bandpass(noise(.28), 3500, 700, 2.5)) * np.sin(np.pi * np.arange(int(.28 * SR)) / int(.28 * SR)) * .4,
    'hit': lambda p: fit(glide(180, 60, .18) * dec(.18, 20) * .8, norm(hp(noise(.06))) * dec(.06, 60) * .35),
    'impact': lambda p: fit(fit(glide(120, 38, .5) * dec(.5, 7) * 1.0, norm(lp(noise(.4), .7)) * dec(.4, 12) * .5), norm(hp(noise(.03))) * dec(.03, 90) * .4),
    'pulse': lambda p: glide(90, 55, .25) * dec(.25, 14) * .6,
    'bass': lambda p: (glide(70, 45, .4) * dec(.4, 7) + .25 * np.sin(2 * np.pi * 140 * ta(.4)) * dec(.4, 12)) * .7,
    'ding': lambda p: sum(a * np.sin(2 * np.pi * f * ta(1.0)) * np.exp(-ta(1.0) / k) for f, a, k in ((1318.5, 1, .45), (1975.5, .5, .25))) * .3,
    'riser': lambda p: (norm(bandpass(noise(1.4), 300, 6000, 2)) * .5 + glide(220, 880, 1.4) * .25) * np.linspace(0, 1, int(1.4 * SR)) ** 2.5 * .7,
    'boom': lambda p: fit(glide(100, 30, 1.6) * dec(1.6, 2.6), norm(lp(noise(1.2), .9)) * dec(1.2, 4) * .5) * .95,
    'chime': lambda p: sum(a * np.sin(2 * np.pi * f * ta(2.2) + .5 * np.sin(2 * np.pi * 5 * ta(2.2))) * np.exp(-ta(2.2) / k)
                           for f, a, k in ((1046.5, 1, 1.4), (1568, .55, .9), (2093, .3, .5))) * np.clip(ta(2.2) / .004, 0, 1) * .3,
}
for at, name, p in spec['cues']:
    place(sfx, FX[name](p), at, pan=float(np.clip(rng.normal(0, .2), -.4, .4)))

# ---- Beat
BEAT = 60 / M['bpm']
start, end = M['start'], M['end']
ROOTS = [55.0, 43.65, 65.4, 49.0]          # A1 F1 C2 G1
STABS = [(220, 261.6, 329.6), (174.6, 220, 261.6), (261.6, 329.6, 392), (196, 246.9, 293.7)]
kick_env = np.zeros(N)
b = 0
while start + b * BEAT < end - 1e-6:
    at = start + b * BEAT
    bar = (b // 4) % 4
    place(music, glide(150, 45, .3) * dec(.3, 11), at, .9)
    i = int(at * SR)
    n = min(int(.3 * SR), N - i)
    kick_env[i : i + n] = np.maximum(kick_env[i : i + n], np.exp(-np.arange(n) / (.09 * SR)))
    if b % 2 == 1:  # clap on 2 and 4
        place(music, norm(bandpass(noise(.15), 1200, 1000, 1.2)) * dec(.15, 26), at, .32, pan=.1)
    for h in (0.25, 0.5, 0.75):  # hats
        place(music, norm(hp(hp(noise(.04)))) * dec(.04, 90), at + h * BEAT, .1 if h == .5 else .05, pan=-.25)
    sub = np.sin(2 * np.pi * ROOTS[bar] * ta(BEAT * .95)) * dec(BEAT * .95, 3, .005)
    place(music, sub, at + BEAT * .5, .45)  # off-beat sub
    b += 1
# A short minor stab on every cut while the beat runs
cuts = sorted({round(start + k * BEAT * 3, 3) for k in range(int((end - start) / (BEAT * 3)) + 1)})
for k, at in enumerate(cuts):
    if at >= end:
        continue
    chord = STABS[(k // 2) % 4]
    st = sum(np.sign(np.sin(2 * np.pi * f * ta(.35))) * .3 + np.sin(2 * np.pi * f * 2 * ta(.35)) for f in chord)
    place(music, lp(st, .82) * dec(.35, 9), at, .09, pan=.15)

music *= (1 - .5 * kick_env)[:, None]
i_end = int(end * SR)
music[i_end:] = 0

mix = np.tanh((music * .6 + sfx) * 1.15)
mix *= 10 ** (-1 / 20) / np.abs(mix).max()
f = int(.01 * SR)
mix[:f] *= np.linspace(0, 1, f)[:, None]
mix[-int(.4 * SR):] *= np.linspace(1, 0, int(.4 * SR))[:, None]
with wave.open(sys.argv[2], 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
