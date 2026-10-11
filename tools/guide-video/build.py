"""Build the home page's bin-guide videos from the captured frames.

    python tools/guide-video/vo.py                    # narration (once, or after changing a line)
    node tools/guide-video/capture.mjs                # frames            (dev server running on :5199)
    python tools/guide-video/build.py                 # frames + narration + music + sound effects
                                                      #   → public/video/bin-guide-<lang>.mp4, .jpg (poster), .vtt (captions)
                                                      #   → src/game/binGuide.json (length and chapter times for the player)
Options: ta            one language (default: en ta)
         --frames DIR  where capture.mjs put the frames (default: tools/guide-video/work)
         --audio       only the soundtrack (work/<lang>/soundtrack.wav), to listen to the mix

The music and the sound effects are generated here, so nothing has to be licensed.
Needs numpy and ffmpeg (imageio-ffmpeg's binary, or ffmpeg on PATH).
"""
import json
import os
import re
import subprocess
import sys
import wave

import numpy as np

from common import FF, HERE, ROOT, SR, WORK, cues, speech_span

OUT = os.path.join(ROOT, 'public', 'video')
META = os.path.join(ROOT, 'src', 'game', 'binGuide.json')
TAU = 2 * np.pi


def run(args, **kw):
    return subprocess.run([FF, '-hide_banner', '-loglevel', 'error', '-y', *args], check=True, **kw)


def pcm(path):
    r = subprocess.run([FF, '-hide_banner', '-loglevel', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32).astype(np.float64)


def level(x, target):
    """Scale speech so its voiced RMS is `target`."""
    v = x[np.abs(x) > 0.02]
    return x * (target / np.sqrt(np.mean(v ** 2))) if len(v) else x


# ── generated sound ─────────────────────────────────────────────────────────
def tone(freq, seconds, decay, partials=((1, 1.0),)):
    t = np.arange(int(seconds * SR)) / SR
    x = sum(a * np.sin(TAU * freq * k * t) * np.exp(-t / (decay / k ** 0.6)) for k, a in partials)
    return x * (1 - np.exp(-t / 0.004))


def effects():
    t = np.arange(int(0.13 * SR)) / SR
    pop = np.sin(TAU * np.cumsum(640 * np.exp(-t / 0.09)) / SR) * np.exp(-t / 0.035)
    ding = tone(1318.5, 0.7, 0.2, ((1, 1.0), (1.5, 0.55)))
    ding[: len(pop)] += pop * 1.2
    chime = tone(880, 1.0, 0.33, ((1, 1.0), (1.5, 0.6), (2, 0.25)))
    # soft air movement: band-limited noise with a swell
    n = int(0.75 * SR)
    spectrum = np.fft.rfft(np.random.default_rng(7).standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    whoosh = np.fft.irfft(spectrum * np.exp(-((np.log(np.maximum(f, 1) / 900)) ** 2) / 0.5), n)
    whoosh *= np.sin(np.pi * np.arange(n) / n) ** 2 / np.abs(whoosh).max()
    return {'pop': (pop, 0.13), 'ding': (ding, 0.075), 'chime': (chime, 0.07), 'whoosh': (whoosh, 0.06)}


def music(n):
    """A light, calm bed: plucked arpeggio, soft pad and bass over C – Am – F – G."""
    C4, D4, E4, G4, A3, B3, F3, G3 = 261.63, 293.66, 329.63, 392.0, 220.0, 246.94, 174.61, 196.0
    chords = [(C4, E4, G4), (A3, C4, E4), (F3, A3, C4), (G3, B3, D4)]
    patterns = [(0, 1, 2, 1, 0, 1, 2, 1), (0, 2, 1, 2, 0, 2, 1, 2)]
    beat = 60 / 92
    bar = 4 * beat
    out = np.zeros((n, 2))

    def add(x, at, gain, pan=0.5):
        i = int(at * SR)
        x = x[: max(0, n - i)]
        out[i:i + len(x), 0] += x * gain * np.sqrt(1 - pan)
        out[i:i + len(x), 1] += x * gain * np.sqrt(pan)

    for b in range(int(np.ceil(n / SR / bar))):
        chord = chords[b % 4]
        t0 = b * bar
        t = np.arange(int((bar + 0.7) * SR)) / SR
        pad = sum(np.sin(TAU * f * t) + np.sin(TAU * f * 1.004 * t) for f in chord)
        add(pad * np.clip(t / 0.6, 0, 1) * np.clip((bar + 0.7 - t) / 0.7, 0, 1), t0, 0.03)
        add(tone(chord[0] / 2, 1.6, 0.7, ((1, 1.0), (2, 0.3))), t0, 0.2)
        add(tone(chord[0] / 2, 0.9, 0.4, ((1, 1.0), (2, 0.3))), t0 + 2.5 * beat, 0.11)
        for s, k in enumerate(patterns[(b // 4) % 2]):
            add(tone(chord[k] * 2, 1.3, 0.36, ((1, 1.0), (2, 0.3), (3, 0.1))), t0 + s * beat / 2, 0.12 if s % 2 == 0 else 0.08, 0.32 if s % 2 == 0 else 0.68)
        if b % 2 == 1:
            add(tone(chord[2] * 4, 1.6, 0.5), t0 + 3 * beat, 0.05, 0.5)
    return out


# ── soundtrack ──────────────────────────────────────────────────────────────
def soundtrack(lang, tl):
    """Narration + sound effects + music (ducked under the voice) → work/<lang>/soundtrack.wav"""
    total = tl['frames'] / tl['fps']
    n = int(total * SR)
    mix = np.zeros((n, 2))
    speech = np.zeros(n)

    def lay(x, at, gain=1.0, talk=False):
        i = int(at * SR)
        x = x[: max(0, n - i)]
        mix[i:i + len(x)] += (x * gain)[:, None]
        if talk:
            speech[i:i + len(x)] = 1

    for cue in tl['cues']:
        x = pcm(os.path.join(WORK, lang, 'vo', cue['id'] + '.mp3'))
        a, b = speech_span(x)
        lay(level(x[int(a * SR):int(b * SR)], 0.115), cue['at'], talk=True)
    fx = effects()
    for s in tl['sfx']:
        x, gain = fx[s['kind']]
        lay(x, s['at'], gain)

    t = np.arange(n) / SR
    win = int(0.3 * SR)
    c = np.cumsum(np.concatenate([np.zeros(win // 2 + 1), speech, np.zeros(win // 2)]))
    duck = (c[win:win + n] - c[:n]) / win
    bed = music(n)
    env = (1 - 0.5 * duck) * np.clip(t / 1.0, 0, 1) * np.clip((total - t) / 2.4, 0, 1)
    mix += bed * env[:, None] * (0.04 / np.sqrt(np.mean(bed ** 2)))
    mix *= np.clip((total - t) / 0.3, 0, 1)[:, None]

    out = os.path.join(WORK, lang, 'soundtrack.wav')

    def save(x):
        w = wave.open(out, 'wb')
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())
        w.close()

    # one static gain to -16 LUFS (web video loudness), keeping peaks under -1 dBFS; no compressor
    mix *= min(1.0, 0.5 / np.abs(mix).max())
    save(mix)
    r = subprocess.run([FF, '-hide_banner', '-nostats', '-i', out, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True)
    lufs = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', r.stderr)[-1])
    gain = min(10 ** ((-16 - lufs) / 20), 0.89 / np.abs(mix).max())
    mix *= gain
    save(mix)
    print(f'  soundtrack {total:.2f} s, {lufs + 20 * np.log10(gain):.1f} LUFS, peak {np.abs(mix).max():.2f}')
    return out


# ── captions and player data ────────────────────────────────────────────────
def stamp(seconds):
    return f'{int(seconds // 3600):02d}:{int(seconds // 60 % 60):02d}:{seconds % 60:06.3f}'


def captions(lang, tl, script):
    text = {cue_id: line['vo'] for cue_id, line in cues(script, lang)}
    durations = json.load(open(os.path.join(WORK, lang, 'vo', 'durations.json'), encoding='utf-8'))
    starts = [c['at'] for c in tl['cues']] + [tl['total']]
    lines = ['WEBVTT', '']
    for i, cue in enumerate(tl['cues']):
        end = min(cue['at'] + durations[cue['id']] + 0.35, starts[i + 1] - 0.02)
        lines += [f"{stamp(cue['at'])} --> {stamp(end)}", text[cue['id']], '']
    path = os.path.join(OUT, f'bin-guide-{lang}.vtt')
    open(path, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))


def metadata(lang, tl):
    meta = json.load(open(META, encoding='utf-8')) if os.path.exists(META) else {}
    meta[lang] = {'duration': round(tl['frames'] / tl['fps'], 2), 'chapters': tl['chapters']}
    json.dump(meta, open(META, 'w', encoding='utf-8', newline='\n'), indent=2)


# ── video ───────────────────────────────────────────────────────────────────
def video(lang, frames_root, script, audio_only):
    tl = json.load(open(os.path.join(WORK, lang, 'timeline.json'), encoding='utf-8'))
    print(f'{lang}:')
    audio = soundtrack(lang, tl)
    if audio_only:
        return
    frames = os.path.join(frames_root, lang, 'frames')
    missing = [i for i in range(tl['frames']) if not os.path.exists(os.path.join(frames, f'f{i:05d}.jpg'))]
    if missing:
        sys.exit(f'{len(missing)} frames missing in {frames} (first: {missing[0]}): run tools/guide-video/capture.mjs')
    os.makedirs(OUT, exist_ok=True)
    # the frames are full-range JPEGs: convert once to video-range BT.709 so every player shows the game's colours
    col = 'in_color_matrix=bt601:in_range=pc:out_color_matrix=bt709:out_range=tv'
    out = os.path.join(OUT, f'bin-guide-{lang}.mp4')
    run(['-framerate', str(tl['fps']), '-i', os.path.join(frames, 'f%05d.jpg'), '-i', audio,
         '-vf', f'scale=1920:1080:flags=lanczos:{col}',
         '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
         # crf 26 keeps each file well under 25 MB (the limit for one file on Cloudflare Pages)
         '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-level', '4.2', '-crf', '26', '-g', '60',
         '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709',
         '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '160k', '-shortest', out])
    print(f'  {os.path.basename(out)}  {os.path.getsize(out) / 1e6:.1f} MB')
    poster = os.path.join(OUT, f'bin-guide-{lang}.jpg')
    run(['-i', os.path.join(frames, f"f{tl['poster']:05d}.jpg"), '-vf', 'scale=1280:720:flags=lanczos', '-q:v', '4', poster])
    print(f'  {os.path.basename(poster)}  {os.path.getsize(poster) / 1e3:.0f} KB')
    captions(lang, tl, script)
    metadata(lang, tl)


if __name__ == '__main__':
    args = sys.argv[1:]
    frames_root = WORK
    if '--frames' in args:
        i = args.index('--frames')
        frames_root = os.path.abspath(args[i + 1])
        del args[i:i + 2]
    audio_only = '--audio' in args
    langs = [a for a in args if not a.startswith('--')] or ['en', 'ta']
    script = json.load(open(os.path.join(HERE, 'script.json'), encoding='utf-8'))
    for lang in langs:
        video(lang, frames_root, script, audio_only)
