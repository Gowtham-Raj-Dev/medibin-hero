// Game rules: picks waste items, runs the timer, scores answers and tracks lives.
// It drives the Stage and reports every change through onChange(state).
import { BINS, BIN_INDEX, ITEMS, MAX_LIVES, levelFor, timeForLevel, pointsFor } from './data.js';
import { audio } from './audio.js';
import { saveScore } from './storage.js';

const shuffle = (list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export function initialState() {
  return {
    phase: 'idle', // idle | countdown | playing | resolving | paused | over
    count: 0,
    score: 0,
    lives: MAX_LIVES,
    streak: 0,
    bestStreak: 0,
    level: 1,
    correct: 0,
    wrong: 0,
    item: null,
    feedback: null,
    levelUp: 0,
    mistakes: [],
    result: null,
  };
}

export class GameController {
  constructor(stage, { onChange, onTimer }) {
    this.stage = stage;
    this.onChange = onChange;
    this.onTimer = onTimer;
    this.state = initialState();
    this.player = { name: 'Player', role: 'public' };
    this.timeLeft = 0;
    this.timeMax = 1;
    this._lastTick = 0;
    this._run = 0; // bumps on every restart so stale async steps bail out
    this._queues = {};
    this._lastBins = [];
    stage.onFrame = (dt) => this._tick(dt);
  }

  _set(patch) {
    this.state = { ...this.state, ...patch };
    this.onChange(this.state);
  }

  // Each bin gets an equal share of turns, and no item repeats until its bin's list is used up.
  _nextItem() {
    let ids = BINS.map((b) => b.id);
    const [last, prev] = this._lastBins;
    if (last && last === prev) ids = ids.filter((id) => id !== last);
    const binId = ids[Math.floor(Math.random() * ids.length)];
    this._lastBins = [binId, last];
    if (!this._queues[binId]?.length) {
      const fresh = shuffle(ITEMS.filter((i) => i.bin === binId));
      if (fresh[fresh.length - 1].id === this.state.item?.id) fresh.reverse();
      this._queues[binId] = fresh;
    }
    return this._queues[binId].pop();
  }

  async start(player) {
    const run = ++this._run;
    this.player = player;
    this._queues = {};
    this._lastBins = [];
    this.stage.paused = false;
    this.stage.setInteractive(false);
    this.stage.clearItem();
    this.onTimer?.(1);
    audio.setIntensity(1);
    audio.duck(1);
    audio.startMusic();
    this.stage.react('wave');
    this._set({ ...initialState(), phase: 'countdown', count: 3 });
    for (let n = 3; n >= 1; n--) {
      this._set({ count: n });
      audio.countdown();
      await this.stage.wait(0.8);
      if (run !== this._run) return;
    }
    this._set({ count: 0 });
    audio.go();
    await this.stage.wait(0.55);
    if (run !== this._run) return;
    this._serve(run);
  }

  async _serve(run) {
    let item;
    // If one model can't be shown, move on to another item instead of freezing the game.
    for (let attempt = 0; attempt < 4; attempt++) {
      item = this._nextItem();
      try {
        await this.stage.showItem(item);
        break;
      } catch (err) {
        console.warn(`Could not show "${item.en}"`, err);
        item = null;
      }
    }
    if (run !== this._run || !item) return;
    this.timeMax = timeForLevel(this.state.level);
    this.timeLeft = this.timeMax;
    this._lastTick = Math.ceil(this.timeLeft);
    this.onTimer?.(1);
    audio.pop();
    this.stage.setInteractive(true);
    this._set({ phase: 'playing', item, feedback: null });
  }

  _tick(dt) {
    if (this.state.phase !== 'playing') return;
    this.timeLeft -= dt;
    this.onTimer?.(Math.max(0, this.timeLeft / this.timeMax));
    const whole = Math.ceil(this.timeLeft);
    if (whole !== this._lastTick && whole <= 3 && whole > 0) audio.tick(whole === 1);
    this._lastTick = whole;
    if (this.timeLeft <= 0) this._answer(-1);
  }

  /** Player picked a bin (0-3). */
  choose(binIndex) {
    if (this.state.phase !== 'playing') return;
    this._answer(binIndex);
  }

  // binIndex -1 means the timer ran out.
  async _answer(binIndex) {
    const run = this._run;
    const { item } = this.state;
    const correctIndex = BIN_INDEX[item.bin];
    const timedOut = binIndex < 0;
    const target = timedOut ? correctIndex : binIndex;
    const ok = !timedOut && binIndex === correctIndex;
    const timeFrac = Math.max(0, this.timeLeft / this.timeMax);

    this.stage.setInteractive(false);
    this._set({ phase: 'resolving' });
    if (timedOut) audio.timeout();
    else audio.click();
    audio.lid();
    audio.whoosh();
    await this.stage.throwItem(target);
    if (run !== this._run) return;
    audio.drop();

    if (ok) {
      const streak = this.state.streak + 1;
      const points = pointsFor(timeFrac, streak);
      const correct = this.state.correct + 1;
      const level = levelFor(correct);
      const leveledUp = level > this.state.level;
      this.stage.resolveBin(target, true);
      this.stage.react('ok');
      audio.correct(streak);
      this._set({
        score: this.state.score + points,
        streak,
        bestStreak: Math.max(this.state.bestStreak, streak),
        correct,
        level,
        feedback: { kind: 'ok', points, bin: target, streak, id: Date.now() },
      });
      await this.stage.wait(0.8);
      if (leveledUp) {
        // the "Level up" banner gets its own beat after the "Correct!" message
        if (run !== this._run) return;
        audio.setIntensity(level);
        audio.levelUp();
        this._set({ levelUp: level });
        await this.stage.wait(1.5);
      }
    } else {
      const lives = this.state.lives - 1;
      this.stage.resolveBin(target, timedOut ? null : false);
      if (!timedOut) audio.wrong();
      this.stage.pointAt(correctIndex, 2.0);
      audio.lifeLost();
      this.stage.react('bad');
      this._set({
        lives,
        streak: 0,
        wrong: this.state.wrong + 1,
        mistakes: [...this.state.mistakes, { item, chosen: binIndex, correct: correctIndex }],
        feedback: { kind: timedOut ? 'timeout' : 'bad', bin: target, correctBin: correctIndex, item, id: Date.now() },
      });
      await this.stage.wait(2.3);
      if (run !== this._run) return;
      if (lives <= 0) {
        this._finish();
        return;
      }
    }
    if (run !== this._run) return;
    this._serve(run);
  }

  _finish() {
    const s = this.state;
    const answered = s.correct + s.wrong;
    const accuracy = answered ? Math.round((s.correct / answered) * 100) : 0;
    const saved = saveScore({ name: this.player.name, role: this.player.role, score: s.score, correct: s.correct, accuracy, level: s.level });
    this.stage.clearItem();
    this.stage.react('over');
    audio.duck(0.35);
    audio.gameOver();
    if (saved.isPersonalBest) setTimeout(() => audio.fanfare(), 1900);
    this._set({ phase: 'over', item: null, feedback: null, result: { accuracy, answered, ...saved } });
  }

  pause() {
    if (this.state.phase !== 'playing') return;
    this.stage.paused = true;
    this.stage.setInteractive(false);
    audio.duck(0.3);
    this._set({ phase: 'paused' });
  }
  resume() {
    if (this.state.phase !== 'paused') return;
    this.stage.paused = false;
    this.stage.setInteractive(true);
    audio.duck(1);
    this._set({ phase: 'playing' });
  }

  /** Back to the name screen. */
  reset() {
    this._run++;
    this.stage.paused = false;
    this.stage.setInteractive(false);
    this.stage.clearItem();
    audio.duck(1);
    this._set(initialState());
  }

  dispose() {
    this._run++;
    this.stage.onFrame = null;
  }
}
