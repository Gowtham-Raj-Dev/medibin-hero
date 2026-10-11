import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// ── asset loading ───────────────────────────────────────────────────────────
// The library .glb files use EXT_meshopt_compression, so the loader needs the decoder.
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();

export function modelUrl(path) {
  return `${import.meta.env.BASE_URL}models/${path}`;
}

export function loadGLB(path) {
  if (!cache.has(path)) cache.set(path, loader.loadAsync(modelUrl(path)));
  return cache.get(path);
}

// ── easing ──────────────────────────────────────────────────────────────────
export const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outBack: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
};

// ── canvas textures ─────────────────────────────────────────────────────────
export function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Biohazard symbol in its standard proportions (unit u = R / 26): three discs
 * (r 15, 11 from the centre) with r 10.5 discs cut out 15 from the centre, a
 * centre hole, thin slits, open horn tips, and a ring showing through the cut-outs.
 * Drawn on a scratch canvas so the cut-outs stay transparent.
 */
export function drawBiohazard(ctx, cx, cy, R, color) {
  const u = R / 26;
  const size = Math.ceil(R * 2.2);
  const o = size / 2;
  const TAU = Math.PI * 2;
  const scratch = () => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
  };
  const point = (k, d) => {
    const angle = -Math.PI / 2 + (k * TAU) / 3;
    return [o + Math.cos(angle) * d * u, o + Math.sin(angle) * d * u];
  };
  const lobes = [0, 1, 2];

  const body = scratch();
  const g = body.getContext('2d');
  const disc = (d, r, k) => {
    g.beginPath();
    g.arc(...point(k, d), r * u, 0, TAU);
    g.fill();
  };
  g.fillStyle = color;
  lobes.forEach((k) => disc(11, 15, k));
  g.globalCompositeOperation = 'destination-out';
  lobes.forEach((k) => disc(15, 10.5, k));
  disc(0, 3, 0);
  for (const k of lobes) {
    g.lineWidth = u;
    g.beginPath();
    g.moveTo(o, o);
    g.lineTo(...point(k, 6));
    g.stroke();
    g.lineWidth = 4 * u;
    g.beginPath();
    g.moveTo(...point(k, 20));
    g.lineTo(...point(k, 28));
    g.stroke();
  }

  const ring = scratch();
  const rg = ring.getContext('2d');
  rg.strokeStyle = color;
  rg.lineWidth = 3.5 * u;
  rg.beginPath();
  rg.arc(o, o, 11.75 * u, 0, TAU);
  rg.stroke();
  rg.globalCompositeOperation = 'destination-in';
  rg.beginPath();
  for (const k of lobes) {
    const [x, y] = point(k, 15);
    rg.moveTo(x + 9.5 * u, y);
    rg.arc(x, y, 9.5 * u, 0, TAU);
  }
  rg.fill();

  g.globalCompositeOperation = 'source-over';
  g.drawImage(ring, 0, 0);
  ctx.drawImage(body, cx - o, cy - o);
}

/** Simple leaf mark used on the general-waste bin. */
export function drawLeaf(ctx, cx, cy, R, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 5);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, R);
  ctx.bezierCurveTo(R * 1.05, R * 0.45, R * 0.75, -R * 0.75, 0, -R);
  ctx.bezierCurveTo(-R * 0.75, -R * 0.75, -R * 1.05, R * 0.45, 0, R);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = R * 0.09;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, R * 0.95);
  ctx.lineTo(0, -R * 0.6);
  for (const y of [0.45, 0.05, -0.3]) {
    ctx.moveTo(0, R * y);
    ctx.lineTo(R * 0.38, R * (y - 0.3));
    ctx.moveTo(0, R * y);
    ctx.lineTo(-R * 0.38, R * (y - 0.3));
  }
  ctx.stroke();
  ctx.restore();
}

// ── geometry ────────────────────────────────────────────────────────────────
function roundedRectOutline(hx, hz, r, seg) {
  r = Math.min(r, hx, hz);
  const pts = [];
  const corners = [
    [hx - r, hz - r, 0],
    [-(hx - r), hz - r, Math.PI / 2],
    [-(hx - r), -(hz - r), Math.PI],
    [hx - r, -(hz - r), Math.PI * 1.5],
  ];
  for (const [cx, cz, a0] of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
  }
  return pts;
}

/**
 * Skins a stack of rounded-rectangle rings ({ y, hx, hz, r }) into one mesh —
 * the bins, lids and other tapered boxes are all built from this.
 */
export function shellGeometry(rings, { capBottom = false, capTop = false, seg = 5 } = {}) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const count = (seg + 1) * 4;
  rings.forEach((ring, ri) => {
    const pts = roundedRectOutline(ring.hx, ring.hz, ring.r ?? 0.05, seg);
    pts.forEach(([x, z], i) => {
      positions.push(x, ring.y, z);
      uvs.push(i / count, ri / Math.max(1, rings.length - 1));
    });
  });
  for (let ri = 0; ri < rings.length - 1; ri++) {
    for (let i = 0; i < count; i++) {
      const a = ri * count + i;
      const b = ri * count + ((i + 1) % count);
      const c = a + count;
      const d = b + count;
      indices.push(a, c, b, b, c, d);
    }
  }
  const addCap = (ring, up) => {
    const pts = roundedRectOutline(ring.hx, ring.hz, ring.r ?? 0.05, seg);
    const base = positions.length / 3;
    positions.push(0, ring.y, 0);
    uvs.push(0.5, 0.5);
    pts.forEach(([x, z]) => {
      positions.push(x, ring.y, z);
      uvs.push(0.5 + x / (ring.hx * 2), 0.5 + z / (ring.hz * 2));
    });
    for (let i = 0; i < count; i++) {
      const a = base + 1 + i;
      const b = base + 1 + ((i + 1) % count);
      if (up) indices.push(base, b, a);
      else indices.push(base, a, b);
    }
  };
  if (capBottom) addCap(rings[0], false);
  if (capTop) addCap(rings[rings.length - 1], true);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Centre an object on its bounding box and scale its longest side to `size`. */
export function fitToSize(object, size) {
  const box = new THREE.Box3().setFromObject(object);
  const dim = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const holder = new THREE.Group();
  object.position.sub(centre);
  holder.add(object);
  holder.scale.setScalar(size / Math.max(dim.x, dim.y, dim.z, 1e-4));
  return holder;
}

export function enableShadows(object, { cast = true, receive = false } = {}) {
  object.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = cast;
      o.receiveShadow = receive;
    }
  });
  return object;
}
