// Moteur de combat temps réel (indépendant du rendu). Pas fixe 1/60 s.
// Gère : déplacements, coups, défense, contres, feintes, clinch, dégâts localisés,
// endurance, étourdissement, knockdowns, compte de l'arbitre, arrêts, rounds et juges.
import { clamp, rand, chance, randRange } from '../core/util.js';
import { effectiveAttrs, hasTech } from '../core/boxer.js';
import { PUNCHES, detectCombo } from './punches.js';
import { scoreRound, finalDecision } from './judges.js';

export const RING_HALF = 3.0;       // demi-côté intérieur du ring (m)
const BODY_R = 0.28;                 // rayon de collision
const DT = 1 / 60;

export class Actor {
  constructor(boxer, side, opts = {}) {
    this.boxer = boxer;
    this.side = side;
    this.name = boxer.lastName;
    this.a = effectiveAttrs(boxer, { drain: opts.drain || 0 });
    this.tech = new Set(boxer.techniques || []);
    this.stance = boxer.stance;
    this.reachM = (boxer.reach || 180) / 200 * 0.92 + 0.32;
    this.weightKg = opts.fightWeight || boxer.weight || 70;
    this.x = side === 0 ? -1.4 : 1.4; this.z = 0;
    this.vx = 0; this.vz = 0;
    this.face = side === 0 ? 0 : Math.PI; // angle (rad) vers l'adversaire
    this.staminaMax = 55 + this.a.endurance * 0.95;
    this.stamina = this.staminaMax;
    this.headHP = 100; this.bodyHP = 100;
    this.daze = 0;
    this.zones = { tete: 0, machoire: 0, corps: 0, cotes: 0, abdomen: 0 };
    this.cuts = { left: 0, right: 0 };
    this.swell = { left: 0, right: 0 };
    this.action = null;    // action temporisée en cours
    this.block = null;     // 'high' | 'body' | null (maintenu)
    this.state = 'fight';  // fight | stun | down | out | clinch
    this.stunT = 0;
    this.counterWindow = 0; // fenêtre de contre ouverte (après esquive/blocage réussi)
    this.opening = 0;       // ouverture créée par une feinte réussie
    this.chain = [];        // séquence de coups pour combos
    this.chainT = 0;
    this.lastPunchT = -9;
    this.queued = null;     // coup en tampon
    this.downs = 0; this.downsRound = 0;
    this.unanswered = 0;
    this.instructions = null;
    this.hitFlash = 0; this.hitDir = 0; this.hitZone = null; this.hitPower = 0;
    this.sweat = 0;
    this.getUp = 0;
    this.liverDelay = 0;
    this.weave = 0; // charge peek-a-boo
    this.stats = newStats();
    this.roundStats = newStats();
    this.ctrl = null; // contrôleur (humain ou IA)
    this.lastComboName = null;
    this.forwardTime = 0;
  }
  get alive() { return this.state !== 'down' && this.state !== 'out'; }
  get stamF() { return 0.55 + 0.45 * (this.stamina / this.staminaMax); }
  speedMul() {
    const s = 1.22 - this.a.speed * 0.0048;
    const tired = this.stamina < this.staminaMax * 0.25 ? 1.18 : 1;
    const stun = this.state === 'stun' ? 1.3 : 1;
    return s * tired * stun;
  }
  isPunching() { return this.action && this.action.kind === 'punch'; }
  punchPhase() {
    const ac = this.action;
    if (!ac || ac.kind !== 'punch') return null;
    if (ac.t < ac.startup) return 'startup';
    if (ac.t < ac.startup + ac.active) return 'active';
    return 'recovery';
  }
}

function newStats() {
  return { thrown: 0, landed: 0, jabsThrown: 0, jabsLanded: 0, powerThrown: 0, powerLanded: 0, bodyLanded: 0, headLanded: 0, damage: 0, knockdowns: 0, blocked: 0, evaded: 0, counters: 0, aggression: 0 };
}

export class FightEngine {
  constructor(opts) {
    this.rounds = opts.rounds || 4;
    this.roundLength = opts.roundLength || 90; // secondes de jeu par round
    this.amateur = !!opts.amateur;
    this.threeKnockdownRule = opts.threeKnockdownRule !== false;
    this.a = new Actor(opts.boxerA, 0, { drain: opts.drainA, fightWeight: opts.weightA });
    this.b = new Actor(opts.boxerB, 1, { drain: opts.drainB, fightWeight: opts.weightB });
    this.actors = [this.a, this.b];
    this.round = 1;
    this.clock = 0;
    this.time = 0;
    this.phase = 'fight'; // fight | count | break | over
    this.events = [];
    this.scorecards = [[], [], []]; // 3 juges : [ [a,b], ... ]
    this.result = null;
    this.count = null;    // {who, n, t}
    this.clinchT = 0;
    this.listeners = [];
    this.roundSummaries = [];
    this.difficulty = opts.difficulty ?? 1;
    this.paused = false;
    this.slowmo = 1;
    this.headgear = !!opts.headgear;
  }

  on(fn) { this.listeners.push(fn); }
  emit(type, data = {}) {
    const ev = { type, t: this.time, round: this.round, ...data };
    this.events.push(ev);
    if (this.events.length > 400) this.events.splice(0, 100);
    for (const l of this.listeners) l(ev);
  }
  other(act) { return act === this.a ? this.b : this.a; }
  dist() { return Math.hypot(this.b.x - this.a.x, this.b.z - this.a.z); }

  // ---------------------------------------------------------------- commandes
  // cmd: { move:{f,l}, punch:{type,target}, block, slip, duck, back, pivot, clinch, feint, getUp }
  command(act, cmd) {
    if (this.phase === 'over') return;
    if (act.state === 'down') { if (cmd.getUp) act.getUp += cmd.getUp; return; }
    if (act.state === 'out') return;
    act.moveCmd = cmd.move || { f: 0, l: 0 };
    act.block = cmd.block || null;
    if (this.phase !== 'fight') return;
    if (act.state === 'clinch') {
      if (cmd.punch || cmd.back) act.breakClinch = (act.breakClinch || 0) + 1;
      return;
    }
    const busy = act.action && !this.canCancel(act, cmd);
    if (cmd.punch) {
      if (busy) { act.queued = { ...cmd.punch, at: this.time }; return; }
      this.startPunch(act, cmd.punch.type, cmd.punch.target || 'head');
      return;
    }
    if (busy) return;
    if (cmd.slip) this.startDefense(act, 'slip', cmd.slip);
    else if (cmd.duck) this.startDefense(act, 'duck');
    else if (cmd.back) this.startDefense(act, 'back');
    else if (cmd.pivot && act.tech.has('pivot')) this.startDefense(act, 'pivot', cmd.pivot);
    else if (cmd.clinch) this.tryClinch(act);
    else if (cmd.feint && act.tech.has('feint')) this.startFeint(act, cmd.feint);
  }

  canCancel(act, cmd) {
    const ac = act.action;
    if (!ac) return true;
    if (act.state === 'stun') return false;
    if (ac.kind === 'punch' && cmd.punch) {
      // Enchaînement : annule la récupération si la combinaison est maîtrisée.
      const maxChain = act.tech.has('combo4') ? 6 : act.tech.has('combo3') ? 3 : 2;
      if (act.chain.length >= maxChain) return false;
      if (ac.t >= ac.startup + ac.active + ac.recovery * 0.35) return true;
      return false;
    }
    if (ac.kind === 'hitstun') return false;
    if (ac.kind === 'feint' && ac.t > ac.dur * 0.6) return true;
    return false;
  }

  startPunch(act, type, target) {
    const P = PUNCHES[type];
    if (!P || act.state === 'stun') return;
    if (act.stamina < P.stam * 0.6) { this.emit('tooTired', { who: act.side }); return; }
    let m = act.speedMul();
    const prev = act.chain[act.chain.length - 1];
    const flowing = prev && this.time - act.chainT < 0.7 && PUNCHES[prev].hand !== P.hand;
    if (flowing) m *= 0.82;
    if (act.counterWindow > 0) m *= 0.85;
    if (this.time - act.chainT > 0.9) act.chain = [];
    act.chain.push(type);
    act.chainT = this.time;
    const weaveBoost = act.weave > 0 && (P.kind !== 'straight');
    act.action = {
      kind: 'punch', type, target, t: 0,
      startup: P.startup * m, active: P.active, recovery: P.recovery * m * (act.stamina < act.staminaMax * 0.2 ? 1.25 : 1),
      hit: false, counter: act.counterWindow > 0 || act.opening > 0, weave: weaveBoost, whiff: false,
    };
    act.stamina -= P.stam * (target === 'body' ? 1.05 : 1);
    act.stats.thrown++; act.roundStats.thrown++;
    if (type === 'jab') { act.stats.jabsThrown++; act.roundStats.jabsThrown++; }
    else { act.stats.powerThrown++; act.roundStats.powerThrown++; }
    act.lastPunchT = this.time;
    if (act.block) act.block = null;
    const combo = detectCombo(act.chain);
    if (combo && act.chain.length === combo.seq.length) act.lastComboName = combo.name;
    this.emit('punch', { who: act.side, punch: type, target });
  }

  startDefense(act, kind, dir) {
    const cost = { slip: 1.2, duck: 1.4, back: 2.2, pivot: 2.6 }[kind];
    if (act.stamina < cost) return;
    act.stamina -= cost;
    const sp = 1.15 - act.a.footwork * 0.003 - act.a.reflexes * 0.0015;
    const dur = { slip: 0.42, duck: 0.48, back: 0.3, pivot: 0.4 }[kind] * sp;
    act.action = { kind, dir: dir || (chance(0.5) ? 'left' : 'right'), t: 0, dur, evaded: false };
    act.block = null;
    this.emit('defense', { who: act.side, kind, dir: act.action.dir });
  }

  startFeint(act, type) {
    act.action = { kind: 'feint', type: type || 'jab', t: 0, dur: 0.22 };
    act.stamina -= 0.5;
    this.emit('feint', { who: act.side });
    // L'adversaire peut mordre à la feinte.
    const o = this.other(act);
    if (o.ctrl && o.ctrl.onFeint) o.ctrl.onFeint(act);
  }

  tryClinch(act) {
    const o = this.other(act);
    if (this.dist() > 0.95 || o.state !== 'fight') return;
    const pro = act.tech.has('clinchPro');
    const p = 0.35 + (act.a.strength - o.a.strength) * 0.006 + (pro ? 0.3 : 0) + (o.isPunching() ? 0.15 : 0) + (act.state === 'stun' ? -0.1 : 0);
    act.stamina -= 1.5;
    if (chance(clamp(p, 0.1, 0.9))) {
      act.state = 'clinch'; o.state = 'clinch';
      act.action = null; o.action = null;
      act.clinchInit = true; o.clinchInit = false;
      act.breakClinch = 0; o.breakClinch = 0;
      this.clinchT = 1.6 + rand() * 1.4;
      this.emit('clinch', { who: act.side });
    } else {
      act.action = { kind: 'hitstun', t: 0, dur: 0.25 };
    }
  }

  // ---------------------------------------------------------------- boucle
  update(dtReal) {
    if (this.paused || this.phase === 'over') return;
    let acc = dtReal * this.slowmo;
    this._acc = (this._acc || 0) + acc;
    let steps = 0;
    while (this._acc >= DT && steps < 10) {
      this.step(DT);
      this._acc -= DT; steps++;
      if (this.phase === 'over' || this.phase === 'break') { this._acc = 0; break; }
    }
  }

  step(dt) {
    this.time += dt;
    if (this.phase === 'fight') {
      this.clock += dt;
      for (const act of this.actors) {
        if (act.ctrl && act.ctrl.think) act.ctrl.think(dt, this);
      }
      for (const act of this.actors) this.updateActor(act, dt);
      this.updateClinch(dt);
      this.resolveSpacing(dt);
      if (this.clock >= this.roundLength) this.endRound();
    } else if (this.phase === 'count') {
      for (const act of this.actors) {
        if (act.state !== 'down' && act.state !== 'out') {
          // Le boxeur debout recule dans un coin neutre.
          act.action = null; act.block = null;
          this.moveTowards(act, act.side === 0 ? -2.2 : 2.2, act.side === 0 ? 2.2 : -2.2, dt, 1.2);
        } else if (act.ctrl && act.ctrl.thinkDown) act.ctrl.thinkDown(dt, this);
        this.regen(act, dt * 0.5);
      }
      this.updateCount(dt);
    }
    for (const act of this.actors) {
      act.hitFlash = Math.max(0, act.hitFlash - dt * 3);
      act.sweat = clamp(act.sweat + dt * 0.004 * (1.4 - act.stamina / act.staminaMax), 0, 1);
    }
  }

  regen(act, dt) {
    const bodyF = 0.45 + act.bodyHP / 180;
    const moving = act.moveCmd && (Math.abs(act.moveCmd.f) + Math.abs(act.moveCmd.l)) > 0.1;
    let r = (2.6 + act.a.cardio * 0.065) * bodyF * (moving ? 0.75 : 1);
    if (act.state === 'clinch') r *= act.tech.has('clinchPro') ? 2.2 : 1.5;
    if (act.block) r *= 0.85;
    if (act.isPunching()) r = 0;
    act.stamina = clamp(act.stamina + r * dt, 0, act.staminaMax);
    // Récupération de l'étourdissement.
    const dz = (4.5 + act.a.recovery * 0.06 + act.a.chin * 0.05) * (act.state === 'stun' ? 0.6 : 1);
    act.daze = Math.max(0, act.daze - dz * dt);
  }

  updateActor(act, dt) {
    const o = this.other(act);
    if (act.state === 'down' || act.state === 'out') return;
    this.regen(act, dt);
    act.counterWindow = Math.max(0, act.counterWindow - dt);
    act.opening = Math.max(0, act.opening - dt);
    act.weave = Math.max(0, act.weave - dt);
    if (act.liverDelay > 0) {
      act.liverDelay -= dt;
      if (act.liverDelay <= 0) { this.knockdown(act, o, 'foie'); return; }
    }
    if (act.state === 'stun') {
      act.stunT -= dt;
      if (act.stunT <= 0) { act.state = 'fight'; act.unanswered = 0; }
    }
    if (act.state === 'clinch') return;

    // Action en cours.
    const ac = act.action;
    if (ac) {
      ac.t += dt;
      if (ac.kind === 'punch') {
        if (!ac.hit && ac.t >= ac.startup) { ac.hit = true; this.resolvePunch(act, o, ac); }
        if (ac.t >= ac.startup + ac.active + ac.recovery) {
          act.action = null;
        }
      } else if (ac.kind === 'back') {
        // Retrait : recul rapide dans l'axe.
        const ang = act.face + Math.PI;
        const sp = (2.6 + act.a.footwork * 0.012) * (1 - ac.t / ac.dur);
        act.x += Math.cos(ang) * sp * dt; act.z += Math.sin(ang) * sp * dt;
        if (ac.t >= ac.dur) act.action = null;
      } else if (ac.kind === 'pivot') {
        // Pivot : rotation autour de l'adversaire.
        const ang = Math.atan2(act.z - o.z, act.x - o.x) + (ac.dir === 'left' ? 1 : -1) * 2.4 * dt / ac.dur * 0.6;
        const r = Math.hypot(act.x - o.x, act.z - o.z);
        act.x = o.x + Math.cos(ang) * r; act.z = o.z + Math.sin(ang) * r;
        if (ac.t >= ac.dur) act.action = null;
      } else if (ac.t >= ac.dur) {
        act.action = null;
      }
    }
    if (!act.action && act.queued) {
      const q = act.queued; act.queued = null;
      if (this.time - q.at < 0.4) this.startPunch(act, q.type, q.target);
    }

    // Déplacement.
    const m = act.moveCmd || { f: 0, l: 0 };
    const busyFeet = act.action && (act.action.kind === 'back' || act.action.kind === 'pivot');
    if (!busyFeet) {
      let sp = (1.05 + act.a.footwork * 0.011) * act.stamF;
      if (act.block) sp *= 0.6 + act.a.blocking * 0.003;
      if (act.isPunching()) sp *= 0.35;
      if (act.state === 'stun') sp *= 0.4;
      const fx = Math.cos(act.face), fz = Math.sin(act.face);
      const lx = -fz, lz = fx;
      const mf = m.f < 0 ? m.f * 0.74 : m.f * (act.pressing ? 1.12 : 1);
      const tx = (fx * mf + lx * m.l * 0.8) * sp, tz = (fz * mf + lz * m.l * 0.8) * sp;
      act.vx += (tx - act.vx) * Math.min(1, dt * 12);
      act.vz += (tz - act.vz) * Math.min(1, dt * 12);
      act.x += act.vx * dt; act.z += act.vz * dt;
      if (m.f > 0.3) { act.forwardTime += dt; act.roundStats.aggression += dt; }
      const moveCost = (Math.abs(m.f) + Math.abs(m.l)) * 0.35 * dt;
      act.stamina = Math.max(0, act.stamina - moveCost);
    }
    // Toujours face à l'adversaire (rotation douce).
    const target = Math.atan2(o.z - act.z, o.x - act.x);
    let d = target - act.face;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    act.face += d * Math.min(1, dt * 10);
    // Limites du ring.
    const lim = RING_HALF - BODY_R;
    act.x = clamp(act.x, -lim, lim); act.z = clamp(act.z, -lim, lim);
  }

  onRopes(act) {
    const lim = RING_HALF - 0.45;
    const ex = Math.abs(act.x) > lim, ez = Math.abs(act.z) > lim;
    return ex && ez ? 2 : ex || ez ? 1 : 0;
  }

  resolveSpacing() {
    const a = this.a, b = this.b;
    const dx = b.x - a.x, dz = b.z - a.z;
    const d = Math.hypot(dx, dz) || 0.001;
    const min = this.a.state === 'clinch' ? 0.45 : 0.55;
    if (d < min) {
      const push = (min - d) / 2;
      const nx = dx / d, nz = dz / d;
      a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
    }
  }

  moveTowards(act, x, z, dt, sp) {
    const dx = x - act.x, dz = z - act.z, d = Math.hypot(dx, dz);
    if (d > 0.05) { act.x += dx / d * Math.min(d, sp * dt); act.z += dz / d * Math.min(d, sp * dt); }
    const o = this.other(act);
    act.face = Math.atan2(o.z - act.z, o.x - act.x);
  }

  updateClinch(dt) {
    if (this.a.state !== 'clinch') return;
    this.clinchT -= dt;
    const broke = (this.a.breakClinch || 0) + (this.b.breakClinch || 0) > 4;
    if (this.clinchT <= 0 || broke) {
      for (const act of this.actors) {
        act.state = 'fight';
        const o = this.other(act);
        const ang = Math.atan2(act.z - o.z, act.x - o.x);
        act.x += Math.cos(ang) * 0.35; act.z += Math.sin(ang) * 0.35;
        act.daze = Math.max(0, act.daze - (act.clinchInit ? 12 : 4));
      }
      this.emit('break', {});
    }
  }

  // ---------------------------------------------------------------- impacts
  resolvePunch(att, def, ac) {
    const P = PUNCHES[ac.type];
    const d = this.dist();
    let reach = att.reachM * P.reach + (ac.target === 'body' ? -0.04 : 0);
    if (d > reach + 0.06) {
      ac.whiff = true;
      ac.recovery *= 1.25;
      att.stamina -= P.stam * 0.5;
      this.emit('miss', { who: att.side, punch: ac.type, whiff: true });
      def.stats.evaded++; def.roundStats.evaded++;
      return;
    }
    if (def.state === 'clinch') return;
    if (def.state === 'down' || def.state === 'out') return;
    const dac = def.action;
    const head = ac.target === 'head';
    // Défense active.
    if (dac && dac.t < dac.dur * 0.85) {
      if (dac.kind === 'slip' && head && P.kind !== 'upper') {
        const avoid = P.kind === 'straight' ? 1 : 0.45;
        if (chance(avoid)) return this.evaded(att, def, ac, 'slip');
      }
      if (dac.kind === 'duck' && head) {
        if (P.kind === 'hook' || (P.kind === 'straight' && chance(0.75))) return this.evaded(att, def, ac, 'duck');
      }
      if (dac.kind === 'back' && d > reach * 0.85) return this.evaded(att, def, ac, 'back');
      if (dac.kind === 'pivot' && chance(0.7)) return this.evaded(att, def, ac, 'pivot');
    }
    // Blocage.
    let blocked = 0;
    if (def.block === 'high' && head) blocked = P.kind === 'upper' ? 0.45 : 0.85;
    if (def.block === 'body' && !head) blocked = P.kind === 'upper' ? 0.6 : 0.85;
    if (def.block === 'body' && head) blocked = 0.15;
    if (blocked > 0) blocked *= 0.75 + def.a.blocking * 0.0028;
    // Roulé d'épaule : dévie les directs et ouvre le contre.
    if (def.block === 'high' && head && P.kind === 'straight' && def.tech.has('shoulder') && chance(0.55)) {
      def.counterWindow = 0.55;
      return this.evaded(att, def, ac, 'shoulder');
    }
    // Esquive passive (mouvement de tête), précision de l'attaquant.
    const ropes = this.onRopes(def);
    const defBusy = (dac && dac.kind === 'punch') || def.state === 'stun';
    let passive = (def.a.evasion * 0.0032 + def.a.reflexes * 0.0018) * def.stamF * (defBusy ? 0.35 : 1) * (1 - ropes * 0.18);
    passive *= 1 - Math.min(0.6, def.daze / 160);
    if (blocked > 0) passive *= 0.3;
    let acc = P.acc * (0.5 + att.a.accuracy * 0.005) * (0.75 + 0.25 * att.stamF) + (ac.target === 'body' ? 0.07 : 0);
    if (ac.counter) acc += 0.15;
    if (att.opening > 0) acc += 0.2;
    // Gonflement de l'œil : vision réduite du côté du coup.
    const side = P.hand === 'lead' ? 'right' : 'left';
    acc += def.swell[side] * 0.1;
    const hitChance = clamp(acc - passive, 0.08, 0.97);
    if (!chance(hitChance) && blocked === 0) {
      this.emit('miss', { who: att.side, punch: ac.type });
      def.stats.evaded++; def.roundStats.evaded++;
      // Un coup raté de près offre un contre.
      if (def.a.reflexes > 40 && chance(def.a.reflexes / 200)) def.counterWindow = 0.35;
      return;
    }
    // Dégâts.
    const clean = blocked > 0 ? 0 : chance(0.35 + att.a.accuracy * 0.005) ? 1 : 0.6;
    const counterOpp = def.isPunching() && def.punchPhase() !== 'startup';
    let counterMul = 1;
    if (ac.counter || counterOpp) {
      counterMul = att.tech.has('counterPro') ? 1.7 : 1.4;
      if (ac.counter || counterOpp) { att.stats.counters++; att.roundStats.counters++; }
    }
    if (ac.weave) counterMul *= 1.3;
    const weightF = clamp(1 + (att.weightKg - def.weightKg) * 0.006, 0.8, 1.25);
    let dmg = P.dmg * (0.42 + att.a.power * 0.0078) * (0.78 + att.a.strength * 0.0032) * weightF * att.stamF * counterMul * (0.4 + 0.6 * clean);
    if (this.headgear) dmg *= 0.7;
    if (def.state === 'stun' && att.tech.has('finisher')) dmg *= 1.3;
    dmg *= randRange(0.85, 1.15);
    const rawDmg = dmg;
    dmg *= 1 - blocked;
    // Zone touchée.
    let zone;
    if (head) {
      const jawP = P.kind === 'straight' ? 0.12 + att.a.accuracy * 0.0012 : 0.25 + att.a.accuracy * 0.0025;
      zone = clean && chance(jawP) ? 'machoire' : 'tete';
    } else {
      zone = P.kind === 'hook' ? 'cotes' : 'abdomen';
      if (P.kind === 'hook' && chance(0.3)) zone = 'corps';
    }
    def.zones[zone] += dmg;
    this.applyDamage(att, def, dmg, zone, ac, blocked, clean, counterMul > 1, rawDmg);
  }

  evaded(att, def, ac, how) {
    ac.whiff = true;
    ac.recovery *= 1.15;
    def.stats.evaded++; def.roundStats.evaded++;
    def.counterWindow = def.tech.has('counterPro') ? 0.7 : 0.45;
    if (how !== 'back' && def.tech.has('weave')) def.weave = 0.8;
    def.action && (def.action.evaded = true);
    this.emit('evade', { who: def.side, how, punch: ac.type });
  }

  applyDamage(att, def, dmg, zone, ac, blocked, clean, isCounter, rawDmg) {
    const P = PUNCHES[ac.type];
    const head = zone === 'tete' || zone === 'machoire';
    if (blocked > 0) {
      def.stamina -= rawDmg * 0.25 * (1.3 - def.a.strength * 0.005);
      att.stats.blocked++; att.roundStats.blocked++;
    } else {
      att.stats.landed++; att.roundStats.landed++;
      if (ac.type === 'jab') { att.stats.jabsLanded++; att.roundStats.jabsLanded++; }
      else { att.stats.powerLanded++; att.roundStats.powerLanded++; }
      if (head) { att.stats.headLanded++; att.roundStats.headLanded++; } else { att.stats.bodyLanded++; att.roundStats.bodyLanded++; }
    }
    att.stats.damage += dmg; att.roundStats.damage += dmg;
    def.hitFlash = Math.min(1, dmg / 10);
    def.hitZone = zone; def.hitPower = dmg; def.hitDir = P.kind === 'hook' ? (P.hand === 'lead' ? 1 : -1) : 0;
    def.hitKind = P.kind;
    if (head) {
      const chinF = 1.32 - def.a.chin * 0.0065;
      def.headHP = Math.max(0, def.headHP - dmg * 0.13 * chinF);
      let dz = dmg * (zone === 'machoire' ? 1.75 : 1) * chinF * (1 + (100 - def.headHP) / 120) * 1.15;
      if (blocked > 0) dz *= 0.4;
      def.daze += dz;
      def.stamina -= dmg * 0.12;
      // Coupures (crochets/directs propres en tête).
      if (clean && dmg > 6 && chance(0.04 + dmg * 0.004)) {
        const s = chance(0.5) ? 'left' : 'right';
        def.cuts[s] = Math.min(1, def.cuts[s] + randRange(0.15, 0.35));
        this.emit('cut', { who: def.side, side: s });
      }
      if (clean) { const s = P.hand === 'lead' ? 'right' : 'left'; def.swell[s] = Math.min(1, def.swell[s] + dmg * 0.004); }
    } else {
      const bodyF = 1.25 - def.a.endurance * 0.004 - def.a.strength * 0.0018;
      def.bodyHP = Math.max(0, def.bodyHP - dmg * 0.3 * bodyF);
      def.stamina -= dmg * 0.85 * bodyF;
      def.daze += dmg * 0.18;
      // Crochet au foie (main avant, au corps).
      if (zone === 'cotes' && P.hand === 'lead' && blocked === 0 && clean) {
        const liverP = (att.tech.has('liver') ? 0.12 : 0.03) * (1.5 - def.bodyHP / 100) * (dmg / 10);
        if (chance(liverP)) { def.liverDelay = 0.45; this.emit('liver', { who: def.side }); }
      }
    }
    def.stamina = Math.max(0, def.stamina);
    if (blocked === 0) { att.unanswered = 0; def.unanswered++; }
    this.emit('hit', { who: def.side, by: att.side, punch: ac.type, zone, dmg, blocked: blocked > 0, counter: isCounter, clean: !!clean, combo: att.lastComboName });
    att.lastComboName = null;
    // Interruption du coup adverse s'il est frappé en phase de lancement.
    if (blocked === 0 && def.isPunching() && def.punchPhase() === 'startup' && dmg > 5) {
      def.action = { kind: 'hitstun', t: 0, dur: 0.18 };
    } else if (blocked === 0 && dmg > 7 && !def.action) {
      def.action = { kind: 'hitstun', t: 0, dur: 0.12 + dmg * 0.012 };
    }
    // Seuils : étourdissement / knockdown / arrêt de l'arbitre.
    const kdTh = 100 * (0.5 + def.a.chin * 0.0048 + def.a.mental * 0.0012) * (0.45 + def.headHP / 180);
    if (def.daze >= kdTh || (head && def.headHP <= 0)) {
      this.knockdown(def, att, zone);
      return;
    }
    if (def.daze > kdTh * 0.62 && def.state === 'fight') {
      def.state = 'stun';
      def.stunT = 0.9 + (def.daze / kdTh) * 1.4 - def.a.mental * 0.006;
      def.unanswered = 0;
      this.emit('stun', { who: def.side });
    }
    if (def.state === 'stun' && def.unanswered >= 7 && blocked === 0 && def.headHP < 45) {
      this.stoppage(def, att, 'L\'arbitre arrête le combat');
    }
  }

  knockdown(def, att, zone) {
    if (this.phase !== 'fight') return;
    def.state = 'down';
    def.action = null; def.block = null;
    def.downs++; def.downsRound++;
    def.getUp = 0;
    att.stats.knockdowns++; att.roundStats.knockdowns++;
    def.liverDelay = 0;
    this.phase = 'count';
    this.count = { who: def.side, n: 0, t: 0, zone };
    this.emit('knockdown', { who: def.side, by: att.side, zone, n: def.downsRound });
    if (this.threeKnockdownRule && def.downsRound >= 3) {
      this.stoppage(def, att, 'Règle des trois knockdowns');
    }
  }

  updateCount(dt) {
    const c = this.count;
    if (!c || this.phase !== 'count') return;
    const def = this.actors[c.who];
    c.t += dt;
    const interval = 0.8;
    if (c.t >= interval) {
      c.t -= interval;
      c.n++;
      this.emit('count', { who: c.who, n: c.n });
      // Capacité à se relever : dégâts, mental, nombre de chutes.
      const need = 10 + def.downs * 6 + (100 - def.headHP) * 0.25 - def.a.mental * 0.08;
      const canRise = def.getUp >= need && def.headHP > 3;
      if (c.n >= 8 && canRise) {
        def.state = 'fight';
        def.daze = 35;
        def.stunT = 0;
        def.unanswered = 0;
        this.phase = 'fight';
        this.count = null;
        def.x = clamp(def.x, -2.2, 2.2); def.z = clamp(def.z, -2.2, 2.2);
        this.emit('getup', { who: c.who });
        return;
      }
      if (c.n >= 10) {
        def.state = 'out';
        this.finish(this.other(def).side, 'KO', `KO au round ${this.round}`);
      }
    }
  }

  stoppage(def, att, why) {
    def.state = def.state === 'down' ? 'out' : 'stun';
    this.finish(att.side, 'TKO', why + ` (round ${this.round})`);
  }

  endRound() {
    this.phase = 'break';
    const sc = scoreRound(this, this.round);
    for (let j = 0; j < 3; j++) this.scorecards[j].push(sc.cards[j]);
    this.roundSummaries.push({ round: this.round, a: { ...this.a.roundStats }, b: { ...this.b.roundStats }, cards: sc.cards });
    this.emit('roundEnd', { round: this.round, cards: sc.cards });
    if (this.round >= this.rounds) {
      const dec = finalDecision(this.scorecards);
      this.finish(dec.winner, dec.method, dec.label, dec);
    }
  }

  // Pause entre les rounds : récupération, soigneur (cutman), consignes.
  restBetweenRounds(opts = {}) {
    for (const act of this.actors) {
      const isA = act === this.a;
      const cutman = (isA ? opts.cutmanA : opts.cutmanB) || 0;
      const rec = 0.32 + act.a.cardio * 0.0035 + act.a.recovery * 0.001;
      act.staminaMax = Math.max(40, act.staminaMax * (0.985 - (1 - act.a.endurance / 100) * 0.02));
      act.stamina = Math.min(act.staminaMax, act.stamina + act.staminaMax * rec);
      act.headHP = Math.min(100, act.headHP + 3 + act.a.recovery * 0.04);
      act.bodyHP = Math.min(100, act.bodyHP + 2 + act.a.recovery * 0.03);
      act.daze = 0;
      act.state = 'fight'; act.action = null; act.block = null; act.queued = null;
      act.downsRound = 0;
      for (const s of ['left', 'right']) {
        act.cuts[s] = Math.max(0, act.cuts[s] - 0.08 - cutman * 0.07);
        act.swell[s] = Math.max(0, act.swell[s] - 0.03 - cutman * 0.03);
      }
      act.roundStats = newStats();
      act.chain = [];
    }
    // Arrêt médical.
    for (const act of this.actors) {
      const worstCut = Math.max(act.cuts.left, act.cuts.right);
      if (worstCut > 0.92 || act.headHP < 10) {
        this.finish(this.other(act).side, 'TKO', `Arrêt médical avant le round ${this.round + 1}`);
        return false;
      }
      if (opts.retire && opts.retire === act.side) {
        this.finish(this.other(act).side, 'RTD', `Abandon dans le coin avant le round ${this.round + 1}`);
        return false;
      }
    }
    this.round++;
    this.clock = 0;
    this.a.x = -1.4; this.a.z = 0; this.b.x = 1.4; this.b.z = 0;
    this.a.face = 0; this.b.face = Math.PI;
    this.phase = 'fight';
    this.emit('roundStart', { round: this.round });
    return true;
  }

  forfeit(side, label = 'L\'entraîneur jette l\'éponge') {
    this.finish(side === 0 ? 1 : 0, 'RTD', label + ` (round ${this.round})`);
  }

  finish(winner, method, label, dec) {
    if (this.phase === 'over') return;
    this.phase = 'over';
    this.result = {
      winner, method, label, round: this.round, time: this.clock, decision: dec || null,
      scorecards: this.scorecards.map((c) => c.slice()),
      stats: [{ ...this.a.stats }, { ...this.b.stats }],
      damage: [this.a, this.b].map((x) => ({ head: 100 - x.headHP, body: 100 - x.bodyHP, cuts: Math.max(x.cuts.left, x.cuts.right), downs: x.downs, zones: { ...x.zones } })),
    };
    this.emit('end', { result: this.result });
  }

  // Simulation complète sans rendu (les deux boxeurs pilotés par IA).
  simulateToEnd(onBreak) {
    let guard = 0;
    while (this.phase !== 'over' && guard++ < 400000) {
      if (this.phase === 'break') {
        if (onBreak) onBreak(this);
        if (this.phase === 'over') break;
        this.restBetweenRounds({ cutmanA: 1, cutmanB: 1 });
        continue;
      }
      this.step(DT * 2);
    }
    return this.result;
  }
}
