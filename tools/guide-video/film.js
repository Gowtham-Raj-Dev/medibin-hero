// Director of the bin-guide video. It puts the game's own 3D stage (room, bins, staff and item
// models) on a virtual clock: frame(i) draws exactly the picture at i / 30 s, so capture.mjs can
// save every frame however long the computer needs to draw it. The pictures are the same in both
// languages; only the texts and the length of each line (taken from the narration) differ.
import * as THREE from 'three';
import { Stage } from '../../src/game/stage.js';
import { BINS, ITEMS, GAME_NAME } from '../../src/game/data.js';
import { BIN_SIZE } from '../../src/game/bins3d.js';
import { createItemModel } from '../../src/game/items3d.js';
import { canvasTexture, drawBiohazard, enableShadows, fitToSize, ease } from '../../src/game/three-utils.js';
import script from './script.json';

const FPS = 30;
const W = 1280;
const H = 720;

// where things stand (metres)
const ROW = (i) => new THREE.Vector3((i - 1.5) * 1.14, 0, 0); // the four bins side by side, as in the game
const HERO = new THREE.Vector3(-1.02, 0, 1.6); // the bin being explained steps forward to here
const SPOT = new THREE.Vector3(0.13, 1.74, 1.9); // its waste floats here before dropping in
const CAMERAS = {
  far: { pos: [0, 2.85, 6.6], tgt: [0, 1.3, 0] },
  wide: { pos: [0, 2.42, 5.35], tgt: [0, 1.14, 0] },
  hero: { pos: [0.3, 1.56, 5.7], tgt: [0.3, 1.13, 1.6] },
  recap: { pos: [0, 2.3, 5.5], tgt: [0, 1.22, 0] },
  out: { pos: [0, 2.5, 6.0], tgt: [0, 1.25, 0] },
};
// how 1 – 4 models of one entry are arranged around SPOT: [x, y] offsets and a size factor
const LAYOUT = {
  1: { scale: 1.42, at: [[0, 0]] },
  2: { scale: 1.02, at: [[-0.33, 0], [0.33, 0]] },
  3: { scale: 0.82, at: [[-0.44, -0.04], [0, 0.1], [0.44, -0.04]] },
  4: { scale: 0.64, at: [[-0.34, 0.2], [0.34, 0.2], [-0.34, -0.27], [0.34, -0.27]] },
};
const PARK_X = 6.6; // how far right of their place in the row the waiting bins stand (out of frame)
const EXIT = new THREE.Vector3(-5.4, 0, 1.6); // a finished bin slides out of frame to here
const ARRIVE = 1.3; // seconds from the start of a bin's part until it stands at HERO
const FLY = 0.44;
const DROP = 0.14;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, k) => a + (b - a) * k;

// ── timeline ────────────────────────────────────────────────────────────────
/** Every moment of the film, from the lengths (seconds) of the narration lines. */
function buildTimeline(dur) {
  const cues = [];
  const sfx = [];
  const say = (id, at) => {
    cues.push({ id, at: Math.round(at * 1000) / 1000 });
    return at + dur[id];
  };
  const T = { intro: [], sections: [], recap: [] };
  let t = 0.8;
  let end = t;
  for (const line of script.intro) {
    const at = t;
    end = say(line.id, at);
    T.intro.push({ id: line.id, at, end });
    t = end + 0.4;
  }
  T.introEnd = end + 0.55;

  t = T.introEnd;
  for (const bin of script.bins) {
    const sec = { t0: t, entries: [] };
    sfx.push({ kind: 'whoosh', at: t + 0.1 });
    end = say(bin.id, t + 0.8);
    t = Math.max(end + 0.35, sec.t0 + ARRIVE + 0.4);
    for (const item of bin.items) {
      const n = item.models.length;
      const d = Math.max(dur[item.id] + 0.85 + (n - 1) * 0.13, 2.3);
      say(item.id, t + 0.3);
      const flights = item.models.map((_, j) => t + d - 0.62 - (n - 1 - j) * 0.13);
      flights.forEach((f0, j) => sfx.push({ kind: j === n - 1 ? 'ding' : 'pop', at: f0 + FLY }));
      sec.entries.push({ s: t, d, flights, land: flights[n - 1] + FLY });
      t += d;
    }
    t += 0.55;
    sec.t1 = t;
    T.sections.push(sec);
  }

  T.out0 = t;
  sfx.push({ kind: 'whoosh', at: t + 0.1 });
  t += 1.55;
  for (const line of script.recap) {
    const at = t;
    end = say(line.id, at);
    sfx.push({ kind: 'chime', at });
    T.recap.push({ at, end });
    t = end + 0.3;
  }
  T.endAt = t + 0.3;
  T.end1 = T.endAt + 0.75;
  end = say(script.end[0].id, T.end1);
  T.end2 = end + 0.45;
  end = say(script.end[1].id, T.end2);
  T.total = end + 3.0; // the end card stays up for a moment after the last word
  T.frames = Math.ceil(T.total * FPS);
  T.cues = cues;
  T.sfx = sfx;
  return T;
}

// ── a model the game doesn't have: pathological / lab waste ────────────────
function labWaste() {
  const g = new THREE.Group();
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...o });
  const clear = (opacity) =>
    new THREE.MeshPhysicalMaterial({ color: 0xf2f8ff, transparent: true, opacity, roughness: 0.05, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.8 });
  const add = (geometry, material, x, y, z, parent = g) => {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // specimen container with a tissue sample
  const cup = new THREE.Group();
  add(new THREE.CylinderGeometry(0.17, 0.14, 0.36, 28, 1, true), clear(0.4), 0, 0.18, 0, cup);
  add(new THREE.CylinderGeometry(0.14, 0.14, 0.012, 28), clear(0.5), 0, 0.006, 0, cup);
  add(new THREE.CylinderGeometry(0.156, 0.136, 0.19, 28), new THREE.MeshStandardMaterial({ color: 0xf0c9a2, transparent: true, opacity: 0.8, roughness: 0.15 }), 0, 0.105, 0, cup);
  add(new THREE.IcosahedronGeometry(0.075, 2), std(0xb8434e, { roughness: 0.6 }), 0.02, 0.09, 0.02, cup).scale.set(1.2, 0.8, 1);
  add(new THREE.CylinderGeometry(0.19, 0.19, 0.07, 28), std(0xf5c518, { roughness: 0.4 }), 0, 0.385, 0, cup);
  add(new THREE.CylinderGeometry(0.195, 0.195, 0.02, 28), std(0xd9a900, { roughness: 0.4 }), 0, 0.36, 0, cup);
  const label = canvasTexture(256, 160, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f5c518';
    ctx.fillRect(0, 0, w, 22);
    drawBiohazard(ctx, 62, 92, 46, '#16191d');
    ctx.fillStyle = '#16191d';
    ctx.font = '700 30px Arial';
    ctx.fillText('LAB', 124, 78);
    ctx.fillRect(124, 96, 104, 6);
    ctx.fillRect(124, 114, 76, 6);
    ctx.fillRect(124, 132, 96, 6);
  });
  add(new THREE.CylinderGeometry(0.168, 0.15, 0.2, 28, 1, true, -1.05, 2.1), std(0xffffff, { map: label, roughness: 0.6, side: THREE.DoubleSide }), 0, 0.19, 0, cup);
  cup.position.set(-0.23, 0, -0.05);
  g.add(cup);

  // culture plate
  const dish = new THREE.Group();
  add(new THREE.CylinderGeometry(0.25, 0.25, 0.05, 36, 1, true), clear(0.45), 0, 0.025, 0, dish);
  add(new THREE.CylinderGeometry(0.242, 0.242, 0.026, 36), std(0xb5232d, { roughness: 0.25 }), 0, 0.014, 0, dish);
  const colony = std(0xf3ecd2, { roughness: 0.7 });
  for (const [x, z, r] of [[0.05, 0.03, 0.03], [-0.09, 0.08, 0.022], [0.12, -0.09, 0.026], [-0.04, -0.12, 0.034], [-0.14, -0.03, 0.018], [0.03, 0.15, 0.02], [0.15, 0.07, 0.016]]) {
    add(new THREE.SphereGeometry(r, 12, 8), colony, x, 0.028, z, dish).scale.y = 0.35;
  }
  const lid = new THREE.Group();
  add(new THREE.CylinderGeometry(0.262, 0.262, 0.04, 36, 1, true), clear(0.35), 0, 0, 0, lid);
  add(new THREE.CylinderGeometry(0.262, 0.262, 0.008, 36), clear(0.22), 0, 0.02, 0, lid);
  lid.position.set(0.16, 0.1, -0.05);
  lid.rotation.z = -0.5;
  dish.add(lid);
  dish.position.set(0.25, 0, 0.1);
  g.add(dish);

  enableShadows(g);
  const tilt = new THREE.Group();
  tilt.add(fitToSize(g, 0.66));
  tilt.rotation.set(0.42, 0, 0);
  return tilt;
}

// ── overlay texts ───────────────────────────────────────────────────────────
const LOGO = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 64 64">
  <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2ee6a8"/><stop offset="1" stop-color="#0b8f6c"/></linearGradient></defs>
  <rect width="64" height="64" rx="16" fill="url(#lg)"/><rect x="14" y="17" width="36" height="7" rx="3.5" fill="#fff"/><rect x="26" y="11" width="12" height="6" rx="3" fill="#fff"/>
  <path d="M18 27h28l-3.2 23a4 4 0 0 1-4 3.4H25.2a4 4 0 0 1-4-3.4z" fill="#fff"/><path d="M29 33h6v5h5v6h-5v5h-6v-5h-5v-6h5z" fill="#0b8f6c"/></svg>`;
const TICK = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#22c55e"/><path d="m6.6 12.4 3.6 3.6 7.2-7.6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const PLAY = '<svg width="34" height="34" viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg>';
const ARROW = '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>';

function el(parent, tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html != null) node.innerHTML = html;
  parent.appendChild(node);
  return node;
}
function show(node, opacity, transform) {
  node.style.opacity = opacity;
  node.style.visibility = opacity <= 0.002 ? 'hidden' : 'visible';
  if (transform !== undefined) node.style.transform = transform;
}
const binVars = (def) => `--bin:${def.color};--bin-deep:${def.deep};--bin-soft:${def.soft};--bin-ink:${def.ink}`;

function buildOverlay(lang) {
  const ui = document.getElementById('ui');
  const text = script.ui[lang];
  ui.lang = lang;
  const o = {};
  o.scrim = el(ui, 'div', 'scrim');
  o.title = el(ui, 'div', 'title', `<div class="name">${LOGO(78)}${GAME_NAME}</div><div class="head">${text.titleHead}</div><div class="sub2">${text.titleSub}</div>`);
  o.brand = el(ui, 'div', 'brand', `${LOGO(36)}${GAME_NAME}<span>${text.brand}</span><div class="dots">${BINS.map((b) => `<i style="background:${b.color}"></i>`).join('')}</div>`);
  o.dots = [...o.brand.querySelectorAll('i')];
  o.panels = script.bins.map((bin, k) => {
    const panel = el(ui, 'div', 'panel', `<header><span class="swatch"></span><div><h2>${bin[lang].name}</h2><span>${bin[lang].label}</span></div></header>`);
    panel.style.cssText = binVars(BINS[k]);
    const list = el(panel, 'ul');
    const rows = bin.items.map((item) => {
      const li = el(list, 'li', '', item[lang].label + TICK);
      return { li, tick: li.querySelector('svg') };
    });
    return { panel, rows };
  });
  o.cap = el(ui, 'div', 'cap', '<b></b>');
  o.capText = o.cap.firstChild;
  o.sub = el(ui, 'div', 'sub', '<b></b>');
  o.subText = o.sub.firstChild;
  o.chips = script.bins.map((bin, k) => {
    const chip = el(ui, 'div', 'chip', `<b>${lang === 'ta' ? BINS[k].nameTa : BINS[k].name}</b><span>${bin[lang].label}</span>`);
    chip.style.cssText = binVars(BINS[k]);
    return chip;
  });
  o.end = el(ui, 'div', 'end', `<div class="name">${LOGO(72)}${GAME_NAME}</div><div class="tag">${text.tagline}</div><div class="row">${BINS.map((b) => `<i style="background:${b.color}"></i>`).join('')}</div><div class="cta">${PLAY}${text.cta}${ARROW}</div><div class="cta-sub">${text.ctaSub}</div>`);
  o.endParts = [...o.end.children];
  o.fade = el(ui, 'div', 'fade');
  return o;
}

// ── the film ────────────────────────────────────────────────────────────────
let stage;
let T;
let lang;
let overlay;
let halo;
let okIcon;
let shots = [];
let shotIndex = 0;
let virtualMs = 0;
let captionEntry = null;
let subtitleLine = null;
const tmp = new THREE.Vector3();

const ready = (async () => {
  stage = new Stage(document.getElementById('stage'), { mode: 'game' });
  stage.renderer.setAnimationLoop(null); // frames are drawn by frame() only
  await stage.load();
  stage.itemRoot.visible = false;

  // one holder per model of every list entry
  const defs = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
  for (const bin of script.bins) {
    for (const item of bin.items) {
      item.objs = [];
      for (const id of item.models) {
        const holder = new THREE.Group();
        holder.add(id === 'lab' ? labWaste() : await createItemModel(defs[id]));
        holder.visible = false;
        stage.scene.add(holder);
        item.objs.push({ holder, from: new THREE.Vector3() });
      }
    }
  }
  halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: stage.halo.material.map, transparent: true, depthWrite: false, opacity: 0 }));
  halo.position.set(SPOT.x, SPOT.y, SPOT.z - 0.45);
  // the game's "correct" mark, smaller than in the game because the camera is much closer here
  okIcon = new THREE.Sprite(new THREE.SpriteMaterial({ map: stage._iconTextures.ok, transparent: true, depthTest: false }));
  okIcon.renderOrder = 12;
  okIcon.visible = false;
  stage.scene.add(halo, okIcon);
})();

function seededRandom(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function init(language, durations) {
  await ready;
  lang = language;
  T = buildTimeline(durations);
  overlay = buildOverlay(lang);
  await document.fonts.ready;

  // the stage reads the clock and rolls dice; give it ours so every run draws the same film
  Math.random = seededRandom(20261011);
  performance.now = () => virtualMs;
  stage._lastFrame = -1000 / FPS;
  stage.time = 0;
  stage.characters.forEach((c) => {
    c.idleAt = 1e9;
  });

  const at = (t, fn) => shots.push({ t, fn });
  const bins = stage.bins;
  at(0.5, () => stage.react('wave'));
  bins.forEach((bin, i) => {
    const t = T.intro[1].at + 0.25 + i * 0.34;
    at(t, () => {
      bin.setOpen(0.62);
      bin.squashVel = -2.2;
    });
    at(t + 0.95, () => bin.setOpen(0));
  });
  T.sections.forEach((sec, k) => {
    at(sec.t0 + ARRIVE - 0.1, () => bins[k].setOpen(1));
    script.bins[k].items.forEach((item, e) => {
      const entry = sec.entries[e];
      entry.flights.forEach((f0, j) => {
        at(f0 + FLY, () => {
          bins[k].catchItem(true);
          if (j < entry.flights.length - 1) return;
          const mouth = bins[k].mouth;
          stage._burst(mouth, ['#ffd43b', '#38e07b', '#4dabf7', '#ffffff', BINS[k].color], 16, 2.7);
        });
      });
    });
    at(sec.t1 - 0.5, () => stage.react('ok'));
    at(sec.t1 - 0.25, () => bins[k].setOpen(0));
  });
  T.recap.forEach((r, i) => at(r.at, () => bins[i].pulse(r.end - r.at + 0.3)));
  at(T.endAt - 0.2, () => stage.react('ok'));
  shots.sort((a, b) => a.t - b.t);

  const chapters = [{ id: 'intro', t: 0 }, ...T.sections.map((s, k) => ({ id: script.bins[k].id, t: Math.round(s.t0 * 100) / 100 })), { id: 'recap', t: Math.round(T.out0 * 100) / 100 }];
  return { lang, fps: FPS, frames: T.frames, total: T.total, cues: T.cues, sfx: T.sfx, chapters, poster: Math.round((T.intro[1].at + 1.9) * FPS) };
}

// camera: [time, shot] keys, eased from one to the next
function cameraAt(t) {
  const keys = [
    [0, 'far'], [T.introEnd, 'wide'], [T.introEnd + 1.25, 'hero'], [T.out0, 'hero'], [T.out0 + 1.45, 'recap'], [T.endAt, 'recap'], [T.total, 'out'],
  ];
  let i = 0;
  while (i < keys.length - 2 && t >= keys[i + 1][0]) i++;
  const [t0, a] = keys[i];
  const [t1, b] = keys[i + 1];
  const k = smooth((t - t0) / (t1 - t0));
  const A = CAMERAS[a];
  const B = CAMERAS[b];
  stage._cameraBase.set(lerp(A.pos[0], B.pos[0], k), lerp(A.pos[1], B.pos[1], k), lerp(A.pos[2], B.pos[2], k));
  stage._cameraTarget.set(lerp(A.tgt[0], B.tgt[0], k), lerp(A.tgt[1], B.tgt[1], k), lerp(A.tgt[2], B.tgt[2], k));
  stage._cameraBase.x += Math.sin(t * 0.31) * 0.07; // never quite still
  stage.camera.position.copy(stage._cameraBase);
  stage.camera.lookAt(stage._cameraTarget);
  stage.camera.updateMatrixWorld();
}

function binsAt(t) {
  // Only the bin being explained is in the picture, so nothing stands behind the waste on show:
  // the others wait out of sight on the right, each leaves to the left when it is done, and they
  // all line up again for the recap.
  const last = stage.bins.length - 1;
  const back = smooth((t - T.out0 - 0.1) / 1.0);
  stage.bins.forEach((bin, i) => {
    const sec = T.sections[i];
    const uIn = clamp01((t - (sec.t0 + ARRIVE - 1.0)) / 1.0);
    const uOut = clamp01((t - sec.t1) / 0.9);
    const row = ROW(i);
    const p = bin.group.position.copy(row);
    if (i > 0) p.x += smooth((t - T.introEnd) / 1.0) * PARK_X;
    p.lerp(HERO, smooth(uIn));
    if (i < last) p.lerp(EXIT, smooth(uOut)).lerp(row, back);
    else p.lerp(row, smooth(uOut));
    // the first bin hops forward out of the row, the last one hops back into it
    p.y = 0.3 * ((i === 0 ? Math.sin(Math.PI * uIn) : 0) + (i === last ? Math.sin(Math.PI * uOut) : 0));
  });
}

function itemsAt(t) {
  let glow = 0;
  let glowSize = 1.7;
  let landed = null; // seconds since the last model of an entry dropped in
  const mouth = tmp.set(HERO.x, BIN_SIZE.height + 0.2, HERO.z).clone();
  T.sections.forEach((sec, k) => {
    script.bins[k].items.forEach((item, e) => {
      const { s, flights, land } = sec.entries[e];
      const n = item.objs.length;
      if (t >= land && t < land + 0.9) landed = t - land;
      const layout = LAYOUT[n];
      if (t >= s && t < flights[0] + 0.3) {
        glow = smooth((t - s) / 0.3) * (1 - smooth((t - flights[0]) / 0.3));
        glowSize = n > 1 ? 2.5 : 1.75;
      }
      item.objs.forEach((o, j) => {
        const f0 = flights[j];
        const h = o.holder;
        if (t < s || t >= f0 + FLY + DROP) {
          h.visible = false;
          return;
        }
        h.visible = true;
        const local = Math.min(t, f0) - s;
        o.from.set(SPOT.x + layout.at[j][0], SPOT.y + layout.at[j][1] + Math.sin(local * 2.2 + j * 1.3) * 0.03, SPOT.z);
        if (t < f0) {
          const a = clamp01((local - j * 0.09) / 0.42);
          h.position.copy(o.from);
          h.scale.setScalar(layout.scale * Math.max(0.001, ease.outBack(a)));
          h.rotation.set(0, local * 1.15 + j * 0.7, 0);
          return;
        }
        const u = t - f0;
        const spin = (f0 - s) * 1.15 + j * 0.7;
        if (u < FLY) {
          const p = (u / FLY) ** 1.2;
          const q = 1 - p;
          const cx = (o.from.x + mouth.x) / 2;
          const cy = Math.max(o.from.y, mouth.y) + 0.5;
          h.position.set(
            q * q * o.from.x + 2 * q * p * cx + p * p * mouth.x,
            q * q * o.from.y + 2 * q * p * cy + p * p * mouth.y,
            q * q * o.from.z + 2 * q * p * (SPOT.z + 0.15) + p * p * mouth.z,
          );
          h.scale.setScalar(layout.scale * (1 - p * 0.42));
        } else {
          const p = (u - FLY) / DROP;
          h.position.set(mouth.x, mouth.y - p * p * 0.62, mouth.z);
          h.scale.setScalar(layout.scale * (0.58 - p * 0.22));
        }
        h.rotation.set(u * 8, spin + u * 3, u * 5.5);
      });
    });
  });
  halo.material.opacity = glow * 0.5;
  halo.scale.setScalar(glowSize + Math.sin(t * 3) * 0.06);
  okIcon.visible = landed !== null;
  if (okIcon.visible) {
    okIcon.position.set(mouth.x, mouth.y + 0.06 + landed * 0.24, mouth.z + 0.1);
    okIcon.scale.setScalar(0.34 * ease.outBack(Math.min(1, landed / 0.28)));
    okIcon.material.opacity = Math.min(1, (0.9 - landed) * 4);
  }
}

function overlayAt(t) {
  const o = overlay;
  // opening title + spoken line
  const title = smooth((t - 0.3) / 0.7) * (1 - smooth((t - (T.introEnd - 0.5)) / 0.45));
  show(o.scrim, title);
  show(o.title, title, `translateY(${(1 - smooth((t - 0.3) / 0.7)) * -18}px)`);
  const line = T.intro.find((l) => t >= l.at - 0.15 && t < l.end + 0.35);
  if (line && line !== subtitleLine) {
    subtitleLine = line;
    o.subText.textContent = script.intro.find((l) => l.id === line.id)[lang].vo;
  }
  show(o.sub, line ? smooth((t - (line.at - 0.15)) / 0.25) * (1 - smooth((t - (line.end + 0.08)) / 0.25)) : 0);

  // brand mark + progress dots
  show(o.brand, smooth((t - (T.introEnd + 0.6)) / 0.5) * (1 - smooth((t - T.out0) / 0.4)));
  o.dots.forEach((dot, k) => {
    const sec = T.sections[k];
    const on = smooth((t - sec.t0 - 0.5) / 0.3);
    const now = on * (1 - smooth((t - sec.t1) / 0.3));
    dot.style.opacity = 0.3 + 0.7 * on;
    dot.style.transform = `scale(${1 + now * 0.35})`;
  });

  // lists
  let active = null;
  T.sections.forEach((sec, k) => {
    const { panel, rows } = o.panels[k];
    const enter = smooth((t - (sec.t0 + 0.55)) / 0.5);
    const leave = smooth((t - (sec.t1 - 0.05)) / 0.4);
    show(panel, enter * (1 - leave), `translateX(${(1 - enter) * 46 + leave * 30}px)`);
    if (enter <= 0 || leave >= 1) return;
    sec.entries.forEach((entry, e) => {
      const { li, tick } = rows[e];
      const lit = smooth((t - entry.s) / 0.25) * (1 - smooth((t - entry.land) / 0.45));
      const done = clamp01((t - entry.land) / 0.3);
      li.style.opacity = 0.42 + 0.58 * Math.max(lit, smooth(done * 2));
      li.style.background = `color-mix(in srgb, var(--bin) ${Math.round(lit * 38)}%, transparent)`;
      tick.style.transform = `scale(${done > 0 ? ease.outBack(done) : 0})`;
      if (t >= entry.s && t < entry.flights[0] + 0.2) active = { entry, k, e };
    });
  });

  // name of the waste on show
  if (active) {
    if (captionEntry !== active.entry) {
      captionEntry = active.entry;
      o.capText.textContent = script.bins[active.k].items[active.e][lang].label;
      o.cap.style.setProperty('--bin', BINS[active.k].color);
    }
    const enter = smooth((t - (active.entry.s + 0.12)) / 0.3);
    const leave = smooth((t - (active.entry.flights[0] - 0.12)) / 0.25);
    show(o.cap, enter * (1 - leave), `translateY(${(1 - enter) * 16}px)`);
  } else {
    show(o.cap, 0);
  }

  // recap labels, above the bins
  const chipsOut = 1 - smooth((t - T.endAt) / 0.4);
  o.chips.forEach((chip, i) => {
    const a = clamp01((t - T.recap[i].at) / 0.4);
    const p = tmp.copy(ROW(i)).setY(1.78).project(stage.camera);
    show(chip, Math.min(1, a * 3) * chipsOut, `translate(${(p.x * 0.5 + 0.5) * W}px, ${(-p.y * 0.5 + 0.5) * H}px) translateY(-100%) scale(${a > 0 ? ease.outBack(a) : 0})`);
  });

  // closing card
  show(o.end, smooth((t - T.endAt) / 0.7));
  [T.endAt + 0.2, T.end1 - 0.15, T.end1 + 0.25, T.end2 - 0.15, T.end2 + 0.3].forEach((start, i) => {
    const a = smooth((t - start) / 0.45);
    // the Play Now button (part 3) pops in and then keeps a slow pulse
    const pop = i === 3 ? `scale(${(a > 0 ? ease.outBack(clamp01((t - start) / 0.5)) : 0) * (1 + 0.035 * Math.sin(Math.max(0, t - start - 0.5) * 5.2))})` : '';
    show(o.endParts[i], a, `translateY(${(1 - a) * 18}px) ${pop}`);
  });

  show(o.fade, Math.max(1 - smooth(t / 0.55), smooth((t - (T.total - 0.6)) / 0.5)));
}

/** Draw frame i. Frames must be asked for in order (the bins' springs and the confetti carry over). */
async function frame(i, settle = true) {
  const t = i / FPS;
  virtualMs = t * 1000;
  while (shotIndex < shots.length && shots[shotIndex].t <= t) shots[shotIndex++].fn();
  cameraAt(t);
  binsAt(t);
  itemsAt(t);
  overlayAt(t);
  stage._frame();
  if (settle) await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

window.__film = { ready, init, frame };

// ?preview: play it in the browser (no sound) to check the timing by eye
const params = new URLSearchParams(location.search);
if (params.has('preview')) {
  const language = params.get('lang') === 'ta' ? 'ta' : 'en';
  const durations = await fetch(`./work/${language}/vo/durations.json`).then((r) => r.json());
  const info = await init(language, durations);
  let i = Math.round(Number(params.get('from') ?? 0) * FPS);
  for (let f = 0; f < i; f++) await frame(f, false);
  const timer = setInterval(() => {
    if (i >= info.frames) clearInterval(timer);
    else frame(i++, false);
  }, 1000 / FPS);
}
