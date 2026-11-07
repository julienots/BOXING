// Modèle 3D procédural d'un boxeur : géométrie sculptée paramétrique + squelette avec IK.
// Repère local : pieds au sol en (0,0,0), regard vers +Z, gauche du boxeur = +X.
import * as THREE from 'three';
import { makeSkinTexture, FaceTexture, hairTexture, stubbleTexture, gloveTexture, shortsTexture, shade } from './textures.js';
import { visualMuscle } from '../core/boxer.js';

const V3 = THREE.Vector3;
const _v1 = new V3(), _v2 = new V3(), _v3 = new V3(), _v4 = new V3(), _v5 = new V3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// --------------------------------------------------------------------------- géométries
// Membre : profil de rayon le long de -Y (lathe). profile = [[t, r], ...] t∈[0,1].
function limbGeometry(len, profile, radial = 22, oval = 1) {
  const pts = [];
  const N = 18;
  const rAt = (t) => {
    for (let i = 0; i < profile.length - 1; i++) {
      const [t0, r0] = profile[i], [t1, r1] = profile[i + 1];
      if (t >= t0 && t <= t1) { const k = (t - t0) / (t1 - t0 || 1); const s = k * k * (3 - 2 * k); return r0 + (r1 - r0) * s; }
    }
    return profile[profile.length - 1][1];
  };
  pts.push(new THREE.Vector2(0.0001, 0.0));
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push(new THREE.Vector2(Math.max(0.001, rAt(t)), -t * len));
  }
  pts.push(new THREE.Vector2(0.0001, -len));
  // Arrondi des extrémités.
  pts[1].y += rAt(0) * 0.25; pts[pts.length - 2].y -= rAt(1) * 0.25;
  pts.reverse(); // profil du bas vers le haut → normales vers l'extérieur
  const g = new THREE.LatheGeometry(pts, radial);
  if (oval !== 1) g.scale(1, 1, oval);
  g.computeVertexNormals();
  return g;
}

// Tronc sculpté : anneaux en super-ellipse + déplacements musculaires.
function torsoGeometry(P) {
  const rings = 30, seg = 40;
  const pos = [], uv = [], idx = [];
  const Ht = P.torsoH;
  for (let j = 0; j <= rings; j++) {
    const t = j / rings;
    // Largeur et profondeur selon la hauteur.
    let w = P.waistW + (P.chestW - P.waistW) * smoothstep(0, 0.62, t) + (P.shoulderW - P.chestW) * smoothstep(0.62, 0.86, t);
    let d = P.waistD + (P.chestD - P.waistD) * smoothstep(0.05, 0.6, t);
    const topK = smoothstep(0.86, 1.0, t);
    w = w + (P.neckR * 1.25 - w) * topK;
    d = d + (P.neckR * 1.15 - d) * topK * 0.9;
    // Flanc : dorsaux qui évasent le haut du dos.
    w *= 1 + P.lats * Math.exp(-Math.pow((t - 0.62) / 0.14, 2)) * 0.07;
    for (let i = 0; i <= seg; i++) {
      const u = i / seg;
      const a = (u - 0.25) * Math.PI * 2; // u=0.25 → avant (+Z)
      const sa = Math.sin(a), ca = Math.cos(a);
      const n = 2.5;
      let x = w * Math.sign(sa) * Math.pow(Math.abs(sa), 2 / n);
      let z = d * Math.sign(ca) * Math.pow(Math.abs(ca), 2 / n);
      const front = Math.max(0, ca), back = Math.max(0, -ca);
      const xn = x / Math.max(0.001, w);
      let push = 0;
      // Pectoraux.
      const pecY = Math.exp(-Math.pow((t - 0.66) / 0.08, 2));
      const pecX = Math.exp(-Math.pow((Math.abs(xn) - 0.42) / 0.3, 2));
      push += P.pecs * pecY * pecX * front * (t < 0.66 ? 1.25 : 0.8);
      // Sillon sternal.
      push -= P.pecs * 0.35 * pecY * Math.exp(-Math.pow(xn / 0.08, 2)) * front;
      // Abdominaux (tablettes).
      if (t > 0.08 && t < 0.52) {
        const ab = Math.exp(-Math.pow(xn / 0.32, 2)) * front;
        const rows = 0.5 + 0.5 * Math.cos((t - 0.08) / 0.44 * Math.PI * 3 * 2);
        const cols = 0.5 + 0.5 * Math.cos(xn / 0.16 * Math.PI);
        push += P.abs * ab * (0.5 + 0.5 * rows * cols) * 0.8;
        // Ventre.
        push += P.belly * Math.exp(-Math.pow((t - 0.25) / 0.2, 2)) * Math.exp(-Math.pow(xn / 0.7, 2)) * front;
      }
      // Obliques / poignées.
      push += P.belly * 0.4 * Math.exp(-Math.pow((t - 0.15) / 0.12, 2)) * Math.pow(Math.abs(sa), 4);
      // Dos : gouttière vertébrale et trapèzes.
      push -= 0.006 * back * Math.exp(-Math.pow(xn / 0.1, 2)) * (t < 0.85 ? 1 : 0);
      push += P.traps * Math.exp(-Math.pow((t - 0.9) / 0.07, 2)) * Math.exp(-Math.pow((Math.abs(xn) - 0.45) / 0.25, 2));
      const len = Math.hypot(x, z) || 1;
      x += (x / len) * push; z += (z / len) * push;
      const y = t * Ht + (P.traps * 0.6) * Math.exp(-Math.pow((t - 0.92) / 0.06, 2)) * Math.exp(-Math.pow((Math.abs(xn) - 0.5) / 0.25, 2));
      pos.push(x, y, z + P.chestFwd * smoothstep(0.3, 0.7, t) * front);
      uv.push(u, t);
    }
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
    const a = j * (seg + 1) + i, b = a + seg + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  // Fermetures (bas et col).
  const base = pos.length / 3;
  pos.push(0, -0.01, 0); uv.push(0.5, 0);
  pos.push(0, Ht + P.neckR * 0.9, 0); uv.push(0.5, 1);
  for (let i = 0; i < seg; i++) {
    idx.push(base, i + 1, i);
    const tb = rings * (seg + 1);
    idx.push(base + 1, tb + i, tb + i + 1);
  }
  // Orientation des triangles : normale vers l'extérieur (par rapport à l'axe du tronc).
  for (let k = 0; k < idx.length; k += 3) {
    const ia = idx[k] * 3, ib = idx[k + 1] * 3, ic = idx[k + 2] * 3;
    const ax = pos[ia], ay = pos[ia + 1], az = pos[ia + 2];
    const e1x = pos[ib] - ax, e1y = pos[ib + 1] - ay, e1z = pos[ib + 2] - az;
    const e2x = pos[ic] - ax, e2y = pos[ic + 1] - ay, e2z = pos[ic + 2] - az;
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    const cx = (ax + pos[ib] + pos[ic]) / 3, cy = (ay + pos[ib + 1] + pos[ic + 1]) / 3, cz = (az + pos[ib + 2] + pos[ic + 2]) / 3;
    const ox = cx, oy = cy - Ht * 0.5, oz = cz;
    if (nx * ox + ny * oy * 0.3 + nz * oz < 0) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Bassin / short : super-ellipse évasée.
function pelvisGeometry(P, top, bottom) {
  const pts = [];
  const g = torsoGeometry({
    torsoH: top - bottom, waistW: P.hipW * 1.12, chestW: P.waistW * 1.08, shoulderW: P.waistW * 1.08, waistD: P.waistD * 1.05 + 0.012, chestD: P.waistD + 0.012,
    neckR: P.waistW * 0.82, lats: 0, pecs: 0, abs: 0, belly: P.belly * 0.6, traps: 0, chestFwd: 0,
  });
  g.translate(0, bottom, 0);
  return g;
}

// Tête : sphère déformée (mâchoire, menton, pommettes, arcades).
function headDeform(v, F, s) {
  // v : direction unitaire. Retourne position.
  const x = v.x, y = v.y, z = v.z;
  let sx = 0.08 * s, sy = 0.106 * s, sz = 0.098 * s;
  let px = x, py = y, pz = z;
  // Mâchoire : se resserre vers le bas selon la largeur choisie.
  const low = smoothstep(-0.05, -0.85, y);
  const jawW = 0.72 + F.jaw * 0.24;
  px *= 1 - (1 - jawW) * low;
  // Menton projeté.
  if (y < -0.45 && z > 0) pz += (0.08 + F.chin * 0.12) * smoothstep(-0.45, -0.8, y) * Math.pow(z, 2);
  // Visage plus plat.
  if (z > 0.55) pz = 0.55 + (pz - 0.55) * 0.62;
  // Arcades sourcilières.
  pz += (0.04 + F.brow * 0.06) * Math.exp(-Math.pow((y - 0.18) / 0.1, 2)) * Math.max(0, z - 0.5) * 2 * (1 - Math.pow(Math.abs(x) * 1.2, 4) * 0.5);
  // Pommettes.
  const cb = Math.exp(-Math.pow((y + 0.05) / 0.13, 2)) * Math.exp(-Math.pow((Math.abs(x) - 0.62) / 0.18, 2)) * Math.max(0, z);
  px += Math.sign(x) * cb * (0.04 + F.cheek * 0.06);
  // Orbites légèrement creusées.
  const orb = Math.exp(-Math.pow((y - 0.06) / 0.07, 2)) * Math.exp(-Math.pow((Math.abs(x) - 0.38) / 0.14, 2)) * Math.max(0, z - 0.5);
  pz -= orb * 0.12;
  // Sommet du crâne plus plat.
  if (y > 0.55) py = 0.55 + (py - 0.55) * 0.75;
  // Crâne arrière plus volumineux.
  if (z < 0 && y > -0.3) { pz *= 1.06; py *= 1.02; }
  // Nuque.
  if (y < -0.4 && z < 0) { pz *= 0.82; }
  return new V3(px * sx, py * sy, pz * sz);
}

function headGeometry(F, s, opts = {}) {
  const g = new THREE.SphereGeometry(1, opts.w || 56, opts.h || 40, opts.phiStart || 0, opts.phiLen || Math.PI * 2, opts.thetaStart || 0, opts.thetaLen || Math.PI);
  const p = g.attributes.position;
  const k = opts.k || 1;
  for (let i = 0; i < p.count; i++) {
    _v1.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    const out = headDeform(_v1, F, s);
    if (opts.bump) {
      const n = Math.sin(_v1.x * 23) * Math.sin(_v1.y * 19 + 1) * Math.sin(_v1.z * 21 + 2);
      out.multiplyScalar(k + n * opts.bump);
    } else out.multiplyScalar(k);
    if (opts.offset) out.add(opts.offset);
    p.setXYZ(i, out.x, out.y, out.z);
  }
  g.computeVertexNormals();
  return g;
}

// --------------------------------------------------------------------------- matériaux
function skinMat(app, map) {
  return new THREE.MeshPhysicalMaterial({ color: '#ffffff', map, roughness: 0.58, metalness: 0, clearcoat: 0.0, clearcoatRoughness: 0.4, sheen: 0.25, sheenColor: new THREE.Color(shade(app.skin, 0.2)), sheenRoughness: 0.6 });
}
function clothMat(color, map) {
  return new THREE.MeshPhysicalMaterial({ color: map ? '#ffffff' : color, map: map || null, roughness: 0.5, metalness: 0, sheen: 0.35, sheenColor: new THREE.Color(shade(color, 0.25)), sheenRoughness: 0.5 });
}
function leatherMat(color, map) {
  return new THREE.MeshPhysicalMaterial({ color: map ? '#ffffff' : color, map: map || null, roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.18 });
}

// --------------------------------------------------------------------------- modèle
export class BoxerModel {
  constructor(boxer, opts = {}) {
    this.boxer = boxer;
    this.opts = opts;
    this.kind = opts.kind || 'boxer'; // boxer | referee | coach
    this.root = new THREE.Group();
    this.root.name = 'boxer';
    this.s = boxer.stance === 'southpaw' ? -1 : 1;
    this.build();
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { if (m.map) m.map.dispose(); m.dispose(); } }
    });
  }

  rebuild(boxer) {
    if (boxer) this.boxer = boxer;
    this.s = this.boxer.stance === 'southpaw' ? -1 : 1;
    const parent = this.root.parent;
    const pos = this.root.position.clone(), rot = this.root.rotation.clone();
    this.root.clear();
    this.dispose();
    this.build();
    this.root.position.copy(pos); this.root.rotation.copy(rot);
    if (parent && !this.root.parent) parent.add(this.root);
  }

  dims() {
    const b = this.boxer, a = b.appearance;
    const H = a.height / 100;
    const s = H / 1.8;
    const mus = this.kind === 'boxer' ? visualMuscle(b) : 0.25;
    const rf = 0.94 + a.reach * 0.12;
    const bulk = 1 + mus * 0.22 + a.belly * 0.08;
    return {
      H, s, mus, rf, bulk,
      thigh: 0.245 * H, shin: 0.228 * H, ankle: 0.042 * H,
      hipY: (0.245 + 0.228 + 0.042) * H,
      hipX: 0.052 * H * (1 + a.legs * 0.15),
      pelvisH: 0.065 * H,
      torsoH: 0.255 * H,
      neck: 0.048 * H,
      upper: 0.168 * H * rf, fore: 0.15 * H * rf,
      shoulderX: (0.1 + a.shoulders * 0.022 + mus * 0.012) * H,
    };
  }

  build() {
    const b = this.boxer, a = b.appearance, out = b.outfits ? b.outfits[b.outfit || 0] : null;
    const D = this.D = this.dims();
    const { s, mus, bulk } = D;
    const F = a.face;
    this.materials = [];
    const skinPlain = makeSkinTexture(a, 'plain');
    const mSkin = skinMat(a, skinPlain);
    const mTorso = skinMat(a, makeSkinTexture(a, 'torso', { name: b.lastName }));
    const mkArm = (r) => ((a.tattoos || []).some((t) => t.zone === (r === 'arm_l' ? 'bras_g' : r === 'arm_r' ? 'bras_d' : r === 'forearm_l' ? 'avantbras_g' : 'avantbras_d')) ? skinMat(a, makeSkinTexture(a, r)) : mSkin);
    const mArmL = mkArm('arm_l'), mArmR = mkArm('arm_r'), mForeL = mkArm('forearm_l'), mForeR = mkArm('forearm_r');
    this.skinMats = [...new Set([mSkin, mTorso, mArmL, mArmR, mForeL, mForeR])];
    const isRef = this.kind === 'referee', isCoach = this.kind === 'coach';
    const shortsCol = out ? out.shorts : '#222';
    const mShorts = isRef || isCoach ? clothMat(isRef ? '#111' : '#2a2d35') : clothMat(shortsCol, shortsTexture(shortsCol, out ? out.shortsTrim : '#fff', b.nickname || b.lastName));
    const mShortsLeg = isRef || isCoach ? clothMat(isRef ? '#111' : '#2a2d35') : clothMat(shortsCol);
    const mShoes = leatherMat(out ? out.shoes : '#111');
    const mSock = clothMat(out ? out.socks || '#eee' : '#eee');
    const mShirt = isRef ? clothMat('#cfe0f2') : isCoach ? clothMat(b.shirt || '#1c1f26') : null;
    const mGlove = leatherMat(out ? out.gloves : '#b00', gloveTexture(out ? out.gloves : '#b00', out ? out.glovesAccent : '#fff'));
    const mGloveCuff = leatherMat(out ? out.glovesAccent : '#fff');
    const mWrap = clothMat(out ? out.wraps || '#eee' : '#eee');
    const mHair = new THREE.MeshStandardMaterial({ color: '#fff', map: hairTexture(a.hairColor, a.hair === 'tresses' ? 'braids' : a.hair === 'afro' || a.hair === 'boucles' ? 'curly' : 'hair'), roughness: 0.85 });
    const mBeard = new THREE.MeshStandardMaterial({ color: '#fff', map: hairTexture(a.beardColor || a.hairColor, 'curly'), roughness: 0.9 });
    const mStubble = new THREE.MeshStandardMaterial({ color: a.beardColor || a.hairColor, alphaMap: null, map: stubbleTexture(a.beardColor || a.hairColor), transparent: true, opacity: 0.85, roughness: 1, depthWrite: false });

    const sh = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

    // Hiérarchie.
    this.body = new THREE.Group(); this.root.add(this.body);
    this.hips = new THREE.Group(); this.hips.rotation.order = 'YXZ'; this.body.add(this.hips);
    this.hips.position.set(0, D.hipY, 0);
    this.spine = new THREE.Group(); this.spine.rotation.order = 'YXZ'; this.spine.position.set(0, D.pelvisH, 0); this.hips.add(this.spine);
    this.chest = new THREE.Group(); this.chest.rotation.order = 'YXZ'; this.chest.position.set(0, D.torsoH * 0.38, 0); this.spine.add(this.chest);

    // Tronc.
    const P = {
      torsoH: D.torsoH, waistW: (0.118 + a.belly * 0.03) * s * bulk * 0.95, chestW: (0.15 + a.chest * 0.018 + mus * 0.018) * s,
      shoulderW: (0.17 + a.shoulders * 0.03 + mus * 0.02) * s, waistD: (0.088 + a.belly * 0.045) * s, chestD: (0.1 + a.chest * 0.02 + mus * 0.014) * s,
      neckR: (0.052 + mus * 0.014) * s, lats: 0.4 + mus, pecs: (0.004 + mus * 0.016 + a.chest * 0.006) * s, abs: (Math.max(0, mus - a.belly * 1.2) * 0.008) * s,
      belly: a.belly * 0.05 * s, traps: (0.004 + mus * 0.014) * s, chestFwd: 0.005 * s, hipW: (0.13 + a.legs * 0.01) * s,
    };
    this.P = P;
    const torsoG = torsoGeometry(P);
    torsoG.translate(0, -D.torsoH * 0.38, 0);
    const torso = sh(new THREE.Mesh(torsoG, mShirt || mTorso));
    this.chest.add(torso);
    this.torsoMesh = torso;
    // Bassin (short) + taille.
    const pelvis = sh(new THREE.Mesh(pelvisGeometry(P, D.pelvisH + 0.03 * s, -0.06 * s), mShorts));
    this.hips.add(pelvis);
    if (isRef) {
      // Nœud papillon.
      const bow = new THREE.Mesh(new THREE.BoxGeometry(0.06 * s, 0.025 * s, 0.015 * s), new THREE.MeshStandardMaterial({ color: '#111' }));
      bow.position.set(0, D.torsoH * 0.6, P.chestD * 0.75); this.chest.add(bow);
    }

    // Cou & tête.
    this.neck = new THREE.Group(); this.neck.position.set(0, D.torsoH * 0.6, -0.008 * s); this.chest.add(this.neck);
    const neckG = limbGeometry(D.neck + 0.03 * s, [[0, P.neckR * 0.9], [0.5, P.neckR * 0.85], [1, P.neckR * 1.05]], 20, 0.95);
    neckG.rotateX(Math.PI); // vers +Y
    neckG.translate(0, -0.02 * s, 0);
    const neckM = sh(new THREE.Mesh(neckG, mSkin)); this.neck.add(neckM);
    this.head = new THREE.Group(); this.head.rotation.order = 'YXZ'; this.head.position.set(0, D.neck, 0.005 * s); this.neck.add(this.head);
    this.buildHead(F, s, a, mSkin, mHair, mBeard, mStubble, out);

    // Bras.
    this.arms = {};
    for (const side of ['L', 'R']) {
      const sx = side === 'L' ? 1 : -1;
      const shoulder = new THREE.Group();
      shoulder.position.set(sx * D.shoulderX, D.torsoH * 0.52, -0.01 * s);
      this.chest.add(shoulder);
      const upper = new THREE.Group(); shoulder.add(upper);
      const r = (v) => v * s * (1.12 + mus * 0.4);
      const upperG = limbGeometry(D.upper, [[0, r(0.052)], [0.12, r(0.06)], [0.3, r(0.05)], [0.5, r(0.046 + mus * 0.006)], [0.8, r(0.038)], [1, r(0.034)]], 22, 0.92);
      const upperM = sh(new THREE.Mesh(upperG, mShirt && isRef ? mShirt : side === 'L' ? mArmL : mArmR));
      upper.add(upperM);
      // Deltoïde.
      const delt = sh(new THREE.Mesh(new THREE.SphereGeometry(0.05 * s * (1 + mus * 0.3), 20, 14), side === 'L' ? mArmL : mArmR));
      delt.scale.set(1, 1.15, 1.05); delt.position.set(sx * 0.006 * s, -0.025 * s, 0); upper.add(delt);
      if (mShirt) { delt.material = mShirt; }
      const fore = new THREE.Group(); fore.position.set(0, -D.upper, 0); upper.add(fore);
      const foreG = limbGeometry(D.fore, [[0, r(0.036)], [0.22, r(0.042)], [0.6, r(0.034)], [1, r(0.027)]], 20, 0.85);
      const foreM = sh(new THREE.Mesh(foreG, side === 'L' ? mForeL : mForeR)); fore.add(foreM);
      const hand = new THREE.Group(); hand.position.set(0, -D.fore, 0); fore.add(hand);
      // Gant.
      const glove = new THREE.Group(); hand.add(glove);
      const gs = s * (1.0 + mus * 0.05);
      const fist = sh(new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), mGlove));
      fist.scale.set(0.056 * gs, 0.074 * gs, 0.062 * gs); fist.position.set(0, -0.07 * gs, 0.006 * gs);
      glove.add(fist);
      const thumb = sh(new THREE.Mesh(new THREE.CapsuleGeometry(0.019 * gs, 0.05 * gs, 6, 12), mGlove));
      thumb.position.set(-sx * 0.036 * gs, -0.055 * gs, 0.03 * gs); thumb.rotation.set(0.3, 0, sx * 0.35); glove.add(thumb);
      const cuff = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.043 * gs, 0.047 * gs, 0.075 * gs, 22), mGlove));
      cuff.position.set(0, 0.012 * gs, 0); glove.add(cuff);
      const band = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.0475 * gs, 0.0475 * gs, 0.022 * gs, 22), mGloveCuff));
      band.position.set(0, 0.03 * gs, 0); glove.add(band);
      // Main bandée (sans gants).
      const wrapHand = new THREE.Group(); hand.add(wrapHand);
      const wfist = sh(new THREE.Mesh(new THREE.BoxGeometry(0.05 * s, 0.07 * s, 0.035 * s, 2, 2, 2), isRef || isCoach ? mSkin : mWrap));
      wfist.geometry = new THREE.CapsuleGeometry(0.024 * s, 0.04 * s, 6, 12); wfist.scale.set(1, 1, 0.8);
      wfist.position.set(0, -0.045 * s, 0); wrapHand.add(wfist);
      wrapHand.visible = false;
      this.arms[side] = { shoulder, upper, fore, hand, glove, wrapHand, L1: D.upper, L2: D.fore };
    }

    // Jambes.
    this.legs = {};
    for (const side of ['L', 'R']) {
      const sx = side === 'L' ? 1 : -1;
      const hip = new THREE.Group(); hip.position.set(sx * D.hipX, 0, 0); this.hips.add(hip);
      const thigh = new THREE.Group(); hip.add(thigh);
      const r = (v) => v * s * (1 + mus * 0.25 + a.legs * 0.15);
      const thighG = limbGeometry(D.thigh, [[0, r(0.082)], [0.25, r(0.078)], [0.55, r(0.066)], [0.85, r(0.05)], [1, r(0.046)]], 22, 0.92);
      const thighM = sh(new THREE.Mesh(thighG, isRef || isCoach ? mShortsLeg : mSkin)); thigh.add(thighM);
      if (!isRef && !isCoach) {
        const sleeve = sh(new THREE.Mesh(limbGeometry(D.thigh * 0.42, [[0, r(0.092)], [0.7, r(0.088)], [1, r(0.086)]], 22, 0.95), mShortsLeg));
        sleeve.position.y = 0.01 * s; thigh.add(sleeve);
      }
      const shinG = new THREE.Group(); shinG.position.set(0, -D.thigh, 0); thigh.add(shinG);
      const shinM = sh(new THREE.Mesh(limbGeometry(D.shin, [[0, r(0.048)], [0.25, r(0.056)], [0.6, r(0.04)], [1, r(0.03)]], 20, 0.92), isRef || isCoach ? mShortsLeg : mSkin)); shinG.add(shinM);
      if (!isRef && !isCoach) {
        const sock = sh(new THREE.Mesh(limbGeometry(D.shin * 0.08, [[0, r(0.044)], [1, r(0.042)]], 20), mSock)); sock.position.y = -D.shin * 0.44; shinG.add(sock);
        const boot = sh(new THREE.Mesh(limbGeometry(D.shin * 0.53, [[0, r(0.045)], [0.6, r(0.037)], [1, r(0.036)]], 20), mShoes)); boot.position.y = -D.shin * 0.48; shinG.add(boot);
      }
      const foot = new THREE.Group(); foot.position.set(0, -D.shin, 0); shinG.add(foot);
      const footM = sh(new THREE.Mesh(new THREE.CapsuleGeometry(0.042 * s, 0.17 * s, 6, 14), mShoes));
      footM.rotation.x = Math.PI / 2; footM.scale.set(1.05, 1, 0.75); footM.position.set(0, -D.ankle * 0.55, 0.055 * s);
      foot.add(footM);
      this.legs[side] = { hip, thigh, shin: shinG, foot, L1: D.thigh, L2: D.shin };
    }

    // Peignoir (entrée).
    if (out && this.kind === 'boxer') {
      const robeMat = new THREE.MeshPhysicalMaterial({ color: out.robe, roughness: 0.3, sheen: 1, sheenColor: new THREE.Color(shade(out.robe, 0.5)), side: THREE.DoubleSide, clearcoat: 0.3 });
      const robeG = new THREE.LatheGeometry([0.6, 0.56, 0.5, 0.42, 0.33, 0.28, 0.25].map((r, i) => new THREE.Vector2(r * (P.shoulderW + 0.05 * s) / 0.6 * 1.25, -i * 0.12 * s * (D.H / 1.8) * 1.6)), 32);
      const robe = new THREE.Mesh(robeG, robeMat);
      robe.castShadow = true;
      robe.scale.set(1, -1, 0.75);
      robe.position.set(0, D.torsoH * 0.55 - (0.12 * 6 * s * 1.6) - 0.08 * s, 0);
      this.robe = new THREE.Group();
      this.robe.add(robe);
      const trimM = new THREE.MeshStandardMaterial({ color: out.robeTrim, roughness: 0.4 });
      const collar = new THREE.Mesh(new THREE.TorusGeometry(P.neckR * 1.8, 0.022 * s, 8, 24), trimM);
      collar.rotation.x = Math.PI / 2; collar.scale.set(1, 0.8, 1); collar.position.set(0, D.torsoH * 0.58, 0); this.robe.add(collar);
      const belt = new THREE.Mesh(new THREE.TorusGeometry(P.waistW * 1.25, 0.015 * s, 8, 24), trimM);
      belt.rotation.x = Math.PI / 2; belt.scale.set(1, 0.8, 1); belt.position.set(0, -D.torsoH * 0.32, 0); this.robe.add(belt);
      this.chest.add(this.robe);
      this.robe.visible = false;
    }

    // Casque amateur.
    if (out && this.kind === 'boxer') {
      const hg = new THREE.Mesh(headGeometry(F, s, { k: 1.12, thetaLen: Math.PI * 0.72, phiStart: Math.PI * 0.75, phiLen: Math.PI * 1.5 }), leatherMat(out.headgear || out.gloves));
      hg.position.copy(this.headMesh.position);
      hg.castShadow = true;
      this.headgear = hg; this.head.add(hg); hg.visible = false;
    }

    this.base = { hipY: D.hipY };
    this.setGloves(this.kind === 'boxer');
    this.sweat = 0;
  }

  buildHead(F, s, a, mSkin, mHair, mBeard, mStubble, out) {
    const head = this.head;
    this.face = new FaceTexture(a);
    const mFace = skinMat(a, this.face.texture);
    this.skinMats.push(mFace);
    const hy = 0.108 * s;
    const headM = new THREE.Mesh(headGeometry(F, s), mFace);
    headM.position.set(0, hy, 0.012 * s);
    headM.castShadow = true; headM.receiveShadow = true;
    head.add(headM);
    this.headMesh = headM;
    const fc = headM.position; // centre de la tête
    const hd = 0.096 * s;
    // Yeux.
    const mWhite = new THREE.MeshPhysicalMaterial({ color: '#f2efe8', roughness: 0.15, clearcoat: 1 });
    const mIris = new THREE.MeshPhysicalMaterial({ color: a.face.eyeColor, roughness: 0.1, clearcoat: 1 });
    const mPupil = new THREE.MeshBasicMaterial({ color: '#050505' });
    this.eyes = [];
    const eyeR = (0.0128 + F.eyes * 0.002) * s;
    for (const sx of [1, -1]) {
      const g = new THREE.Group();
      g.position.set(fc.x + sx * 0.032 * s, fc.y + 0.008 * s, fc.z + hd * 0.7);
      const w = new THREE.Mesh(new THREE.SphereGeometry(eyeR, 16, 12), mWhite); g.add(w);
      const ir = new THREE.Mesh(new THREE.CircleGeometry(eyeR * 0.55, 16), mIris); ir.position.z = eyeR * 0.97; g.add(ir);
      const pu = new THREE.Mesh(new THREE.CircleGeometry(eyeR * 0.25, 12), mPupil); pu.position.z = eyeR * 0.985; g.add(pu);
      // Paupières (supérieure / inférieure), animables.
      const lidU = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 1.12, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mSkin);
      lidU.rotation.x = -0.9; g.add(lidU);
      const lidD = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 1.1, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mSkin);
      lidD.rotation.x = 0.5; g.add(lidD);
      // Gonflement (œil au beurre noir).
      const swell = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 1.4, 14, 10), new THREE.MeshStandardMaterial({ color: shade(a.skin, -0.25), roughness: 0.4 }));
      swell.position.set(sx * eyeR * 0.3, eyeR * 0.6, eyeR * 0.1); swell.scale.set(1.2, 0.8, 0.8); swell.visible = false; g.add(swell);
      // Sourcil.
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.0045 * s, 0.022 * s, 4, 8), new THREE.MeshStandardMaterial({ color: a.hairColor, roughness: 0.9 }));
      brow.rotation.z = Math.PI / 2; brow.position.set(sx * 0.002 * s, eyeR * 1.55, eyeR * 0.6);
      g.add(brow);
      head.add(g);
      this.eyes.push({ g, lidU, lidD, brow, swell, sx });
    }
    // Nez.
    const ns = 0.8 + F.nose * 0.5, nw = 0.75 + F.noseWidth * 0.6;
    const noseG = new THREE.ConeGeometry(0.012 * s * nw, 0.042 * s * ns, 12, 3);
    noseG.rotateX(Math.PI * 0.5 - 0.35);
    const nose = new THREE.Mesh(noseG, mFace);
    nose.position.set(fc.x, fc.y - 0.022 * s, fc.z + hd * 0.78);
    nose.rotation.z = F.noseBroken * 0.2;
    head.add(nose);
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.014 * s * nw, 14, 10), mFace);
    nostril.scale.set(1.25, 0.7, 0.9); nostril.position.set(fc.x + F.noseBroken * 0.004, fc.y - 0.035 * s, fc.z + hd * 0.84 + 0.008 * s * ns);
    head.add(nostril);
    // Bouche.
    const mouth = new THREE.Group();
    mouth.position.set(fc.x, fc.y - 0.058 * s, fc.z + hd * 0.74);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.016 * s, 14, 8), new THREE.MeshBasicMaterial({ color: '#2a0c0c' }));
    inner.scale.set(1.3, 0.25, 0.5); mouth.add(inner);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.03 * s, 0.008 * s, 0.01 * s), new THREE.MeshStandardMaterial({ color: out ? out.mouthguard : '#eee', roughness: 0.3 }));
    guard.position.z = 0.002 * s; mouth.add(guard);
    const lipMat = new THREE.MeshStandardMaterial({ color: shade(a.skin, -0.18), roughness: 0.45 });
    const lipU = new THREE.Mesh(new THREE.CapsuleGeometry(0.0045 * s * (0.8 + F.lips * 0.5), 0.026 * s, 4, 10), lipMat);
    lipU.rotation.z = Math.PI / 2; lipU.position.set(0, 0.004 * s, 0.004 * s); mouth.add(lipU);
    const lipD = lipU.clone(); lipD.position.set(0, -0.004 * s, 0.004 * s); mouth.add(lipD);
    head.add(mouth);
    this.mouth = { g: mouth, inner, guard, lipU, lipD };
    // Oreilles.
    for (const sx of [1, -1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), mSkin);
      ear.scale.set(0.009 * s, 0.026 * s * (0.85 + F.ears * 0.3), 0.017 * s);
      ear.position.set(fc.x + sx * 0.076 * s, fc.y + 0.0, fc.z - 0.006 * s);
      ear.rotation.y = sx * 0.3;
      head.add(ear);
    }
    // Cheveux.
    const H = (opts) => { const m = new THREE.Mesh(headGeometry(F, s, opts), opts.mat || mHair); m.position.copy(fc); m.castShadow = true; head.add(m); return m; };
    const top = { thetaStart: 0, thetaLen: Math.PI * 0.42 };
    switch (a.hair) {
      case 'rase': H({ k: 1.012, thetaLen: Math.PI * 0.5, mat: mStubble }); break;
      case 'court': H({ k: 1.045, ...top, thetaLen: Math.PI * 0.46 }); break;
      case 'degrade': H({ k: 1.055, thetaLen: Math.PI * 0.3 }); H({ k: 1.012, thetaLen: Math.PI * 0.52, mat: mStubble }); break;
      case 'afro': H({ k: 1.32, thetaLen: Math.PI * 0.55, bump: 0.025, offset: new V3(0, 0.018 * s, -0.01 * s) }); break;
      case 'tresses': H({ k: 1.035, thetaLen: Math.PI * 0.5 }); break;
      case 'iroquoise': {
        H({ k: 1.01, thetaLen: Math.PI * 0.5, mat: mStubble });
        const mo = new THREE.Mesh(new THREE.BoxGeometry(0.022 * s, 0.035 * s, 0.17 * s), mHair);
        mo.position.set(fc.x, fc.y + 0.112 * s, fc.z - 0.01 * s); head.add(mo); break;
      }
      case 'boucles': H({ k: 1.12, thetaLen: Math.PI * 0.48, bump: 0.035 }); break;
      case 'queue': {
        H({ k: 1.04, thetaLen: Math.PI * 0.47 });
        const bun = new THREE.Mesh(new THREE.SphereGeometry(0.03 * s, 14, 10), mHair);
        bun.position.set(fc.x, fc.y + 0.08 * s, fc.z - 0.085 * s); head.add(bun); break;
      }
      default: break;
    }
    // Barbe.
    const lower = { thetaStart: Math.PI * 0.58, thetaLen: Math.PI * 0.4, phiStart: Math.PI * 0.05, phiLen: Math.PI * 0.9 };
    switch (a.beard) {
      case 'barbe3j': H({ k: 1.01, ...lower, mat: mStubble }); break;
      case 'pleine': H({ k: 1.06, ...lower, thetaStart: Math.PI * 0.55, thetaLen: Math.PI * 0.45, mat: mBeard, bump: 0.02 }); break;
      case 'bouc': H({ k: 1.04, thetaStart: Math.PI * 0.72, thetaLen: Math.PI * 0.26, phiStart: Math.PI * 0.35, phiLen: Math.PI * 0.3, mat: mBeard }); break;
      case 'collier': H({ k: 1.03, thetaStart: Math.PI * 0.68, thetaLen: Math.PI * 0.3, phiStart: Math.PI * 0.1, phiLen: Math.PI * 0.8, mat: mBeard }); break;
      default: break;
    }
    if (a.beard === 'moustache' || a.beard === 'pleine' || a.beard === 'bouc') {
      const mu = new THREE.Mesh(new THREE.CapsuleGeometry(0.006 * s, 0.03 * s, 4, 8), mBeard);
      mu.rotation.z = Math.PI / 2; mu.position.set(fc.x, fc.y - 0.045 * s, fc.z + hd * 0.8); head.add(mu);
    }
  }

  setGloves(on) {
    for (const side of ['L', 'R']) { this.arms[side].glove.visible = on; this.arms[side].wrapHand.visible = !on; }
    this.glovesOn = on;
  }
  setRobe(on) { if (this.robe) this.robe.visible = on; }
  setHeadgear(on) { if (this.headgear) this.headgear.visible = on; }

  // Transpiration : peau plus brillante et humide.
  setSweat(v) {
    v = clamp(v, 0, 1);
    if (Math.abs(v - this.sweat) < 0.01) return;
    this.sweat = v;
    for (const m of this.skinMats) { m.roughness = 0.58 - v * 0.38; m.clearcoat = v * 0.75; m.clearcoatRoughness = 0.35 - v * 0.2; }
  }

  // Dégâts visibles : ecchymoses, coupures, gonflements.
  setDamage(actor) {
    const z = actor.zones;
    this.face.set({
      bruiseL: clamp(z.tete / 260 + actor.swell.left * 0.5, 0, 1), bruiseR: clamp(z.tete / 260 + actor.swell.right * 0.5, 0, 1),
      jaw: clamp(z.machoire / 120, 0, 1), cutL: actor.cuts.left, cutR: actor.cuts.right, nose: clamp(z.tete / 300, 0, 1),
      swellL: actor.swell.left, swellR: actor.swell.right,
    });
    for (const e of this.eyes) {
      const sw = e.sx > 0 ? actor.swell.left : actor.swell.right;
      e.swell.visible = sw > 0.25;
      e.swell.scale.setScalar(0.6 + sw * 0.8);
      e.swellAmt = sw;
    }
  }

  // Expression : brow (-1..1 : colère), lids (0 fermé..1 ouvert), mouth (0..1), grimace.
  setExpression(ex) {
    for (const e of this.eyes) {
      const open = clamp((ex.lids ?? 1) * (1 - (e.swellAmt || 0) * 0.8), 0, 1);
      e.lidU.rotation.x = -0.25 - open * 0.95;
      e.lidD.rotation.x = 0.35 + open * 0.35;
      e.brow.rotation.z = Math.PI / 2 + e.sx * (ex.brow || 0) * 0.35;
      e.brow.position.y = (0.0115 + 0.006) * this.D.s * 1.45 + (ex.browUp || 0) * 0.004 * this.D.s - Math.max(0, ex.brow || 0) * 0.002 * this.D.s;
    }
    const m = this.mouth, mo = clamp(ex.mouth || 0, 0, 1);
    m.inner.scale.set(1.3 + (ex.grimace || 0) * 0.4, 0.25 + mo * 1.6, 0.5);
    m.lipU.position.y = 0.004 * this.D.s + mo * 0.006 * this.D.s;
    m.lipD.position.y = -0.004 * this.D.s - mo * 0.012 * this.D.s;
    m.guard.visible = mo > 0.25 && this.glovesOn;
  }

  // ------------------------------------------------------------------ IK
  solveLimb(parent, upper, fore, L1, L2, targetW, poleW) {
    parent.updateMatrixWorld(true);
    const S = upper.getWorldPosition(_v1);
    const t = _v2.copy(targetW).sub(S);
    let d = t.length();
    const maxD = (L1 + L2) * 0.999;
    d = clamp(d, Math.abs(L1 - L2) + 0.01, maxD);
    const tdir = t.normalize();
    const pole = _v3.copy(poleW).addScaledVector(tdir, -poleW.dot(tdir));
    if (pole.lengthSq() < 1e-8) pole.set(0, 0, 1).addScaledVector(tdir, -tdir.z);
    pole.normalize();
    const cosA = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
    const A = Math.acos(cosA);
    const upperDir = _v4.copy(tdir).multiplyScalar(Math.cos(A)).addScaledVector(pole, Math.sin(A)).normalize();
    const elbow = _v5.copy(upperDir).multiplyScalar(L1);
    const foreDir = tdir.clone().multiplyScalar(d).sub(elbow).normalize();
    // Base du segment supérieur.
    const y = upperDir.clone().negate();
    let x = new V3().crossVectors(upperDir, foreDir);
    if (x.lengthSq() < 1e-6) x.crossVectors(upperDir, pole);
    x.normalize();
    const z = new V3().crossVectors(x, y).normalize();
    _m.makeBasis(x, y, z);
    const qU = new THREE.Quaternion().setFromRotationMatrix(_m);
    const y2 = foreDir.clone().negate();
    const z2 = new V3().crossVectors(x, y2).normalize();
    _m.makeBasis(x, y2, z2);
    const qF = new THREE.Quaternion().setFromRotationMatrix(_m);
    parent.getWorldQuaternion(_q1);
    upper.quaternion.copy(_q1.invert().multiply(qU));
    fore.quaternion.copy(qU.clone().invert().multiply(qF));
  }

  // Applique une pose complète (voir animator.js pour la structure).
  applyPose(p) {
    const D = this.D;
    this.body.position.set(0, p.tilt.y, p.tilt.z);
    this.body.rotation.set(p.tilt.pitch, p.tilt.yaw || 0, p.tilt.roll);
    this.hips.position.set(p.hips.x, D.hipY + p.hips.y, p.hips.z);
    this.hips.rotation.set(p.hips.pitch, p.hips.yaw, p.hips.roll);
    this.spine.rotation.set(p.spine.pitch, p.spine.yaw, p.spine.roll);
    this.chest.rotation.set(p.chest.pitch, p.chest.yaw, p.chest.roll);
    this.head.rotation.set(p.head.pitch, p.head.yaw, p.head.roll);
    if (p.breath) { this.chest.scale.set(1 + p.breath * 0.012, 1, 1 + p.breath * 0.025); }
    this.root.updateMatrixWorld(true);
    const bw = this.body.matrixWorld;
    // Bras.
    for (const side of ['L', 'R']) {
      const A = this.arms[side];
      const tgt = (side === 'L' ? p.handL : p.handR).clone().applyMatrix4(bw);
      const pole = (side === 'L' ? p.poleL : p.poleR).clone().transformDirection(bw);
      this.solveLimb(A.shoulder, A.upper, A.fore, A.L1, A.L2, tgt, pole);
      A.hand.rotation.set(0, side === 'L' ? p.twistL : p.twistR, 0);
    }
    // Jambes.
    _q2.setFromRotationMatrix(_m.extractRotation(bw));
    for (const side of ['L', 'R']) {
      const Lg = this.legs[side];
      const ft = (side === 'L' ? p.footL : p.footR);
      const tgt = _v1.set(ft.x, ft.y + D.ankle, ft.z).applyMatrix4(bw).clone();
      const yaw = side === 'L' ? p.footYawL : p.footYawR;
      const pole = new V3(Math.sin(yaw) + (side === 'L' ? 0.25 : -0.25), 0.15, Math.cos(yaw)).transformDirection(bw);
      this.solveLimb(Lg.hip, Lg.thigh, Lg.shin, Lg.L1, Lg.L2, tgt, pole);
      // Pied à plat.
      Lg.shin.updateMatrixWorld(true);
      Lg.shin.getWorldQuaternion(_q1);
      const want = _q2.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(p.footPitch || 0, yaw, 0)));
      Lg.foot.quaternion.copy(_q1.invert().multiply(want));
    }
    if (p.expr) this.setExpression(p.expr);
  }

  // Positions utiles (espace monde).
  headWorld(out = new V3()) { return this.headMesh.getWorldPosition(out); }
  chestWorld(out = new V3()) { return this.chest.getWorldPosition(out); }
  gloveWorld(side, out = new V3()) { return this.arms[side].hand.getWorldPosition(out); }

  // Capture/restauration de pose (ralentis).
  snapshot() {
    const bones = [this.body, this.hips, this.spine, this.chest, this.head];
    for (const s of ['L', 'R']) bones.push(this.arms[s].upper, this.arms[s].fore, this.arms[s].hand, this.legs[s].thigh, this.legs[s].shin, this.legs[s].foot);
    const arr = new Float32Array(bones.length * 7 + 7);
    let k = 0;
    const put = (o) => { arr[k++] = o.position.x; arr[k++] = o.position.y; arr[k++] = o.position.z; arr[k++] = o.quaternion.x; arr[k++] = o.quaternion.y; arr[k++] = o.quaternion.z; arr[k++] = o.quaternion.w; };
    put(this.root);
    for (const b of bones) put(b);
    this._bones = bones;
    return arr;
  }
  restore(arr) {
    if (!this._bones) this.snapshot();
    let k = 0;
    const get = (o) => { o.position.set(arr[k], arr[k + 1], arr[k + 2]); o.quaternion.set(arr[k + 3], arr[k + 4], arr[k + 5], arr[k + 6]); k += 7; };
    get(this.root);
    for (const b of this._bones) get(b);
  }
}
