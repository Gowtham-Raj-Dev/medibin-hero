// The 3D stage: hospital room, four bins, the two medical workers and the waste
// item in play. It only knows how to show things — the rules live in controller.js.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { BINS, ITEMS } from './data.js';
import { Bin, BIN_SIZE } from './bins3d.js';
import { createItemModel, itemGlbPaths } from './items3d.js';
import { loadGLB, canvasTexture, roundRect, ease, enableShadows } from './three-utils.js';

const BIN_SPACING = 1.14;
const ITEM_HOME = new THREE.Vector3(0, 1.86, 0.35);
const FOV = 36;
const HALF_WIDTH = 2.9; // bins plus the characters beside them
const MIN_DISTANCE = 4.8;
const FONT = '"Baloo Thambi 2 Variable", "Nirmala UI", sans-serif';

const CHARACTERS = [
  {
    model: 'characters/medical-female-01.glb',
    position: [-2.95, 0, -1.0],
    rotation: 0.32,
    clips: {
      idle: 'animations/f_idle_neutral_01.glb',
      look: 'animations/f_idle_look_around_01.glb',
      think: 'animations/f_gestic_thoughtful_01.glb',
      wave: 'animations/f_wave_01.glb',
      cheer: 'animations/f_cheer_01.glb',
      clap: 'animations/f_claphands_01.glb',
    },
  },
  {
    model: 'characters/medical-male-04.glb',
    position: [2.95, 0, -1.0],
    rotation: -0.32,
    clips: {
      idle: 'animations/m_idle_neutral_01.glb',
      think: 'animations/m_gestic_thoughtful_01.glb',
      wave: 'animations/m_wave_01.glb',
      clap: 'animations/m_claphands_01.glb',
    },
  },
];

// Background props: [file, scale, x, z, rotationY, y]
const PROPS = [
  ['props/potted-plant.glb', 1.9, -3.95, -2.75, 0.4, 0],
  ['props/pot-plant.glb', 1.05, 3.95, -2.75, 0, 0],
  ['props/bed-single.glb', 1.8, -5.7, -1.7, 0, 0],
  ['props/cabinet-bed-drawer.glb', 1.8, -4.85, -2.85, 0, 0],
  ['props/wheelchair.glb', 1.9, 5.3, -1.7, -0.7, 0],
  ['props/bathroom-sink.glb', 1.75, 5.0, -3.0, 0, 0],
  ['props/aid-kit.glb', 1.5, 3.0, -3.12, 0, 1.3],
];

// The window in the back wall, and the street outside it (the room is a few floors up).
const WALL_Z = -3.2;
const WINDOW = { x: -1.78, y: 2.0, w: 1.9, h: 1.4 };
const OUTSIDE_GROUND = -5.4;
const CLOUD_RANGE = [-34, 14]; // clouds drift left → right between these and wrap round
// [file, scale, x, z, rotationY]
const OUTSIDE_MODELS = [
  ['outdoor/building-skyscraper-c.glb', 1.7, -9.5, -30, 0.5],
  ['outdoor/building-n.glb', 2.2, -5.2, -24, -0.3],
  ['outdoor/building-l.glb', 2.6, -13, -26, 0.25],
  ['outdoor/building-skyscraper-a.glb', 2.1, -1.6, -28, -0.6],
  ['outdoor/building-skyscraper-e.glb', 1.5, -17, -32, 0.2],
  ['outdoor/building-g.glb', 3.0, 2.4, -25, 0.4],
  ['outdoor/tree-default.glb', 3.4, -9.6, -19, 0],
  ['outdoor/tree-oak.glb', 4.4, -5.6, -18, 1.2],
  ['outdoor/tree-detailed.glb', 4.2, -2.6, -20, 2.1],
  ['outdoor/tree-default.glb', 3.2, -13, -21, 0.8],
  ['outdoor/tree-oak.glb', 4.2, 0.4, -19, 0.3],
];

// Sample item floating over each bin on the home page.
const SHOWCASE_ITEMS = { yellow: 'cotton', red: 'syringe', blue: 'scissors', green: 'banana' };

export class Stage {
  constructor(container, { mode = 'game', onBinClick, onBinHover, onLayout, onContextLost } = {}) {
    this.container = container;
    this.mode = mode;
    this.onBinClick = onBinClick;
    this.onBinHover = onBinHover;
    this.onLayout = onLayout;
    this.onContextLost = onContextLost;
    this.onFrame = null; // (dt) => void, game time only
    this.paused = false;
    this.disposed = false;
    this.interactive = false;
    this.time = 0;
    this.shake = 0;
    this.rotated = false; // true while the page draws the game turned 90° (phone held upright)
    this.itemHome = ITEM_HOME.clone();
    this.bins = [];
    this.characters = [];
    this.item = null;
    this.itemFlying = false;
    this.hoverIndex = -1;
    this._quality = 2; // 2 = full, 1 = no shadows, 0 = no shadows + pixel ratio 1
    this._slowTime = 0;
    this._loaded = false;
    this._itemModels = new Map(); // item id → model, built once and reused every time it comes up
    this._tweens = [];
    this._particles = [];
    this._icons = [];
    this._showcase = [];

    const renderer = (this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }));
    const touch = window.matchMedia('(pointer: coarse)').matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 1.75 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.domElement.className = 'stage-canvas';
    container.appendChild(renderer.domElement);

    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color(0xeaf3f1);
    this._pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = this._pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;

    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 120);
    this._cameraBase = new THREE.Vector3();
    this._cameraTarget = new THREE.Vector3(0, 1.12, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xc4d6e2, 0.85));
    const key = new THREE.DirectionalLight(0xfff6e8, 2.5);
    key.position.set(2.8, 6.5, 5.5);
    key.target.position.set(0, 0.8, -0.5);
    key.castShadow = true;
    key.shadow.mapSize.setScalar(touch ? 1024 : 2048);
    Object.assign(key.shadow.camera, { left: -7, right: 7, top: 6, bottom: -3, near: 0.5, far: 22 });
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.03;
    key.shadow.radius = 5;
    scene.add(key, key.target);
    this._keyLight = key;
    const fill = new THREE.DirectionalLight(0xcfe6ff, 0.55);
    fill.position.set(-5, 3, 4);
    scene.add(fill);

    this._buildRoom();
    this._buildItemRig();

    this._raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
    this._onPointerMove = (e) => this._handlePointer(e, false);
    this._onPointerDown = (e) => this._handlePointer(e, true);
    this._onPointerLeave = () => this._setHover(-1);
    const el = renderer.domElement;
    el.addEventListener('pointermove', this._onPointerMove);
    el.addEventListener('pointerdown', this._onPointerDown);
    el.addEventListener('pointerleave', this._onPointerLeave);
    // The browser can take the GPU away (driver reset, low memory); tell the page so it can offer a reload.
    this._onContextLost = () => {
      if (!this.disposed) this.onContextLost?.();
    };
    el.addEventListener('webglcontextlost', this._onContextLost);

    this._resizeObserver = new ResizeObserver(() => this.resize());
    this._resizeObserver.observe(container);
    this.resize();

    this._lastFrame = performance.now();
    renderer.setAnimationLoop(() => this._frame());
  }

  // ── construction ────────────────────────────────────────────────────────
  _buildRoom() {
    const tiles = canvasTexture(256, 256, (ctx) => {
      ctx.fillStyle = '#eef3f6';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#e2eaef';
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillRect(128, 128, 128, 128);
      ctx.strokeStyle = '#cdd8df';
      ctx.lineWidth = 3;
      for (const p of [0, 128, 256]) {
        ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, 256); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(256, p); ctx.stroke();
      }
    });
    tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping;
    tiles.repeat.set(40 / 1.3, 26 / 1.3);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 26), new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.3, metalness: 0.05 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = 4;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const WALL_H = 7;
    const wallTex = canvasTexture(16, 512, (ctx, w, h) => {
      const px = h / WALL_H;
      ctx.fillStyle = '#f4f8f5';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#c3e6e0';
      ctx.fillRect(0, h - 1.12 * px, w, 1.12 * px);
      ctx.fillStyle = '#2aa79b';
      ctx.fillRect(0, h - 1.19 * px, w, 0.07 * px);
      ctx.fillStyle = '#93a8b0';
      ctx.fillRect(0, h - 0.13 * px, w, 0.13 * px);
      ctx.fillStyle = '#dcefeb';
      ctx.fillRect(0, 0, w, h - 2.98 * px);
      ctx.fillStyle = '#2aa79b';
      ctx.fillRect(0, h - 3.02 * px, w, 0.04 * px);
    });
    // back wall with a real opening for the window
    const wallShape = new THREE.Shape();
    wallShape.moveTo(-20, 0);
    wallShape.lineTo(20, 0);
    wallShape.lineTo(20, WALL_H);
    wallShape.lineTo(-20, WALL_H);
    wallShape.closePath();
    const hole = new THREE.Path();
    const [hx0, hx1, hy0, hy1] = [WINDOW.x - WINDOW.w / 2, WINDOW.x + WINDOW.w / 2, WINDOW.y - WINDOW.h / 2, WINDOW.y + WINDOW.h / 2];
    hole.moveTo(hx0, hy0);
    hole.lineTo(hx0, hy1);
    hole.lineTo(hx1, hy1);
    hole.lineTo(hx1, hy0);
    hole.closePath();
    wallShape.holes.push(hole);
    const wallGeo = new THREE.ShapeGeometry(wallShape);
    const wallPos = wallGeo.attributes.position;
    const wallUv = wallGeo.attributes.uv;
    for (let i = 0; i < wallPos.count; i++) wallUv.setXY(i, (wallPos.getX(i) + 20) / 40, wallPos.getY(i) / WALL_H);
    const wall = new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.92 }));
    wall.position.set(0, 0, WALL_Z);
    wall.receiveShadow = true;
    this.scene.add(wall);

    const CEILING = 3.7;
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(40, 14), new THREE.MeshStandardMaterial({ color: 0xe7eef0, roughness: 1 }));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, CEILING, 3.8);
    this.scene.add(ceiling);
    const panel = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    for (const x of [-4.2, -1.4, 1.4, 4.2]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.5), panel);
      lamp.position.set(x, CEILING - 0.02, -1.9);
      this.scene.add(lamp);
    }

    this._buildWindow();
    this._buildOutside();
  }

  /** Window in the back wall: frame, glass and the thickness of the wall around the opening. */
  _buildWindow() {
    const { w, h } = WINDOW;
    const win = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const box = (bw, bh, bd, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), white);
      m.position.set(x, y, z);
      win.add(m);
      return m;
    };
    // the wall is 0.3 thick: these line the inside of the opening
    const DEPTH = 0.3;
    box(0.04, h, DEPTH, -w / 2 - 0.02, 0, -DEPTH / 2);
    box(0.04, h, DEPTH, w / 2 + 0.02, 0, -DEPTH / 2);
    box(w + 0.08, 0.04, DEPTH, 0, h / 2 + 0.02, -DEPTH / 2);
    box(w + 0.08, 0.04, DEPTH, 0, -h / 2 - 0.02, -DEPTH / 2);
    // frame on the room side, with one upright and one cross bar
    const F = 0.08;
    box(F, h + F, 0.07, -w / 2, 0, 0.02);
    box(F, h + F, 0.07, w / 2, 0, 0.02);
    box(w + F, F, 0.07, 0, h / 2, 0.02);
    box(w + F, F, 0.07, 0, -h / 2, 0.02);
    box(0.05, h, 0.05, 0, 0, 0);
    box(w, 0.05, 0.05, 0, 0.12, 0);
    box(w + 0.3, 0.06, 0.2, 0, -h / 2 - 0.06, 0.08).castShadow = true; // sill

    // glass: almost clear, with a faint diagonal glare so it reads as a pane
    const glare = canvasTexture(256, 256, (ctx, cw, ch) => {
      ctx.clearRect(0, 0, cw, ch);
      ctx.translate(cw / 2, ch / 2);
      ctx.rotate(-0.6);
      const g = ctx.createLinearGradient(-cw, 0, cw, 0);
      g.addColorStop(0.3, 'rgba(255,255,255,0)');
      g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
      g.addColorStop(0.46, 'rgba(255,255,255,0)');
      g.addColorStop(0.52, 'rgba(255,255,255,0.28)');
      g.addColorStop(0.56, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-cw, -ch, cw * 2, ch * 2);
    });
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: glare, color: 0xffffff, transparent: true, opacity: 0.32, depthWrite: false, toneMapped: false }),
    );
    glass.position.z = -0.03;
    win.add(glass);
    win.position.set(WINDOW.x, WINDOW.y, WALL_Z);
    this.scene.add(win);

    // daylight falling through the window onto the floor
    const patch = canvasTexture(256, 256, (ctx, cw, ch) => {
      ctx.clearRect(0, 0, cw, ch);
      ctx.filter = 'blur(7px)';
      ctx.fillStyle = 'rgba(255, 244, 214, 1)';
      for (const [x, y, pw, ph] of [[26, 30, 96, 74], [134, 30, 96, 74], [26, 116, 96, 110], [134, 116, 96, 110]]) ctx.fillRect(x, y, pw, ph);
    });
    const light = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 1.15, 2.0),
      new THREE.MeshBasicMaterial({ map: patch, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    );
    light.geometry.applyMatrix4(new THREE.Matrix4().makeShear(0, 0, 0.45, 0, 0, 0)); // slanted, as from a sun off to the side
    light.rotation.x = -Math.PI / 2;
    light.position.set(WINDOW.x + 0.55, 0.006, WALL_Z + 1.25);
    this.scene.add(light);
  }

  /**
   * What you see through the window. The room is on an upper floor, so the view is
   * of rooftops and treetops against the sky, with clouds drifting past.
   */
  _buildOutside() {
    const out = (this._outside = new THREE.Group());
    this.scene.add(out);

    const sky = canvasTexture(8, 512, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#2c86e0');
      g.addColorStop(0.42, '#55adf5');
      g.addColorStop(0.6, '#dff1ff');
      g.addColorStop(1, '#dff1ff');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
    const dome = new THREE.Mesh(new THREE.PlaneGeometry(130, 50), new THREE.MeshBasicMaterial({ map: sky, toneMapped: false }));
    dome.position.set(-8, 2, -62);
    out.add(dome);

    // far hills, hazy with distance
    const hillGeo = new THREE.SphereGeometry(1, 24, 12);
    for (const [x, z, sx, sy, color] of [
      [-30, -54, 20, 8.6, 0xa9d6c4],
      [-9, -56, 24, 9.6, 0xb7dccd],
      [12, -54, 18, 8.2, 0xa9d6c4],
      [-19, -50, 13, 7.6, 0x93cbb0],
      [2, -50, 14, 7.2, 0x93cbb0],
    ]) {
      const hill = new THREE.Mesh(hillGeo, new THREE.MeshBasicMaterial({ color, toneMapped: false }));
      hill.scale.set(sx, sy, 5);
      hill.position.set(x, -12, z);
      out.add(hill);
    }

    // clouds: soft 3D puffs that drift across the sky and come round again
    const puffGeo = new THREE.SphereGeometry(1, 18, 12);
    const puffMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xdfeaf5, emissiveIntensity: 0.72 });
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    this._clouds = [];
    for (const [x, y, z, size, speed] of [
      [-24, 2.7, -42, 1.5, 0.42],
      [-15, 2.1, -36, 1.15, 0.55],
      [-7, 3.0, -44, 1.7, 0.38],
      [0, 2.3, -38, 1.25, 0.5],
      [7, 2.8, -41, 1.45, 0.45],
      [-31, 2.2, -37, 1.1, 0.58],
    ]) {
      const cloud = new THREE.Group();
      const n = 6 + Math.floor(rand() * 3);
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1) - 0.5;
        const puff = new THREE.Mesh(puffGeo, puffMat);
        puff.scale.setScalar((0.5 + rand() * 0.4) * (1.15 - Math.abs(t) * 1.1));
        puff.position.set(t * 2.8, (0.5 - Math.abs(t)) * 0.5 + rand() * 0.22, rand() * 0.5 - 0.25);
        cloud.add(puff);
      }
      cloud.scale.set(size, size * 0.72, size * 0.8);
      cloud.position.set(x, y, z);
      out.add(cloud);
      this._clouds.push({ cloud, speed });
    }
  }

  /** Buildings and trees outside the window, from the model library. */
  _loadOutside(track) {
    return OUTSIDE_MODELS.map(([path, scale, x, z, ry]) =>
      track(loadGLB(path)).then((gltf) => {
        if (this.disposed) return;
        const obj = gltf.scene.clone(true);
        obj.scale.setScalar(scale);
        obj.position.set(x, OUTSIDE_GROUND, z);
        obj.rotation.y = ry;
        this._outside.add(obj);
      }),
    );
  }

  /** Wall notice board — drawn after the web fonts are ready so the Tamil text renders properly. */
  _buildSign() {
    const sign = canvasTexture(768, 512, (ctx, w, h) => {
      ctx.fillStyle = '#0f8f6b';
      roundRect(ctx, 0, 0, w, h, 40);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 8;
      roundRect(ctx, 18, 18, w - 36, h - 36, 28);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(120, 128, 66, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e5352b';
      ctx.fillRect(102, 84, 36, 88);
      ctx.fillRect(76, 110, 88, 36);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.font = `800 62px ${FONT}`;
      ctx.fillText('BIO-MEDICAL', 214, 112);
      ctx.fillText('WASTE', 214, 178);
      ctx.font = `700 46px ${FONT}`;
      ctx.fillText('உயிர் மருத்துவக் கழிவு', 60, 282);
      ctx.font = `600 36px ${FONT}`;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText('Segregate at source', 60, 340);
      BINS.forEach((b, i) => {
        ctx.fillStyle = b.color;
        roundRect(ctx, 60 + i * 168, 392, 144, 66, 18);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 5;
        ctx.stroke();
      });
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.56, 1.04), new THREE.MeshStandardMaterial({ map: sign, transparent: true, roughness: 0.6 }));
    board.position.set(1.78, 1.98, -3.17);
    this.scene.add(board);
  }

  _buildItemRig() {
    this.itemRoot = new THREE.Group();
    this.itemRoot.position.copy(this.itemHome);
    this.itemSpin = new THREE.Group();
    this.itemRoot.add(this.itemSpin);
    const halo = canvasTexture(256, 256, (ctx) => {
      const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.45, 'rgba(255,255,255,0.4)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
    });
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, transparent: true, depthWrite: false, opacity: 0 }));
    this.halo.scale.setScalar(1.5);
    this.halo.position.z = -0.4;
    this.itemRoot.add(this.halo);
    this.scene.add(this.itemRoot);

    const iconTexture = (ok) =>
      canvasTexture(256, 256, (ctx) => {
        ctx.fillStyle = ok ? '#22c55e' : '#ef4444';
        ctx.beginPath();
        ctx.arc(128, 128, 112, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 12;
        ctx.stroke();
        ctx.lineWidth = 30;
        ctx.lineCap = ctx.lineJoin = 'round';
        ctx.beginPath();
        if (ok) {
          ctx.moveTo(72, 132); ctx.lineTo(112, 172); ctx.lineTo(186, 90);
        } else {
          ctx.moveTo(84, 84); ctx.lineTo(172, 172); ctx.moveTo(172, 84); ctx.lineTo(84, 172);
        }
        ctx.stroke();
      });
    this._iconTextures = { ok: iconTexture(true), bad: iconTexture(false) };
    this._arrowTexture = (color) => canvasTexture(256, 256, (ctx) => {
      ctx.fillStyle = color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 16;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(128, 236); ctx.lineTo(34, 120); ctx.lineTo(92, 120); ctx.lineTo(92, 22);
      ctx.lineTo(164, 22); ctx.lineTo(164, 120); ctx.lineTo(222, 120);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
    });
  }

  /** Load fonts, models and animations, then build everything that depends on them. */
  async load(onProgress) {
    const report = (() => {
      let done = 0;
      let total = 1;
      return {
        add: (n) => { total += n; },
        tick: () => { done += 1; onProgress?.(Math.min(1, done / total)); },
      };
    })();
    const track = (promise) => promise.then((v) => { report.tick(); return v; });

    try {
      await Promise.race([
        Promise.all([
          document.fonts.load(`800 62px ${FONT}`, 'BIO-MEDICAL'),
          document.fonts.load(`700 44px ${FONT}`, 'தொற்றுக் கழிவு பிளாஸ்டிக் கண்ணாடி உலோகம் பொதுவான உயிர் மருத்துவ'),
        ]),
        new Promise((r) => setTimeout(r, 2500)),
      ]);
    } catch {
      // fall back to system fonts
    }
    if (this.disposed) return;
    this._buildSign();

    BINS.forEach((def, i) => {
      const bin = new Bin(def, i);
      bin.group.position.set((i - (BINS.length - 1) / 2) * BIN_SPACING, 0, 0);
      const arrow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._arrowTexture(def.color), transparent: true, depthTest: false, opacity: 0 }));
      arrow.scale.setScalar(0.46);
      arrow.renderOrder = 10;
      bin.arrow = arrow;
      bin.group.add(arrow);
      this.scene.add(bin.group);
      this.bins.push(bin);
    });
    this._emitLayout();

    const propJobs = PROPS.map(([path, scale, x, z, ry, y]) =>
      track(loadGLB(path)).then((gltf) => {
        if (this.disposed) return;
        const obj = enableShadows(gltf.scene.clone(true), { cast: true, receive: true });
        obj.scale.setScalar(scale);
        obj.position.set(x, y, z);
        obj.rotation.y = ry;
        this.scene.add(obj);
      }),
    );
    const itemPaths = this.mode === 'game' ? itemGlbPaths(ITEMS) : ['items/banana.glb'];
    const itemJobs = itemPaths.map((p) => track(loadGLB(p)));
    const characterJobs = CHARACTERS.map((def) => this._loadCharacter(def, track, report));
    const outsideJobs = this._loadOutside(track);
    report.add(propJobs.length + itemJobs.length + outsideJobs.length);

    const results = await Promise.allSettled([...propJobs, ...itemJobs, ...outsideJobs, ...characterJobs]);
    results.filter((r) => r.status === 'rejected').forEach((r) => console.warn('Model failed to load:', r.reason));
    if (this.disposed) return;

    if (this.mode === 'showcase') await this._buildShowcase();
    this._loaded = true;
    onProgress?.(1);
  }

  async _loadCharacter(def, track, report) {
    const names = Object.keys(def.clips);
    report.add(1 + names.length);
    const [gltf, ...clipFiles] = await Promise.all([track(loadGLB(def.model)), ...names.map((n) => track(loadGLB(def.clips[n])))]);
    if (this.disposed) return;
    const model = cloneSkinned(gltf.scene);
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.frustumCulled = false; // skinned bounds don't follow the animation
      }
    });
    model.position.set(...def.position);
    model.rotation.y = def.rotation;
    const mixer = new THREE.AnimationMixer(model);
    const actions = {};
    names.forEach((name, i) => {
      const source = clipFiles[i].animations[0];
      if (!source) return;
      // keep only the tracks whose bones exist on this character
      const tracks = source.tracks.filter((t) => model.getObjectByName(THREE.PropertyBinding.parseTrackName(t.name).nodeName));
      actions[name] = mixer.clipAction(new THREE.AnimationClip(name, source.duration, tracks));
    });
    const character = { model, mixer, actions, current: null, revertAt: 0, idleAt: 4 + Math.random() * 4 };
    this.scene.add(model);
    this.characters.push(character);
    this._play(character, 'idle', 0);
  }

  async _buildShowcase() {
    for (const bin of this.bins) {
      const def = ITEMS.find((i) => (i.model.make ?? i.id) === SHOWCASE_ITEMS[bin.def.id]) ?? ITEMS.find((i) => i.bin === bin.def.id);
      const model = await createItemModel({ ...def, size: 0.56 });
      if (this.disposed) return;
      const holder = new THREE.Group();
      holder.add(model);
      holder.position.set(bin.group.position.x, 1.98, 0.1);
      this.scene.add(holder);
      this._showcase.push({ holder, bin, phase: bin.index * 1.1 });
    }
    this.characters.forEach((c, i) => this._react(c, 'wave', 3.2 + i * 0.4));
  }

  // ── characters ──────────────────────────────────────────────────────────
  _play(character, name, fade = 0.35) {
    const next = character.actions[name] ?? character.actions.idle;
    if (!next || character.current === next) return;
    next.reset().setEffectiveWeight(1).play();
    if (character.current) character.current.crossFadeTo(next, fade, false);
    character.current = next;
  }
  _react(character, name, seconds) {
    if (!character.actions[name]) return;
    this._play(character, name);
    character.revertAt = this.time + seconds;
  }
  /** 'ok' | 'bad' | 'wave' | 'over' */
  react(kind) {
    this.characters.forEach((c, i) => {
      if (kind === 'ok') this._react(c, c.actions.cheer && Math.random() < 0.5 ? 'cheer' : 'clap', 2.3);
      else if (kind === 'bad') this._react(c, 'think', 2.6);
      else if (kind === 'wave') this._react(c, 'wave', 2.8 + i * 0.3);
      else if (kind === 'over') this._react(c, 'think', 6);
    });
  }

  // ── item in play ────────────────────────────────────────────────────────
  async showItem(def) {
    this.clearItem();
    let model = this._itemModels.get(def.id);
    if (!model) {
      model = await createItemModel(def);
      this._itemModels.set(def.id, model);
    }
    if (this.disposed) return;
    this.clearItem();
    this.item = model;
    this.itemSpin.add(model);
    this.itemSpin.rotation.set(0, 0, 0);
    this.itemRoot.position.copy(this.itemHome);
    this.itemRoot.scale.setScalar(0.001);
    this.itemRoot.visible = true;
    this.itemFlying = false;
    this.tween(0.38, (t) => {
      this.itemRoot.scale.setScalar(Math.max(0.001, t));
      this.halo.material.opacity = Math.min(1, t) * 0.55;
    }, ease.outBack);
  }

  clearItem() {
    if (this.item) {
      this.itemSpin.remove(this.item);
      this.item = null;
    }
    this.halo.material.opacity = 0;
  }

  /** Toss the current item into a bin; resolves when it has dropped inside. */
  async throwItem(binIndex) {
    const bin = this.bins[binIndex];
    if (!this.item || !bin) return;
    this.itemFlying = true;
    bin.setOpen(1);
    const start = this.itemRoot.position.clone();
    const end = bin.mouth;
    end.y += 0.16;
    const ctrl = new THREE.Vector3((start.x + end.x) / 2, Math.max(start.y, end.y) + 0.5, 0.5);
    const p = new THREE.Vector3();
    await this.tween(0.52, (t) => {
      const u = 1 - t;
      p.set(0, 0, 0).addScaledVector(start, u * u).addScaledVector(ctrl, 2 * u * t).addScaledVector(end, t * t);
      this.itemRoot.position.copy(p);
      this.itemRoot.scale.setScalar(1 - t * 0.3);
      this.halo.material.opacity = 0.55 * u;
    }, (t) => t ** 1.2);
    const fromY = end.y;
    await this.tween(0.17, (t) => {
      this.itemRoot.position.y = fromY - t * 0.62;
      this.itemRoot.scale.setScalar(0.7 - t * 0.25);
    }, ease.inQuad);
    this.clearItem();
    this.itemRoot.visible = false;
    this.itemFlying = false;
  }

  /** Bin reaction once the item is inside: bounce, flash, confetti or smoke. */
  resolveBin(binIndex, correct) {
    const bin = this.bins[binIndex];
    const at = bin.mouth;
    if (correct === null) {
      // timer ran out: the item was dropped in for the player, so no cheer and no cross
      bin.squashVel = -2.6;
      this.tween(0.42, () => {}).then(() => bin.setOpen(0));
      return;
    }
    bin.catchItem(correct);
    if (correct) {
      this._burst(at, ['#ffd43b', '#38e07b', '#4dabf7', '#ff6b6b', '#ffffff', bin.def.color], 34, 3.4);
    } else {
      this._burst(at, ['#3d4651', '#6c757d', '#ef4444'], 18, 1.9);
      this.shake = 0.45;
    }
    this._popIcon(at, correct);
    this.tween(0.42, () => {}).then(() => bin.setOpen(0));
  }

  /** Bounce the bin where the item should have gone. */
  pointAt(binIndex, seconds = 1.8) {
    this.bins[binIndex]?.pulse(seconds);
  }

  _popIcon(position, ok) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._iconTextures[ok ? 'ok' : 'bad'], transparent: true, depthTest: false }));
    sprite.position.copy(position);
    sprite.position.y += 0.14;
    sprite.renderOrder = 12;
    this.scene.add(sprite);
    this._icons.push({ sprite, age: 0, life: ok ? 0.9 : 1.2 });
  }

  _burst(origin, colors, count, power) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide, transparent: true });
      const mesh = new THREE.Mesh(this._confettiGeometry ?? (this._confettiGeometry = new THREE.PlaneGeometry(0.075, 0.05)), mat);
      mesh.position.copy(origin);
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.5 + 0.2;
      this.scene.add(mesh);
      this._particles.push({
        mesh,
        vel: new THREE.Vector3(Math.cos(a) * r * power * 0.45, power * (0.65 + Math.random() * 0.5), Math.sin(a) * r * power * 0.3 + 0.3),
        spin: new THREE.Vector3(Math.random() * 12 - 6, Math.random() * 12 - 6, Math.random() * 12 - 6),
        age: 0,
        life: 0.9 + Math.random() * 0.5,
      });
    }
  }

  // Slow devices: if the frame rate stays under ~25 fps, drop the shadows first, then some sharpness.
  _watchFrameRate(real) {
    if (!this._loaded || this._quality === 0) return;
    this._slowTime = real > 0.04 ? this._slowTime + real : Math.max(0, this._slowTime - real * 2);
    if (this._slowTime < 2.5) return;
    this._slowTime = 0;
    this._quality -= 1;
    if (this._quality === 1) {
      this._keyLight.castShadow = false;
    } else {
      this.renderer.setPixelRatio(1);
      this.resize();
    }
  }

  // ── timing helpers (game time: they freeze while paused) ────────────────
  tween(duration, update, easing = ease.linear) {
    return new Promise((resolve) => {
      this._tweens.push({ t: 0, duration: Math.max(duration, 1e-3), update, easing, resolve });
    });
  }
  wait(seconds) {
    return this.tween(seconds, () => {});
  }

  // ── input ───────────────────────────────────────────────────────────────
  _handlePointer(event, isDown) {
    if (!this.interactive || this.mode !== 'game') return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    // u, v: 0..1 across and down the canvas in its own orientation. When the canvas is turned
    // 90° clockwise its left→right runs down the screen and its top→bottom runs right→left.
    const u = this.rotated ? (event.clientY - rect.top) / rect.height : (event.clientX - rect.left) / rect.width;
    const v = this.rotated ? (rect.right - event.clientX) / rect.width : (event.clientY - rect.top) / rect.height;
    this._pointer.set(u * 2 - 1, 1 - v * 2);
    this._raycaster.setFromCamera(this._pointer, this.camera);
    const hit = this._raycaster.intersectObjects(this.bins.map((b) => b.hitbox), false)[0];
    const index = hit ? hit.object.userData.binIndex : -1;
    this._setHover(index);
    if (isDown && index >= 0) this.onBinClick?.(index);
  }
  _setHover(index) {
    if (index === this.hoverIndex) return;
    this.hoverIndex = index;
    this.bins.forEach((b, i) => b.setHover(i === index));
    this.renderer.domElement.style.cursor = index >= 0 ? 'pointer' : '';
    this.onBinHover?.(index);
  }
  /** Highlight a bin from the HTML buttons / keyboard. */
  highlight(index) {
    this._setHover(index);
  }
  setInteractive(on) {
    this.interactive = on;
    if (!on) this._setHover(-1);
  }

  // ── layout ──────────────────────────────────────────────────────────────
  resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const distance = Math.max(MIN_DISTANCE, HALF_WIDTH / (tan * aspect));
    this.camera.aspect = aspect;
    // short screens (phones in landscape): float the item a little lower so the name card above it has room
    this.itemHome.y = h < 520 ? 1.76 : ITEM_HOME.y;
    if (this.mode === 'showcase') {
      // home page preview: lower, straighter view with the floating items in frame
      this._cameraTarget.set(0, 1.22, 0);
      this._cameraBase.set(0, 1.22 + distance * 0.14, distance);
    } else {
      this._cameraBase.set(0, 1.12 + distance * 0.25, distance);
    }
    this.camera.position.copy(this._cameraBase);
    this.camera.lookAt(this._cameraTarget);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this._emitLayout();
  }

  _project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.container.clientWidth, y: (-v.y * 0.5 + 0.5) * this.container.clientHeight };
  }

  _emitLayout() {
    if (!this.onLayout || !this.bins.length) return;
    this.onLayout({
      bins: this.bins.map((b) => ({ base: this._project(b.group.position.x, 0, BIN_SIZE.botZ + 0.32) })),
      item: this._project(this.itemHome.x, this.itemHome.y, this.itemHome.z),
    });
  }

  // ── frame loop ──────────────────────────────────────────────────────────
  _frame() {
    if (this.disposed) return;
    const now = performance.now();
    const real = Math.min((now - this._lastFrame) / 1000, 0.1);
    this._lastFrame = now;
    this._watchFrameRate(real);
    const dt = this.paused ? 0 : real;
    this.time += real;
    const time = this.time;

    if (dt > 0) {
      for (let i = this._tweens.length - 1; i >= 0; i--) {
        const tw = this._tweens[i];
        tw.t = Math.min(1, tw.t + dt / tw.duration);
        tw.update(tw.easing(tw.t));
        if (tw.t >= 1) {
          this._tweens.splice(i, 1);
          tw.resolve();
        }
      }
      this.onFrame?.(dt);
    }

    for (const bin of this.bins) {
      bin.update(real, time);
      const showArrow = bin.pulseTime > 0;
      bin.arrow.material.opacity += ((showArrow ? 1 : 0) - bin.arrow.material.opacity) * Math.min(1, real * 12);
      bin.arrow.position.set(0, BIN_SIZE.height + 0.52 + Math.sin(time * 7) * 0.08, 0.3);
    }

    for (const c of this.characters) {
      c.mixer.update(real);
      if (c.revertAt && time > c.revertAt) {
        c.revertAt = 0;
        this._play(c, 'idle', 0.5);
      } else if (!c.revertAt && c.actions.look && time > c.idleAt) {
        c.idleAt = time + 9 + Math.random() * 6;
        this._react(c, 'look', 4.2);
      }
    }

    if (this.item && !this.itemFlying) {
      this.itemSpin.rotation.y += real * 1.25;
      this.itemRoot.position.y = this.itemHome.y + Math.sin(time * 2.2) * 0.045;
      this.halo.scale.setScalar(1.45 + Math.sin(time * 3) * 0.08);
    } else if (this.itemFlying) {
      this.itemSpin.rotation.x += real * 9;
      this.itemSpin.rotation.z += real * 6;
    }

    for (const c of this._clouds) {
      c.cloud.position.x += c.speed * real;
      if (c.cloud.position.x > CLOUD_RANGE[1]) c.cloud.position.x = CLOUD_RANGE[0];
    }

    for (const s of this._showcase) {
      s.holder.rotation.y += real * 0.9;
      s.holder.position.y = 1.98 + Math.sin(time * 1.8 + s.phase) * 0.07;
      s.bin.setOpen(Math.sin(time * 0.9 - s.phase) > 0.4 ? 0.42 : 0);
    }

    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.age += real;
      p.vel.y -= 7.5 * real;
      p.mesh.position.addScaledVector(p.vel, real);
      p.mesh.rotation.x += p.spin.x * real;
      p.mesh.rotation.y += p.spin.y * real;
      p.mesh.rotation.z += p.spin.z * real;
      p.mesh.material.opacity = Math.min(1, (p.life - p.age) * 3);
      if (p.age >= p.life) {
        this.scene.remove(p.mesh);
        p.mesh.material.dispose();
        this._particles.splice(i, 1);
      }
    }

    for (let i = this._icons.length - 1; i >= 0; i--) {
      const ic = this._icons[i];
      ic.age += real;
      const k = Math.min(1, ic.age / 0.28);
      ic.sprite.scale.setScalar(0.62 * ease.outBack(k));
      ic.sprite.position.y += real * 0.22;
      ic.sprite.material.opacity = Math.min(1, (ic.life - ic.age) * 4);
      if (ic.age >= ic.life) {
        this.scene.remove(ic.sprite);
        ic.sprite.material.dispose();
        this._icons.splice(i, 1);
      }
    }

    // camera: gentle sway on the home page, shake on a wrong answer
    this.camera.position.copy(this._cameraBase);
    if (this.mode === 'showcase') {
      this.camera.position.x += Math.sin(time * 0.35) * 0.55;
      this.camera.position.y += Math.sin(time * 0.5) * 0.08;
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - real);
      const a = this.shake * 0.16;
      this.camera.position.x += (Math.random() - 0.5) * a;
      this.camera.position.y += (Math.random() - 0.5) * a;
    }
    this.camera.lookAt(this._cameraTarget);

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this._resizeObserver.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener('pointermove', this._onPointerMove);
    el.removeEventListener('pointerdown', this._onPointerDown);
    el.removeEventListener('pointerleave', this._onPointerLeave);
    el.removeEventListener('webglcontextlost', this._onContextLost);
    this._tweens.length = 0;
    this._pmrem.dispose();
    // Dropping the context frees every GPU resource at once; loaded .glb data stays cached for the next visit.
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    el.remove();
  }
}
