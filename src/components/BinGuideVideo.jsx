import { useEffect, useRef, useState } from 'react';
import { BINS } from '../game/data.js';
import guide from '../game/binGuide.json';
import { PlayIcon, ArrowRight, RefreshIcon } from './icons.jsx';

const LANGS = [
  { id: 'en', label: 'English', title: 'Bin guide video (English)' },
  { id: 'ta', label: 'தமிழ்', title: 'தொட்டி வழிகாட்டி வீடியோ (தமிழ்)' },
];
const file = (lang, ext) => `${import.meta.env.BASE_URL}video/bin-guide-${lang}.${ext}`;
const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/**
 * The "Know your bins" guide: one video per language (same pictures, different voice and
 * text, made by tools/guide-video) with a button per bin that jumps to its chapter. When a
 * video ends, a real Play Now button (onPlayGame) takes over from the one drawn in its end card.
 */
export default function BinGuideVideo({ onPlayGame }) {
  const videoRef = useRef(null);
  const resume = useRef(null); // { time, play } to apply once the other language's video is in place
  const [lang, setLang] = useState('en');
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [chapter, setChapter] = useState(-1); // index into BINS while that bin is on screen

  const chapters = guide[lang].chapters;
  const binStart = (index, language = lang) => guide[language].chapters.find((c) => c.id === BINS[index].id).t;

  const playFrom = (time) => {
    const video = videoRef.current;
    if (time !== undefined) video.currentTime = time;
    setStarted(true);
    video.play().catch(() => {});
  };

  // The two videos run at different speeds, so a switch restarts the chapter being watched.
  const switchLang = (next) => {
    if (next === lang) return;
    setEnded(false);
    const video = videoRef.current;
    if (started) resume.current = { time: chapter >= 0 ? binStart(chapter, next) : 0, play: !video.paused };
    setLang(next);
  };
  useEffect(() => {
    const pending = resume.current;
    resume.current = null;
    if (!pending) return;
    videoRef.current.currentTime = pending.time;
    if (pending.play) videoRef.current.play().catch(() => {});
  }, [lang]);

  const onTimeUpdate = (e) => {
    const t = e.currentTarget.currentTime;
    const current = chapters.filter((c) => t >= c.t - 0.05).pop();
    setChapter(BINS.findIndex((b) => b.id === current?.id));
  };

  const active = LANGS.find((l) => l.id === lang);
  return (
    <div className="guide">
      <div className="guide-bar">
        <div className="guide-langs" role="group" aria-label="Video language">
          {LANGS.map((l) => (
            <button key={l.id} type="button" className={l.id === lang ? 'is-on' : ''} aria-pressed={l.id === lang} lang={l.id} onClick={() => switchLang(l.id)}>
              {l.label}
            </button>
          ))}
        </div>
        <span className="guide-length">{clock(guide[lang].duration)} min · 3D guide · வீடியோ வழிகாட்டி</span>
      </div>

      <div className="guide-frame">
        <video
          key={lang}
          ref={videoRef}
          src={file(lang, 'mp4')}
          poster={file(lang, 'jpg')}
          title={active.title}
          controls={started}
          playsInline
          preload="none"
          onPlay={() => { setStarted(true); setEnded(false); }}
          onSeeking={() => setEnded(false)}
          onEnded={() => setEnded(true)}
          onTimeUpdate={onTimeUpdate}
        >
          <track kind="captions" srcLang={lang} label={active.label} src={file(lang, 'vtt')} />
        </video>
        {!started && (
          <button type="button" className="guide-start" onClick={() => playFrom()} aria-label={`Play: ${active.title}`}>
            <span className="video-play"><PlayIcon width={30} height={30} /></span>
          </button>
        )}
        {ended && (
          <div className="guide-end">
            <button type="button" className="btn btn-play" onClick={onPlayGame}>
              <PlayIcon /> Play Now <ArrowRight className="btn-arrow" />
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => playFrom(0)}>
              <RefreshIcon width={18} height={18} /> Watch again · மீண்டும் பார்க்க
            </button>
          </div>
        )}
      </div>

      <div className="guide-chapters">
        {BINS.map((bin, i) => (
          <button
            key={bin.id}
            type="button"
            className={`guide-chapter ${chapter === i ? 'is-on' : ''}`}
            style={{ '--bin': bin.color, '--bin-deep': bin.deep, '--bin-soft': bin.soft }}
            onClick={() => playFrom(binStart(i))}
          >
            <span className="bin-swatch" />
            <span className="guide-chapter-text">
              <b>{bin.name} bin</b>
              <span>{bin.nameTa} தொட்டி</span>
              <em>{bin.label} · {bin.labelTa}</em>
            </span>
            <time>{clock(binStart(i))}</time>
          </button>
        ))}
      </div>
    </div>
  );
}
