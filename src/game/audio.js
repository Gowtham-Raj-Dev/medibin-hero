// All game sound is synthesised with the Web Audio API — no audio files, so the
// game works offline. One shared AudioManager drives the music loop and effects.

const STORE_KEY = 'medibin.audio';
const MUSIC_GAIN = 1.35; // music bus level relative to the effects
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

// 8-bar loop in C major: bass root + chord tones per bar.
const BARS = [
  { bass: 36, chord: [60, 64, 67, 72] }, // C
  { bass: 45, chord: [57, 60, 64, 69] }, // Am
  { bass: 41, chord: [53, 57, 60, 65] }, // F
  { bass: 43, chord: [55, 59, 62, 67] }, // G
  { bass: 36, chord: [60, 64, 67, 72] }, // C
  { bass: 40, chord: [52, 55, 59, 64] }, // Em
  { bass: 41, chord: [53, 57, 60, 65] }, // F
  { bass: 43, chord: [55, 59, 62, 67] }, // G
];
const ARP = [0, 1, 2, 3, 2, 1, 2, 3];
// Melody in 8th notes, one row per bar (0 = rest).
const MELODY = [
  [76, 0, 79, 0, 84, 0, 79, 0],
  [81, 0, 79, 76, 0, 0, 72, 0],
  [77, 0, 81, 0, 84, 0, 81, 0],
  [79, 0, 74, 0, 83, 0, 0, 0],
  [76, 0, 79, 0, 84, 0, 88, 0],
  [86, 0, 83, 79, 0, 0, 76, 0],
  [77, 81, 84, 0, 81, 0, 77, 0],
  [79, 0, 83, 0, 86, 0, 0, 0],
];
const STEPS_PER_BAR = 16;
const LOOP_STEPS = STEPS_PER_BAR * BARS.length * 2; // second pass adds the melody

class AudioManager {
  constructor() {
    this.ctx = null;
    this.musicOn = true;
    this.sfxOn = true;
    this.bpm = 108;
    this.musicLevel = 1;
    this._wantMusic = false;
    this._timer = null;
    this._step = 0;
    this._nextTime = 0;
    this._listeners = new Set();
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      if (typeof saved.musicOn === 'boolean') this.musicOn = saved.musicOn;
      if (typeof saved.sfxOn === 'boolean') this.sfxOn = saved.sfxOn;
    } catch {
      // storage unavailable — keep defaults
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) this.ctx.suspend();
        else this.ctx.resume().then(() => { this._nextTime = this.ctx.currentTime + 0.05; });
      });
    }
  }

  // ── setup ───────────────────────────────────────────────────────────────
  /** Call from a user gesture; browsers block audio until then. */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = (this.ctx = new Ctx());
      this.master = ctx.createGain();
      this.master.gain.value = 0.9;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -10;
      limiter.ratio.value = 6;
      this.master.connect(limiter).connect(ctx.destination);

      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = this.musicOn ? MUSIC_GAIN : 0;
      this.musicDuck = ctx.createGain();
      this.musicDuck.gain.value = 1;
      this.musicBus.connect(this.musicDuck).connect(this.master);

      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = this.sfxOn ? 1 : 0;
      this.sfxBus.connect(this.master);

      // Echo for the lead voices.
      this.echo = ctx.createDelay(1);
      this.echo.delayTime.value = 0.28;
      const fb = ctx.createGain();
      fb.gain.value = 0.28;
      const wet = ctx.createGain();
      wet.gain.value = 0.22;
      this.echo.connect(fb).connect(this.echo);
      this.echo.connect(wet).connect(this.musicBus);

      const len = ctx.sampleRate;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this._wantMusic) this._startLoop();
  }

  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }
  _emit() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ musicOn: this.musicOn, sfxOn: this.sfxOn }));
    } catch {
      // ignore
    }
    this._listeners.forEach((fn) => fn());
  }
  setMusic(on) {
    this.musicOn = on;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(on ? MUSIC_GAIN : 0, this.ctx.currentTime, 0.05);
    this._emit();
  }
  setSfx(on) {
    this.sfxOn = on;
    if (this.ctx) this.sfxBus.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.02);
    this._emit();
  }

  // ── building blocks ─────────────────────────────────────────────────────
  _tone({ type = 'sine', f, f2, at = 0, when, dur = 0.15, gain = 0.2, attack = 0.005, dest, cutoff, detune = 0 }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = when ?? ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.detune.value = detune;
    osc.frequency.setValueAtTime(f, t);
    if (f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (cutoff) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = cutoff;
      node = osc.connect(lp);
    }
    node.connect(g).connect(dest || this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.03);
    return g;
  }

  _noise({ at = 0, when, dur = 0.2, gain = 0.2, type = 'bandpass', f = 1000, f2, q = 1, attack = 0.005, dest }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = when ?? ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(f, t);
    if (f2) filter.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(dest || this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.03);
  }

  // ── sound effects ───────────────────────────────────────────────────────
  click() {
    this._tone({ type: 'triangle', f: 620, f2: 900, dur: 0.08, gain: 0.22 });
    this._tone({ type: 'sine', f: 1240, dur: 0.05, gain: 0.05, at: 0.02 });
  }
  hover() {
    this._tone({ type: 'sine', f: 1100, f2: 1300, dur: 0.035, gain: 0.035 });
  }
  pop() {
    this._tone({ type: 'sine', f: 420, f2: 980, dur: 0.1, gain: 0.16 });
    this._tone({ type: 'triangle', f: 1400, dur: 0.06, gain: 0.04, at: 0.05 });
  }
  whoosh() {
    this._noise({ dur: 0.42, gain: 0.16, f: 380, f2: 2600, q: 0.9, attack: 0.12 });
  }
  lid() {
    this._tone({ type: 'square', f: 190, f2: 120, dur: 0.05, gain: 0.07, cutoff: 900 });
    this._noise({ dur: 0.04, gain: 0.07, f: 2400, q: 2 });
  }
  drop() {
    this._tone({ type: 'sine', f: 170, f2: 55, dur: 0.2, gain: 0.3 });
    this._noise({ dur: 0.12, gain: 0.12, type: 'lowpass', f: 700 });
  }
  correct(streak = 1) {
    const base = 84 + Math.min(streak - 1, 7); // rises with the streak
    [0, 4, 7, 12].forEach((iv, i) => {
      const f = midi(base + iv);
      this._tone({ type: 'triangle', f, dur: i === 3 ? 0.42 : 0.13, gain: 0.17, at: i * 0.07 });
      this._tone({ type: 'sine', f: f * 2, dur: i === 3 ? 0.5 : 0.1, gain: 0.05, at: i * 0.07 });
    });
  }
  wrong() {
    this._tone({ type: 'sawtooth', f: 233, f2: 104, dur: 0.42, gain: 0.2, cutoff: 1300 });
    this._tone({ type: 'sawtooth', f: 220, f2: 98, dur: 0.42, gain: 0.2, cutoff: 1300, detune: 30 });
    this._tone({ type: 'square', f: 78, dur: 0.3, gain: 0.12, at: 0.05, cutoff: 500 });
    this._noise({ dur: 0.16, gain: 0.07, f: 300, q: 0.7 });
  }
  timeout() {
    [76, 72, 67].forEach((n, i) => this._tone({ type: 'square', f: midi(n), dur: 0.16, gain: 0.1, at: i * 0.13, cutoff: 1800 }));
  }
  tick(urgent) {
    this._tone({ type: 'square', f: urgent ? 1500 : 1050, dur: 0.045, gain: 0.07, cutoff: 3200 });
  }
  countdown() {
    this._tone({ type: 'triangle', f: 523.25, dur: 0.16, gain: 0.2 });
  }
  go() {
    [72, 76, 79, 84].forEach((n) => this._tone({ type: 'triangle', f: midi(n), dur: 0.5, gain: 0.11 }));
    this._noise({ dur: 0.3, gain: 0.05, type: 'highpass', f: 5000 });
  }
  levelUp() {
    [72, 76, 79, 84, 88, 91].forEach((n, i) => {
      this._tone({ type: 'triangle', f: midi(n), dur: 0.22, gain: 0.15, at: i * 0.065 });
      this._tone({ type: 'sine', f: midi(n + 12), dur: 0.3, gain: 0.05, at: i * 0.065 });
    });
  }
  lifeLost() {
    this._tone({ type: 'triangle', f: midi(64), f2: midi(58), dur: 0.3, gain: 0.16, at: 0.3 });
  }
  gameOver() {
    [67, 64, 60, 57, 52].forEach((n, i) => {
      this._tone({ type: 'triangle', f: midi(n), dur: 0.5, gain: 0.2, at: i * 0.24 });
      this._tone({ type: 'sine', f: midi(n - 12), dur: 0.55, gain: 0.14, at: i * 0.24 });
    });
    [48, 52, 55].forEach((n) => this._tone({ type: 'sawtooth', f: midi(n), dur: 1.4, gain: 0.07, at: 1.25, cutoff: 900, attack: 0.05 }));
  }
  fanfare() {
    const seq = [[72, 0], [72, 0.12], [72, 0.24], [76, 0.4], [79, 0.56], [84, 0.74]];
    seq.forEach(([n, at], i) => {
      const dur = i === seq.length - 1 ? 0.8 : 0.16;
      this._tone({ type: 'triangle', f: midi(n), dur, gain: 0.17, at });
      this._tone({ type: 'square', f: midi(n), dur, gain: 0.04, at, cutoff: 2400 });
    });
  }

  // ── music ───────────────────────────────────────────────────────────────
  startMusic() {
    this._wantMusic = true;
    if (this.ctx) this._startLoop();
  }
  stopMusic() {
    this._wantMusic = false;
    clearInterval(this._timer);
    this._timer = null;
  }
  /** Game level 1..n — the music speeds up a little as the game gets harder. */
  setIntensity(level) {
    this.musicLevel = level;
    this.bpm = Math.min(138, 108 + (level - 1) * 5);
  }
  /** Lower the music (e.g. on the results screen) without stopping it. */
  duck(amount) {
    if (this.ctx) this.musicDuck.gain.setTargetAtTime(amount, this.ctx.currentTime, 0.25);
  }

  _startLoop() {
    if (this._timer) return;
    this._step = 0;
    this._nextTime = this.ctx.currentTime + 0.08;
    this._timer = setInterval(() => this._schedule(), 40);
  }

  _schedule() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (this._nextTime < ctx.currentTime) this._nextTime = ctx.currentTime + 0.03;
    while (this._nextTime < ctx.currentTime + 0.14) {
      this._playStep(this._step, this._nextTime);
      this._nextTime += 60 / this.bpm / 4;
      this._step = (this._step + 1) % LOOP_STEPS;
    }
  }

  _playStep(step, t) {
    const dest = this.musicBus;
    const s = step % STEPS_PER_BAR;
    const barIndex = Math.floor(step / STEPS_PER_BAR) % BARS.length;
    const pass = Math.floor(step / (STEPS_PER_BAR * BARS.length));
    const bar = BARS[barIndex];
    const beat = 60 / this.bpm;

    // drums
    if (s === 0 || s === 8 || (s === 10 && barIndex % 2 === 1)) {
      this._tone({ type: 'sine', f: 150, f2: 42, dur: 0.22, gain: s === 10 ? 0.11 : 0.18, when: t, dest });
    }
    if (s === 4 || s === 12) {
      this._noise({ when: t, dur: 0.13, gain: 0.09, f: 1900, q: 0.8, dest });
      this._tone({ type: 'triangle', f: 210, f2: 150, dur: 0.08, gain: 0.05, when: t, dest });
    }
    if (s % 2 === 0) {
      this._noise({ when: t, dur: s === 14 ? 0.12 : 0.035, gain: s % 4 === 2 ? 0.035 : 0.022, type: 'highpass', f: 7500, dest });
    }

    // bass
    if (s === 0 || s === 6 || s === 8 || s === 14) {
      this._tone({ type: 'triangle', f: midi(bar.bass), dur: beat * 0.7, gain: 0.17, when: t, dest, cutoff: 500 });
    } else if (s === 12) {
      this._tone({ type: 'triangle', f: midi(bar.bass + 7), dur: beat * 0.45, gain: 0.15, when: t, dest, cutoff: 500 });
    }

    // warm pad once per bar
    if (s === 0) {
      bar.chord.slice(0, 3).forEach((n) => {
        this._tone({ type: 'sawtooth', f: midi(n), dur: beat * 4, gain: 0.03, when: t, attack: 0.25, dest, cutoff: 850 });
      });
    }

    // plucked arpeggio on 8th notes
    if (s % 2 === 0) {
      const n = bar.chord[ARP[s / 2]];
      this._tone({ type: 'triangle', f: midi(n), dur: 0.22, gain: 0.085, when: t, dest, cutoff: 2600 });
    }

    // marimba-like melody on the second pass
    if (pass === 1 && s % 2 === 0) {
      const n = MELODY[barIndex][s / 2];
      if (n) {
        this._tone({ type: 'sine', f: midi(n), dur: 0.34, gain: 0.11, when: t, dest });
        this._tone({ type: 'sine', f: midi(n), dur: 0.3, gain: 0.07, when: t, dest: this.echo });
        this._tone({ type: 'triangle', f: midi(n + 12), dur: 0.09, gain: 0.03, when: t, dest });
      }
    }
  }
}

export const audio = new AudioManager();
