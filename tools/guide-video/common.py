"""Shared by vo.py and build.py."""
import os
import shutil

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
WORK = os.path.join(HERE, 'work')
SR = 48000


def _ffmpeg():
    exe = shutil.which('ffmpeg')
    if exe:
        return exe
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


FF = _ffmpeg()


def cues(script, lang):
    """Every spoken line as (cue id, {vo, say?, ...}), in the order it is heard."""
    for line in script['intro']:
        yield line['id'], line[lang]
    for b in script['bins']:
        yield b['id'], b[lang]
        for item in b['items']:
            yield item['id'], item[lang]
    for line in script['recap'] + script['end']:
        yield line['id'], line[lang]


def speech_span(x, sr=SR):
    """(start, end) seconds of the speech in a clip (leading / trailing silence removed)."""
    hop = sr // 100
    e = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, len(x) - hop, hop)])
    on = np.nonzero(e > max(1e-4, e.max() * 0.03))[0]
    return (max(0, on[0] - 3) / 100, min(len(e), on[-1] + 12) / 100) if len(on) else (0.0, len(x) / sr)


def tts(text, voice, path, rate='+0%', pitch='+0Hz'):
    """Coroutine: speak `text` with an edge-tts neural voice into an MP3 (96 kbps instead of the default 48)."""
    import sys
    import types
    import edge_tts.communicate as comm
    hq = sys.modules.get('edge_tts.communicate_hq')
    if hq is None:
        src = open(comm.__file__, encoding='utf-8').read()
        old = '"outputFormat":"audio-24khz-48kbitrate-mono-mp3"'
        if old not in src:
            sys.exit('edge-tts changed: cannot set the output format')
        hq = types.ModuleType('edge_tts.communicate_hq')
        hq.__package__ = 'edge_tts'
        exec(compile(src.replace(old, '"outputFormat":"audio-24khz-96kbitrate-mono-mp3"'), comm.__file__, 'exec'), hq.__dict__)
        sys.modules['edge_tts.communicate_hq'] = hq
    return hq.Communicate(text, voice, rate=rate, pitch=pitch).save(path)
