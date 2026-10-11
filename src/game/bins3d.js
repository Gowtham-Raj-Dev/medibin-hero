// Colour-coded pedal bins, built in code so each one has a working hinged lid,
// a pedal, a liner and a bilingual label sticker.
import * as THREE from 'three';
import { canvasTexture, roundRect, drawBiohazard, drawLeaf, shellGeometry } from './three-utils.js';

export const BIN_SIZE = { height: 1.05, topX: 0.44, topZ: 0.4, botX: 0.34, botZ: 0.3 };
const LABEL_FONT = '"Baloo Thambi 2 Variable", "Nirmala UI", "Noto Sans Tamil", sans-serif';

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Set the largest font size (up to `size`) at which `text` fits in `maxWidth`. */
function fitFont(ctx, text, weight, size, maxWidth) {
  let px = size;
  do {
    ctx.font = `${weight} ${px}px ${LABEL_FONT}`;
    px -= 2;
  } while (ctx.measureText(text).width > maxWidth && px > 16);
}

function stickerTexture(def) {
  return canvasTexture(512, 600, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, 8, 8, w - 16, h - 16, 44);
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = def.deep;
    roundRect(ctx, 20, 20, w - 40, h - 40, 34);
    ctx.stroke();

    if (def.icon === 'leaf') drawLeaf(ctx, w / 2, 170, 105, def.deep);
    else drawBiohazard(ctx, w / 2, 178, 132, '#16191d');

    ctx.textAlign = 'center';
    ctx.fillStyle = '#16191d';
    ctx.font = `800 62px ${LABEL_FONT}`;
    const lines = wrapText(ctx, def.label.toUpperCase(), w - 90);
    let y = lines.length > 1 ? 378 : 410;
    for (const line of lines) {
      ctx.fillText(line, w / 2, y);
      y += 62;
    }
    ctx.fillStyle = def.deep;
    fitFont(ctx, def.labelTa, 700, 46, w - 84);
    ctx.fillText(def.labelTa, w / 2, 548);
  });
}

export class Bin {
  constructor(def, index) {
    this.def = def;
    this.index = index;
    this.group = new THREE.Group();
    this.body = new THREE.Group(); // squashes and shakes; the group itself stays put
    this.group.add(this.body);

    const { height: H, topX, topZ, botX, botZ } = BIN_SIZE;
    const color = new THREE.Color(def.color);
    const deep = new THREE.Color(def.deep);

    this.material = new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.02, emissive: color, emissiveIntensity: 0 });
    const darkMat = new THREE.MeshStandardMaterial({ color: deep, roughness: 0.5 });
    this.lidMaterial = new THREE.MeshStandardMaterial({ color: deep, roughness: 0.4, emissive: color, emissiveIntensity: 0 });

    // outer shell with a rolled lip
    const outer = new THREE.Mesh(
      shellGeometry([
        { y: 0, hx: botX, hz: botZ, r: 0.07 },
        { y: H - 0.09, hx: topX - 0.008, hz: topZ - 0.008, r: 0.09 },
        { y: H - 0.075, hx: topX + 0.028, hz: topZ + 0.028, r: 0.1 },
        { y: H, hx: topX + 0.028, hz: topZ + 0.028, r: 0.1 },
        { y: H, hx: topX - 0.03, hz: topZ - 0.03, r: 0.08 },
      ]),
      this.material,
    );
    // liner bag seen through the open lid
    const inner = new THREE.Mesh(
      shellGeometry(
        [
          { y: H, hx: topX - 0.03, hz: topZ - 0.03, r: 0.08 },
          { y: 0.16, hx: botX - 0.02, hz: botZ - 0.02, r: 0.06 },
        ],
        { capTop: false },
      ),
      new THREE.MeshStandardMaterial({ color: deep.clone().multiplyScalar(0.45), roughness: 0.9, side: THREE.DoubleSide }),
    );
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(botX * 2, botZ * 2), new THREE.MeshStandardMaterial({ color: deep.clone().multiplyScalar(0.3), roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.165;
    const base = new THREE.Mesh(
      shellGeometry([
        { y: 0, hx: botX + 0.02, hz: botZ + 0.02, r: 0.08 },
        { y: 0.07, hx: botX + 0.026, hz: botZ + 0.026, r: 0.08 },
        { y: 0.085, hx: botX + 0.008, hz: botZ + 0.008, r: 0.07 },
      ]),
      darkMat,
    );
    outer.castShadow = base.castShadow = true;
    outer.receiveShadow = true;
    this.body.add(outer, inner, floor, base);

    // pedal
    this.pedal = new THREE.Group();
    const grey = new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.5, metalness: 0.4 });
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.13), grey);
    pad.position.set(0, 0, 0.09);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.025, 0.1), grey);
    this.pedal.add(pad, arm);
    this.pedal.position.set(0, 0.075, botZ + 0.03);
    pad.castShadow = true;
    this.body.add(this.pedal);

    // label sticker on the (slightly leaning) front face
    const lean = Math.atan((topZ - botZ) / H);
    const sticker = new THREE.Mesh(
      new THREE.PlaneGeometry(0.52, 0.61),
      new THREE.MeshStandardMaterial({ map: stickerTexture(def), transparent: true, roughness: 0.55 }),
    );
    const stickerY = 0.5;
    sticker.position.set(0, stickerY, botZ + (topZ - botZ) * (stickerY / H) + 0.006);
    sticker.rotation.x = lean;
    this.body.add(sticker);

    // hinged lid
    const lidX = topX + 0.05;
    const lidZ = topZ + 0.05;
    this.lidPivot = new THREE.Group();
    this.lidPivot.position.set(0, H + 0.006, -lidZ + 0.02);
    const lid = new THREE.Mesh(
      shellGeometry(
        [
          { y: 0, hx: lidX, hz: lidZ, r: 0.11 },
          { y: 0.04, hx: lidX, hz: lidZ, r: 0.11 },
          { y: 0.085, hx: lidX - 0.06, hz: lidZ - 0.06, r: 0.09 },
        ],
        { capBottom: true, capTop: true },
      ),
      this.lidMaterial,
    );
    lid.position.set(0, 0, lidZ - 0.02);
    lid.castShadow = true;
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.035, 0.06), grey);
    handle.position.set(0, 0.03, lidZ * 2 - 0.03);
    this.lidPivot.add(lid, handle);
    this.body.add(this.lidPivot);

    // glow ring on the floor
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.64, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.012;
    this.group.add(this.ring);

    // invisible click target
    this.hitbox = new THREE.Mesh(new THREE.BoxGeometry(topX * 2 + 0.16, H + 0.5, topZ * 2 + 0.3), new THREE.MeshBasicMaterial({ visible: false }));
    this.hitbox.position.y = (H + 0.5) / 2;
    this.hitbox.userData.binIndex = index;
    this.group.add(this.hitbox);

    this.openTarget = 0;
    this.open = 0;
    this.hover = 0;
    this.hoverTarget = 0;
    this.squash = 0; // spring displacement
    this.squashVel = 0;
    this.shakeTime = 0;
    this.pulseTime = 0;
    this.flash = 0;
    this.flashColor = new THREE.Color(def.color);
    this.baseColor = color.clone();
  }

  /** World position of the bin opening. */
  get mouth() {
    return new THREE.Vector3(this.group.position.x, BIN_SIZE.height + 0.05, this.group.position.z);
  }

  setOpen(v) {
    this.openTarget = v;
  }
  setHover(on) {
    this.hoverTarget = on ? 1 : 0;
  }
  /** The item has landed: bounce, and flash green or red. */
  catchItem(correct) {
    this.squashVel = -2.6;
    this.flash = 1;
    this.flashColor.set(correct ? 0x38e07b : 0xff3b30);
    if (!correct) this.shakeTime = 0.55;
  }
  /** Point the player at this bin (used to show the right answer). */
  pulse(seconds = 1.8) {
    this.pulseTime = seconds;
  }

  update(dt, time) {
    // lid: fast open, softer close
    const k = this.openTarget > this.open ? 14 : 7;
    this.open += (this.openTarget - this.open) * Math.min(1, dt * k);
    const peek = this.hover * 0.14;
    this.lidPivot.rotation.x = -Math.max(this.open, peek) * 1.32;
    this.pedal.rotation.x = Math.max(this.open, peek) * 0.35;

    this.hover += (this.hoverTarget - this.hover) * Math.min(1, dt * 12);

    // squash spring
    this.squashVel += (-this.squash * 190 - this.squashVel * 11) * dt;
    this.squash += this.squashVel * dt;
    const s = THREE.MathUtils.clamp(this.squash, -0.25, 0.25);
    const lift = 1 + this.hover * 0.045;
    this.body.scale.set(lift * (1 - s * 0.6), lift * (1 + s), lift * (1 - s * 0.6));

    // "no" shake
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const a = Math.max(0, this.shakeTime) / 0.55;
      this.body.rotation.z = Math.sin(time * 42) * 0.075 * a;
      this.body.position.x = Math.sin(time * 42) * 0.03 * a;
    } else {
      this.body.rotation.z = 0;
      this.body.position.x = 0;
    }

    // glow
    let glow = this.hover * 0.16;
    let ringOpacity = this.hover * 0.55;
    if (this.pulseTime > 0) {
      this.pulseTime -= dt;
      const wave = 0.5 + 0.5 * Math.sin(time * 11);
      glow = Math.max(glow, 0.2 + wave * 0.5);
      ringOpacity = Math.max(ringOpacity, 0.5 + wave * 0.5);
      this.body.position.y = Math.abs(Math.sin(time * 5.5)) * 0.05;
    } else {
      this.body.position.y = 0;
    }
    this.flash = Math.max(0, this.flash - dt * 1.9);
    this.material.emissive.copy(this.baseColor).lerp(this.flashColor, Math.min(1, this.flash * 1.4));
    this.lidMaterial.emissive.copy(this.material.emissive);
    this.material.emissiveIntensity = this.lidMaterial.emissiveIntensity = Math.max(glow, this.flash * 0.9);
    this.ring.material.opacity = ringOpacity;
    this.ring.scale.setScalar(1 + this.hover * 0.06);
  }
}
