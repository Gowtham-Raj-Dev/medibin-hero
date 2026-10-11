// Full-screen panels shown over the game: name entry, pause and results.
import { useEffect, useRef, useState } from 'react';
import { BINS, MAX_LIVES, ROLES, TAGLINE_TA, rankFor } from '../game/data.js';
import { audio } from '../game/audio.js';
import { loadScores } from '../game/storage.js';
import { Logo, PlayIcon, HomeIcon, RefreshIcon, StarIcon, TrophyIcon, UserIcon, HeartIcon, ClockIcon, MouseIcon, ArrowRight } from './icons.jsx';

const roleLabel = (id) => ROLES.find((r) => r.id === id)?.label ?? '';

function BinDot({ index, children }) {
  const bin = BINS[index];
  return (
    <i className="bin-dot" style={{ background: bin.color, color: bin.ink }}>
      {children ?? bin.name}
    </i>
  );
}

// ── name entry ──────────────────────────────────────────────────────────────
export function NameGate({ gameName, player, ready, progress, error, onStart, onHome }) {
  const [name, setName] = useState(player.name || '');
  const [role, setRole] = useState(player.role || 'staff');
  const [touched, setTouched] = useState(false);
  const inputRef = useRef(null);
  const clean = name.trim().replace(/\s+/g, ' ');
  const valid = clean.length >= 2;

  useEffect(() => {
    // not on phones: focusing would pop the on-screen keyboard over the form straight away
    if (!window.matchMedia('(pointer: coarse)').matches) inputRef.current?.focus();
  }, []);

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!valid || !ready) return;
    onStart({ name: clean, role });
  };

  return (
    <div className="overlay">
      <form className="panel gate" onSubmit={submit} noValidate>
        <button type="button" className="panel-back" onClick={onHome}>
          <HomeIcon width={18} height={18} /> Home
        </button>
        <div className="gate-brand">
          <Logo size={58} />
          <div>
            <h1>{gameName}</h1>
            <p>{TAGLINE_TA}</p>
          </div>
        </div>

        <label className="field">
          <span>Your name <em>· உங்கள் பெயர்</em></span>
          <div className={`input-wrap ${touched && !valid ? 'is-invalid' : ''}`}>
            <UserIcon />
            <input
              ref={inputRef}
              type="text"
              value={name}
              maxLength={20}
              autoComplete="off"
              spellCheck={false}
              placeholder="Type your name"
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched(true)}
            />
          </div>
          {touched && !valid && <small className="field-error">Please enter your name (at least 2 letters) · பெயரை உள்ளிடவும்</small>}
        </label>

        <div className="field">
          <span>I am a <em>· நான்</em></span>
          <div className="role-row">
            {ROLES.map((r) => (
              <button key={r.id} type="button" className={`role ${role === r.id ? 'is-active' : ''}`} aria-pressed={role === r.id} onClick={() => { audio.unlock(); audio.click(); setRole(r.id); }}>
                <b>{r.label}</b>
                <small>{r.labelTa}</small>
              </button>
            ))}
          </div>
        </div>

        <ul className="gate-rules">
          <li><ClockIcon /> Read the item before the timer ends</li>
          <li><MouseIcon /> Tap or click the right bin <span className="keys-hint">(or press <kbd>1</kbd>–<kbd>4</kbd>)</span></li>
          <li><HeartIcon /> {MAX_LIVES} wrong bins and you are out</li>
        </ul>

        {error ? (
          <p className="gate-error">{error}</p>
        ) : (
          <button type="submit" className="btn btn-play btn-block" disabled={!ready}>
            {ready ? (
              <>
                <PlayIcon /> Start Game <ArrowRight className="btn-arrow" />
              </>
            ) : (
              <>
                <span className="spinner" /> Loading 3D models… {Math.round(progress * 100)}%
              </>
            )}
            {!ready && <i className="btn-progress" style={{ transform: `scaleX(${progress})` }} />}
          </button>
        )}
      </form>
    </div>
  );
}

// ── pause ───────────────────────────────────────────────────────────────────
export function PauseMenu({ onResume, onRestart, onHome }) {
  return (
    <div className="overlay">
      <div className="panel pause">
        <h2>Paused</h2>
        <p>இடைநிறுத்தப்பட்டது</p>
        <button type="button" className="btn btn-play btn-block" onClick={onResume} autoFocus>
          <PlayIcon /> Resume
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={onRestart}>
          <RefreshIcon /> Restart
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={onHome}>
          <HomeIcon /> Home
        </button>
      </div>
    </div>
  );
}

// ── results ─────────────────────────────────────────────────────────────────
function useCountUp(target, ms = 1100) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf;
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      setValue(Math.round(target * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

export function Results({ game, player, onAgain, onChangePlayer, onHome }) {
  const score = useCountUp(game.score);
  const rank = rankFor(game.score);
  const { result } = game;
  // The board holds one row per player: their best score.
  const scores = result?.scores ?? loadScores();
  const top = scores.slice(0, 5);
  const mine = scores.find((s) => s.id === result?.id);
  const isPersonalBest = Boolean(result?.isPersonalBest);
  const headline =
    isPersonalBest && result.rank === 1 ? 'New high score!' : isPersonalBest ? 'New personal best!' : game.score > 0 ? 'Well played!' : 'Keep practising!';

  return (
    <div className="overlay">
      <div className="panel results">
        <header className="results-head">
          <small>Game over · விளையாட்டு முடிந்தது</small>
          <h2>{headline}</h2>
          <p>
            <b>{player.name}</b> · {roleLabel(player.role)}
          </p>
        </header>

        <div className="results-body">
          <section className="score-block">
            <div className="score-ring">
              <small>Your score</small>
              <b>{score}</b>
              <span className="stars">
                {[1, 2, 3].map((n) => (
                  <StarIcon key={n} width={26} height={26} className={n <= rank.stars ? 'is-on' : ''} style={{ animationDelay: `${0.5 + n * 0.18}s` }} />
                ))}
              </span>
            </div>
            <p className="rank">
              {rank.title}
              <em>{rank.titleTa}</em>
            </p>
            <p className={`best-line ${isPersonalBest ? 'is-new' : ''}`}>
              <TrophyIcon width={16} height={16} />
              {isPersonalBest ? (
                <span>New personal best! <em>· புதிய சிறந்த மதிப்பெண்</em></span>
              ) : (
                <span>Your best score: <b>{result?.best ?? game.score}</b> <em>· உங்கள் சிறந்த மதிப்பெண்</em></span>
              )}
            </p>
            <dl className="stats">
              <div><dt>Correct</dt><dd>{game.correct}</dd></div>
              <div><dt>Accuracy</dt><dd>{result?.accuracy ?? 0}%</dd></div>
              <div><dt>Best streak</dt><dd>{game.bestStreak}</dd></div>
              <div><dt>Level</dt><dd>{game.level}</dd></div>
            </dl>
          </section>

          <section className="side-block">
            <h3>Learn from your mistakes <em>· தவறுகளிலிருந்து கற்றுக்கொள்ளுங்கள்</em></h3>
            <ul className="mistakes">
              {game.mistakes.map((m, i) => (
                <li key={i}>
                  <span className="mistake-name">
                    <b>{m.item.en}</b>
                    <small>{m.item.ta}</small>
                  </span>
                  <span className="mistake-bins">
                    {m.chosen >= 0 ? <BinDot index={m.chosen}><s>{BINS[m.chosen].name}</s></BinDot> : <i className="bin-dot is-time">Time up</i>}
                    <ArrowRight width={16} height={16} />
                    <BinDot index={m.correct} />
                  </span>
                </li>
              ))}
            </ul>

            <h3><TrophyIcon width={18} height={18} /> Top scores <em>· each player's best · ஒவ்வொருவரின் சிறந்த மதிப்பெண்</em></h3>
            <ol className="board">
              {top.map((s, i) => (
                <li key={s.id} className={s.id === result?.id ? 'is-me' : ''}>
                  <span className="pos">{i + 1}</span>
                  <span className="who">{s.name}<small>{roleLabel(s.role)}</small></span>
                  <b>{s.score}</b>
                </li>
              ))}
              {mine && !top.includes(mine) && (
                <li className="is-me">
                  <span className="pos">{result.rank}</span>
                  <span className="who">{mine.name}<small>{roleLabel(mine.role)}</small></span>
                  <b>{mine.score}</b>
                </li>
              )}
            </ol>
          </section>
        </div>

        <footer className="results-actions">
          <button type="button" className="btn btn-play" onClick={onAgain} autoFocus>
            <RefreshIcon /> Play Again
          </button>
          <button type="button" className="btn btn-ghost" onClick={onChangePlayer}>
            <UserIcon /> New Player
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            <HomeIcon /> Home
          </button>
        </footer>
      </div>
    </div>
  );
}
