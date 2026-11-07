// Scène de combat : arène, boxeurs, arbitre, particules, caméra plongeante 2.5D, ralentis.
// Caméra principale : vue de dessus légèrement de côté (angle fixe, style retransmission),
// pour une lecture claire du combat sans caméra 3D libre.
import * as THREE from 'three';
import { Arena } from './arena.js';
import { BoxerModel } from './boxerModel.js';
import { Animator } from './animator.js';
import { createBoxer, defaultAppearance } from '../core/boxer.js';
import { PUNCHES } from '../fight/punches.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const CAMERA_MODES = {
  top: { name: 'Plongée de côté', height: 5.3, back: 4.3, side: 1.1, fov: 36 },
  high: { name: 'Vue du dessus', height: 7.5, back: 2.2, side: 0.3, fov: 38 },
  low: { name: 'Plongée rapprochée', height: 3.8, back: 3.6, side: 1.4, fov: 36 },
};

export class FightView {
  constructor(engine, opts = {}) {
    this.engine = engine;
    this.opts = opts;
    this.arena = new Arena(opts.venue || 'club', { title: opts.title, subtitle: opts.subtitle, crowd: opts.crowd });
    this.scene = this.arena.scene;
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    this.camMode = opts.camMode || 'top';
    this.models = [new BoxerModel(engine.a.boxer), new BoxerModel(engine.b.boxer)];
    this.anims = this.models.map((m) => new Animator(m));
    for (const m of this.models) { this.scene.add(m.root); m.setHeadgear(!!opts.headgear); }
    // Arbitre.
    const refB = createBoxer({ firstName: 'Arbitre', lastName: 'Officiel', appearance: { ...defaultAppearance(), skin: '#d9a27a', height: 180, muscle: 0.1, belly: 0.4, hair: 'court', hairColor: '#444', beard: 'aucune' } });
    this.ref = new BoxerModel(refB, { kind: 'referee' });
    this.ref.setGloves(false);
    this.refAnim = new Animator(this.ref);
    this.scene.add(this.ref.root);
    this.refPos = new THREE.Vector3(0, 0, -1.2);
    // Particules (sueur / sang).
    this.particles = [];
    const pg = new THREE.SphereGeometry(0.012, 4, 3);
    this.pMatSweat = new THREE.MeshBasicMaterial({ color: '#d8eefc', transparent: true, opacity: 0.8 });
    this.pMatBlood = new THREE.MeshBasicMaterial({ color: '#8a0b10', transparent: true, opacity: 0.9 });
    for (let i = 0; i < 90; i++) { const p = new THREE.Mesh(pg, this.pMatSweat); p.visible = false; this.scene.add(p); this.particles.push({ mesh: p, v: new THREE.Vector3(), life: 0 }); }
    this.shake = 0;
    this.camPos = new THREE.Vector3(0, 7, 6);
    this.camLook = new THREE.Vector3();
    this.mode = 'fight'; // intro | fight | corner | replay | end
    this.replayBuf = [];
    this.replay = null;
    this.excite = 0.25;
    this.t = 0;
    engine.on((ev) => this.onEvent(ev));
    this.syncModels(0, true);
  }

  onEvent(ev) {
    if (ev.type === 'hit') {
      const vi = ev.who;
      const P = PUNCHES[ev.punch];
      const att = this.engine.actors[ev.by];
      const dir = P.kind === 'hook' ? (P.hand === 'lead' ? 1 : -1) * (att.stance === 'southpaw' ? -1 : 1) : 0;
      this.anims[vi].impulse(ev.zone, P.kind, dir, ev.blocked ? ev.dmg * 0.3 : ev.dmg);
      if (!ev.blocked && ev.dmg > 5) {
        const head = ev.zone === 'tete' || ev.zone === 'machoire';
        const pos = head ? this.models[vi].headWorld(new THREE.Vector3()) : this.models[vi].chestWorld(new THREE.Vector3());
        const n = Math.min(24, Math.round(ev.dmg * 1.4));
        const away = new THREE.Vector3().subVectors(pos, this.models[ev.by].root.position).setY(0).normalize();
        const actor = this.engine.actors[vi];
        this.spray(pos, away, n, Math.max(actor.cuts.left, actor.cuts.right) > 0.3 && head);
        this.shake = Math.min(0.25, this.shake + ev.dmg * 0.012);
      }
      this.excite = clamp(this.excite + ev.dmg * 0.02, 0, 1);
    }
    if (ev.type === 'knockdown') { this.excite = 1; this.shake = 0.35; }
    if (ev.type === 'stun') this.excite = clamp(this.excite + 0.3, 0, 1);
  }

  spray(pos, dir, n, blood) {
    let k = 0;
    for (const p of this.particles) {
      if (p.life > 0) continue;
      p.mesh.visible = true; p.mesh.position.copy(pos);
      p.mesh.material = blood && Math.random() < 0.5 ? this.pMatBlood : this.pMatSweat;
      p.v.copy(dir).multiplyScalar(1.5 + Math.random() * 2.5).add(new THREE.Vector3((Math.random() - 0.5) * 1.6, Math.random() * 1.8, (Math.random() - 0.5) * 1.6));
      p.life = 0.5 + Math.random() * 0.5;
      if (++k >= n) break;
    }
  }

  // Position/orientation des modèles depuis le moteur.
  syncModels(dt, snap = false) {
    const E = this.engine;
    E.actors.forEach((act, i) => {
      const m = this.models[i];
      const yaw = Math.PI / 2 - act.face;
      if (snap) { m.root.position.set(act.x, 0, act.z); m.root.rotation.y = yaw; }
      else {
        m.root.position.x += (act.x - m.root.position.x) * Math.min(1, dt * 20);
        m.root.position.z += (act.z - m.root.position.z) * Math.min(1, dt * 20);
        let d = yaw - m.root.rotation.y;
        while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        m.root.rotation.y += d * Math.min(1, dt * 15);
      }
    });
  }

  // Place les boxeurs dans leur coin (présentation / repos).
  placeCorners() {
    const c = 3.0 - 0.38;
    const pos = [[-c, -c], [c, c]];
    this.models.forEach((m, i) => { m.root.position.set(pos[i][0], 0, pos[i][1]); m.root.rotation.y = Math.atan2(-pos[i][0], -pos[i][1]) + Math.PI; });
  }

  update(dt) {
    this.t += dt;
    const E = this.engine;
    this.arena.update(dt, this.excite);
    this.excite = Math.max(0.2, this.excite - dt * 0.08);
    if (this.mode === 'replay' && this.replay) { this.updateReplay(dt); return; }
    if (this.mode === 'intro') {
      this.placeCorners();
      this.models.forEach((m, i) => { m.setRobe(true); this.anims[i].updateIdle(dt, { energy: 1, relaxed: false }); });
      this.updateRef(dt, true);
    } else if (this.mode === 'corner') {
      this.placeCorners();
      this.arena.showStools(true);
      this.models.forEach((m, i) => this.anims[i].updateCorner(dt, 1 - E.actors[i].stamina / E.actors[i].staminaMax));
      this.updateRef(dt, true);
    } else if (this.mode === 'end') {
      this.arena.showStools(false);
      const w = E.result ? E.result.winner : null;
      this.models.forEach((m, i) => {
        if (E.actors[i].state === 'out' || (E.actors[i].state === 'down')) this.anims[i].updateFight(dt, E.actors[i], this.models[1 - i], E);
        else if (w === i) this.anims[i].updateVictory(dt);
        else this.anims[i].updateDejected(dt);
      });
      this.updateRef(dt, false, w);
    } else {
      this.arena.showStools(false);
      this.models.forEach((m) => m.setRobe(false));
      this.syncModels(dt);
      E.actors.forEach((act, i) => {
        this.anims[i].updateFight(dt, act, this.models[1 - i], E);
        this.models[i].setDamage(act);
        this.models[i].setSweat(act.sweat + (1 - act.stamina / act.staminaMax) * 0.3);
      });
      this.updateRef(dt);
      this.record();
    }
    // Particules.
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.life -= dt; p.v.y -= 9.8 * dt;
      p.mesh.position.addScaledVector(p.v, dt);
      if (p.mesh.position.y < 0.01) { p.mesh.position.y = 0.01; p.v.set(0, 0, 0); }
      if (p.life <= 0) p.mesh.visible = false;
    }
    this.updateCamera(dt);
  }

  updateRef(dt, idle = false, winner = null) {
    const E = this.engine;
    const a = E.a, b = E.b;
    let target;
    if (idle) target = new THREE.Vector3(0, 0, -2.2);
    else if (E.phase === 'count' && E.count) {
      const down = E.actors[E.count.who];
      target = new THREE.Vector3(down.x + 0.9, 0, down.z - 0.6);
    } else {
      // Se place derrière l'axe des boxeurs (côté opposé à la caméra) pour ne pas gêner la vue.
      const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      let px = -(b.z - a.z), pz = b.x - a.x;
      const l = Math.hypot(px, pz) || 1; px /= l; pz /= l;
      if (pz > 0) { px = -px; pz = -pz; }
      target = new THREE.Vector3(clamp(mx + px * 1.5, -2.6, 2.6), 0, clamp(mz + pz * 1.5, -2.6, 2.6));
    }
    this.refPos.lerp(target, Math.min(1, dt * 2.5));
    this.ref.root.position.copy(this.refPos);
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    this.ref.root.rotation.y = Math.atan2(mx - this.refPos.x, mz - this.refPos.z);
    if (winner != null && !idle) {
      // L'arbitre lève le bras du vainqueur.
      this.refAnim.updateVictory(dt);
    } else this.refAnim.updateIdle(dt, { relaxed: true });
    if (E.phase === 'count' && E.count) {
      // Gestuelle du compte : bras qui bat la mesure.
      const k = (E.count.t / 0.8);
      const arm = this.ref.arms.R;
      arm.upper.rotation.x -= Math.sin(k * Math.PI) * 1.4;
    }
  }

  setCameraMode(mode) { if (CAMERA_MODES[mode]) this.camMode = mode; }

  updateCamera(dt) {
    const E = this.engine;
    const cm = CAMERA_MODES[this.camMode] || CAMERA_MODES.top;
    let look, pos, fov = cm.fov;
    if (this.mode === 'intro') {
      const a = this.t * 0.25;
      look = new THREE.Vector3(0, 1.0, 0);
      pos = new THREE.Vector3(Math.sin(a) * 7, 4.5, Math.cos(a) * 7);
    } else if (this.mode === 'corner') {
      look = new THREE.Vector3(-2.4, 0.9, -2.4);
      pos = new THREE.Vector3(-0.3, 2.6, 0.2);
      fov = 42;
    } else {
      const mx = (E.a.x + E.b.x) / 2, mz = (E.a.z + E.b.z) / 2;
      const d = Math.hypot(E.a.x - E.b.x, E.a.z - E.b.z);
      const zoom = clamp(0.85 + d * 0.12, 0.9, 1.25) * (this.mode === 'end' ? 0.8 : 1);
      look = new THREE.Vector3(mx * 0.85, 0.9, mz * 0.85);
      pos = new THREE.Vector3(look.x + cm.side * zoom, cm.height * zoom, look.z + cm.back * zoom);
    }
    if (this.camera.fov !== fov) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    const k = this.mode === 'intro' ? 1 : Math.min(1, dt * 4);
    this.camPos.lerp(pos, k);
    this.camLook.lerp(look, k);
    this.camera.position.copy(this.camPos);
    if (this.shake > 0 && this.opts.shake !== false) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.3;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.3;
      this.shake = Math.max(0, this.shake - dt * 1.2);
    }
    this.camera.lookAt(this.camLook);
  }

  // --------------------------------------------------------------- ralentis
  record() {
    this.replayBuf.push({ s: [this.models[0].snapshot(), this.models[1].snapshot(), this.ref.snapshot()] });
    if (this.replayBuf.length > 300) this.replayBuf.shift();
  }

  startReplay(onDone) {
    if (this.replayBuf.length < 30) { onDone && onDone(); return; }
    this.replay = { frames: this.replayBuf.slice(-180), i: 0, onDone, prevMode: this.mode };
    this.mode = 'replay';
  }

  updateReplay(dt) {
    const R = this.replay;
    R.i += dt * 60 * 0.3; // ralenti x0.3
    const f = R.frames[Math.min(R.frames.length - 1, Math.floor(R.i))];
    this.models[0].restore(f.s[0]); this.models[1].restore(f.s[1]); this.ref.restore(f.s[2]);
    // Caméra rapprochée cinématique, basse et tournante autour de l'impact.
    const mid = this.models[0].root.position.clone().lerp(this.models[1].root.position, 0.5);
    const a = R.i * 0.004 + 0.6;
    const pos = new THREE.Vector3(mid.x + Math.sin(a) * 2.6, 1.5, mid.z + Math.cos(a) * 2.6);
    this.camera.position.lerp(pos, 0.15);
    this.camera.lookAt(mid.x, 1.3, mid.z);
    if (this.camera.fov !== 32) { this.camera.fov = 32; this.camera.updateProjectionMatrix(); }
    if (R.i >= R.frames.length - 1) {
      this.mode = R.prevMode === 'replay' ? 'end' : R.prevMode;
      this.replay = null;
      R.onDone && R.onDone();
    }
  }

  dispose() {
    for (const m of [...this.models, this.ref]) m.dispose();
  }
}
