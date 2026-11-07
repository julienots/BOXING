// Ring, salles et arènes : du petit club au stade, public animé, éclairage cinématographique.
import * as THREE from 'three';
import { ringCanvasTexture, apronTexture, floorTexture, wallTexture, textPanel, posterTexture } from './textures.js';

const RING = 3.0;       // demi-côté intérieur (cordes)
const APRON = 3.6;      // demi-côté plateforme
const PLATFORM_H = 1.0; // hauteur de la plateforme (le tapis est à y=0)

export const VENUE_STYLE = {
  club:     { crowd: 60,   rows: 2, radius: 6.5,  floor: 'concrete', wall: 'brick', ring: '#3b4a5a', rope: ['#c8c8c8'], light: 0.9, haze: 0.035, color: '#fff2d8', bg: '#14100c', tiers: false },
  amateur:  { crowd: 140,  rows: 3, radius: 7,    floor: 'wood',     wall: 'gym',   ring: '#1d4f91', rope: ['#d32f2f', '#f5f5f5', '#1d4f91'], light: 1.0, haze: 0.03, color: '#f4f6ff', bg: '#1a1d22', tiers: false },
  regional: { crowd: 450,  rows: 6, radius: 8,    floor: 'dark',     wall: null,    ring: '#2b2f6b', rope: ['#d32f2f', '#f5f5f5', '#d32f2f'], light: 1.15, haze: 0.025, color: '#fff', bg: '#07080c', tiers: true },
  arena:    { crowd: 1100, rows: 10, radius: 9,   floor: 'dark',     wall: null,    ring: '#8a1020', rope: ['#f5f5f5', '#f5c542', '#f5f5f5'], light: 1.3, haze: 0.022, color: '#fff', bg: '#040406', tiers: true, screens: true },
  intl:     { crowd: 1700, rows: 13, radius: 9.5, floor: 'dark',     wall: null,    ring: '#0d2a5c', rope: ['#d32f2f', '#f5f5f5', '#1d4f91'], light: 1.4, haze: 0.02, color: '#f0f4ff', bg: '#020306', tiers: true, screens: true, beams: true },
  stadium:  { crowd: 2600, rows: 16, radius: 14,  floor: 'grass',    wall: null,    ring: '#111111', rope: ['#f5c542'], light: 1.6, haze: 0.012, color: '#fff', bg: '#05070f', tiers: true, screens: true, beams: true, open: true },
  world:    { crowd: 2000, rows: 14, radius: 10,  floor: 'dark',     wall: null,    ring: '#1b1b1b', rope: ['#f5c542', '#111', '#f5c542'], light: 1.5, haze: 0.02, color: '#fff8e8', bg: '#020202', tiers: true, screens: true, beams: true, belts: true },
  historic: { crowd: 900,  rows: 9, radius: 8.5,  floor: 'wood',     wall: 'brick', ring: '#cfc6b0', rope: ['#e8e2d0'], light: 1.1, haze: 0.05, color: '#ffe9c0', bg: '#0b0906', tiers: true, sepia: true },
};

function mat(c, o = {}) { return new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o }); }

export function buildRing(style, opts = {}) {
  const g = new THREE.Group();
  // Plateforme et tapis.
  const canvasTex = ringCanvasTexture(style.ring, opts.logo || 'BOXING LEGEND', opts.sub || '');
  const top = new THREE.Mesh(new THREE.BoxGeometry(APRON * 2, 0.08, APRON * 2), [
    mat('#222'), mat('#222'), new THREE.MeshStandardMaterial({ map: canvasTex, roughness: 0.85 }), mat('#222'), mat('#222'), mat('#222'),
  ]);
  top.position.y = -0.04; top.receiveShadow = true; g.add(top);
  const skirtTex = apronTexture(opts.apron || 'BOXING LEGEND', '#0b0b0d');
  skirtTex.repeat.set(1, 1);
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(APRON * 2 + 0.02, PLATFORM_H, APRON * 2 + 0.02), new THREE.MeshStandardMaterial({ map: skirtTex, roughness: 0.8 }));
  skirt.position.y = -0.08 - PLATFORM_H / 2; g.add(skirt);
  // Poteaux & coussins.
  const postM = mat('#d9d9d9', { metalness: 0.7, roughness: 0.3 });
  const padCols = ['#c62828', '#f2f2f2', '#1565c0', '#f2f2f2']; // rouge, neutre, bleu, neutre
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const pc = RING + 0.15;
  corners.forEach(([x, z], i) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 12), postM);
    post.position.set(x * pc, 0.8, z * pc); post.castShadow = true; g.add(post);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.3, 0.2), mat(padCols[i], { roughness: 0.35 }));
    pad.position.set(x * (pc - 0.08), 0.85, z * (pc - 0.08)); pad.rotation.y = Math.PI / 4; pad.castShadow = true; g.add(pad);
  });
  // Cordes (4 rangs).
  const heights = [0.45, 0.8, 1.15, 1.5];
  const ropeCols = style.rope;
  heights.forEach((h, ri) => {
    const col = ropeCols[ri % ropeCols.length];
    const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.35 });
    for (let s = 0; s < 4; s++) {
      const a = corners[s], b = corners[(s + 1) % 4];
      const p0 = new THREE.Vector3(a[0] * pc, h, a[1] * pc), p1 = new THREE.Vector3(b[0] * pc, h, b[1] * pc);
      const mid = p0.clone().lerp(p1, 0.5); mid.y -= 0.035;
      const curve = new THREE.QuadraticBezierCurve3(p0, mid, p1);
      const rope = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.028, 8, false), m);
      rope.castShadow = true; g.add(rope);
    }
  });
  // Tabourets & seaux (visibles entre les rounds).
  const stools = new THREE.Group();
  for (const [x, z] of [[-1, -1], [1, 1]]) {
    const st = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16), mat('#333'));
    seat.position.y = 0.6; st.add(seat);
    for (let k = 0; k < 3; k++) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 6), mat('#999', { metalness: 0.8 })); const a = k / 3 * Math.PI * 2; leg.position.set(Math.cos(a) * 0.14, 0.3, Math.sin(a) * 0.14); st.add(leg); }
    st.position.set(x * (RING - 0.35), 0, z * (RING - 0.35));
    stools.add(st);
  }
  stools.visible = false;
  g.add(stools);
  g.userData.stools = stools;
  return g;
}

// Public instancié : balancement par shader (léger, compatible mobile).
function buildCrowd(style, count, uniforms) {
  const body = new THREE.CapsuleGeometry(0.2, 0.45, 3, 8);
  body.translate(0, 0.45, 0);
  const merged = body;
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) phase[i] = Math.random() * 100;
  merged.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  const m = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime; sh.uniforms.uExcite = uniforms.uExcite;
    sh.vertexShader = 'uniform float uTime; uniform float uExcite; attribute float aPhase;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float bob = sin(uTime * (3.0 + fract(aPhase) * 4.0) + aPhase) * 0.5 + 0.5;
      transformed.y += bob * (0.03 + uExcite * 0.22) * step(0.2, position.y);
      transformed.x += sin(uTime * 1.3 + aPhase * 3.0) * 0.03 * step(0.6, position.y);`);
  };
  const mesh = new THREE.InstancedMesh(merged, m, count);
  const dummy = new THREE.Object3D();
  const palette = ['#2b2b2b', '#5a2a2a', '#22324a', '#3e3e3e', '#6b5b3e', '#1f3d2b', '#7a7a7a', '#8a2a2a', '#2c2c54', '#d8d8d8', '#b38b59'];
  const skins = ['#f3d2b8', '#d9a27a', '#a86e48', '#6b3f26', '#c68a5f'];
  const color = new THREE.Color();
  let i = 0;
  const R = style.radius;
  const rows = style.rows;
  const perRow = Math.ceil(count / rows);
  for (let r = 0; r < rows && i < count; r++) {
    const dist = R + r * 0.9;
    const y = style.tiers ? -PLATFORM_H - 0.1 + r * 0.55 : -PLATFORM_H - 0.08;
    const side = dist * 2;
    const n = Math.min(perRow, count - i);
    for (let k = 0; k < n; k++) {
      // Répartition sur le périmètre d'un carré arrondi.
      const t = k / n;
      const per = t * 4;
      const sideIdx = Math.floor(per), f = per - sideIdx;
      let x, z;
      if (sideIdx === 0) { x = -dist + f * side; z = -dist; }
      else if (sideIdx === 1) { x = dist; z = -dist + f * side; }
      else if (sideIdx === 2) { x = dist - f * side; z = dist; }
      else { x = -dist; z = dist - f * side; }
      x += (Math.random() - 0.5) * 0.3; z += (Math.random() - 0.5) * 0.3;
      dummy.position.set(x, y, z);
      dummy.rotation.y = Math.atan2(-x, -z);
      const sc = 0.92 + Math.random() * 0.16;
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.set(palette[Math.floor(Math.random() * palette.length)]);
      mesh.setColorAt(i, color);
      i++;
    }
  }
  mesh.count = i;
  mesh.instanceMatrix.needsUpdate = true;
  // Têtes de couleur peau : second passage sur un mesh de têtes.
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.125, 10, 8).translate(0, 0.98, 0), m.clone(), i);
  heads.material.onBeforeCompile = m.onBeforeCompile;
  heads.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  for (let k = 0; k < i; k++) { mesh.getMatrixAt(k, dummy.matrix); heads.setMatrixAt(k, dummy.matrix); color.set(skins[Math.floor(Math.random() * skins.length)]); heads.setColorAt(k, color); }
  const grp = new THREE.Group(); grp.add(mesh, heads);
  return grp;
}

function mergeGeos(geos) {
  // Fusion simple (positions, normales, uv, index).
  let vCount = 0, iCount = 0;
  for (const g of geos) { vCount += g.attributes.position.count; iCount += g.index.count; }
  const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3), uv = new Float32Array(vCount * 2);
  const idx = new Uint32Array(iCount);
  let vo = 0, io = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, vo * 3); nor.set(g.attributes.normal.array, vo * 3); uv.set(g.attributes.uv.array, vo * 2);
    for (let k = 0; k < g.index.count; k++) idx[io + k] = g.index.array[k] + vo;
    vo += g.attributes.position.count; io += g.index.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

export class Arena {
  constructor(venueId, opts = {}) {
    this.venueId = venueId;
    this.style = VENUE_STYLE[venueId] || VENUE_STYLE.club;
    this.scene = new THREE.Scene();
    this.uniforms = { uTime: { value: 0 }, uExcite: { value: 0.2 } };
    this.flashes = [];
    this.build(opts);
  }

  build(opts) {
    const st = this.style, sc = this.scene;
    sc.background = new THREE.Color(st.bg);
    sc.fog = new THREE.FogExp2(st.bg, st.haze);
    this.ring = buildRing(st, opts);
    sc.add(this.ring);
    // Sol de la salle.
    const fk = st.floor === 'grass' ? 'dark' : st.floor;
    const ft = floorTexture(fk);
    ft.repeat.set(12, 12);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: ft, color: st.floor === 'grass' ? '#1e3a1e' : '#ffffff', roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -PLATFORM_H - 0.08; floor.receiveShadow = true;
    sc.add(floor);
    // Murs (petites salles).
    if (st.wall) {
      const wt = wallTexture(st.wall === 'gym' ? 'gym' : 'brick');
      wt.repeat.set(6, 1.2);
      const R = st.radius + st.rows * 0.9 + 1.5;
      for (let k = 0; k < 4; k++) {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(R * 2, 7), new THREE.MeshStandardMaterial({ map: wt, roughness: 0.95 }));
        const a = k * Math.PI / 2;
        w.position.set(Math.sin(a) * R, 2.4, Math.cos(a) * R);
        w.rotation.y = a + Math.PI;
        sc.add(w);
        // Affiches.
        for (let p = -1; p <= 1; p += 2) {
          const poster = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.5), new THREE.MeshStandardMaterial({ map: posterTexture('BOXE', 'GRAND GALA', ['#b3121b', '#0f3d91', '#111'][k % 3]), roughness: 0.9 }));
          poster.position.copy(w.position).multiplyScalar(0.985); poster.position.y = 2.2;
          poster.position.x += Math.cos(a) * p * 3; poster.position.z -= Math.sin(a) * p * 3;
          poster.rotation.y = a + Math.PI;
          sc.add(poster);
        }
      }
    }
    // Public.
    this.crowd = buildCrowd(st, opts.crowd || st.crowd, this.uniforms);
    sc.add(this.crowd);
    // Tribunes (gradins).
    if (st.tiers) {
      const tm = mat('#15161a', { roughness: 0.95 });
      for (let r = 0; r < st.rows; r += 2) {
        const dist = st.radius + r * 0.9 + 0.4;
        const y = -PLATFORM_H - 0.1 + r * 0.55 - 0.3;
        for (let k = 0; k < 4; k++) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(dist * 2 + 2, 0.6, 1.8), tm);
          const a = k * Math.PI / 2;
          b.position.set(Math.sin(a) * (dist + 0.5), y, Math.cos(a) * (dist + 0.5));
          b.rotation.y = a;
          sc.add(b);
        }
      }
    }
    // Table des juges & presse.
    const table = new THREE.Mesh(new THREE.BoxGeometry(5, 0.75, 0.7), mat('#0e0e10'));
    table.position.set(0, -PLATFORM_H - 0.08 + 0.375, -(APRON + 1.2)); sc.add(table);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.7), new THREE.MeshStandardMaterial({ map: apronTexture('JUGES — OFFICIELS', '#121212') }));
    cloth.position.set(0, -PLATFORM_H + 0.0, -(APRON + 0.84)); sc.add(cloth);

    // Éclairage.
    const amb = new THREE.HemisphereLight('#9aa4b8', '#1a1410', 0.35 * st.light);
    sc.add(amb);
    const key = new THREE.SpotLight(st.color, 220 * st.light, 30, Math.PI / 5.2, 0.45, 1.6);
    key.position.set(0, 9, 0); key.target.position.set(0, 0, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(opts.shadowSize || 2048, opts.shadowSize || 2048);
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
    key.shadow.camera.near = 3; key.shadow.camera.far = 14;
    sc.add(key, key.target);
    this.key = key;
    // Lumières d'appoint (sans ombres) aux 4 coins de la structure.
    const fill = new THREE.DirectionalLight(st.color, 0.9 * st.light);
    fill.position.set(3, 8, 6);
    sc.add(fill);
    // Contre-jour coloré (ambiance TV).
    const rim1 = new THREE.PointLight(st.sepia ? '#ffcc88' : '#4060ff', 12 * st.light, 18); rim1.position.set(-6, 4, 6); sc.add(rim1);
    const rim2 = new THREE.PointLight(st.sepia ? '#ffbb77' : '#ff3050', 12 * st.light, 18); rim2.position.set(6, 4, -6); sc.add(rim2);
    // Structure lumineuse au-dessus du ring (truss) + lampes émissives.
    const truss = new THREE.Group();
    const tm = mat('#222', { metalness: 0.8, roughness: 0.4 });
    for (let k = 0; k < 4; k++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(7, 0.18, 0.18), tm);
      const a = k * Math.PI / 2;
      bar.position.set(Math.sin(a) * 3.5, 7.2, Math.cos(a) * 3.5); bar.rotation.y = a + Math.PI / 2;
      truss.add(bar);
      for (let j = -2; j <= 2; j++) {
        const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.25, 12), new THREE.MeshStandardMaterial({ color: '#111', emissive: st.color, emissiveIntensity: 3 }));
        lamp.position.copy(bar.position); lamp.position.y -= 0.2;
        lamp.position.x += Math.cos(a) * j * 1.2; lamp.position.z -= Math.sin(a) * j * 1.2;
        truss.add(lamp);
      }
    }
    sc.add(truss);
    // Faisceaux volumétriques (factices).
    if (st.beams) {
      const beamM = new THREE.MeshBasicMaterial({ color: st.color, transparent: true, opacity: 0.045, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      for (let k = 0; k < 8; k++) {
        const beam = new THREE.Mesh(new THREE.ConeGeometry(1.4, 7.5, 24, 1, true), beamM);
        const a = k / 8 * Math.PI * 2;
        beam.position.set(Math.cos(a) * 2.2, 3.5, Math.sin(a) * 2.2);
        beam.rotation.z = Math.cos(a) * 0.12; beam.rotation.x = -Math.sin(a) * 0.12;
        sc.add(beam);
      }
    }
    // Écrans géants.
    if (st.screens) {
      this.screenTex = textPanel([{ text: opts.title || 'BOXING LEGEND', size: 80, color: '#f5c542' }, { text: opts.subtitle || '', size: 56 }, { text: '', size: 48 }]);
      const scr = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 0.2), [mat('#111'), mat('#111'), mat('#111'), mat('#111'), new THREE.MeshBasicMaterial({ map: this.screenTex }), new THREE.MeshBasicMaterial({ map: this.screenTex })]);
      scr.position.set(0, 9.3, 0);
      const scr2 = scr.clone(); scr2.rotation.y = Math.PI / 2;
      sc.add(scr, scr2);
      // Murs d'écrans latéraux pour les grandes salles.
      const R = st.radius + st.rows * 0.9 + 2;
      for (let k = 0; k < 2; k++) {
        const big = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), new THREE.MeshBasicMaterial({ map: this.screenTex }));
        big.position.set(0, st.rows * 0.55 + 3, (k ? 1 : -1) * R);
        big.rotation.y = k ? Math.PI : 0;
        sc.add(big);
      }
    }
    // Stade : tours d'éclairage.
    if (st.open) {
      for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const tower = new THREE.Mesh(new THREE.BoxGeometry(0.6, 22, 0.6), mat('#333'));
        tower.position.set(x * 30, 8, z * 30); sc.add(tower);
        const panel = new THREE.Mesh(new THREE.BoxGeometry(4, 2.5, 0.4), new THREE.MeshStandardMaterial({ color: '#222', emissive: '#ffffff', emissiveIntensity: 4 }));
        panel.position.set(x * 29, 19, z * 29); panel.lookAt(0, 0, 0); sc.add(panel);
      }
      // Ciel étoilé.
      const sg = new THREE.BufferGeometry(); const sp = [];
      for (let i = 0; i < 1200; i++) { const a = Math.random() * Math.PI * 2, e = Math.random() * 0.6 + 0.15; sp.push(Math.cos(a) * Math.cos(e) * 70, Math.sin(e) * 70, Math.sin(a) * Math.cos(e) * 70); }
      sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
      sc.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 0.15, fog: false })));
    }
    // Ceintures exposées.
    if (st.belts) {
      const beltM = new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 1, roughness: 0.25, emissive: '#3a2a00' });
      for (let k = 0; k < 4; k++) {
        const belt = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.05, 8, 24), beltM);
        belt.position.set(-1.5 + k, -PLATFORM_H + 0.5, -(APRON + 1.2)); belt.rotation.x = Math.PI / 2.3;
        sc.add(belt);
      }
    }
    // Flashs photo.
    const flashGeo = new THREE.SphereGeometry(0.06, 6, 4);
    for (let i = 0; i < 18; i++) {
      const f = new THREE.Mesh(flashGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0 }));
      const a = Math.random() * Math.PI * 2, r = st.radius + Math.random() * st.rows * 0.9;
      f.position.set(Math.cos(a) * r, -PLATFORM_H + 0.5 + Math.random() * st.rows * 0.5, Math.sin(a) * r);
      f.userData.t = Math.random() * 5;
      sc.add(f); this.flashes.push(f);
    }
  }

  setScreen(lines) { if (this.screenTex) this.screenTex.redraw(lines); }
  showStools(v) { this.ring.userData.stools.visible = v; }

  update(dt, excite = 0.2) {
    this.uniforms.uTime.value += dt;
    const u = this.uniforms.uExcite;
    u.value += (excite - u.value) * Math.min(1, dt * 2);
    for (const f of this.flashes) {
      f.userData.t -= dt * (0.5 + u.value * 3);
      if (f.userData.t <= 0) { f.userData.t = 1 + Math.random() * 5; f.material.opacity = 1; }
      f.material.opacity = Math.max(0, f.material.opacity - dt * 8);
    }
  }
}

export const RING_HALF = RING;
export const PLATFORM = PLATFORM_H;
