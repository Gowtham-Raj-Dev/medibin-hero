// 3D waste items. Food, stationery, bone and bottle come from the model library
// (public/models/items); medical items that the library doesn't have are built here.
import * as THREE from 'three';
import { canvasTexture, roundRect, shellGeometry, fitToSize, enableShadows, loadGLB } from './three-utils.js';

// ── materials ───────────────────────────────────────────────────────────────
const std = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...opts });
const steel = (color = 0xc9d1da) => std(color, { metalness: 1, roughness: 0.28 });
const glass = (color = 0xbfe9ff, opacity = 0.45) =>
  new THREE.MeshPhysicalMaterial({
    color,
    transparent: true,
    opacity,
    roughness: 0.05,
    metalness: 0,
    clearcoat: 1,
    side: THREE.DoubleSide,
    depthWrite: false,
    envMapIntensity: 1.8,
  });
const clearPlastic = (opacity = 0.38) => glass(0xf2f8ff, opacity);

function mesh(geometry, material, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.scale.set(...scale);
  return m;
}

const cyl = (rt, rb, h, seg = 20, open = false, t0 = 0, tl = Math.PI * 2) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open, t0, tl);
const hash = (x, y, z) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return n - Math.floor(n);
};

/** Push vertices in/out along their direction from the centre (same result for coincident vertices). */
function roughen(geometry, amount, freq = 9) {
  const p = geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + (hash(Math.round(v.x * freq), Math.round(v.y * freq), Math.round(v.z * freq)) - 0.5) * amount;
    p.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Tint vertices dark red near the given points ([x, y, z, radius] in the parent's space). */
function stain(geometry, offset, spots) {
  const p = geometry.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const white = new THREE.Color(0xfbfbf8);
  const blood = new THREE.Color(0x8f0d14);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    let k = 0;
    for (const [x, y, z, r] of spots) {
      const d = Math.hypot(p.getX(i) + offset[0] - x, p.getY(i) + offset[1] - y, p.getZ(i) + offset[2] - z);
      k = Math.max(k, 1 - THREE.MathUtils.smoothstep(d, r * 0.55, r));
    }
    c.copy(white).lerp(blood, k);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function withEdges(m, color = 0xffffff, opacity = 0.9) {
  const lines = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 25), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  m.add(lines);
  return m;
}

function bloodBlot(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
  g.addColorStop(0, 'rgba(120,8,14,0.95)');
  g.addColorStop(0.6, 'rgba(165,18,24,0.85)');
  g.addColorStop(1, 'rgba(180,30,30,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// ── builders ────────────────────────────────────────────────────────────────
const BUILDERS = {
  // Yellow bin ---------------------------------------------------------------
  cotton() {
    const g = new THREE.Group();
    const mat = std(0xffffff, { roughness: 1, vertexColors: true });
    const puffs = [
      [0, 0, 0, 0.26], [0.24, 0.06, 0.03, 0.2], [-0.23, 0.04, 0.05, 0.21], [0.05, 0.2, -0.05, 0.19],
      [-0.08, -0.17, 0.06, 0.2], [0.16, -0.14, -0.08, 0.17], [-0.05, 0.05, 0.2, 0.18], [0.02, 0.02, -0.2, 0.19],
    ];
    const spots = [[0.12, 0.1, 0.24, 0.24], [-0.24, -0.06, 0.16, 0.17], [0.2, -0.16, -0.12, 0.2], [-0.02, 0.24, -0.16, 0.16]];
    for (const [x, y, z, r] of puffs) {
      g.add(mesh(stain(roughen(new THREE.IcosahedronGeometry(r, 3), 0.1, 14), [x, y, z], spots), mat, [x, y, z]));
    }
    return g;
  },

  bandage() {
    const g = new THREE.Group();
    const weave = canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#f4eedd';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(160,145,110,0.35)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= w; i += 16) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke();
      }
    });
    weave.wrapS = weave.wrapT = THREE.RepeatWrapping;
    weave.repeat.set(3, 1);
    const gauze = std(0xffffff, { map: weave, roughness: 1 });
    const stained = canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#f4eedd';
      ctx.fillRect(0, 0, w, h);
      bloodBlot(ctx, 120, 150, 80);
      bloodBlot(ctx, 190, 70, 40);
    });
    g.add(mesh(cyl(0.18, 0.18, 0.32, 28), gauze, [0, 0, 0], [0, 0, Math.PI / 2]));
    g.add(mesh(cyl(0.045, 0.045, 0.325, 12), std(0x8d7f66, { roughness: 1 }), [0, 0, 0], [0, 0, Math.PI / 2]));
    // loose tail
    const tail = new THREE.PlaneGeometry(0.32, 0.62, 1, 12);
    const p = tail.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = (p.getY(i) + 0.31) / 0.62;
      p.setZ(i, Math.sin(t * Math.PI * 1.6) * 0.05);
    }
    tail.computeVertexNormals();
    g.add(mesh(tail, std(0xffffff, { map: stained, roughness: 1, side: THREE.DoubleSide }), [0, -0.19, 0.33], [-Math.PI / 2 + 0.12, 0, 0]));
    return g;
  },

  mask() {
    const g = new THREE.Group();
    const R = 0.44;
    const half = 0.56;
    const blue = std(0x7cc3ee, { roughness: 0.85, side: THREE.DoubleSide });
    const white = std(0xf5f9fc, { roughness: 0.9, side: THREE.DoubleSide });
    const band = (h, y, material, r = R, a = half) => mesh(cyl(r, r, h, 24, true, -a, a * 2), material, [0, y, -R]);
    g.add(band(0.36, 0, blue));
    for (const y of [-0.09, 0, 0.09]) g.add(band(0.014, y, std(0x5aa7d8, { roughness: 0.9, side: THREE.DoubleSide }), R + 0.004));
    g.add(band(0.024, 0.175, white, R + 0.003));
    g.add(band(0.024, -0.175, white, R + 0.003));
    g.add(band(0.014, 0.15, std(0xdfe6ec, { roughness: 0.6 }), R + 0.006, 0.26)); // nose wire
    for (const s of [-1, 1]) {
      const loop = mesh(new THREE.TorusGeometry(0.15, 0.009, 8, 28, Math.PI), white, [s * Math.sin(half) * R, 0, Math.cos(half) * R - R], [0, s * -0.5, s * (-Math.PI / 2)]);
      g.add(loop);
    }
    return g;
  },

  cap() {
    const g = new THREE.Group();
    const dome = roughen(new THREE.SphereGeometry(0.36, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.56), 0.1, 7);
    g.add(mesh(dome, std(0x8fd3e6, { roughness: 0.9, flatShading: true, side: THREE.DoubleSide }), [0, 0, 0], [0, 0, 0], [1, 0.62, 1]));
    g.add(mesh(new THREE.TorusGeometry(0.335, 0.032, 8, 22), std(0x5fb3cc, { roughness: 0.9, flatShading: true }), [0, -0.035, 0], [Math.PI / 2, 0, 0]));
    return g;
  },

  cast() {
    const g = new THREE.Group();
    const plaster = std(0xf6f4ee, { roughness: 1 });
    const padding = std(0xe6dcc4, { roughness: 1 });
    const outer = roughen(new THREE.CylinderGeometry(0.15, 0.2, 0.86, 22, 8, true), 0.035, 11);
    g.add(mesh(outer, plaster));
    g.add(mesh(cyl(0.125, 0.172, 0.86, 22, true), std(0xd9d2c0, { roughness: 1, side: THREE.BackSide })));
    g.add(mesh(new THREE.TorusGeometry(0.145, 0.028, 8, 22), padding, [0, 0.43, 0], [Math.PI / 2, 0, 0]));
    g.add(mesh(new THREE.TorusGeometry(0.19, 0.03, 8, 22), padding, [0, -0.43, 0], [Math.PI / 2, 0, 0]));
    // thumb opening
    g.add(mesh(cyl(0.06, 0.075, 0.2, 14, true), std(0xf6f4ee, { roughness: 1, side: THREE.DoubleSide }), [0.17, 0.27, 0], [0, 0, -0.9]));
    g.add(mesh(new THREE.TorusGeometry(0.06, 0.016, 6, 14), padding, [0.248, 0.332, 0], [Math.PI / 2, -0.9, 0]));
    for (const y of [-0.2, 0, 0.18]) {
      g.add(mesh(new THREE.TorusGeometry(0.176 - y * 0.058, 0.006, 6, 24), std(0xe4e0d6, { roughness: 1 }), [0, y, 0], [Math.PI / 2, 0, 0.3]));
    }
    return g;
  },

  medicine() {
    const g = new THREE.Group();
    const foil = std(0xd7dde4, { metalness: 0.9, roughness: 0.32 });
    g.add(mesh(shellGeometry([{ y: -0.012, hx: 0.34, hz: 0.2, r: 0.03 }, { y: 0.012, hx: 0.34, hz: 0.2, r: 0.03 }], { capBottom: true, capTop: true }), foil));
    const dome = new THREE.SphereGeometry(0.05, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const colors = [0xff7a59, 0xfff3d6];
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 2; j++) {
        g.add(mesh(dome, std(colors[(i + j) % 2], { roughness: 0.35 }), [-0.24 + i * 0.12, 0.012, -0.09 + j * 0.18], [0, 0, 0], [0.85, 0.7, 1.5]));
      }
    }
    const capsule = new THREE.CapsuleGeometry(0.04, 0.1, 6, 12);
    g.add(mesh(capsule, std(0xe5352b, { roughness: 0.3 }), [0.2, 0.07, 0.3], [Math.PI / 2, 0, 0.6]));
    g.add(mesh(capsule, std(0xf5c518, { roughness: 0.3 }), [-0.02, 0.07, 0.33], [Math.PI / 2, 0, -0.5]));
    g.add(mesh(cyl(0.06, 0.06, 0.035, 18), std(0xffffff, { roughness: 0.4 }), [-0.24, 0.05, 0.3]));
    return g;
  },

  cloth() {
    const g = new THREE.Group();
    const tex = canvasTexture(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#d6eadc';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(90,140,110,0.18)';
      for (let i = 0; i < w; i += 8) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
      }
      bloodBlot(ctx, 210, 250, 150);
      bloodBlot(ctx, 360, 150, 80);
      bloodBlot(ctx, 330, 380, 60);
    });
    const geo = new THREE.PlaneGeometry(0.85, 0.85, 18, 18);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const edge = Math.max(Math.abs(x), Math.abs(y)) / 0.425;
      p.setZ(i, Math.sin(x * 9 + 1) * Math.cos(y * 7) * 0.055 + Math.sin(y * 13) * 0.02 - edge * edge * 0.12);
    }
    geo.computeVertexNormals();
    g.add(mesh(geo, std(0xffffff, { map: tex, roughness: 1, side: THREE.DoubleSide })));
    return g;
  },

  bedding() {
    const g = new THREE.Group();
    const layer = (y, hx, hz, color) =>
      mesh(shellGeometry([{ y: 0, hx, hz, r: 0.07 }, { y: 0.03, hx: hx + 0.012, hz: hz + 0.012, r: 0.08 }, { y: 0.08, hx: hx + 0.012, hz: hz + 0.012, r: 0.08 }, { y: 0.11, hx, hz, r: 0.07 }], { capBottom: true, capTop: true }), std(color, { roughness: 1 }), [0, y, 0]);
    g.add(layer(0, 0.42, 0.3, 0xf3f6f8));
    g.add(layer(0.11, 0.41, 0.29, 0xbcd9ee));
    g.add(layer(0.22, 0.4, 0.28, 0xf3f6f8));
    const stain = canvasTexture(256, 256, (ctx) => {
      const y = ctx.createRadialGradient(128, 128, 10, 128, 128, 120);
      y.addColorStop(0, 'rgba(170,120,30,0.85)');
      y.addColorStop(0.7, 'rgba(190,150,50,0.5)');
      y.addColorStop(1, 'rgba(190,150,50,0)');
      ctx.fillStyle = y;
      ctx.fillRect(0, 0, 256, 256);
      bloodBlot(ctx, 150, 120, 55);
    });
    g.add(mesh(new THREE.PlaneGeometry(0.5, 0.42), new THREE.MeshStandardMaterial({ map: stain, transparent: true, roughness: 1, depthWrite: false }), [0.05, 0.333, 0.02], [-Math.PI / 2, 0, 0.3]));
    return g;
  },

  // Red bin ------------------------------------------------------------------
  syringe() {
    const g = new THREE.Group();
    const clear = clearPlastic(0.4);
    const white = std(0xf7f9fb, { roughness: 0.35 });
    g.add(mesh(cyl(0.1, 0.1, 0.62, 24, true), clear));
    g.add(mesh(cyl(0.032, 0.1, 0.06, 24), clear, [0, 0.34, 0]));
    g.add(mesh(cyl(0.026, 0.034, 0.1, 14), std(0xe8eef4, { roughness: 0.3 }), [0, 0.42, 0])); // luer tip, no needle
    g.add(mesh(cyl(0.2, 0.2, 0.026, 28), white, [0, -0.31, 0], [0, 0, 0], [1, 1, 0.52]));
    g.add(mesh(cyl(0.093, 0.093, 0.075, 20), std(0x23272e, { roughness: 0.8 }), [0, 0.06, 0]));
    g.add(mesh(cyl(0.088, 0.088, 0.24, 20), new THREE.MeshStandardMaterial({ color: 0xd9434a, transparent: true, opacity: 0.75, roughness: 0.2 }), [0, 0.215, 0]));
    g.add(mesh(new THREE.BoxGeometry(0.075, 0.6, 0.016), white, [0, -0.275, 0]));
    g.add(mesh(new THREE.BoxGeometry(0.016, 0.6, 0.075), white, [0, -0.275, 0]));
    g.add(mesh(cyl(0.125, 0.125, 0.026, 24), white, [0, -0.585, 0]));
    const tick = std(0x1c2530, { roughness: 0.8, side: THREE.DoubleSide });
    for (let i = 0; i < 9; i++) {
      const long = i % 2 === 0;
      g.add(mesh(cyl(0.1015, 0.1015, 0.007, 20, true, -0.5, long ? 1 : 0.6), tick, [0, -0.22 + i * 0.062, 0]));
    }
    return g;
  },

  glove() {
    const g = new THREE.Group();
    const nitrile = std(0x2f86e6, { roughness: 0.5 });
    g.add(mesh(new THREE.SphereGeometry(1, 22, 16), nitrile, [0, 0, 0], [0, 0, 0], [0.215, 0.26, 0.08]));
    const fingers = [[-0.14, 0.2, 0.13], [-0.048, 0.27, 0.04], [0.048, 0.25, -0.04], [0.14, 0.18, -0.13]];
    for (const [x, len, rz] of fingers) {
      const f = mesh(new THREE.CapsuleGeometry(0.046, len, 6, 12), nitrile, [x - Math.sin(rz) * len * 0.5, 0.2 + len * 0.5, 0], [0, 0, rz], [1, 1, 0.8]);
      g.add(f);
    }
    g.add(mesh(new THREE.CapsuleGeometry(0.052, 0.17, 6, 12), nitrile, [0.25, 0.03, 0], [0, 0, -0.95], [1, 1, 0.8]));
    g.add(mesh(cyl(0.165, 0.2, 0.3, 22, true), std(0x2f86e6, { roughness: 0.5, side: THREE.DoubleSide }), [0, -0.36, 0], [0, 0, 0], [1, 1, 0.4]));
    g.add(mesh(new THREE.TorusGeometry(0.2, 0.02, 8, 24), std(0x2470c8, { roughness: 0.5 }), [0, -0.51, 0], [Math.PI / 2, 0, 0], [1, 0.4, 1]));
    return g;
  },

  ivBottle() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CapsuleGeometry(0.2, 0.44, 10, 26), clearPlastic(0.42)));
    g.add(mesh(new THREE.CapsuleGeometry(0.185, 0.16, 8, 24), new THREE.MeshStandardMaterial({ color: 0xbfeaf5, transparent: true, opacity: 0.85, roughness: 0.15 }), [0, -0.15, 0]));
    const label = canvasTexture(512, 256, (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1565c0';
      ctx.fillRect(0, 0, w, 70);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 44px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('IV FLUID', w / 2, 50);
      ctx.fillStyle = '#1565c0';
      ctx.font = '700 40px Arial';
      ctx.fillText('DEXTROSE 5%', w / 2, 130);
      ctx.fillStyle = '#5b6b7b';
      ctx.font = '500 26px Arial';
      ctx.fillText('500 ml • Sterile', w / 2, 175);
      ctx.fillRect(110, 200, 292, 6);
      ctx.fillRect(160, 220, 192, 6);
    });
    g.add(mesh(cyl(0.204, 0.204, 0.3, 26, true, -1.1, 2.2), std(0xffffff, { map: label, roughness: 0.6, side: THREE.DoubleSide }), [0, 0.04, 0]));
    g.add(mesh(cyl(0.07, 0.1, 0.09, 20), std(0xe9f1f7, { roughness: 0.4 }), [0, 0.46, 0]));
    g.add(mesh(cyl(0.09, 0.09, 0.08, 20), std(0x1565c0, { roughness: 0.4 }), [0, 0.54, 0]));
    g.add(mesh(cyl(0.03, 0.03, 0.05, 12), std(0xd0d7de, { roughness: 0.4 }), [0, 0.6, 0]));
    g.add(mesh(new THREE.TorusGeometry(0.075, 0.014, 8, 20), std(0xe9f1f7, { roughness: 0.4 }), [0, -0.47, 0]));
    return g;
  },

  bloodTubes() {
    const g = new THREE.Group();
    const tube = (capColor, fill) => {
      const t = new THREE.Group();
      const body = clearPlastic(0.36);
      t.add(mesh(cyl(0.072, 0.072, 0.52, 20, true), body));
      t.add(mesh(new THREE.SphereGeometry(0.072, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), body, [0, -0.26, 0]));
      const blood = std(0x8b0d14, { roughness: 0.25 });
      const h = 0.5 * fill;
      t.add(mesh(cyl(0.063, 0.063, h, 18), blood, [0, -0.26 + h / 2, 0]));
      t.add(mesh(new THREE.SphereGeometry(0.063, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), blood, [0, -0.26, 0]));
      t.add(mesh(cyl(0.0735, 0.0735, 0.2, 20, true, -1.2, 2.4), std(0xffffff, { roughness: 0.7, side: THREE.DoubleSide }), [0, 0.02, 0]));
      t.add(mesh(cyl(0.09, 0.09, 0.14, 20), std(capColor, { roughness: 0.45 }), [0, 0.31, 0]));
      t.add(mesh(cyl(0.05, 0.05, 0.01, 16), std(0x3a3f47, { roughness: 0.8 }), [0, 0.382, 0]));
      return t;
    };
    const a = tube(0x8e44ad, 0.62);
    a.position.set(-0.12, 0, 0);
    a.rotation.z = 0.2;
    const b = tube(0xd6332a, 0.75);
    b.position.set(0.12, -0.02, 0.04);
    b.rotation.z = -0.22;
    g.add(a, b);
    return g;
  },

  esrTube() {
    const g = new THREE.Group();
    const body = clearPlastic(0.36);
    g.add(mesh(cyl(0.04, 0.04, 0.96, 16, true), body));
    g.add(mesh(new THREE.SphereGeometry(0.04, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), body, [0, -0.48, 0]));
    const blood = std(0x8b0d14, { roughness: 0.25 });
    g.add(mesh(cyl(0.033, 0.033, 0.7, 14), blood, [0, -0.13, 0]));
    g.add(mesh(new THREE.SphereGeometry(0.033, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), blood, [0, -0.48, 0]));
    const scale = canvasTexture(64, 512, (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#111';
      for (let i = 0; i <= 20; i++) ctx.fillRect(0, 8 + i * 24.5, i % 5 === 0 ? 44 : 24, 3);
    });
    g.add(mesh(cyl(0.0415, 0.0415, 0.74, 16, true, -0.6, 1.2), std(0xffffff, { map: scale, roughness: 0.7, side: THREE.DoubleSide }), [0, -0.05, 0]));
    g.add(mesh(cyl(0.058, 0.058, 0.12, 18), std(0x15181d, { roughness: 0.6 }), [0, 0.53, 0]));
    g.add(mesh(cyl(0.062, 0.062, 0.02, 18), std(0x2c3138, { roughness: 0.6 }), [0, 0.47, 0]));
    return g;
  },

  vidasStrip() {
    const g = new THREE.Group();
    const white = std(0xf6f8fa, { roughness: 0.45 });
    g.add(mesh(new THREE.BoxGeometry(0.96, 0.045, 0.14), white));
    g.add(mesh(new THREE.BoxGeometry(0.66, 0.006, 0.12), std(0xcdd5dd, { metalness: 0.9, roughness: 0.3 }), [-0.04, 0.026, 0]));
    const well = std(0xeef3f7, { roughness: 0.3, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 9; i++) g.add(mesh(cyl(0.036, 0.03, 0.12, 14), well, [-0.33 + i * 0.073, -0.08, 0]));
    g.add(mesh(cyl(0.05, 0.04, 0.15, 16), well, [-0.425, -0.09, 0]));
    g.add(mesh(cyl(0.04, 0.04, 0.008, 16), std(0x7a1f2b, { roughness: 0.3 }), [-0.425, 0.024, 0]));
    g.add(mesh(new THREE.BoxGeometry(0.15, 0.1, 0.14), white, [0.405, 0.03, 0]));
    const sticker = canvasTexture(128, 128, (ctx) => {
      ctx.fillStyle = '#ff5fa2';
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = '#fff';
      ctx.font = '700 46px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('TSH', 64, 60);
      ctx.fillStyle = '#111';
      for (let i = 0; i < 12; i++) ctx.fillRect(14 + i * 9, 80, i % 3 ? 3 : 6, 34);
    });
    g.add(mesh(new THREE.PlaneGeometry(0.13, 0.12), std(0xffffff, { map: sticker, roughness: 0.6 }), [0.405, 0.081, 0], [-Math.PI / 2, 0, 0]));
    return g;
  },

  rapidCard() {
    const g = new THREE.Group();
    g.add(mesh(shellGeometry([{ y: -0.035, hx: 0.42, hz: 0.15, r: 0.05 }, { y: 0.035, hx: 0.42, hz: 0.15, r: 0.05 }], { capBottom: true, capTop: true }), std(0xf8fafc, { roughness: 0.4 })));
    const face = canvasTexture(768, 256, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      // result window
      ctx.fillStyle = '#c9d2db';
      roundRect(ctx, 250, 62, 290, 132, 22);
      ctx.fill();
      ctx.fillStyle = '#fdfdfd';
      roundRect(ctx, 264, 76, 262, 104, 12);
      ctx.fill();
      ctx.fillStyle = '#d81b3a';
      ctx.fillRect(330, 80, 14, 96);
      ctx.fillStyle = 'rgba(216,27,58,0.75)';
      ctx.fillRect(440, 80, 14, 96);
      ctx.fillStyle = '#2b3440';
      ctx.font = '700 44px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('C', 337, 48);
      ctx.fillText('T', 447, 48);
      // sample well
      ctx.fillStyle = '#c9d2db';
      ctx.beginPath();
      ctx.arc(650, 128, 56, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f3b4bd';
      ctx.beginPath();
      ctx.arc(650, 128, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2b3440';
      ctx.fillText('S', 650, 236);
      ctx.font = '700 30px Arial';
      ctx.fillText('RAPID', 120, 118);
      ctx.fillText('TEST', 120, 156);
    });
    g.add(mesh(new THREE.PlaneGeometry(0.8, 0.267), new THREE.MeshStandardMaterial({ map: face, transparent: true, roughness: 0.5 }), [0, 0.037, 0], [-Math.PI / 2, 0, 0]));
    return g;
  },

  // Blue bin -----------------------------------------------------------------
  brokenGlass() {
    const g = new THREE.Group();
    const mat = glass(0xc9772a, 0.72);
    const N = 18;
    const r = 0.22;
    const heights = [0.5, 0.3, 0.44, 0.2, 0.36, 0.56, 0.28, 0.16, 0.4, 0.5, 0.24, 0.38, 0.2, 0.46, 0.3, 0.52, 0.26, 0.42];
    const pos = [];
    const idx = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      pos.push(Math.cos(a) * r, 0, Math.sin(a) * r, Math.cos(a) * r * 1.06, heights[i], Math.sin(a) * r * 1.06);
    }
    for (let i = 0; i < N; i++) {
      const a = i * 2;
      const b = ((i + 1) % N) * 2;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    const wall = new THREE.BufferGeometry();
    wall.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    wall.setIndex(idx);
    wall.computeVertexNormals();
    g.add(withEdges(mesh(wall, mat, [0, -0.25, 0]), 0xffe2b8, 0.85));
    g.add(mesh(new THREE.CylinderGeometry(r, r * 0.96, 0.03, N), glass(0xa85f1c, 0.85), [0, -0.25, 0]));
    const shard = (pts, p, rot) => {
      const shape = new THREE.Shape();
      shape.moveTo(...pts[0]);
      pts.slice(1).forEach((q) => shape.lineTo(...q));
      shape.closePath();
      return withEdges(mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.018, bevelEnabled: false }), mat, p, rot), 0xffe2b8, 0.85);
    };
    g.add(shard([[0, 0], [0.26, 0.04], [0.08, 0.3]], [0.3, -0.26, 0.12], [-Math.PI / 2, 0, 0.4]));
    g.add(shard([[0, 0], [0.2, 0], [0.14, 0.24], [0.02, 0.16]], [-0.5, -0.26, 0.1], [-Math.PI / 2, 0, -0.3]));
    g.add(shard([[0, 0], [0.16, 0.02], [0.06, 0.32]], [0.3, -0.24, -0.08], [-0.3, 0.5, 0.5]));
    g.add(shard([[0, 0], [0.12, 0], [0.05, 0.18]], [-0.34, -0.26, -0.22], [-Math.PI / 2, 0, 1.4]));
    return g;
  },

  ampoule() {
    const g = new THREE.Group();
    const profile = [[0, 0], [0.1, 0], [0.112, 0.025], [0.112, 0.5], [0.1, 0.57], [0.052, 0.63], [0.046, 0.665], [0.076, 0.72], [0.08, 0.78], [0.06, 0.86], [0.024, 0.96], [0, 0.98]];
    g.add(mesh(new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 28), glass(0xcfeaff, 0.58)));
    g.add(mesh(cyl(0.1, 0.1, 0.34, 22), new THREE.MeshStandardMaterial({ color: 0xffe08a, transparent: true, opacity: 0.85, roughness: 0.15 }), [0, 0.19, 0]));
    g.add(mesh(new THREE.TorusGeometry(0.05, 0.009, 8, 20), std(0x1565c0, { roughness: 0.4 }), [0, 0.648, 0], [Math.PI / 2, 0, 0]));
    const label = canvasTexture(256, 128, (ctx, w, h) => {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#c62828';
      ctx.fillRect(0, 0, w, 26);
      ctx.fillStyle = '#1b2530';
      ctx.font = '700 34px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('INJ 2 ml', w / 2, 70);
      ctx.fillRect(50, 88, 156, 6);
      ctx.fillRect(80, 104, 96, 6);
    });
    g.add(mesh(cyl(0.114, 0.114, 0.2, 24, true, -1, 2), std(0xffffff, { map: label, roughness: 0.6, side: THREE.DoubleSide }), [0, 0.3, 0]));
    return g;
  },

  labSlides() {
    const g = new THREE.Group();
    const slide = () => {
      const s = new THREE.Group();
      s.add(withEdges(mesh(new THREE.BoxGeometry(0.78, 0.016, 0.26), glass(0x9fd6ff, 0.55)), 0x3d8bd6, 0.9));
      s.add(mesh(new THREE.BoxGeometry(0.2, 0.018, 0.262), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.88, roughness: 0.9 }), [-0.29, 0, 0]));
      s.add(mesh(new THREE.CircleGeometry(0.075, 20), new THREE.MeshStandardMaterial({ color: 0xa0408a, transparent: true, opacity: 0.75, roughness: 0.6 }), [0.13, 0.0095, 0], [-Math.PI / 2, 0, 0], [1.3, 1, 1]));
      s.add(withEdges(mesh(new THREE.BoxGeometry(0.26, 0.006, 0.22), glass(0xe8f7ff, 0.3), [0.13, 0.014, 0]), 0x3d8bd6, 0.6));
      return s;
    };
    const a = slide();
    const b = slide();
    b.position.set(0.05, -0.05, -0.06);
    b.rotation.y = 0.5;
    g.add(a, b);
    return g;
  },

  nails() {
    const g = new THREE.Group();
    const mat = steel(0xb9c1ca);
    const nail = () => {
      const n = new THREE.Group();
      n.add(mesh(cyl(0.024, 0.024, 0.6, 10), mat));
      n.add(mesh(new THREE.ConeGeometry(0.024, 0.1, 10), mat, [0, -0.35, 0], [Math.PI, 0, 0]));
      n.add(mesh(cyl(0.07, 0.07, 0.02, 18), mat, [0, 0.31, 0]));
      return n;
    };
    const layout = [[0, 0, 0, 0.5], [0.1, 0.02, 0.06, -0.55], [-0.06, -0.04, -0.06, 1.35], [0.02, 0.08, 0.1, 0.05]];
    for (const [x, y, z, rz] of layout) {
      const n = nail();
      n.position.set(x, y, z);
      n.rotation.set(0.2, 0, rz);
      g.add(n);
    }
    return g;
  },

  implant() {
    const g = new THREE.Group();
    const titanium = steel(0xbcc4cf);
    const shape = new THREE.Shape();
    shape.moveTo(-0.36, -0.1);
    shape.lineTo(0.36, -0.1);
    shape.absarc(0.36, 0, 0.1, -Math.PI / 2, Math.PI / 2, false);
    shape.lineTo(-0.36, 0.1);
    shape.absarc(-0.36, 0, 0.1, Math.PI / 2, Math.PI * 1.5, false);
    const holes = [-0.32, -0.16, 0, 0.16, 0.32];
    for (const x of holes) {
      const hole = new THREE.Path();
      hole.absarc(x, 0, 0.046, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
    const plate = new THREE.ExtrudeGeometry(shape, { depth: 0.045, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2, curveSegments: 18 });
    g.add(mesh(plate, titanium, [0, 0, -0.022]));
    const screw = (x) => {
      const s = new THREE.Group();
      s.add(mesh(cyl(0.058, 0.044, 0.035, 16), titanium, [0, 0.03, 0]));
      s.add(mesh(new THREE.BoxGeometry(0.07, 0.012, 0.014), std(0x59616b, { metalness: 1, roughness: 0.4 }), [0, 0.049, 0]));
      s.add(mesh(cyl(0.026, 0.02, 0.3, 12), titanium, [0, -0.13, 0]));
      for (let i = 0; i < 7; i++) s.add(mesh(new THREE.TorusGeometry(0.026, 0.006, 6, 12), titanium, [0, -0.03 - i * 0.036, 0], [Math.PI / 2, 0, 0]));
      s.rotation.x = Math.PI / 2;
      s.position.set(x, 0, 0.02);
      return s;
    };
    g.add(screw(-0.32), screw(0.16));
    return g;
  },

  scissors() {
    const g = new THREE.Group();
    const mat = steel(0xcfd6dd);
    const half = (mirror) => {
      const h = new THREE.Group();
      const blade = new THREE.Shape();
      blade.moveTo(-0.004, -0.02);
      blade.lineTo(0.036, -0.02);
      blade.lineTo(0.02, 0.44);
      blade.lineTo(0, 0.54);
      blade.closePath();
      h.add(mesh(new THREE.ExtrudeGeometry(blade, { depth: 0.014, bevelEnabled: false }), mat, [-0.016, 0, -0.007]));
      h.add(mesh(new THREE.BoxGeometry(0.034, 0.4, 0.016), mat, [0.02, -0.2, 0], [0, 0, -0.1]));
      h.add(mesh(new THREE.TorusGeometry(0.082, 0.018, 10, 26), mat, [0.075, -0.47, 0]));
      h.scale.x = mirror ? -1 : 1;
      h.rotation.z = mirror ? -0.2 : 0.2;
      h.position.z = mirror ? 0.009 : -0.009;
      return h;
    };
    g.add(half(false), half(true));
    g.add(mesh(cyl(0.026, 0.026, 0.05, 14), steel(0x8d96a0), [0, 0, 0], [Math.PI / 2, 0, 0]));
    return g;
  },

  // Green bin ----------------------------------------------------------------
  paperBall() {
    const g = new THREE.Group();
    const geo = roughen(new THREE.IcosahedronGeometry(0.3, 2), 0.42, 5);
    g.add(mesh(geo, std(0xf7f7f2, { roughness: 1, flatShading: true })));
    return g;
  },
};

/** Build a ready-to-show item: centred, scaled and tilted for display. */
export async function createItemModel(def) {
  let object;
  if (def.model.glb) {
    const gltf = await loadGLB(def.model.glb);
    object = gltf.scene.clone(true);
  } else {
    object = BUILDERS[def.model.make]();
  }
  enableShadows(object);
  const fitted = fitToSize(object, def.size ?? 0.6);
  const tilt = new THREE.Group();
  tilt.add(fitted);
  if (def.rot) tilt.rotation.set(...def.rot);
  return tilt;
}

export function itemGlbPaths(items) {
  return items.filter((i) => i.model.glb).map((i) => i.model.glb);
}
