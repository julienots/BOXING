// Tests du cœur de simulation (sans rendu) : node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoxer, overall, ATTR_KEYS, defaultAppearance } from '../src/core/boxer.js';
import { newCareer, advanceDay, acceptOffer, applyFightResult, bookedOpponent, weighIn, playerRank, computeTier, buyEquipment, upgradeGym, hireStaff, negotiate } from '../src/core/career.js';
import { runSession, EXERCISES } from '../src/core/training.js';
import { weightClasses, DEFAULT_WEIGHT_CLASSES } from '../src/data/weightClasses.js';
import { simulateFight } from '../src/fight/setup.js';
import { FightEngine } from '../src/fight/engine.js';
import { AIController } from '../src/fight/ai.js';
import { resolveEvent, eventDef } from '../src/core/events.js';
import { saveGame, loadGame, exportSave, importSave } from '../src/core/save.js';
import { legendBoxer, LEGENDS } from '../src/data/legends.js';

function player() {
  return createBoxer({ isPlayer: true, firstName: 'Test', lastName: 'Boxer', weightClass: 'welter', appearance: { ...defaultAppearance(), height: 178 } });
}

test('17 catégories de poids avec limites exactes', () => {
  const w = weightClasses();
  assert.equal(w.length, 17);
  assert.equal(DEFAULT_WEIGHT_CLASSES.find((c) => c.id === 'welter').lb, 147);
  assert.equal(w.find((c) => c.id === 'welter').kg, 66.678);
  assert.equal(w.find((c) => c.id === 'cruiser').kg, 90.718);
  assert.equal(w.find((c) => c.id === 'heavy').kg, Infinity);
});

test('le boxeur du joueur commence mauvais', () => {
  const b = player();
  assert.ok(overall(b) < 25, 'overall=' + overall(b));
});

test('l\'entraînement augmente réellement les statistiques ciblées', () => {
  const s = newCareer({ boxer: player() });
  const before = s.boxer.attrs.power;
  for (let i = 0; i < 10; i++) { runSession(s, 'heavybag', 'normal'); s.boxer.condition.fatigue = 10; }
  assert.ok(s.boxer.attrs.power > before + 1, `power ${before} -> ${s.boxer.attrs.power}`);
});

test('le surentraînement fait monter la fatigue et réduit les gains', () => {
  const s = newCareer({ boxer: player() });
  s.boxer.condition.fatigue = 90;
  const b0 = s.boxer.attrs.power;
  const r = runSession(s, 'heavybag', 'intense');
  const tired = s.boxer.attrs.power - b0;
  s.boxer.condition.fatigue = 5;
  const b1 = s.boxer.attrs.power;
  runSession(s, 'heavybag', 'intense');
  const fresh = s.boxer.attrs.power - b1;
  assert.ok(fresh > tired * 1.8, `fresh ${fresh} tired ${tired}`);
  assert.ok(r.fatigueDelta > 0);
});

test('équipement manquant empêche l\'exercice', () => {
  const s = newCareer({ boxer: player() });
  const r = runSession(s, 'bench', 'normal');
  assert.ok(r.skipped);
});

test('combat IA vs IA se termine avec un résultat valide', () => {
  const a = createBoxer({ base: 55 }), b = createBoxer({ base: 55 });
  const { result } = simulateFight({ player: a, opp: b, rounds: 6 });
  assert.ok(['KO', 'TKO', 'UD', 'SD', 'MD', 'D', 'RTD'].includes(result.method));
  assert.ok(result.stats[0].thrown > 50);
});

test('un boxeur bien meilleur gagne presque toujours', () => {
  let wins = 0;
  for (let i = 0; i < 10; i++) {
    const { result } = simulateFight({ player: createBoxer({ base: 75, spread: 3 }), opp: createBoxer({ base: 35, spread: 3 }), rounds: 6 });
    if (result.winner === 0) wins++;
  }
  assert.ok(wins >= 9, 'wins=' + wins);
});

test('l\'IA apprend les habitudes : prédiction du jab', () => {
  const e = new FightEngine({ boxerA: createBoxer({ base: 50 }), boxerB: createBoxer({ base: 50 }), rounds: 1 });
  const ai = new AIController(e.b); ai.attach(e);
  for (let i = 0; i < 30; i++) e.emit('punch', { who: 0, punch: 'jab', target: 'head' });
  const p = ai.model.predict(e.time);
  assert.ok(p.jab > 0.6, 'jab prob ' + p.jab);
});

test('pesée : surpoids détecté, sauna réduit le poids', () => {
  const s = newCareer({ boxer: player() });
  acceptOffer(s, s.offers[0].id);
  s.boxer.weight = 68.2;
  const r = weighIn(s, 'sauna');
  assert.ok(r.final < 68.2);
  s.boxer.weight = 75;
  const r2 = weighIn(s, 'normal');
  assert.equal(r2.made, false);
});

test('gestion : achat équipement, agrandissement, staff', () => {
  const s = newCareer({ boxer: player() });
  s.money = 100000;
  assert.equal(buyEquipment(s, 'speedbag'), null);
  assert.equal(s.gym.equipment.speedbag, 1);
  assert.ok(buyEquipment(s, 'machines'));
  assert.equal(upgradeGym(s), null);
  assert.equal(s.gym.level, 2);
  const st = s.staffMarket[0];
  assert.equal(hireStaff(s, st.id), null);
  assert.equal(s.gym.staff.length, 1);
});

test('négociation : renvoie un résultat', () => {
  const s = newCareer({ boxer: player() });
  const r = negotiate(s, s.offers[0].id, 0.1);
  assert.ok(typeof r.ok === 'boolean');
});

test('sauvegarde / chargement / export', () => {
  const s = newCareer({ boxer: player() });
  s.money = 1234;
  assert.ok(saveGame(s, '1').ok);
  const l = loadGame('1');
  assert.equal(l.money, 1234);
  const imp = importSave(exportSave(s));
  assert.equal(imp.boxer.lastName, 'Boxer');
});

test('légendes : profils complets', () => {
  for (const L of LEGENDS) {
    const b = legendBoxer(L.id);
    assert.ok(overall(b) > 80, L.id + ' ' + overall(b));
  }
});

test('carrière longue : 4 ans de jeu sans crash avec progression', () => {
  const s = newCareer({ boxer: player() });
  s.money = 5000;
  const start = overall(s.boxer);
  let fights = 0, guard = 0;
  while (s.day < 365 * 4 && guard++ < 20000) {
    if (!s.booked && s.offers.length) {
      // Choisit l'offre la moins dangereuse.
      const o = s.offers.slice().sort((a, b) => a.danger - b.danger)[0];
      acceptOffer(s, o.id);
    }
    const out = advanceDay(s);
    for (const it of out.interrupts) {
      if (it.type === 'fight') {
        const opp = bookedOpponent(s);
        assert.ok(opp, 'adversaire introuvable');
        const w = s.booked.weigh || weighIn(s, 'sauna');
        const { result, memory } = simulateFight({ player: s.boxer, opp, rounds: s.booked.rounds, drain: w.drain, amateur: !s.boxer.pro, gym: s.gym });
        applyFightResult(s, null, result, { opp, memory });
        fights++;
        s.day++;
      } else if (it.type === 'press') { /* ignoré */ }
      else if (it.type === 'weighin') { weighIn(s, 'sauna'); }
      else if (it.type === 'event') { resolveEvent(s, it.event, 0); }
      else if (it.type === 'bankrupt') { s.money = 5000; }
      else if (it.type === 'forcedRetire') break;
    }
    if (s.boxer.weight > 66.5) s.boxer.diet = 'cut'; else s.boxer.diet = 'maintain';
  }
  const end = overall(s.boxer);
  assert.ok(fights >= 10, 'fights=' + fights);
  assert.ok(end > start + 25, `overall ${start} -> ${end}`);
  assert.ok(s.boxer.pro, 'devenu pro');
  console.log(`  4 ans : ${fights} combats, overall ${start} -> ${end}, record ${s.boxer.record.w}-${s.boxer.record.l}-${s.boxer.record.d} (am ${s.boxer.record.amW}-${s.boxer.record.amL}), rang ${playerRank(s)}, palier ${computeTier(s)}, argent ${Math.round(s.money)}`);
});
