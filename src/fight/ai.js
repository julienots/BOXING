// Intelligence artificielle de combat.
// - Modèle d'habitudes : apprend les coups favoris de l'adversaire (chaîne de Markov),
//   ses réactions défensives, son rythme, ses ouvertures de garde.
// - Couche stratégique : change de plan selon le score estimé, la santé, le round.
// - Couche tactique : distance, choix des coups/combinaisons, défense réactive et anticipée.
import { clamp, chance, rand, weightedPick, pick } from '../core/util.js';
import { styleOf } from '../data/styles.js';
import { PUNCHES, PUNCH_KEYS } from './punches.js';

export class HabitModel {
  constructor(seed) {
    this.counts = Object.fromEntries(PUNCH_KEYS.map((k) => [k, 1]));
    this.trans = Object.fromEntries(PUNCH_KEYS.map((k) => [k, Object.fromEntries(PUNCH_KEYS.map((j) => [j, 0.5]))]));
    this.last = null; this.lastT = -9;
    this.intervals = []; this.bodyShots = 0; this.headShots = 0;
    this.def = { high: 1, body: 0.3, slip: 0.5, duck: 0.3, back: 0.5, none: 2 };
    this.openAfterPunch = 0.5; this.openSamples = 1;
    this.total = 0;
    if (seed) Object.assign(this, JSON.parse(JSON.stringify(seed)));
  }
  observePunch(type, target, t) {
    this.counts[type] += 1; this.total++;
    if (this.last && t - this.lastT < 1.2) this.trans[this.last][type] += 1;
    if (this.lastT > 0) { this.intervals.push(t - this.lastT); if (this.intervals.length > 20) this.intervals.shift(); }
    this.last = type; this.lastT = t;
    if (target === 'body') this.bodyShots++; else this.headShots++;
  }
  observeDefense(kind) { this.def[kind] = (this.def[kind] || 0) + 1; }
  observeOpenness(open) { this.openAfterPunch += open ? 1 : 0; this.openSamples++; }
  predict(t) {
    // Probabilités du prochain coup.
    const useTrans = this.last && t - this.lastT < 1.2;
    const src = useTrans ? this.trans[this.last] : this.counts;
    let sum = 0; for (const k of PUNCH_KEYS) sum += src[k];
    const out = {}; for (const k of PUNCH_KEYS) out[k] = src[k] / sum;
    return out;
  }
  rate(kind) { let s = 0; for (const k in this.def) s += this.def[k]; return this.def[kind] / s; }
  avgInterval() { return this.intervals.length ? this.intervals.reduce((a, b) => a + b, 0) / this.intervals.length : 1.5; }
  jabRate() { return this.counts.jab / (this.total + 6); }
  hookRate() { return (this.counts.lhook + this.counts.rhook) / (this.total + 6); }
  serialize() { return { counts: this.counts, trans: this.trans, def: this.def, openAfterPunch: this.openAfterPunch, openSamples: this.openSamples, total: this.total }; }
}

export const INSTRUCTIONS = {
  none:     { name: 'Aucune consigne', desc: 'Le boxeur suit son style naturel.' },
  jab:      { name: 'Travaille au jab', desc: 'Garde la distance, contrôle avec le jab.', mod: { range: 0.3, jabBias: 1.2, mobility: 0.2 } },
  body:     { name: 'Attaque le corps', desc: 'Use l\'adversaire avec des coups au corps.', mod: { bodyWork: 0.45 } },
  pressure: { name: 'Mets la pression', desc: 'Avance, coupe le ring, étouffe-le.', mod: { aggression: 0.35, range: -0.35, workrate: 0.2 } },
  counter:  { name: 'Contre-attaque', desc: 'Laisse-le venir et punis ses erreurs.', mod: { counter: 0.45, aggression: -0.3 } },
  defense:  { name: 'Protège-toi', desc: 'Garde haute, prudence, limite les dégâts.', mod: { defense: 0.4, workrate: -0.25, clinch: 0.2 } },
  move:     { name: 'Bouge, tourne autour', desc: 'Mobilité, ne reste pas dans l\'axe.', mod: { mobility: 0.45, range: 0.2 } },
  ko:       { name: 'Va chercher le KO', desc: 'Coups puissants, prise de risques.', mod: { power: 0.45, aggression: 0.35, workrate: 0.2, defense: -0.25 } },
  conserve: { name: 'Gère ton énergie', desc: 'Moins de volume, récupère.', mod: { workrate: -0.35, clinch: 0.15 } },
};

const MODES = {
  base:    {},
  pressure:{ aggression: 0.3, range: -0.3 },
  outbox:  { range: 0.35, mobility: 0.3, jabBias: 0.8 },
  counter: { counter: 0.4, aggression: -0.3 },
  defend:  { defense: 0.3, workrate: -0.25, clinch: 0.15, mobility: 0.2 },
  allout:  { aggression: 0.5, workrate: 0.4, power: 0.3, defense: -0.3 },
  survive: { defense: 0.5, clinch: 0.55, mobility: 0.35, workrate: -0.5 },
  finish:  { aggression: 0.5, power: 0.4, workrate: 0.45 },
};
export const MODE_NAMES = { base: 'Plan initial', pressure: 'Pression', outbox: 'Boxe à distance', counter: 'Contre', defend: 'Défense (gère son avance)', allout: 'Tout pour le tout', survive: 'Survie', finish: 'Cherche à finir' };

export class AIController {
  constructor(actor, opts = {}) {
    this.me = actor;
    actor.ctrl = this;
    this.style = styleOf(opts.style || actor.boxer.style);
    this.iq = clamp(opts.iq ?? (0.3 + (actor.a.mental + actor.a.technique) / 280 + (actor.boxer.experience || 0) / 300), 0.15, 1);
    this.difficulty = opts.difficulty ?? 1; // 0.6 facile … 1.4 légende
    this.instruction = opts.instruction || 'none';
    this.model = new HabitModel(opts.memory);
    this.mode = 'base';
    this.modeT = 0;
    this.decideT = 0;
    this.reactPending = null;
    this.reactedTo = null;
    this.plan = [];
    this.lat = chance(0.5) ? 1 : -1;
    this.latT = 0;
    this.guardHold = 0;
    this.blockMode = null;
    this.log = [];
    this.lastModeReason = '';
    this.engine = null;
  }

  attach(engine) {
    this.engine = engine;
    engine.on((ev) => this.onEvent(ev));
  }

  onEvent(ev) {
    const me = this.me.side, opp = 1 - me;
    if (ev.type === 'punch' && ev.who === opp) this.model.observePunch(ev.punch, ev.target, ev.t);
    if (ev.type === 'hit' && ev.who === opp) {
      // Notre coup a touché : quelle était la défense adverse ?
      const o = this.engine.actors[opp];
      this.model.observeDefense(ev.blocked ? (o.block === 'body' ? 'body' : 'high') : 'none');
      if (o.action && o.action.kind === 'punch') this.model.observeOpenness(true);
    }
    if (ev.type === 'evade' && ev.who === opp) this.model.observeDefense(ev.how === 'shoulder' ? 'high' : ev.how);
  }

  params() {
    const p = { ...this.style.ai, jabBias: 0 };
    const add = (m) => { if (!m) return; for (const k in m) p[k] = (p[k] || 0) + m[k]; };
    add(MODES[this.mode]);
    add(INSTRUCTIONS[this.instruction]?.mod);
    for (const k in p) p[k] = clamp(p[k], 0, 1.6);
    return p;
  }

  onFeint(by) {
    // Réaction à une feinte : un boxeur peu expérimenté mord.
    const bite = clamp(0.65 - this.iq * 0.45 - this.me.a.mental * 0.002, 0.05, 0.7);
    if (chance(bite) && !this.me.action) {
      if (chance(0.5)) this.cmd({ block: 'high' }); else this.cmd({ slip: chance(0.5) ? 'left' : 'right' });
      by.opening = 0.55;
    }
  }

  cmd(c) {
    const mv = this.moveCmd || { f: 0, l: 0 };
    this.engine.command(this.me, { move: mv, block: this.blockMode, ...c });
  }

  thinkDown(dt) {
    // Volonté de se relever : mental, cœur, dégâts.
    const will = 6 + this.me.a.mental * 0.12 + (this.me.boxer.condition?.confidence || 50) * 0.03;
    const dmgF = 0.4 + this.me.headHP / 160;
    this.me.getUp += will * dmgF * dt * (0.7 + rand() * 0.6);
  }

  strategic(eng) {
    const me = this.me, o = eng.other(me);
    const kdTh = 100 * (0.5 + me.a.chin * 0.0048) * (0.45 + me.headHP / 180);
    const hurt = me.state === 'stun' || me.daze > kdTh * 0.45;
    const oppHurt = o.state === 'stun' || o.daze > 40 || o.headHP < 35;
    // Score estimé (perception approximative de l'IA).
    let myPts = 0, opPts = 0;
    for (const r of eng.roundSummaries) {
      const mine = me.side === 0 ? r.a : r.b, his = me.side === 0 ? r.b : r.a;
      const d = (mine.landed + mine.powerLanded + mine.knockdowns * 8) - (his.landed + his.powerLanded + his.knockdowns * 8);
      if (d > 2) myPts++; else if (d < -2) opPts++;
    }
    const roundsLeft = eng.rounds - eng.round;
    const late = roundsLeft <= Math.max(1, Math.floor(eng.rounds / 4));
    const losingThisRound = (me.roundStats.landed - o.roundStats.landed) < -4;
    let mode = 'base', why = 'Suit son plan de combat';
    if (hurt) { mode = 'survive'; why = 'Touché, il cherche à survivre'; }
    else if (oppHurt && chance(0.5 + this.iq * 0.5)) { mode = 'finish'; why = 'Sent son adversaire en difficulté, il accélère'; }
    else if (late && opPts > myPts) { mode = 'allout'; why = 'Mené aux points, il cherche le KO'; }
    else if (late && myPts > opPts + 1 && this.iq > 0.4) { mode = this.style.ai.mobility > 0.4 ? 'outbox' : 'defend'; why = 'Il mène et joue la sécurité'; }
    else if ((opPts > myPts || losingThisRound) && chance(this.iq)) {
      // Adaptation : change d'approche.
      const opts = ['pressure', 'outbox', 'counter'].filter((m) => m !== this.mode);
      if (this.model.jabRate() > 0.45) opts.push('pressure');
      if (this.model.hookRate() > 0.35) opts.push('counter');
      mode = pick(opts); why = 'Il change de stratégie (' + MODE_NAMES[mode] + ')';
    }
    if (me.stamina < me.staminaMax * 0.18 && mode !== 'finish' && mode !== 'allout') { mode = 'defend'; why = 'À bout de souffle, il gère'; }
    if (mode !== this.mode) {
      this.mode = mode; this.lastModeReason = why;
      eng.emit('aiMode', { who: me.side, mode, why });
    }
  }

  think(dt, eng) {
    const me = this.me, o = eng.other(me);
    if (!this.engine) this.attach(eng);
    if (!me.alive) return;
    this.modeT -= dt;
    if (this.modeT <= 0) { this.modeT = 2.5 - this.iq; this.strategic(eng); }
    const p = this.params();
    const d = eng.dist();
    const myReach = me.reachM;

    // ---------------- Défense réactive : lire le coup adverse.
    const oa = o.action;
    if (oa && oa.kind === 'punch' && this.reactedTo !== oa) {
      this.reactedTo = oa;
      const reaction = clamp(0.33 - me.a.reflexes * 0.0026, 0.07, 0.33) / this.difficulty;
      const pred = this.model.predict(eng.time);
      const read = pred[oa.type] > 0.4 ? 0.15 * this.iq : 0; // anticipation des habitudes
      const quality = clamp((p.defense * 0.45 + me.a.reflexes / 260 + me.a.evasion / 400 + read) * this.difficulty * (me.state === 'stun' ? 0.3 : 1) * me.stamF, 0, 0.92);
      this.reactPending = { ac: oa, at: eng.time + reaction - read * 0.3, quality };
    }
    if (this.reactPending && eng.time >= this.reactPending.at) {
      const rp = this.reactPending; this.reactPending = null;
      if (o.action === rp.ac && rp.ac.t < rp.ac.startup && chance(rp.quality) && (!me.action || me.action.kind === 'punch' && me.punchPhase() === 'recovery')) {
        const P = PUNCHES[rp.ac.type];
        const inRange = d < o.reachM * P.reach + 0.1;
        if (inRange) {
          if (rp.ac.target === 'body') { this.blockMode = 'body'; this.guardHold = 0.5; this.cmd({}); }
          else if (P.kind === 'straight') {
            if (chance(p.slipPref)) this.cmd({ slip: chance(0.5) ? 'left' : 'right' });
            else if (chance(0.3 + p.mobility * 0.3)) this.cmd({ back: true });
            else { this.blockMode = 'high'; this.guardHold = 0.45; this.cmd({}); }
          } else if (P.kind === 'hook') {
            if (chance(p.slipPref * 0.8)) this.cmd({ duck: true });
            else { this.blockMode = 'high'; this.guardHold = 0.45; this.cmd({}); }
          } else {
            if (chance(0.5)) this.cmd({ back: true }); else { this.blockMode = 'high'; this.guardHold = 0.45; this.cmd({}); }
          }
          return;
        }
      }
    }

    this.decideT -= dt;
    this.guardHold -= dt;
    if (this.guardHold <= 0 && this.blockMode) this.blockMode = null;
    if (this.decideT > 0) { this.engine.command(me, { move: this.moveCmd || { f: 0, l: 0 }, block: this.blockMode }); return; }
    this.decideT = clamp(0.22 - this.iq * 0.1, 0.08, 0.22) / this.difficulty;

    // ---------------- Déplacements.
    const desired = 0.72 + p.range * 0.62;
    let f = clamp((d - desired) * 2.2, -1, 1);
    if (p.aggression > 0.7 && d > desired) f = 1;
    this.latT -= this.decideT;
    if (this.latT <= 0) { this.latT = 0.8 + rand() * 2; if (chance(0.5)) this.lat *= -1; }
    let l = this.lat * p.mobility * 0.9;
    const ropes = eng.onRopes(me);
    if (ropes) {
      // Sortir des cordes : se décaler vers le centre.
      const cx = -me.x, cz = -me.z;
      const fx = Math.cos(me.face), fz = Math.sin(me.face);
      const latDot = -fz * cx + fx * cz;
      l = latDot > 0 ? 1 : -1;
      if (f < 0) f *= 0.3;
      if (me.tech.has('pivot') && chance(0.12 * this.iq) && d < 1.1) { this.cmd({ pivot: l > 0 ? 'left' : 'right' }); return; }
    }
    // Pressure : couper le ring (suivre le déplacement latéral adverse).
    if (p.aggression > 0.8 && eng.onRopes(o)) l *= 0.2;
    me.pressing = p.aggression > 0.7;
    // Entrée en esquive (bob & weave) pour les boxeurs de corps à corps.
    if (p.range < 0.4 && p.aggression > 0.6 && d > desired + 0.12 && d < myReach + 0.35 && !me.action && chance(0.1 * p.slipPref * this.difficulty)) {
      this.moveCmd = { f: 1, l: l * 0.3 };
      this.cmd({ slip: chance(0.5) ? 'left' : 'right' });
      return;
    }
    this.moveCmd = { f, l };

    // ---------------- Clinch quand en difficulté.
    if (d < 0.95 && (me.state === 'stun' || me.daze > 45 || me.stamina < me.staminaMax * 0.15) && chance(0.15 + p.clinch * 0.5)) {
      this.cmd({ clinch: true }); return;
    }

    if (me.state === 'stun') { this.blockMode = 'high'; this.guardHold = 0.3; this.cmd({}); return; }

    // ---------------- Contre immédiat.
    const oppRecovering = o.action && o.action.kind === 'punch' && o.punchPhase() === 'recovery';
    if ((me.counterWindow > 0 || (oppRecovering && o.action.whiff)) && d < myReach * 1.02 && chance(0.35 + p.counter * 0.6)) {
      const t = d < myReach * 0.58 ? weightedPick([['lhook', 1], ['rupper', 0.8], ['rhook', 0.7]]) : d < myReach * 0.74 ? weightedPick([['lhook', 1], ['rhook', 0.8], ['cross', 0.6]]) : weightedPick([['cross', 1.5], ['jab', 0.4]]);
      this.plan = chance(0.5) ? [t, t === 'cross' ? 'lhook' : 'cross'] : [t];
      this.firePlan(eng);
      return;
    }

    // Poursuivre une combinaison en cours.
    if (this.plan.length && (!me.action || (me.action.kind === 'punch' && me.punchPhase() === 'recovery'))) { this.firePlan(eng); return; }

    // ---------------- Attaque.
    const inRange = d < myReach * 1.0;
    const stamOk = me.stamina > me.staminaMax * (p.workrate > 1 ? 0.05 : 0.22);
    if (inRange && !me.action && stamOk) {
      let pAtk = (0.12 + p.workrate * 0.32) * (0.6 + p.aggression * 0.6) * me.stamF * this.difficulty;
      if (p.counter > 0.7 && !oppRecovering) pAtk *= 0.55;
      if (o.state === 'stun') pAtk *= 2;
      if (chance(pAtk)) { this.choosePlan(eng, p, d); this.firePlan(eng); return; }
      // Feinte.
      if (me.tech.has('feint') && chance(p.feint * 0.08)) { this.cmd({ feint: 'jab' }); return; }
      // Esquive anticipée : le joueur est prévisible (rythme + coup favori).
      const pred = this.model.predict(eng.time);
      const since = eng.time - this.model.lastT;
      if (pred.jab > 0.45 && Math.abs(since - this.model.avgInterval()) < 0.25 && chance(this.iq * 0.35 * this.difficulty)) {
        this.cmd({ slip: chance(0.5) ? 'left' : 'right' }); return;
      }
    }
    // Garde.
    if (!me.action && d < o.reachM + 0.2) {
      const holdP = Math.max(p.defense * 0.5 * (1 - p.aggression * 0.4), this.style.highGuard || 0);
      if (chance(holdP)) {
        this.blockMode = this.model.bodyShots > this.model.headShots * 0.7 && chance(0.4) ? 'body' : 'high';
        this.guardHold = 0.3 + rand() * 0.5;
      }
    }
    this.engine.command(me, { move: this.moveCmd, block: this.blockMode });
  }

  choosePlan(eng, p, d) {
    const me = this.me, o = eng.other(me);
    const myReach = me.reachM;
    // Poids des coups : style × distance × exploitation des habitudes adverses.
    const w = {};
    PUNCH_KEYS.forEach((k, i) => { w[k] = this.style.mix[i]; });
    w.jab *= 1 + p.jabBias;
    for (const k of PUNCH_KEYS) {
      const P = PUNCHES[k];
      if (d > myReach * P.reach) w[k] *= 0.08;
      if (P.kind !== 'straight' && d < myReach * 0.7) w[k] *= 1.3;
      if (k !== 'jab') w[k] *= 0.7 + p.power * 0.6;
    }
    const blockHigh = this.model.rate('high'), duckR = this.model.rate('duck'), slipR = this.model.rate('slip');
    if (duckR > 0.18) { w.lupper *= 1.8; w.rupper *= 1.8; }
    if (slipR > 0.2) { w.lhook *= 1.5; w.rhook *= 1.4; }
    if (blockHigh > 0.35) { w.lupper *= 1.4; w.rupper *= 1.4; }
    if (o.block === 'high') { w.lupper *= 1.5; w.rupper *= 1.5; }
    let bodyP = p.bodyWork * 0.6 + (blockHigh > 0.35 ? 0.2 : 0) + (o.block === 'high' ? 0.3 : 0) + (o.bodyHP < 50 ? 0.15 : 0);
    if (o.block === 'body') bodyP *= 0.2;
    // Combinaison favorite ?
    const maxChain = me.tech.has('combo4') ? 6 : me.tech.has('combo3') ? 3 : 2;
    let plan;
    const usable = this.style.combos.filter((c) => d <= myReach * PUNCHES[c[0]].reach + 0.05);
    if (usable.length && chance(0.35 + this.iq * 0.3)) {
      plan = pick(usable).slice(0, maxChain);
    } else {
      plan = [weightedPick(PUNCH_KEYS.map((k) => [k, w[k]]))];
      if (chance(p.workrate * 0.5) && maxChain > 1) plan.push(weightedPick(PUNCH_KEYS.filter((k) => PUNCHES[k].hand !== PUNCHES[plan[0]].hand).map((k) => [k, w[k]])));
    }
    if (o.state === 'stun') plan = ['rhook', 'lhook', 'rupper', 'cross'].slice(0, Math.max(2, maxChain));
    this.plan = plan.map((t) => ({ type: t, target: chance(bodyP) && t !== 'jab' ? 'body' : (t === 'jab' && chance(bodyP * 0.3) ? 'body' : 'head') }));
  }

  firePlan(eng) {
    const next = this.plan.shift();
    if (!next) return;
    const n = typeof next === 'string' ? { type: next, target: 'head' } : { ...next };
    // Ne pas gaspiller un coup hors de portée : adapter ou abandonner la combinaison.
    const d = eng.dist(), R = this.me.reachM;
    if (d > R * PUNCHES[n.type].reach + 0.04) {
      if (d <= R * PUNCHES.cross.reach + 0.02) n.type = PUNCHES[n.type].hand === 'lead' ? 'jab' : 'cross';
      else { this.plan = []; return; }
    }
    this.blockMode = null;
    this.engine.command(this.me, { move: this.moveCmd || { f: 0, l: 0 }, punch: n });
  }
}

// Contrôleur humain : traduit l'état des entrées en commandes moteur.
export class HumanController {
  constructor(actor, input) {
    this.me = actor; actor.ctrl = this; this.input = input; this.engine = null;
  }
  think(dt, eng) {
    this.engine = eng;
    const i = this.input;
    const c = { move: i.moveFor ? i.moveFor(this.me) : { f: i.axisF(), l: i.axisL() }, block: i.held('blockBody') ? 'body' : i.held('block') ? 'high' : null };
    const pr = i.consumePunch();
    if (pr) c.punch = pr;
    const def = i.consumeAction();
    if (def) Object.assign(c, def);
    eng.command(this.me, c);
  }
  thinkDown(dt, eng) {
    const presses = this.input.consumeMash();
    if (presses) eng.command(this.me, { getUp: presses * (1.4 + this.me.a.mental * 0.012) * (0.5 + this.me.headHP / 200) });
  }
}
