"""Record the bin-guide narration in both languages with neural voices (both female).

    python tools/guide-video/vo.py            # work/<lang>/vo/<cue>.mp3 + durations.json
    python tools/guide-video/vo.py ta         # one language only

The lines come from script.json ("say" is used instead of "vo" where the spelling has to be
changed for the voice to pronounce it properly). A line is only recorded again when its text
or voice changed. Needs: pip install edge-tts imageio-ffmpeg numpy
"""
import asyncio
import hashlib
import json
import os
import subprocess
import sys

import numpy as np

from common import FF, HERE, SR, WORK, cues, speech_span, tts


def pcm(path):
    r = subprocess.run([FF, '-hide_banner', '-loglevel', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32).astype(np.float64)


async def record(lang, script):
    v = script['voices'][lang]
    out = os.path.join(WORK, lang, 'vo')
    os.makedirs(out, exist_ok=True)
    cache_path = os.path.join(out, 'cache.json')
    cache = json.load(open(cache_path, encoding='utf-8')) if os.path.exists(cache_path) else {}
    durations = {}
    for cue_id, line in cues(script, lang):
        text = line.get('say', line['vo'])
        key = hashlib.sha1(json.dumps([text, v], ensure_ascii=False).encode('utf-8')).hexdigest()
        path = os.path.join(out, cue_id + '.mp3')
        if cache.get(cue_id) != key or not os.path.exists(path):
            await tts(text, v['voice'], path, v['rate'], v['pitch'])
            cache[cue_id] = key
            json.dump(cache, open(cache_path, 'w', encoding='utf-8'), indent=1)
        a, b = speech_span(pcm(path))
        durations[cue_id] = round(b - a, 3)
        print(f'  {lang} {cue_id:10s} {b - a:5.2f} s')
    json.dump(durations, open(os.path.join(out, 'durations.json'), 'w', encoding='utf-8'), indent=1)
    print(f'{lang}: {len(durations)} lines, {sum(durations.values()):.1f} s of speech ({v["voice"]})')


async def main():
    script = json.load(open(os.path.join(HERE, 'script.json'), encoding='utf-8'))
    for lang in (sys.argv[1:] or ['en', 'ta']):
        await record(lang, script)

asyncio.run(main())
