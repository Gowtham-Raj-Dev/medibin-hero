// Director of the gameplay promo. capture.mjs adds it to the real game page (/play, dev build,
// already on the virtual clock of clock.js) once the 3D models are loaded. It plays a round the
// way a person would — types a name, starts, sorts the waste — and adds a title and an end card.
// step() advances the game by one video frame; "cue" events say when the narration lines start
// and "sfx" events where build.py puts the sounds (the game's own audio is not recorded).
window.__promo = (() => {
  const FPS = 30;
  const { stage, controller } = window.__game;
  const PLAYER = 'Priya';
  // one entry per waste item: seconds of "thinking" before the answer, and what else happens then
  const ROUND = [
    { think: 3.5, cue: 'item' },
    { think: 1.5 },
    { think: 1.3, cue: 'points' },
    { think: 1.2 },
    { think: 1.1, cueOnPick: 'streak' }, // the fifth correct answer is a level up
    { think: 1.3 },
    { think: 1.7, wrong: true, cueOnPick: 'wrong' },
    { think: 1.3 },
    { think: 1.1 },
  ];

  // ── title and end card ────────────────────────────────────────────────────
  const LOGO = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 64 64">
    <defs><linearGradient id="promo-lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2ee6a8"/><stop offset="1" stop-color="#0b8f6c"/></linearGradient></defs>
    <rect width="64" height="64" rx="16" fill="url(#promo-lg)"/><rect x="14" y="17" width="36" height="7" rx="3.5" fill="#fff"/><rect x="26" y="11" width="12" height="6" rx="3" fill="#fff"/>
    <path d="M18 27h28l-3.2 23a4 4 0 0 1-4 3.4H25.2a4 4 0 0 1-4-3.4z" fill="#fff"/><path d="M29 33h6v5h5v6h-5v5h-6v-5h-5v-6h5z" fill="#0b8f6c"/></svg>`;
  const PLAY = '<svg width="34" height="34" viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg>';
  const ARROW = '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>';
  const BARS = ['#f5c518', '#e5352b', '#1f7fe0', '#2faa4f'].map((c) => `<i style="background:${c}"></i>`).join('');

  const style = document.createElement('style');
  style.textContent = `
    .promo { position: fixed; inset: 0; z-index: 100; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
      font-family: 'Baloo Thambi 2 Variable', 'Nirmala UI', sans-serif; color: #f1fbf8; text-align: center; opacity: 0; visibility: hidden;
      background: radial-gradient(900px 520px at 50% 42%, rgba(6, 40, 52, 0.93), rgba(3, 21, 28, 0.97)); transition: opacity 0.55s ease, visibility 0s 0.55s; }
    .promo.is-on { opacity: 1; visibility: visible; transition: opacity 0.55s ease; }
    .promo.is-curtain { background: #03151c; transition-duration: 0.3s; }
    .promo > * { opacity: 0; transform: translateY(18px); transition: opacity 0.45s ease, transform 0.45s ease; }
    .promo.is-on > * { opacity: 1; transform: none; }
    .promo.is-on > :nth-child(2) { transition-delay: 0.35s; }
    .promo.is-on > :nth-child(3) { transition-delay: 0.6s; }
    .promo.is-on > :nth-child(4) { transition-delay: 0.9s; }
    .promo.is-on > :nth-child(5) { transition-delay: 1.15s; }
    .promo .name { display: inline-flex; align-items: center; gap: 18px; font-weight: 800; font-size: 70px; line-height: 1; }
    .promo .tag { font-weight: 700; font-size: 42px; line-height: 1.2; background: linear-gradient(90deg, #f5c518, #ff8a5b 35%, #5cb4ff 68%, #4fe08a);
      -webkit-background-clip: text; background-clip: text; color: transparent; }
    .promo .row { display: flex; gap: 12px; margin-top: 6px; }
    .promo .row i { width: 54px; height: 12px; border-radius: 6px; }
    .promo .sub { color: #a8c7c9; font-weight: 600; font-size: 23px; }
    .promo .cta { display: inline-flex; align-items: center; gap: 16px; margin-top: 22px; padding: 18px 46px; border-radius: 999px; color: #04261c;
      background: linear-gradient(135deg, #7dffd0 0%, #2ee6a8 45%, #14c98f 100%); font-weight: 800; font-size: 42px; line-height: 1.15;
      box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.45) inset, 0 6px 0 #0a8f68, 0 0 0 12px rgba(46, 230, 168, 0.14), 0 26px 60px -12px rgba(46, 230, 168, 0.9);
      animation: promo-pulse 1.2s ease-in-out 1.6s infinite; }
    @keyframes promo-pulse { 50% { scale: 1.04; } }
    .promo-fade { position: fixed; inset: 0; z-index: 101; background: #000; opacity: 0; transition: opacity 0.5s ease; pointer-events: none; }
  `;
  document.head.appendChild(style);
  const card = (html, extra = '') => {
    const node = document.createElement('div');
    node.className = `promo ${extra}`;
    node.innerHTML = html;
    document.body.appendChild(node);
    return node;
  };
  const title = card(`<div class="name">${LOGO(80)}MediBin Hero</div><div class="tag">Right waste. Right bin. Every time.</div><div class="row">${BARS}</div><div class="sub">The 3D hospital waste sorting game · English + தமிழ்</div>`, 'is-on');
  const curtain = card('', 'is-curtain');
  const endCard = card(`<div class="name">${LOGO(72)}MediBin Hero</div><div class="tag">Right waste. Right bin. Every time.</div><div class="row">${BARS}</div><div class="cta">${PLAY}Play Now${ARROW}</div><div class="sub">Free in your browser · Laptop & mobile · English + தமிழ்</div>`);
  const fade = document.createElement('div');
  fade.className = 'promo-fade';
  fade.style.opacity = 1; // the film opens from black
  document.body.appendChild(fade);

  // ── bookkeeping ───────────────────────────────────────────────────────────
  const events = [];
  let saved = 0; // frames kept so far = position in the finished video
  let saving = true;
  const videoTime = () => saved / FPS;
  const mark = (type, id, offset = 0) => events.push({ type, id, at: Math.round((videoTime() + offset) * 1000) / 1000 });

  // what the game does, turned into sound events
  let last = { count: -1, item: null, feedback: null, levelUp: 0, phase: 'idle' };
  function listen() {
    const s = controller.state;
    if (saving) {
      if (s.phase === 'countdown' && s.count !== last.count) mark('sfx', s.count > 0 ? 'beep' : 'go');
      if (s.phase === 'playing' && s.item && s.item.id !== last.item) mark('sfx', 'pop');
      if (s.feedback && s.feedback.id !== last.feedback) mark('sfx', s.feedback.kind === 'ok' ? 'ding' : 'buzz');
      if (s.levelUp !== last.levelUp && s.levelUp > 1) mark('sfx', 'levelup');
    }
    last = { count: s.phase === 'countdown' ? s.count : -1, item: s.item?.id ?? null, feedback: s.feedback?.id ?? null, levelUp: s.levelUp, phase: s.phase };
  }

  // ── the script (a generator: every yield is one frame) ────────────────────
  function* wait(seconds) {
    for (let i = Math.round(seconds * FPS); i > 0; i--) yield;
  }
  function* until(test, limit = 30) {
    for (let i = limit * FPS; i > 0 && !test(); i--) yield;
  }
  const phase = (name) => () => controller.state.phase === name;
  const correctBin = () => stage.bins.findIndex((b) => b.def.id === controller.state.item.bin);

  function* script() {
    yield;
    fade.style.opacity = 0;
    mark('cue', 'title', 0.5);
    yield* wait(3.9);
    title.classList.remove('is-on');
    yield* wait(0.7);

    // the name form
    mark('cue', 'gate', 0.6);
    const input = document.querySelector('.gate input');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    for (let i = 1; i <= PLAYER.length; i++) {
      setValue.call(input, PLAYER.slice(0, i));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      mark('sfx', 'key');
      yield* wait(0.16);
    }
    yield* wait(1.0);
    mark('sfx', 'click');
    document.querySelector('.gate').requestSubmit();
    yield* until(phase('playing'));

    // the round
    for (const turn of ROUND) {
      yield* until(phase('playing'));
      if (turn.cue) mark('cue', turn.cue, 0.2);
      const right = correctBin();
      const pick = turn.wrong ? (right + 2) % 4 : right;
      yield* wait(turn.think - 0.45);
      stage.highlight(pick);
      yield* wait(0.45);
      if (turn.cueOnPick) mark('cue', turn.cueOnPick, 0.75);
      controller.choose(pick);
      yield;
    }
    yield* until(phase('playing'));
    yield* wait(0.9);

    // cut to the end of the game: the last two chances are lost off camera
    curtain.classList.add('is-on');
    mark('sfx', 'whoosh');
    yield* wait(0.4);
    saving = false;
    while (controller.state.phase !== 'over') {
      if (controller.state.phase === 'playing') controller.choose((correctBin() + 2) % 4);
      yield;
    }
    saving = true;
    mark('sfx', 'fanfare', 0.3);
    mark('cue', 'results', 0.5);
    yield* wait(0.15);
    curtain.classList.remove('is-on');
    yield* wait(6.4);

    // end card
    endCard.classList.add('is-on');
    mark('sfx', 'whoosh');
    mark('cue', 'end', 0.8);
    yield* wait(7.4);
    fade.style.opacity = 1;
    yield* wait(0.6);
  }

  const run = script();
  return {
    events,
    /** Advance one frame. Returns { save, done }: whether to keep this frame, and whether the film is over. */
    async step() {
      window.__clock.tick(1000 / FPS);
      listen();
      const { done } = run.next();
      await window.__clock.settle();
      const save = saving && !done;
      if (save) saved += 1;
      return { save, done, frames: saved };
    },
  };
})();
