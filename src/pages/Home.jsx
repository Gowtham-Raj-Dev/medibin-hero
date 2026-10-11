import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BINS, ITEMS, RANKS, ROLES, GAME_NAME, TAGLINE, TAGLINE_TA, MAX_LIVES } from '../game/data.js';
import { audio } from '../game/audio.js';
import { enterImmersive } from '../game/immersive.js';
import { loadScores } from '../game/storage.js';
import BinGuideVideo from '../components/BinGuideVideo.jsx';
import SoundToggles from '../components/SoundToggles.jsx';
import { Logo, PlayIcon, PhoneIcon, MonitorIcon, HeartIcon, ClockIcon, MouseIcon, ArrowRight, StarIcon, TrophyIcon, RefreshIcon } from '../components/icons.jsx';
import '../styles/home.css';

const STEPS = [
  { icon: <ClockIcon />, title: 'A waste item appears', ta: 'ஒரு கழிவுப் பொருள் தோன்றும்', text: 'Read its name before the timer runs out.' },
  { icon: <MouseIcon />, title: 'Pick the right bin', ta: 'சரியான தொட்டியைத் தேர்ந்தெடுங்கள்', text: 'Tap or click a bin, or press keys 1 – 4.' },
  { icon: <HeartIcon />, title: `${MAX_LIVES} chances only`, ta: 'மூன்று வாய்ப்புகள் மட்டும்', text: 'Three wrong bins and the game is over.' },
];

const STATS = [
  { value: BINS.length, label: 'Colour-coded bins', color: 'var(--yellow)' },
  { value: ITEMS.length, label: 'Hospital waste items', color: 'var(--red)' },
  { value: 2, label: 'Languages · English + தமிழ்', color: 'var(--blue)' },
  { value: MAX_LIVES, label: 'Lives per game', color: 'var(--green)' },
];

const BASE = import.meta.env.BASE_URL;
const GAMEPLAY = { src: `${BASE}video/gameplay.mp4`, poster: `${BASE}video/gameplay.jpg` };

/** Gameplay video in the hero: a poster with a play button; nothing is downloaded until it is pressed. */
function GameplayVideo({ onPlayGame }) {
  const videoRef = useRef(null);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);

  const start = () => {
    const video = videoRef.current;
    video.currentTime = 0;
    setStarted(true);
    video.play().catch(() => {});
  };

  return (
    <div className="game-visual">
      <video
        ref={videoRef}
        src={GAMEPLAY.src}
        poster={GAMEPLAY.poster}
        title="MediBin Hero gameplay video"
        controls={started}
        playsInline
        preload="none"
        onPlay={() => { setStarted(true); setEnded(false); }}
        onSeeking={() => setEnded(false)}
        onEnded={() => setEnded(true)}
      />
      {!started && (
        <>
          <span className="live-badge"><i /> Gameplay video · விளையாட்டு வீடியோ</span>
          <button type="button" className="guide-start" onClick={start} aria-label="Play the gameplay video">
            <span className="video-play"><PlayIcon width={30} height={30} /></span>
          </button>
        </>
      )}
      {ended && (
        <div className="guide-end">
          <button type="button" className="btn btn-play" onClick={onPlayGame}>
            <PlayIcon /> Play Now <ArrowRight className="btn-arrow" />
          </button>
          <button type="button" className="btn btn-ghost" onClick={start}>
            <RefreshIcon width={18} height={18} /> Watch again · மீண்டும் பார்க்க
          </button>
        </div>
      )}
    </div>
  );
}

const roleLabel = (id) => ROLES.find((r) => r.id === id)?.label ?? '';

export default function Home() {
  const navigate = useNavigate();
  const [scores] = useState(() => loadScores().slice(0, 5));

  const play = () => {
    enterImmersive(); // phones: go fullscreen + landscape straight from this tap
    audio.unlock();
    audio.click();
    navigate('/play');
  };

  return (
    <div className="home">
      <div className="home-bg" aria-hidden>
        <span className="blob blob-yellow" />
        <span className="blob blob-red" />
        <span className="blob blob-blue" />
        <span className="blob blob-green" />
      </div>

      <header className="nav">
        <a className="brand" href={BASE} onClick={(e) => { e.preventDefault(); navigate('/'); }}>
          <Logo size={40} />
          <span className="brand-name">{GAME_NAME}</span>
        </a>
        <nav className="nav-links">
          <a href="#how">How to play</a>
          <a href="#bins">Bin guide</a>
          <a href="#ranks">Ranks</a>
        </nav>
        <div className="nav-actions">
          <SoundToggles />
          <button type="button" className="btn btn-ghost" onClick={play}>
            <PlayIcon width={16} height={16} /> Play
          </button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="dot-row">{BINS.map((b) => <i key={b.id} style={{ background: b.color }} />)}</span>
              Bio-Medical Waste Training Game
            </span>
            <h1>
              MediBin <span className="accent">Hero</span>
            </h1>
            <p className="hero-tag">{TAGLINE}</p>
            <p className="hero-ta">{TAGLINE_TA}</p>
            <p className="hero-lead">
              A 3D game for hospital staff and the public. Hospital waste appears one by one — drop each item into the
              correct colour-coded bin and learn safe waste segregation while you play.
            </p>
            <div className="hero-actions">
              <button type="button" className="btn btn-play" onClick={play}>
                <PlayIcon /> Play Now <ArrowRight className="btn-arrow" />
              </button>
              <a className="btn btn-ghost" href="#how">How to play</a>
            </div>
            <ul className="platforms">
              <li><MonitorIcon /> Laptop / desktop — any browser</li>
              <li><PhoneIcon /> Mobile — full screen · முழுத்திரை</li>
            </ul>
          </div>

          <div className="hero-visual">
            <GameplayVideo onPlayGame={play} />
          </div>
        </section>

        <ul className="stat-bar">
          {STATS.map((s) => (
            <li key={s.label} style={{ '--accent': s.color }}>
              <b>{s.value}</b>
              <span>{s.label}</span>
            </li>
          ))}
        </ul>

        <section className="how" id="how">
          <header className="section-head">
            <span className="kicker">விளையாடுவது எப்படி</span>
            <h2>How to play</h2>
            <p>Three simple rules — that is all you need to start.</p>
          </header>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="step-no" aria-hidden>{i + 1}</span>
                <span className="step-icon">{s.icon}</span>
                <strong>{s.title}</strong>
                <em>{s.ta}</em>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="bins" id="bins">
          <header className="section-head">
            <span className="kicker">உங்கள் தொட்டிகளை அறிந்து கொள்ளுங்கள்</span>
            <h2>Know your bins</h2>
            <p>Watch what goes into each bin — in English or தமிழ். The same colour code as your hospital posters.</p>
          </header>
          <BinGuideVideo onPlayGame={play} />
        </section>

        <section className="ranks" id="ranks">
          <header className="section-head">
            <span className="kicker">தரவரிசை</span>
            <h2>Climb the ranks</h2>
            <p>Faster answers and longer streaks score more. How far can you go?</p>
          </header>
          <div className="ranks-grid">
            <ol className="ladder">
              {RANKS.map((r, i) => (
                <li key={r.title} className={i === RANKS.length - 1 ? 'is-top' : ''}>
                  <span className="ladder-no">{i + 1}</span>
                  <div className="ladder-name">
                    <strong>{r.title}</strong>
                    <span>{r.titleTa}</span>
                  </div>
                  <span className="ladder-stars" aria-label={`${r.stars} of 3 stars`}>
                    {[0, 1, 2].map((n) => <StarIcon key={n} width={16} height={16} className={n < r.stars ? 'is-on' : ''} />)}
                  </span>
                  <b>{r.min}+ <small>pts</small></b>
                </li>
              ))}
            </ol>

            <aside className="board-card">
              <h3><TrophyIcon width={20} height={20} /> Top scores <em>on this device</em></h3>
              {scores.length > 0 ? (
                <ol className="home-board">
                  {scores.map((s, i) => (
                    <li key={s.id ?? s.name}>
                      <span className="pos">{i + 1}</span>
                      <span className="who">{s.name}<small>{roleLabel(s.role)}</small></span>
                      <b>{s.score}</b>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="board-empty">No scores yet. Play a round and your name goes first on the board.</p>
              )}
              <button type="button" className="btn btn-ghost btn-block" onClick={play}>
                <PlayIcon width={16} height={16} /> {scores.length > 0 ? 'Beat the top score' : 'Set the first score'}
              </button>
            </aside>
          </div>
        </section>

        <section className="cta-band">
          <span className="cta-stripe" aria-hidden>{BINS.map((b) => <i key={b.id} style={{ background: b.color }} />)}</span>
          <div>
            <h2>Ready to sort?</h2>
            <p>விளையாடத் தயாரா? Enter your name, beat the timer and top the leaderboard.</p>
          </div>
          <button type="button" className="btn btn-play" onClick={play}>
            <PlayIcon /> Play Now <ArrowRight className="btn-arrow" />
          </button>
        </section>
      </main>

      <footer className="footer">
        <span className="brand small"><Logo size={26} /> {GAME_NAME}</span>
        <span>Made for hospital staff and public awareness of bio-medical waste segregation.</span>
        <span>3D models: <a href="https://models.codelove.in/" target="_blank" rel="noreferrer">models.codelove.in</a></span>
      </footer>
    </div>
  );
}
