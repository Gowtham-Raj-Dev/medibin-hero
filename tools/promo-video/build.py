"""Build the gameplay promo from the captured frames.

    node tools/promo-video/capture.mjs            # frames + timeline   (dev server running on :5199)
    python tools/promo-video/build.py             # narration + music + sounds + frames
                                                  #   → public/video/gameplay.mp4 and gameplay.jpg (poster)
Options: --frames DIR  where capture.mjs put the frames (default: tools/promo-video/work)
         --audio       only the soundtrack (work/soundtrack.wav)

The narration (female neural voice) is recorded here; a line is only recorded again when its
text changes. Music and sounds are generated, as in tools/guide-video/build.py.
Needs: pip install edge-tts imageio-ffmpeg numpy
"""
import asyncio
import hashlib
import importlib.util
import json
import os
import re
import subprocess
import sys
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
GUIDE = os.path.join(os.path.dirname(HERE), 'guide-video')
sys.path.insert(0, GUIDE)
from common import FF, ROOT, SR, speech_span, tts  # noqa: E402

_spec = importlib.util.spec_from_file_location('guide_build', os.path.join(GUIDE, 'build.py'))
guide = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(guide)  # its music, tones and ffmpeg helpers

WORK = os.path.join(HERE, 'work')
OUT = os.path.join(ROOT, 'public', 'video')
VOICE = 'en-IN-NeerjaExpressiveNeural'
# cue (set in director.js): line
LINES = {
    'title': 'MediBin Hero. The 3D hospital waste sorting game.',
    'gate': 'Enter your name, and start.',
    'item': 'A waste item appears. Read its name, and pick the right bin.',
    'points': 'Every correct answer scores points. The faster, the better.',
    'streak': 'Build a streak, and level up.',
    'wrong': 'Wrong bin? The game shows you where it really goes.',
    'results': 'At the end, see your score, your rank, and what to learn.',
    'end': 'MediBin Hero. Play now, free in your browser.',
}


async def narration():
    out = os.path.join(WORK, 'vo')
    os.makedirs(out, exist_ok=True)
    cache_path = os.path.join(out, 'cache.json')
    cache = json.load(open(cache_path, encoding='utf-8')) if os.path.exists(cache_path) else {}
    for cue, text in LINES.items():
        key = hashlib.sha1((VOICE + text).encode('utf-8')).hexdigest()
        path = os.path.join(out, cue + '.mp3')
        if cache.get(cue) != key or not os.path.exists(path):
            await tts(text, VOICE, path)
            cache[cue] = key
            json.dump(cache, open(cache_path, 'w', encoding='utf-8'), indent=1)


def effects():
    tone = guide.tone
    fx = guide.effects()
    t = np.arange(int(0.4 * SR)) / SR
    buzz = (np.sign(np.sin(guide.TAU * 150 * t)) * 0.5 + np.sin(guide.TAU * 112 * t)) * np.exp(-t / 0.14)

    def notes(freqs, gap, seconds, decay):
        x = np.zeros(int((gap * len(freqs) + seconds) * SR))
        for i, f in enumerate(freqs):
            n = tone(f, seconds, decay, ((1, 1.0), (2, 0.3)))
            k = int(i * gap * SR)
            x[k:k + len(n)] += n
        return x

    fx.update({
        'beep': (tone(660, 0.22, 0.07), 0.12),
        'go': (tone(990, 0.5, 0.16, ((1, 1.0), (2, 0.4))), 0.13),
        'key': (tone(1500, 0.05, 0.012), 0.05),
        'click': (tone(820, 0.09, 0.025), 0.1),
        'buzz': (buzz, 0.085),
        'levelup': (notes([523.25, 659.25, 783.99, 1046.5], 0.1, 0.7, 0.25), 0.09),
        'fanfare': (notes([523.25, 659.25, 783.99, 1046.5, 1318.5], 0.13, 1.2, 0.4), 0.09),
    })
    return fx


def soundtrack(tl):
    total = tl['frames'] / tl['fps']
    n = int(total * SR)
    mix = np.zeros((n, 2))
    speech = np.zeros(n)
    fx = effects()
    busy_until = 0.0
    for e in tl['events']:
        i = int(e['at'] * SR)
        if e['type'] == 'cue':
            x = guide.pcm(os.path.join(WORK, 'vo', e['id'] + '.mp3'))
            a, b = speech_span(x)
            x = guide.level(x[int(a * SR):int(b * SR)], 0.115)[: max(0, n - i)]
            if e['at'] < busy_until:
                print(f"  ! narration '{e['id']}' starts {busy_until - e['at']:.2f} s before the previous line ends")
            busy_until = e['at'] + len(x) / SR
            speech[i:i + len(x)] = 1
            print(f"  narration {e['id']:8s} {e['at']:6.2f} – {busy_until:6.2f} s")
        else:
            x, gain = fx[e['id']]
            x = (x * gain)[: max(0, n - i)]
        mix[i:i + len(x)] += x[:, None]

    t = np.arange(n) / SR
    win = int(0.3 * SR)
    c = np.cumsum(np.concatenate([np.zeros(win // 2 + 1), speech, np.zeros(win // 2)]))
    duck = (c[win:win + n] - c[:n]) / win
    bed = guide.music(n)
    env = (1 - 0.5 * duck) * np.clip(t / 1.0, 0, 1) * np.clip((total - t) / 2.4, 0, 1)
    mix += bed * env[:, None] * (0.05 / np.sqrt(np.mean(bed ** 2)))
    mix *= np.clip((total - t) / 0.3, 0, 1)[:, None]

    out = os.path.join(WORK, 'soundtrack.wav')

    def save(x):
        w = wave.open(out, 'wb')
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())
        w.close()

    mix *= min(1.0, 0.5 / np.abs(mix).max())
    save(mix)
    r = subprocess.run([FF, '-hide_banner', '-nostats', '-i', out, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True)
    lufs = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', r.stderr)[-1])
    gain = min(10 ** ((-16 - lufs) / 20), 0.89 / np.abs(mix).max())
    mix *= gain
    save(mix)
    print(f'  soundtrack {total:.2f} s, {lufs + 20 * np.log10(gain):.1f} LUFS, peak {np.abs(mix).max():.2f}')
    return out


def main():
    args = sys.argv[1:]
    frames_root = WORK
    if '--frames' in args:
        frames_root = os.path.abspath(args[args.index('--frames') + 1])
    tl = json.load(open(os.path.join(WORK, 'timeline.json'), encoding='utf-8'))
    asyncio.run(narration())
    audio = soundtrack(tl)
    if '--audio' in args:
        return
    frames = os.path.join(frames_root, 'frames')
    missing = [i for i in range(tl['frames']) if not os.path.exists(os.path.join(frames, f'f{i:05d}.jpg'))]
    if missing:
        sys.exit(f'{len(missing)} frames missing in {frames} (first: {missing[0]}): run tools/promo-video/capture.mjs')
    os.makedirs(OUT, exist_ok=True)
    col = 'in_color_matrix=bt601:in_range=pc:out_color_matrix=bt709:out_range=tv'
    out = os.path.join(OUT, 'gameplay.mp4')
    guide.run(['-framerate', str(tl['fps']), '-i', os.path.join(frames, 'f%05d.jpg'), '-i', audio,
               '-vf', f'scale=1920:1080:flags=lanczos:{col}',
               '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
               '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-level', '4.2', '-crf', '25', '-g', '60',
               '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709',
               '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '160k', '-shortest', out])
    print(f'  gameplay.mp4  {os.path.getsize(out) / 1e6:.1f} MB')
    # poster: a moment of play, just after the "points" line starts
    at = next(e['at'] for e in tl['events'] if e['type'] == 'cue' and e['id'] == 'points') + 1.0
    poster = os.path.join(OUT, 'gameplay.jpg')
    guide.run(['-i', os.path.join(frames, f'f{int(at * tl["fps"]):05d}.jpg'), '-vf', 'scale=1280:720:flags=lanczos', '-q:v', '4', poster])
    print(f'  gameplay.jpg  {os.path.getsize(poster) / 1e3:.0f} KB')


if __name__ == '__main__':
    main()
