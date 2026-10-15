"""Synthesizes the sound for the logo animation (design/templates/logo-motion.html).

Every cue sits on the animation's timeline, so the sound and picture stay in sync:
  0.15-0.55 whoosh as the dot falls     0.55 thump as it lands, 0.85 / 1.05 bounces
  0.55-1.05 low swell as the badge blooms   1.05-1.65 swish as the ن writes itself
  1.70 chime on the core                    2.50 warm chord under the name

Usage: python3 scripts/logo-sound.py <out.wav>   (needs numpy)
"""
import sys
import wave

import numpy as np

SR = 44100
DUR = 5.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
mix = np.zeros((N, 2))


def place(sig, at, gain=1.0, pan=0.0):
    """Adds a mono signal at `at` seconds, panned -1 (left) to 1 (right)."""
    i = int(at * SR)
    sig = sig[: N - i] * gain
    mix[i : i + len(sig), 0] += sig * np.sqrt((1 - pan) / 2)
    mix[i : i + len(sig), 1] += sig * np.sqrt((1 + pan) / 2)


def t_axis(d):
    return np.arange(int(d * SR)) / SR


def sweep(f0, f1, d, curve='exp'):
    """Sine whose pitch glides from f0 to f1 over d seconds."""
    t = t_axis(d)
    f = f0 * (f1 / f0) ** (t / d) if curve == 'exp' else f0 + (f1 - f0) * t / d
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def bandpass(x, f0, f1, q=2.5):
    """State-variable band-pass filter whose centre moves from f0 to f1."""
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


def env(d, attack, release=None, shape=4.0):
    """Attack ramp, then exponential decay (or a fade over `release`)."""
    t = t_axis(d)
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    if release is None:
        return a * np.exp(-shape * np.clip(t - attack, 0, None) / max(d - attack, 1e-4))
    r = np.clip((d - t) / release, 0, 1)
    return a * r


# Whoosh: filtered noise falling in pitch as the dot drops, getting louder
d = 0.42
w = bandpass(rng.standard_normal(int(d * SR)), 2600, 500, q=1.6)
w *= np.linspace(0, 1, len(w)) ** 2
place(w / np.abs(w).max(), 0.14, 0.34, pan=-0.2)

# Landing: a pitched-down thump, a soft pop and a tiny click
def drop(at, gain, pop_hz):
    th = sweep(150, 48, 0.32) * env(0.32, 0.002, shape=7)
    pop = sweep(pop_hz * 1.25, pop_hz, 0.12) * env(0.12, 0.001, shape=9)
    click = rng.standard_normal(int(0.006 * SR)) * np.linspace(1, 0, int(0.006 * SR))
    place(th, at, gain)
    place(pop, at, gain * 0.55)
    place(click, at, gain * 0.25)


drop(0.55, 0.95, 520)
drop(0.85, 0.42, 700)
drop(1.05, 0.22, 860)

# Bloom: a low swell as the indigo badge opens
d = 0.9
t = t_axis(d)
swell = (np.sin(2 * np.pi * 98 * t) + 0.5 * np.sin(2 * np.pi * 147 * t)) * np.sin(np.pi * t / d) ** 2
place(swell, 0.55, 0.22)

# Swish: the pen stroke of the ن, moving right to left across the stereo field
d = 0.62
n = int(d * SR)
s = bandpass(rng.standard_normal(n), 700, 3600, q=3.0)
s = s / np.abs(s).max() * np.sin(np.pi * np.arange(n) / n) ** 1.5
tone = sweep(330, 660, d) * np.sin(np.pi * np.arange(n) / n) ** 2
for k, pan in ((0, 0.6), (1, -0.6)):
    half = slice(k * n // 2, (k + 1) * n // 2)
    seg = np.zeros(n)
    seg[half] = (s + 0.25 * tone)[half]
    place(seg, 1.05, 0.42, pan=pan)

# Chime: the core lights up (C6 + G6 + C7, bell-like decays, a little shimmer)
d = 2.6
t = t_axis(d)
chime = np.zeros(len(t))
for f, a, decay in ((1046.5, 1.0, 1.7), (1568.0, 0.55, 1.1), (2093.0, 0.35, 0.6), (3136.0, 0.12, 0.3)):
    chime += a * np.sin(2 * np.pi * f * t + 0.6 * np.sin(2 * np.pi * 5.5 * t)) * np.exp(-t / decay)
chime *= np.clip(t / 0.004, 0, 1)
place(chime, 1.70, 0.30, pan=0.15)
place(chime, 1.78, 0.10, pan=-0.35)  # a soft echo

# Pad: a warm C-major chord under the name, fading out by the end
d = DUR - 2.5
t = t_axis(d)
pad = sum(a * (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t))
          for f, a in ((130.8, 0.9), (261.6, 0.6), (329.6, 0.45), (392.0, 0.4)))
pad *= env(d, 0.5, release=1.6)
place(pad, 2.5, 0.10)

# Master: soft-clip, normalise to -1 dBFS, short fade at both ends
mix = np.tanh(mix * 1.2)
mix *= 10 ** (-1 / 20) / np.abs(mix).max()
fade = int(0.01 * SR)
mix[:fade] *= np.linspace(0, 1, fade)[:, None]
mix[-fade:] *= np.linspace(1, 0, fade)[:, None]

with wave.open(sys.argv[1] if len(sys.argv) > 1 else 'logo-sound.wav', 'wb') as f:
    f.setnchannels(2)
    f.setsampwidth(2)
    f.setframerate(SR)
    f.writeframes((mix * 32767).astype('<i2').tobytes())
