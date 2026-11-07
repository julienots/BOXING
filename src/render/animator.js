// Animation procédurale : convertit l'état du moteur (ou un script d'entraînement) en pose IK.
import * as THREE from 'three';
import { PUNCHES } from '../fight/punches.js';

const V3 = THREE.Vector3;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const bez = (a, b, c, t, out) => out.set(
  (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * b.x + t * t * c.x,
  (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * b.y + t * t * c.y,
  (1 - t) * (1 - t) * a.z + 2 * (1 - t) * t * b.z + t * t * c.z,
);

export function blankPose() {
  return {
    tilt: { pitch: 0, roll: 0, yaw: 0, y: 0, z: 0 },
    hips: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    spine: { yaw: 0, pitch: 0, roll: 0 }, chest: { yaw: 0, pitch: 0, roll: 0 }, head: { yaw: 0, pitch: 0, roll: 0 },
    handL: new V3(), handR: new V3(), poleL: new V3(1, -1, -0.3), poleR: new V3(-1, -1, -0.3), twistL: 0, twistR: 0,
    footL: new V3(), footR: new V3(), footYawL: 0, footYawR: 0, footPitch: 0,
    expr: { brow: 0.4, lids: 0.9, mouth: 0, grimace: 0, browUp: 0 }, breath: 0,
  };
}

function lerpPose(c, t, a, aHands) {
  const L = (x, y, k) => x + (y - x) * k;
  for (const g of ['tilt', 'hips', 'spine', 'chest', 'head']) for (const k in t[g]) c[g][k] = L(c[g][k], t[g][k], a);
  c.handL.lerp(t.handL, aHands); c.handR.lerp(t.handR, aHands);
  c.poleL.lerp(t.poleL, a).normalize(); c.poleR.lerp(t.poleR, a).normalize();
  c.twistL = L(c.twistL, t.twistL, aHands); c.twistR = L(c.twistR, t.twistR, aHands);
  c.footL.lerp(t.footL, a); c.footR.lerp(t.footR, a);
  c.footYawL = L(c.footYawL, t.footYawL, a); c.footYawR = L(c.footYawR, t.footYawR, a);
  c.footPitch = L(c.footPitch, t.footPitch, a);
  for (const k in t.expr) c.expr[k] = L(c.expr[k] ?? 0, t.expr[k], Math.min(1, a * 1.5));
  c.breath = t.breath;
}

// Ressort amorti pour les réactions aux impacts.
class Spring {
  constructor(k = 140, d = 13) { this.k = k; this.d = d; this.x = 0; this.v = 0; }
  kick(v) { this.v += v; }
  step(dt) { const a = -this.k * this.x - this.d * this.v; this.v += a * dt; this.x += this.v * dt; return this.x; }
}

export class Animator {
  constructor(model) {
    this.model = model;
    this.cur = blankPose();
    this.tgt = blankPose();
    this.t = Math.random() * 10;
    this.springs = { hp: new Spring(160, 12), hy: new Spring(150, 12), hr: new Spring(150, 12), sp: new Spring(110, 11), hx: new Spring(90, 12) };
    this.fall = 0; this.fallDir = 1;
    this.blinkT = 2;
    this.blink = 0;
    this.script = null;
    this.first = true;
    this.computeRefs();
  }

  computeRefs() {
    const D = this.model.D, s = D.s;
    const neckBase = D.hipY + D.pelvisH + D.torsoH * 0.98;
    this.ref = {
      neckBase, headY: neckBase + D.neck + 0.108 * s, chinY: neckBase + D.neck + 0.03 * s,
      chestY: D.hipY + D.pelvisH + D.torsoH * 0.6, sc: s, H: D.H, reach: D.upper + D.fore,
    };
  }

  impulse(zone, kind, dir, power) {
    const p = clamp(power / 10, 0.2, 2.2);
    const S = this.springs;
    if (zone === 'tete' || zone === 'machoire') {
      if (kind === 'upper') S.hp.kick(-7 * p);
      else if (kind === 'hook') { S.hy.kick(dir * 9 * p); S.hr.kick(dir * 4 * p); S.hp.kick(-1.5 * p); }
      else S.hp.kick(-6 * p);
      S.hx.kick(-0.6 * p);
    } else {
      S.sp.kick(4.5 * p);
      S.hx.kick(-0.4 * p);
    }
  }

  // Calcule la trajectoire d'un coup. tgtB = point cible en espace "body".
  punchPose(T, ac, handSide, tgtB, opts = {}) {
    const P = PUNCHES[ac.type];
    const r = this.ref, s = this.model.s, sc = r.sc;
    const lead = P.hand === 'lead';
    const hand = lead ? (s > 0 ? 'L' : 'R') : (s > 0 ? 'R' : 'L');
    const hx = hand === 'L' ? 1 : -1;
    const guard = hand === 'L' ? T.handL.clone() : T.handR.clone();
    const ext = ac.startup, act = ac.active, rec = ac.recovery;
    let u; // 0 garde → 1 impact
    if (ac.t < ext) u = easeOut(ac.t / ext);
    else if (ac.t < ext + act) u = 1;
    else u = 1 - easeInOut(clamp((ac.t - ext - act) / rec, 0, 1));
    // Cible atteignable (limitée par l'allonge, épaule ≈ hauteur du cou).
    const shoulder = new V3(hx * 0.16 * sc, r.neckBase - 0.03 * sc, 0.0);
    const tgt = tgtB.clone();
    tgt.x += hx * (P.kind === 'hook' ? -0.03 : 0.02) * sc;
    // La cible IK est le poignet : reculer de la longueur du gant.
    tgt.addScaledVector(tgt.clone().sub(guard).normalize(), -0.09 * sc);
    const dv = tgt.clone().sub(shoulder);
    const maxR = r.reach * (ac.whiff ? 1.08 : 1.02);
    if (dv.length() > maxR) tgt.copy(shoulder).addScaledVector(dv.normalize(), maxR);
    const out = new V3();
    if (P.kind === 'straight') {
      out.copy(guard).lerp(tgt, u);
      out.y += Math.sin(u * Math.PI) * 0.02 * sc;
    } else if (P.kind === 'hook') {
      const ctrl = new V3(hx * 0.45 * sc, (guard.y + tgt.y) / 2 + 0.03 * sc, (guard.z + tgt.z) * 0.45);
      bez(guard, ctrl, tgt, u, out);
    } else {
      const ctrl = new V3(guard.x * 0.6, r.chestY - 0.2 * sc, (guard.z + tgt.z) * 0.4);
      bez(guard, ctrl, tgt, u, out);
    }
    if (hand === 'L') { T.handL.copy(out); } else { T.handR.copy(out); }
    // Coude, rotation du poing.
    const pole = P.kind === 'hook' ? new V3(hx, 0.6, -0.4) : P.kind === 'upper' ? new V3(hx * 0.5, -1, 0.2) : new V3(hx * 0.8, -1, -0.3);
    if (hand === 'L') T.poleL.copy(pole); else T.poleR.copy(pole);
    const tw = P.kind === 'straight' ? 1.45 : P.kind === 'hook' ? 1.0 : 0;
    if (hand === 'L') T.twistL = -tw * u; else T.twistR = tw * u;
    // Rotation du buste et transfert du poids.
    const sign = hand === 'L' ? -1 : 1; // rotation du torse vers l'avant de la main qui frappe
    const pw = { jab: 0.22, cross: 0.6, lhook: 0.75, rhook: 0.75, lupper: 0.45, rupper: 0.6 }[ac.type] * (opts.power || 1);
    let twist;
    if (P.kind === 'hook') twist = sign * pw * (u < 1 ? (u * 1.3 - 0.3) : 1);
    else twist = sign * pw * u;
    T.chest.yaw += twist * 0.55; T.spine.yaw += twist * 0.45; T.hips.yaw += twist * 0.35;
    T.head.yaw -= twist * 0.6;
    if (P.kind === 'upper') { T.hips.y -= 0.05 * sc * (1 - u) + 0.02 * sc; T.spine.pitch -= 0.08 * u; }
    if (ac.target === 'body') { T.hips.y -= 0.08 * sc * u; T.spine.pitch += 0.2 * u; T.spine.roll += -hx * 0.12 * u; }
    if (P.kind === 'straight') { T.spine.pitch += 0.08 * u; T.hips.z += (lead ? 0.04 : 0.02) * sc * u; }
    if (!lead) { const f = s > 0 ? 'footYawR' : 'footYawL'; T[f] += sign * 0.5 * u; }
    else if (ac.type === 'jab') { const f = s > 0 ? 'footL' : 'footR'; T[f].z += 0.05 * sc * u; }
    // Expression : effort.
    T.expr.brow = 0.8; T.expr.mouth = Math.max(T.expr.mouth, 0.15 * u);
    return hand;
  }

  // Pose de garde de base.
  guard(T, fatigue = 0, style = null) {
    const r = this.ref, s = this.model.s, sc = r.sc;
    const low = fatigue * 0.14 * sc;
    const hiGuard = style === 'peekaboo' ? 0.03 * sc : 0;
    const leadH = new V3(s * 0.12 * sc, r.chinY - 0.11 * sc - low + hiGuard, 0.22 * sc);
    const rearH = new V3(-s * 0.08 * sc, r.chinY - 0.09 * sc - low * 0.7 + hiGuard, 0.13 * sc);
    if (style === 'slick') { leadH.set(s * 0.12 * sc, r.chestY - 0.05 * sc, 0.18 * sc); }
    if (s > 0) { T.handL.copy(leadH); T.handR.copy(rearH); } else { T.handR.copy(leadH); T.handL.copy(rearH); }
    T.poleL.set(0.7, -1, -0.25); T.poleR.set(-0.7, -1, -0.25);
    T.twistL = -0.35; T.twistR = 0.35;
    T.footL.set(0.1 * sc * s + (s < 0 ? 0.24 * sc : 0) * 0, 0, 0);
    // Pieds : avant / arrière selon la garde.
    const lf = new V3(s * 0.11 * sc, 0, 0.19 * sc), rf = new V3(-s * 0.15 * sc, 0, -0.2 * sc);
    if (s > 0) { T.footL.copy(lf); T.footR.copy(rf); T.footYawL = -0.15; T.footYawR = -0.7; }
    else { T.footR.copy(lf); T.footL.copy(rf); T.footYawR = 0.15; T.footYawL = 0.7; }
    T.hips.yaw = -s * 0.45; T.chest.yaw = -s * 0.12; T.spine.yaw = -s * 0.05;
    T.head.yaw = s * 0.55; T.head.pitch = 0.14; T.chest.pitch = 0.08; T.spine.pitch = 0.06;
    T.hips.y = -0.045 * sc;
  }

  resetTarget(T) {
    T.tilt.pitch = 0; T.tilt.roll = 0; T.tilt.y = 0; T.tilt.z = 0; T.tilt.yaw = 0;
    for (const g of ['hips', 'spine', 'chest', 'head']) for (const k in T[g]) T[g][k] = 0;
    T.footPitch = 0;
    T.expr.brow = 0.4; T.expr.lids = 0.9; T.expr.mouth = 0; T.expr.grimace = 0; T.expr.browUp = 0;
  }

  finish(dt, aBody = 14, aHands = 22) {
    const T = this.tgt, C = this.cur, S = this.springs;
    // Clignement.
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 0.12; this.blinkT = 2 + Math.random() * 4; }
    if (this.blink > 0) { this.blink -= dt; T.expr.lids = Math.min(T.expr.lids, 0.05); }
    if (this.first) { lerpPose(C, T, 1, 1); this.first = false; }
    else lerpPose(C, T, 1 - Math.exp(-aBody * dt), 1 - Math.exp(-aHands * dt));
    // Ressorts (impacts) ajoutés après lissage.
    const P = {
      ...C,
      head: { pitch: C.head.pitch + S.hp.step(dt), yaw: C.head.yaw + S.hy.step(dt), roll: C.head.roll + S.hr.step(dt) },
      spine: { ...C.spine, pitch: C.spine.pitch + S.sp.step(dt) },
      hips: { ...C.hips, z: C.hips.z + S.hx.step(dt) * 0.1 },
    };
    this.model.applyPose(P);
  }

  // --------------------------------------------------------------- combat
  updateFight(dt, actor, oppModel, engine) {
    this.t += dt;
    const T = this.tgt, r = this.ref, s = this.model.s, sc = r.sc;
    this.resetTarget(T);
    const fat = 1 - actor.stamina / actor.staminaMax;
    const style = actor.boxer.style;
    this.guard(T, fat, style);
    // Rebond de garde et respiration.
    const bounce = actor.state === 'fight' ? Math.sin(this.t * 7.5) * 0.012 * sc * (1 - fat * 0.6) : 0;
    T.hips.y += bounce;
    T.breath = Math.sin(this.t * (2 + fat * 3)) * (0.5 + fat);
    T.expr.mouth = fat * 0.55;
    T.expr.brow = 0.55;
    // Déplacement : petit pas chassé.
    const mv = actor.moveCmd || { f: 0, l: 0 };
    const step = Math.sin(this.t * 9) * 0.03 * sc * Math.min(1, Math.abs(mv.f) + Math.abs(mv.l));
    T.footL.z += step; T.footR.z -= step;
    // Cible : tête / corps adverse en espace body.
    const oppHead = oppModel.headWorld(new V3());
    const oppChest = oppModel.chestWorld(new V3());
    this.model.body.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.model.body.matrixWorld).invert();
    const headB = oppHead.clone().applyMatrix4(inv);
    const chestB = oppChest.clone().applyMatrix4(inv);
    headB.z -= 0.09 * sc; chestB.z -= 0.13 * sc; chestB.y -= 0.05 * sc;
    // Regarder l'adversaire.
    T.head.pitch += clamp(-(headB.y - r.headY) * 0.8, -0.3, 0.3);

    let aHands = 20, aBody = 14;
    const ac = actor.action;
    if (actor.state === 'down' || actor.state === 'out') {
      this.fall = Math.min(1, this.fall + dt * 1.6);
    } else if (this.fall > 0) {
      this.fall = Math.max(0, this.fall - dt * 0.9);
    }
    if (this.fall > 0) { this.fallPose(T, actor.state === 'out'); this.finish(dt, 10, 10); return; }

    if (actor.state === 'clinch') {
      const d = headB.z;
      T.handL.set(0.17 * sc, r.chestY + 0.08 * sc, Math.min(d, 0.45 * sc));
      T.handR.set(-0.17 * sc, r.chestY + 0.06 * sc, Math.min(d, 0.45 * sc));
      T.poleL.set(1, 0, -0.3); T.poleR.set(-1, 0, -0.3);
      T.spine.pitch = 0.3; T.chest.pitch = 0.15; T.head.yaw = s * 0.35; T.head.pitch = 0.25;
      T.hips.yaw = 0; T.chest.yaw = 0;
    } else if (ac && ac.kind === 'punch') {
      const tgt = ac.target === 'body' ? chestB : headB;
      this.punchPose(T, ac, null, tgt);
      aHands = 60; aBody = 22;
    } else if (ac && ac.kind === 'slip') {
      const k = Math.sin(clamp(ac.t / ac.dur, 0, 1) * Math.PI);
      const dir = ac.dir === 'left' ? 1 : -1;
      T.hips.x += dir * 0.1 * sc * k; T.spine.roll -= dir * 0.28 * k; T.chest.roll -= dir * 0.12 * k;
      T.hips.y -= 0.05 * sc * k; T.spine.pitch += 0.12 * k;
      aBody = 30;
    } else if (ac && ac.kind === 'duck') {
      const k = Math.sin(clamp(ac.t / ac.dur, 0, 1) * Math.PI);
      T.hips.y -= 0.17 * sc * k; T.spine.pitch += 0.42 * k; T.head.pitch -= 0.2 * k;
      aBody = 30;
    } else if (ac && ac.kind === 'back') {
      T.spine.pitch -= 0.12; T.hips.z -= 0.03 * sc;
    } else if (ac && ac.kind === 'feint') {
      const k = Math.sin(clamp(ac.t / ac.dur, 0, 1) * Math.PI);
      const leadHand = s > 0 ? T.handL : T.handR;
      leadHand.z += 0.15 * sc * k; T.chest.yaw -= s * 0.15 * k; T.hips.y -= 0.03 * sc * k;
      aHands = 40;
    } else if (ac && ac.kind === 'hitstun') {
      T.expr.grimace = 1; T.expr.lids = 0.3;
    }
    if (actor.block === 'high' && !(ac && ac.kind === 'punch')) {
      T.handL.set(0.07 * sc, r.headY - 0.06 * sc, 0.12 * sc); T.handR.set(-0.07 * sc, r.headY - 0.065 * sc, 0.11 * sc);
      if (actor.tech.has('shoulder')) { const lh = s > 0 ? T.handL : T.handR; lh.set(s * 0.1 * sc, r.chestY - 0.02 * sc, 0.16 * sc); T.chest.yaw -= s * 0.25; }
      T.poleL.set(0.3, -1, 0.3); T.poleR.set(-0.3, -1, 0.3);
      T.twistL = 0.2; T.twistR = -0.2;
      T.head.pitch += 0.22; T.chest.pitch += 0.12; T.hips.y -= 0.02 * sc;
      aHands = 35;
    } else if (actor.block === 'body' && !(ac && ac.kind === 'punch')) {
      T.handL.set(0.08 * sc, r.chinY - 0.12 * sc, 0.12 * sc); T.handR.set(-0.08 * sc, r.chinY - 0.13 * sc, 0.11 * sc);
      T.poleL.set(0.1, -1, 0.05); T.poleR.set(-0.1, -1, 0.05);
      T.spine.pitch += 0.22; T.hips.y -= 0.05 * sc; T.chest.pitch += 0.1;
      aHands = 35;
    }
    if (actor.state === 'stun') {
      T.hips.x += Math.sin(this.t * 2.6) * 0.06 * sc; T.spine.roll += Math.sin(this.t * 2.1) * 0.14;
      T.handL.y -= 0.12 * sc; T.handR.y -= 0.12 * sc; T.hips.y -= 0.06 * sc;
      T.expr.lids = 0.35; T.expr.mouth = 0.6; T.expr.brow = -0.4;
      T.footL.x += 0.04 * sc; T.footR.x -= 0.04 * sc;
    }
    if (actor.hitFlash > 0.4) { T.expr.grimace = actor.hitFlash; T.expr.lids = Math.min(T.expr.lids, 0.4); }
    if (engine && engine.phase === 'count' && actor.state === 'fight') {
      // Debout pendant le compte : attend dans le coin neutre.
      this.resetTarget(T); this.idle(T, 0.3);
    }
    this.finish(dt, aBody, aHands);
  }

  fallPose(T, out) {
    const r = this.ref, sc = r.sc;
    const f = this.fall;
    const e = f * f * (3 - 2 * f);
    this.resetTarget(T);
    T.tilt.pitch = -1.52 * e;
    T.tilt.y = 0.11 * sc * e;
    T.tilt.z = -0.15 * sc * e;
    T.hips.y = -0.12 * sc * Math.sin(Math.min(1, f * 1.6) * Math.PI) * (1 - e);
    // Genoux pliés au sol, bras écartés.
    T.footL.set(0.18 * sc, 0, 0.3 * sc * e); T.footR.set(-0.16 * sc, 0, 0.22 * sc * e);
    T.footYawL = 0.4; T.footYawR = -0.4;
    T.footPitch = -1.2 * e;
    T.handL.set(0.45 * sc, r.chestY - 0.05 * sc, -0.05 * sc); T.handR.set(-0.45 * sc, r.chestY + 0.05 * sc, -0.02 * sc);
    T.poleL.set(1, 0, -1); T.poleR.set(-1, 0, -1);
    T.head.yaw = out ? 0.6 : 0.2 * Math.sin(this.t * 2); T.head.pitch = out ? -0.2 : 0.1;
    T.expr.lids = out ? 0 : 0.3 + 0.2 * Math.sin(this.t * 3); T.expr.mouth = 0.5; T.expr.brow = -0.6;
    T.twistL = 0; T.twistR = 0;
  }

  // --------------------------------------------------------------- hors combat
  idle(T, energy = 0.5, style = null) {
    const r = this.ref, sc = r.sc;
    this.guard(T, 0.3, style);
    T.hips.y += Math.sin(this.t * 4) * 0.008 * sc * energy;
    T.breath = Math.sin(this.t * 2);
    T.expr.brow = 0.2;
  }

  relaxed(T) {
    const r = this.ref, sc = r.sc;
    T.handL.set(0.22 * sc, r.chestY - 0.32 * sc, 0.05 * sc); T.handR.set(-0.22 * sc, r.chestY - 0.32 * sc, 0.05 * sc);
    T.poleL.set(1, 0, -1); T.poleR.set(-1, 0, -1);
    T.footL.set(0.13 * sc, 0, 0.02 * sc); T.footR.set(-0.13 * sc, 0, -0.02 * sc);
    T.footYawL = 0.15; T.footYawR = -0.15;
    T.breath = Math.sin(this.t * 1.8);
    T.expr.brow = 0; T.expr.lids = 0.95;
  }

  updateIdle(dt, opts = {}) {
    this.t += dt;
    const T = this.tgt;
    this.resetTarget(T);
    if (opts.relaxed) this.relaxed(T); else this.idle(T, opts.energy ?? 0.7, opts.style);
    if (opts.look) { T.head.yaw += opts.look.yaw || 0; T.head.pitch += opts.look.pitch || 0; }
    // Petits mouvements vivants.
    if (!opts.relaxed && opts.shadow) {
      if (!this.script || this.script.done) this.script = shadowScript(this);
      this.runScript(dt, T, opts.shadowTarget);
    }
    this.finish(dt, 10, this.script && this.script.active ? 50 : 18);
  }

  updateVictory(dt) {
    this.t += dt;
    const T = this.tgt, r = this.ref, sc = r.sc;
    this.resetTarget(T);
    this.relaxed(T);
    const b = Math.abs(Math.sin(this.t * 4));
    T.handL.set(0.28 * sc, r.headY + 0.42 * sc + b * 0.04, 0.05 * sc); T.handR.set(-0.28 * sc, r.headY + 0.42 * sc + b * 0.04, 0.05 * sc);
    T.poleL.set(1, 0.2, 0); T.poleR.set(-1, 0.2, 0);
    T.hips.y = b * 0.03 * sc; T.head.pitch = -0.25;
    T.expr.mouth = 0.5; T.expr.brow = -0.2; T.expr.lids = 0.8;
    this.finish(dt, 8, 10);
  }

  updateDejected(dt) {
    this.t += dt;
    const T = this.tgt;
    this.resetTarget(T);
    this.relaxed(T);
    T.head.pitch = 0.45; T.spine.pitch = 0.15; T.expr.brow = -0.7; T.expr.lids = 0.5;
    this.finish(dt, 6, 8);
  }

  updateWalk(dt, speed = 1) {
    this.t += dt * speed;
    const T = this.tgt, r = this.ref, sc = r.sc;
    this.resetTarget(T);
    this.relaxed(T);
    const ph = this.t * 6;
    T.footL.z = Math.sin(ph) * 0.2 * sc; T.footR.z = -Math.sin(ph) * 0.2 * sc;
    T.footL.y = Math.max(0, Math.cos(ph)) * 0.05 * sc; T.footR.y = Math.max(0, -Math.cos(ph)) * 0.05 * sc;
    T.handL.z = -Math.sin(ph) * 0.12 * sc + 0.05; T.handR.z = Math.sin(ph) * 0.12 * sc + 0.05;
    T.hips.y = -Math.abs(Math.sin(ph)) * 0.02 * sc; T.hips.yaw = Math.sin(ph) * 0.08; T.chest.yaw = -Math.sin(ph) * 0.12;
    T.expr.brow = 0.6;
    this.finish(dt, 16, 16);
  }

  // Assis sur le tabouret dans le coin.
  updateCorner(dt, fatigue = 0.5) {
    this.t += dt;
    const T = this.tgt, r = this.ref, sc = r.sc;
    this.resetTarget(T);
    const stool = 0.62 * sc;
    T.hips.y = -(this.model.D.hipY - stool);
    T.hips.z = -0.05 * sc;
    T.footL.set(0.2 * sc, 0, 0.38 * sc); T.footR.set(-0.2 * sc, 0, 0.38 * sc);
    T.footYawL = 0.2; T.footYawR = -0.2;
    // Bras sur les cordes.
    T.handL.set(0.55 * sc, r.chestY - 0.2 * sc, -0.2 * sc); T.handR.set(-0.55 * sc, r.chestY - 0.2 * sc, -0.2 * sc);
    T.poleL.set(1, -0.5, -0.5); T.poleR.set(-1, -0.5, -0.5);
    T.spine.pitch = -0.08; T.head.pitch = -0.1 + Math.sin(this.t * 1.5) * 0.05;
    T.breath = Math.sin(this.t * (2 + fatigue * 3)) * (1 + fatigue);
    T.expr.mouth = 0.3 + fatigue * 0.4; T.expr.lids = 0.8; T.expr.brow = 0.1;
    this.finish(dt, 6, 6);
  }

  // --------------------------------------------------------------- scripts (entraînement)
  runScript(dt, T, target) {
    const sc = this.script;
    if (!sc) return;
    sc.time += dt;
    if (!sc.active) {
      sc.wait -= dt;
      if (sc.wait <= 0) {
        const n = sc.queue.shift();
        if (!n) { sc.done = true; return; }
        sc.active = { kind: 'punch', type: n.type, target: n.target || 'head', t: 0, startup: n.startup || PUNCHES[n.type].startup * 1.1, active: 0.06, recovery: PUNCHES[n.type].recovery * 1.05, whiff: false };
      }
    }
    if (sc.active) {
      const ac = sc.active;
      ac.t += dt;
      const tg = target ? (ac.target === 'body' ? target.body : target.head) : new V3(0, this.ref.chinY, 0.62 * this.ref.sc);
      this.punchPose(T, ac, null, tg, { power: sc.power || 1 });
      if (!ac.fired && ac.t >= ac.startup) { ac.fired = true; if (sc.onHit) sc.onHit(ac); }
      if (ac.t >= ac.startup + ac.active + ac.recovery) { sc.active = null; sc.wait = sc.gap(); }
    }
  }

  // Animation d'entraînement par type. target: points cibles en espace body.
  updateTraining(dt, kind, ctx = {}) {
    this.t += dt;
    const T = this.tgt, r = this.ref, s = this.model.s, sc = r.sc;
    this.resetTarget(T);
    let aH = 22, aB = 12;
    const tt = this.t;
    switch (kind) {
      case 'heavybag': case 'doubleend': case 'dummy': case 'mitts': case 'shadow': case 'sparring': case 'defense': {
        this.idle(T, 1, ctx.style);
        if (kind === 'defense') {
          const k = Math.sin(tt * 3.2);
          T.hips.x += k * 0.1 * sc; T.spine.roll -= k * 0.25; T.hips.y -= Math.abs(k) * 0.08 * sc; T.spine.pitch += Math.abs(k) * 0.2;
          break;
        }
        if (!this.script || this.script.done) this.script = trainingScript(kind, ctx.onHit);
        this.runScript(dt, T, ctx.target);
        if (this.script.active) aH = 55;
        T.expr.brow = 0.8; T.expr.mouth = 0.15 + 0.15 * Math.sin(tt * 3);
        break;
      }
      case 'speedbag': {
        this.relaxed(T);
        const c = Math.sin(tt * 18), c2 = Math.cos(tt * 18);
        const y = r.headY + 0.04 * sc;
        T.handL.set(0.07 * sc + c * 0.03 * sc, y + c2 * 0.04 * sc, 0.3 * sc + c * 0.03);
        T.handR.set(-0.07 * sc - c * 0.03 * sc, y - c2 * 0.04 * sc, 0.3 * sc - c * 0.03);
        T.poleL.set(1, -0.3, -0.5); T.poleR.set(-1, -0.3, -0.5);
        T.head.pitch = -0.15; aH = 60; T.expr.brow = 0.7;
        break;
      }
      case 'rope': {
        this.relaxed(T);
        const j = Math.abs(Math.sin(tt * 7.5));
        T.tilt.y = j * 0.06 * sc;
        T.handL.set(0.25 * sc + Math.cos(tt * 15) * 0.03 * sc, r.chestY - 0.3 * sc + Math.sin(tt * 15) * 0.03 * sc, 0.12 * sc);
        T.handR.set(-0.25 * sc - Math.cos(tt * 15) * 0.03 * sc, r.chestY - 0.3 * sc + Math.sin(tt * 15) * 0.03 * sc, 0.12 * sc);
        T.footPitch = 0.3; T.footL.x = 0.07 * sc; T.footR.x = -0.07 * sc; aH = 40;
        break;
      }
      case 'dumbbells': {
        this.relaxed(T);
        const cl = (Math.sin(tt * 2.6) + 1) / 2, cr = (Math.sin(tt * 2.6 + Math.PI) + 1) / 2;
        T.handL.set(0.2 * sc, r.chestY - 0.3 * sc + cl * 0.32 * sc, 0.1 * sc + cl * 0.12 * sc);
        T.handR.set(-0.2 * sc, r.chestY - 0.3 * sc + cr * 0.32 * sc, 0.1 * sc + cr * 0.12 * sc);
        T.poleL.set(0.3, -1, -0.6); T.poleR.set(-0.3, -1, -0.6);
        T.expr.grimace = Math.max(cl, cr) * 0.6; T.expr.brow = 0.6;
        break;
      }
      case 'bench': {
        // Allongé sur le banc (dos à +Y).
        T.tilt.pitch = -Math.PI / 2; T.tilt.y = 0.45 * sc; T.tilt.z = 0.55 * sc;
        const p = (Math.sin(tt * 1.8) + 1) / 2;
        T.handL.set(0.28 * sc, r.chestY - 0.05 * sc, 0.12 * sc + p * 0.4 * sc);
        T.handR.set(-0.28 * sc, r.chestY - 0.05 * sc, 0.12 * sc + p * 0.4 * sc);
        T.poleL.set(1, 0, -1); T.poleR.set(-1, 0, -1);
        T.footL.set(0.25 * sc, 0, 0.42 * sc); T.footR.set(-0.25 * sc, 0, 0.42 * sc);
        T.footPitch = -1.4;
        T.expr.grimace = (1 - p) * 0.8; T.expr.mouth = 0.3;
        break;
      }
      case 'machines': {
        this.relaxed(T);
        const stool = 0.55 * sc;
        T.hips.y = -(this.model.D.hipY - stool);
        T.footL.set(0.15 * sc, 0, 0.42 * sc); T.footR.set(-0.15 * sc, 0, 0.42 * sc);
        const p = (Math.sin(tt * 2) + 1) / 2;
        T.handL.set(0.15 * sc, r.chestY + 0.02 * sc, 0.45 * sc - p * 0.3 * sc);
        T.handR.set(-0.15 * sc, r.chestY + 0.02 * sc, 0.45 * sc - p * 0.3 * sc);
        T.poleL.set(1, -0.5, -1); T.poleR.set(-1, -0.5, -1);
        T.spine.pitch = 0.1 - p * 0.15; T.expr.grimace = p * 0.6;
        break;
      }
      case 'battlerope': {
        this.relaxed(T);
        T.hips.y = -0.18 * sc; T.spine.pitch = 0.3; T.footL.x = 0.2 * sc; T.footR.x = -0.2 * sc;
        const w = Math.sin(tt * 11);
        T.handL.set(0.17 * sc, r.chestY - 0.25 * sc + w * 0.13 * sc, 0.35 * sc);
        T.handR.set(-0.17 * sc, r.chestY - 0.25 * sc - w * 0.13 * sc, 0.35 * sc);
        T.poleL.set(1, -0.5, -1); T.poleR.set(-1, -0.5, -1);
        T.expr.grimace = 0.7; T.expr.mouth = 0.5; aH = 45;
        break;
      }
      case 'run': {
        this.relaxed(T);
        const ph = tt * 10;
        T.footL.set(0.1 * sc, Math.max(0, Math.cos(ph)) * 0.14 * sc, Math.sin(ph) * 0.3 * sc);
        T.footR.set(-0.1 * sc, Math.max(0, -Math.cos(ph)) * 0.14 * sc, -Math.sin(ph) * 0.3 * sc);
        T.handL.set(0.2 * sc, r.chestY - 0.12 * sc, -Math.sin(ph) * 0.2 * sc + 0.08 * sc);
        T.handR.set(-0.2 * sc, r.chestY - 0.12 * sc, Math.sin(ph) * 0.2 * sc + 0.08 * sc);
        T.poleL.set(0.5, -1, -1); T.poleR.set(-0.5, -1, -1);
        T.hips.y = -Math.abs(Math.sin(ph)) * 0.04 * sc - 0.03 * sc; T.spine.pitch = 0.12; T.chest.yaw = Math.sin(ph) * 0.15;
        T.expr.mouth = 0.4; aH = 40; aB = 30;
        break;
      }
      case 'core': {
        // Gainage / abdos au sol.
        T.tilt.pitch = -Math.PI / 2; T.tilt.y = 0.1 * sc;
        const p = (Math.sin(tt * 2.4) + 1) / 2;
        T.spine.pitch = p * 0.8; T.chest.pitch = p * 0.3;
        T.footL.set(0.15 * sc, 0, 0.35 * sc); T.footR.set(-0.15 * sc, 0, 0.35 * sc); T.footPitch = -1.3;
        T.handL.set(0.1 * sc, r.headY, 0.12 * sc); T.handR.set(-0.1 * sc, r.headY, 0.12 * sc);
        T.poleL.set(1, 0, 0); T.poleR.set(-1, 0, 0);
        T.expr.grimace = p * 0.7;
        break;
      }
      case 'stretch': {
        this.relaxed(T);
        const p = (Math.sin(tt * 0.9) + 1) / 2;
        T.handL.set(0.12 * sc, r.headY + 0.45 * sc, 0.05 * sc); T.handR.set(-0.12 * sc, r.headY + 0.45 * sc, 0.05 * sc);
        T.spine.roll = (p - 0.5) * 0.6; T.chest.roll = (p - 0.5) * 0.3;
        T.footL.x = 0.25 * sc; T.footR.x = -0.25 * sc;
        T.poleL.set(1, 0, 0); T.poleR.set(-1, 0, 0);
        T.expr.lids = 0.6; T.expr.brow = -0.1;
        break;
      }
      default: { // repos, vidéo, méditation : assis
        const stool = 0.48 * sc;
        this.relaxed(T);
        T.hips.y = -(this.model.D.hipY - stool);
        T.footL.set(0.18 * sc, 0, 0.4 * sc); T.footR.set(-0.18 * sc, 0, 0.4 * sc);
        T.handL.set(0.17 * sc, stool + 0.1 * sc, 0.3 * sc); T.handR.set(-0.17 * sc, stool + 0.1 * sc, 0.3 * sc);
        T.poleL.set(1, -0.5, -1); T.poleR.set(-1, -0.5, -1);
        T.head.pitch = 0.1 + Math.sin(tt * 0.6) * 0.05; T.expr.lids = kind === 'meditation' ? 0.05 : 0.8;
        T.breath = Math.sin(tt * 1.4);
      }
    }
    this.finish(dt, aB, aH);
  }
}

function shadowScript(anim) {
  const opts = ['jab', 'cross', 'lhook', 'jab', 'rupper'];
  const q = [];
  const n = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) q.push({ type: opts[Math.floor(Math.random() * opts.length)] });
  return { queue: q, wait: 1.5 + Math.random() * 3, gap: () => 0.08, time: 0, done: false, active: null, power: 0.8 };
}

function trainingScript(kind, onHit) {
  const pools = {
    heavybag: [['jab', 'cross'], ['jab', 'cross', 'lhook'], ['cross', 'lhook', 'cross'], ['rhook', 'lhook'], ['lupper', 'lhook', 'cross'], ['jab', 'jab', 'cross']],
    doubleend: [['jab'], ['jab', 'cross'], ['jab', 'jab'], ['cross']],
    dummy: [['jab', 'cross'], ['lhook:body', 'cross'], ['cross:body', 'lhook'], ['rupper:body', 'lhook']],
    mitts: [['jab', 'cross'], ['jab', 'cross', 'lhook', 'cross'], ['lhook', 'rhook'], ['jab', 'rupper', 'lhook']],
    shadow: [['jab', 'cross'], ['jab', 'jab', 'cross'], ['lhook', 'cross'], ['rupper', 'lhook']],
    sparring: [['jab'], ['jab', 'cross'], ['lhook'], ['cross', 'lhook']],
  };
  const combo = (pools[kind] || pools.shadow)[Math.floor(Math.random() * (pools[kind] || pools.shadow).length)];
  return {
    queue: combo.map((c) => { const [type, target] = c.split(':'); return { type, target: target || 'head' }; }),
    wait: 0.3 + Math.random() * 0.6, gap: () => 0.02, time: 0, done: false, active: null, onHit, power: kind === 'heavybag' ? 1.2 : 1,
  };
}
