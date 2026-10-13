import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BINS, GAME_NAME, MAX_LIVES, ROLES } from '../game/data.js';
import { Stage } from '../game/stage.js';
import { GameController, initialState } from '../game/controller.js';
import { audio } from '../game/audio.js';
import { loadPlayer, savePlayer } from '../game/storage.js';
import { enterImmersive, exitImmersive } from '../game/immersive.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import SoundToggles from '../components/SoundToggles.jsx';
import { NameGate, PauseMenu, Results } from '../components/PlayPanels.jsx';
import { HeartIcon, FlameIcon, PauseIcon, HomeIcon, CheckIcon, CrossIcon, ClockIcon, RefreshIcon } from '../components/icons.jsx';
import '../styles/play.css';

const roleLabel = (id) => ROLES.find((r) => r.id === id)?.label ?? '';

export default function Play() {
  const navigate = useNavigate();
  // A phone or tablet held upright: the whole game screen is drawn sideways (see .play.is-rotated),
  // so everything from the name form to the results is landscape.
  const uprightTouch = useMediaQuery('(pointer: coarse) and (orientation: portrait)');
  const mountRef = useRef(null);
  const stageRef = useRef(null);
  const gameRef = useRef(null);
  const timerRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [gpuLost, setGpuLost] = useState(false);
  const [game, setGame] = useState(initialState);
  const [player, setPlayer] = useState(loadPlayer);
  const [layout, setLayout] = useState(null);
  const [hover, setHover] = useState(-1);

  // Build the 3D stage and the game controller once.
  useEffect(() => {
    let stage;
    try {
      stage = new Stage(mountRef.current, {
        onBinClick: (i) => gameRef.current?.choose(i),
        onBinHover: (i) => {
          setHover(i);
          if (i >= 0) audio.hover();
        },
        onLayout: setLayout,
        onContextLost: () => {
          gameRef.current?.pause();
          setGpuLost(true);
        },
      });
    } catch (err) {
      console.error(err);
      setError('This browser could not start 3D graphics (WebGL). Please try the latest Chrome, Edge or Firefox.');
      return undefined;
    }
    const controller = new GameController(stage, {
      onChange: setGame,
      onTimer: (frac) => {
        const el = timerRef.current;
        if (!el) return;
        el.style.transform = `scaleX(${frac})`;
        el.dataset.low = frac < 0.3 ? 'true' : 'false';
      },
    });
    stageRef.current = stage;
    gameRef.current = controller;
    if (import.meta.env.DEV) window.__game = { stage, controller }; // handy in the dev console
    stage
      .load(setProgress)
      .then(() => setReady(true))
      .catch((err) => {
        console.error(err);
        setError('The 3D models could not be loaded. Check your connection and reload the page.');
      });
    return () => {
      controller.dispose();
      stage.dispose();
      audio.stopMusic();
      exitImmersive();
      stageRef.current = gameRef.current = null;
    };
  }, []);

  const rotated = uprightTouch;
  useEffect(() => {
    if (stageRef.current) stageRef.current.rotated = rotated;
  }, [rotated]);

  // While the name form, pause menu or results cover the 3D view it only needs a light redraw.
  const covered = game.phase === 'idle' || game.phase === 'paused' || game.phase === 'over';
  useEffect(() => {
    if (stageRef.current) stageRef.current.dimmed = covered;
  }, [covered]);

  const choose = useCallback((i) => gameRef.current?.choose(i), []);

  // Keyboard: 1-4 pick a bin, Esc / P pause.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.repeat) return;
      const index = BINS.findIndex((b) => b.key === e.key);
      if (index >= 0) choose(index);
      else if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
        const g = gameRef.current;
        if (g?.state.phase === 'playing') g.pause();
        else if (g?.state.phase === 'paused') g.resume();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choose]);

  // Pause automatically when the tab is hidden.
  useEffect(() => {
    const onHide = () => document.hidden && gameRef.current?.pause();
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  const start = (next) => {
    enterImmersive(); // phones: fullscreen + landscape (needs this tap)
    audio.unlock();
    audio.click();
    savePlayer(next);
    setPlayer(next);
    gameRef.current?.start(next);
  };
  const resume = () => {
    enterImmersive();
    audio.click();
    gameRef.current?.resume();
  };
  const goHome = () => {
    audio.click();
    navigate('/');
  };

  const { phase, item, feedback } = game;
  const inGame = phase !== 'idle';
  const canPick = phase === 'playing';
  const fbBin = feedback ? BINS[feedback.kind === 'ok' ? feedback.bin : feedback.correctBin] : null;

  return (
    <div className={`play phase-${phase} ${rotated ? 'is-rotated' : ''}`}>
      <div ref={mountRef} className="stage-mount" />
      {feedback && <div key={feedback.id} className={`screen-flash flash-${feedback.kind}`} />}

      {inGame && (
        <>
          <div className="hud hud-left">
            <button type="button" className="icon-btn" onClick={goHome} title="Home" aria-label="Back to home">
              <HomeIcon />
            </button>
            <div className="player-chip">
              <span className="avatar">{player.name.trim().charAt(0).toUpperCase() || 'P'}</span>
              <span className="player-meta">
                <b>{player.name}</b>
                <small>{roleLabel(player.role)}</small>
              </span>
            </div>
            <div className="score-chip">
              <small>Score</small>
              <b key={game.score} className="bump">{game.score}</b>
            </div>
            <div className="level-chip">
              <small>Level</small>
              <b>{game.level}</b>
            </div>
          </div>

          <div className="hud hud-right">
            {game.streak >= 2 && (
              <div key={game.streak} className="streak-chip bump">
                <FlameIcon width={18} height={18} /> {game.streak} <span>streak</span>
              </div>
            )}
            <div className="lives" aria-label={`${game.lives} chances left`}>
              {Array.from({ length: MAX_LIVES }, (_, i) => (
                <HeartIcon key={i} width={28} height={28} className={i < game.lives ? 'heart' : 'heart is-lost'} />
              ))}
            </div>
            <button type="button" className="icon-btn" onClick={() => gameRef.current?.pause()} disabled={phase !== 'playing'} title="Pause (Esc)" aria-label="Pause">
              <PauseIcon />
            </button>
            <SoundToggles />
          </div>

          <div className={`item-card ${item && phase !== 'over' ? 'is-visible' : ''}`}>
            <small>Which bin? · எந்த தொட்டி?</small>
            <strong key={item?.id}>{item?.en ?? ' '}</strong>
            <span>{item?.ta ?? ' '}</span>
            <div className="timer">
              <i ref={timerRef} />
            </div>
          </div>

          {layout && (
            <div className="bin-keys">
              {BINS.map((bin, i) => (
                <button
                  key={bin.id}
                  type="button"
                  className={`bin-key ${hover === i ? 'is-hover' : ''}`}
                  style={{ left: layout.bins[i].base.x, top: layout.bins[i].base.y, '--bin': bin.color, '--bin-ink': bin.ink }}
                  disabled={!canPick}
                  onClick={() => choose(i)}
                  onMouseEnter={() => canPick && stageRef.current?.highlight(i)}
                  onMouseLeave={() => stageRef.current?.highlight(-1)}
                >
                  <kbd>{bin.key}</kbd>
                  <span>
                    <b>{bin.name}</b>
                    <small>{bin.nameTa}</small>
                  </span>
                </button>
              ))}
            </div>
          )}

          {feedback && layout && (
            <div key={feedback.id} className={`feedback fb-${feedback.kind}`} style={{ left: layout.item.x, top: layout.item.y }}>
              {feedback.kind === 'ok' ? (
                <>
                  <span className="fb-icon"><CheckIcon width={30} height={30} /></span>
                  <b>Correct! <em>சரி!</em></b>
                  <span className="fb-points">+{feedback.points}</span>
                </>
              ) : (
                <>
                  <span className="fb-icon">{feedback.kind === 'timeout' ? <ClockIcon width={30} height={30} /> : <CrossIcon width={30} height={30} />}</span>
                  <b>{feedback.kind === 'timeout' ? "Time's up!" : 'Wrong bin!'} <em>{feedback.kind === 'timeout' ? 'நேரம் முடிந்தது!' : 'தவறான தொட்டி!'}</em></b>
                  <span className="fb-answer">
                    {feedback.item.en} goes in the
                    <i style={{ background: fbBin.color, color: fbBin.ink }}>{fbBin.name} bin</i>
                  </span>
                  <span className="fb-answer-ta">{fbBin.nameTa} தொட்டியில் போட வேண்டும் — {fbBin.labelTa}</span>
                </>
              )}
            </div>
          )}

          {game.levelUp > 1 && (
            <div key={game.levelUp} className="level-banner">
              <small>Level up!</small>
              <b>Level {game.levelUp}</b>
              <span>Faster now · இன்னும் வேகமாக!</span>
            </div>
          )}

          {phase === 'countdown' && (
            <div className="countdown">
              <b key={game.count}>{game.count > 0 ? game.count : 'GO!'}</b>
              <span>{game.count > 0 ? 'Get ready · தயாராகுங்கள்' : 'Sort the waste!'}</span>
            </div>
          )}
        </>
      )}

      {phase === 'idle' && (
        <NameGate gameName={GAME_NAME} player={player} ready={ready} progress={progress} error={error} onStart={start} onHome={goHome} />
      )}
      {phase === 'paused' && (
        <PauseMenu onResume={resume} onRestart={() => start(player)} onHome={goHome} />
      )}
      {gpuLost && (
        <div className="overlay overlay-top">
          <div className="panel pause">
            <h2>3D graphics stopped</h2>
            <p>The browser paused the 3D view. Reload the page to continue · பக்கத்தை மீண்டும் ஏற்றவும்</p>
            <button type="button" className="btn btn-play btn-block" onClick={() => window.location.reload()}>
              <RefreshIcon /> Reload
            </button>
          </div>
        </div>
      )}
      {phase === 'over' && (
        <Results game={game} player={player} onAgain={() => start(player)} onChangePlayer={() => { audio.click(); gameRef.current?.reset(); }} onHome={goHome} />
      )}
    </div>
  );
}
