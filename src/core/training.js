// Système d'entraînement : exercices, équipement, programmes hebdomadaires, fatigue, blessures.
import { clamp, chance, rand, randRange, pick, randInt } from './util.js';
import { ATTR_KEYS, TECHNIQUES, levelFromXp, naturalWeightFor, ageYears } from './boxer.js';

// Équipements du gymnase. level 0 = non possédé. Prix par niveau (1..3).
export const EQUIPMENT = {
  heavybag:   { name: 'Sac de frappe lourd', price: [0, 350, 1400, 5200], minGym: 1 },
  speedbag:   { name: 'Sac de vitesse (speed bag)', price: [0, 450, 1600, 5000], minGym: 1 },
  doubleend:  { name: 'Poire double élastique', price: [0, 300, 1200, 4200], minGym: 1 },
  ring:       { name: 'Ring d\'entraînement', price: [0, 2500, 9000, 30000], minGym: 2 },
  ropes:      { name: 'Cordes à sauter', price: [0, 40, 250, 900], minGym: 1 },
  dumbbells:  { name: 'Haltères', price: [0, 300, 1300, 4500], minGym: 1 },
  bench:      { name: 'Banc de musculation', price: [0, 400, 1600, 5500], minGym: 2 },
  machines:   { name: 'Machines de musculation', price: [0, 3500, 11000, 32000], minGym: 3 },
  battlerope: { name: 'Corde ondulatoire', price: [0, 250, 900, 3000], minGym: 2 },
  dummy:      { name: 'Mannequin de frappe', price: [0, 600, 2200, 7000], minGym: 2 },
  cardio:     { name: 'Zone cardio (tapis, vélo)', price: [0, 1200, 5000, 16000], minGym: 2 },
  mirror:     { name: 'Miroirs techniques', price: [0, 200, 900, 3200], minGym: 1 },
  recovery:   { name: 'Espace récupération (bain froid, sauna)', price: [0, 1800, 7000, 22000], minGym: 3 },
};

// Exercices. gains : points de base par séance (intensité normale, qualité 1).
// fatigue : coût en fatigue. risk : risque de blessure de base. zone : zone corporelle exposée.
export const EXERCISES = {
  shadow:    { name: 'Shadow boxing', eq: null, gains: { technique: 0.9, footwork: 0.6, accuracy: 0.3, speed: 0.2 }, fatigue: 7, risk: 0.002, xp: 6, anim: 'shadow', techLearn: 1 },
  heavybag:  { name: 'Sac lourd', eq: 'heavybag', gains: { power: 1.1, strength: 0.4, endurance: 0.4, accuracy: 0.2 }, fatigue: 14, risk: 0.008, zone: 'main', xp: 9, anim: 'heavybag' },
  speedbag:  { name: 'Sac de vitesse', eq: 'speedbag', gains: { speed: 1.0, accuracy: 0.4, reflexes: 0.3, endurance: 0.15 }, fatigue: 8, risk: 0.002, xp: 7, anim: 'speedbag' },
  doubleend: { name: 'Poire double élastique', eq: 'doubleend', gains: { reflexes: 1.0, accuracy: 0.6, evasion: 0.35, speed: 0.2 }, fatigue: 8, risk: 0.002, xp: 8, anim: 'doubleend' },
  mitts:     { name: 'Pattes d\'ours avec le coach', eq: 'ring', gains: { technique: 1.2, accuracy: 0.7, speed: 0.3, power: 0.3 }, fatigue: 11, risk: 0.004, xp: 11, anim: 'mitts', needsStaff: 'trainer', techLearn: 3 },
  sparring:  { name: 'Sparring', eq: 'ring', gains: { mental: 0.6, evasion: 0.5, blocking: 0.5, reflexes: 0.4, technique: 0.4, chin: 0.35, cardio: 0.3, footwork: 0.3 }, fatigue: 20, risk: 0.03, zone: 'tete', xp: 18, anim: 'sparring', needsStaff: 'sparring', sharp: 6, techLearn: 2 },
  defense:   { name: 'Exercices défensifs (corde de slip)', eq: 'ring', gains: { evasion: 1.0, blocking: 0.6, reflexes: 0.4, footwork: 0.3 }, fatigue: 9, risk: 0.003, xp: 9, anim: 'defense', techLearn: 1 },
  rope:      { name: 'Corde à sauter', eq: 'ropes', gains: { footwork: 0.8, cardio: 0.8, speed: 0.3, endurance: 0.3 }, fatigue: 10, risk: 0.004, zone: 'jambe', xp: 7, anim: 'rope' },
  dumbbells: { name: 'Haltères', eq: 'dumbbells', gains: { strength: 0.9, power: 0.4, endurance: 0.15 }, fatigue: 12, risk: 0.007, zone: 'epaule', xp: 7, anim: 'dumbbells' },
  bench:     { name: 'Développé couché', eq: 'bench', gains: { strength: 1.3, power: 0.45 }, fatigue: 14, risk: 0.009, zone: 'epaule', xp: 8, anim: 'bench', muscle: true },
  machines:  { name: 'Circuit machines', eq: 'machines', gains: { strength: 1.0, endurance: 0.5, chin: 0.25, power: 0.3 }, fatigue: 12, risk: 0.003, xp: 8, anim: 'machines', muscle: true },
  battlerope:{ name: 'Corde ondulatoire', eq: 'battlerope', gains: { endurance: 0.9, cardio: 0.6, power: 0.3, strength: 0.25 }, fatigue: 15, risk: 0.005, zone: 'epaule', xp: 8, anim: 'battlerope' },
  dummy:     { name: 'Mannequin (précision au corps)', eq: 'dummy', gains: { accuracy: 1.1, power: 0.4, technique: 0.4 }, fatigue: 10, risk: 0.004, zone: 'main', xp: 8, anim: 'dummy', techLearn: 1 },
  run:       { name: 'Footing / cardio', eq: null, gains: { cardio: 1.0, endurance: 0.8, recovery: 0.2 }, fatigue: 12, risk: 0.004, zone: 'jambe', xp: 6, anim: 'run' },
  cardio:    { name: 'Zone cardio (fractionné)', eq: 'cardio', gains: { cardio: 1.25, endurance: 1.0, recovery: 0.25 }, fatigue: 14, risk: 0.003, zone: 'jambe', xp: 8, anim: 'run' },
  neck:      { name: 'Renforcement cou & gainage', eq: null, gains: { chin: 0.7, strength: 0.25, endurance: 0.2 }, fatigue: 9, risk: 0.003, xp: 6, anim: 'core' },
  mirror:    { name: 'Travail technique au miroir', eq: 'mirror', gains: { technique: 1.1, blocking: 0.5, evasion: 0.35, footwork: 0.3 }, fatigue: 6, risk: 0.001, xp: 8, anim: 'shadow', techLearn: 2 },
  video:     { name: 'Analyse vidéo & tactique', eq: null, gains: { mental: 0.8, technique: 0.25 }, fatigue: 1, risk: 0, xp: 6, anim: 'rest', scout: true },
  meditation:{ name: 'Préparation mentale', eq: null, gains: { mental: 0.9, recovery: 0.2 }, fatigue: -3, risk: 0, xp: 4, anim: 'rest', moraleUp: 4 },
  active:    { name: 'Récupération active (étirements, natation)', eq: null, gains: { recovery: 0.6 }, fatigue: -14, risk: 0, xp: 2, anim: 'stretch', heal: 1 },
  massage:   { name: 'Séance de kiné', eq: null, gains: { recovery: 0.3 }, fatigue: -18, risk: 0, xp: 1, anim: 'rest', needsStaff: 'physio', heal: 2 },
  sauna:     { name: 'Bain froid & sauna', eq: 'recovery', gains: { recovery: 0.5 }, fatigue: -20, risk: 0, xp: 1, anim: 'rest', heal: 1.5 },
  rest:      { name: 'Repos', eq: null, gains: {}, fatigue: -25, risk: 0, xp: 0, anim: 'rest', heal: 1, rest: true },
};

export const INTENSITY = {
  light:  { name: 'Légère', gain: 0.55, fatigue: 0.55, risk: 0.4 },
  normal: { name: 'Normale', gain: 1.0, fatigue: 1.0, risk: 1.0 },
  intense:{ name: 'Intense', gain: 1.45, fatigue: 1.6, risk: 2.2 },
};

export const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export const SLOTS = ['Matin', 'Après-midi', 'Soir'];

// Programme d'exemple du cahier des charges (adapté au matériel initial).
export function defaultProgram() {
  return {
    name: 'Programme de base',
    days: [
      [{ ex: 'heavybag', int: 'normal' }, { ex: 'dumbbells', int: 'normal' }, null],
      [{ ex: 'shadow', int: 'normal' }, { ex: 'mirror', int: 'normal' }, null],
      [{ ex: 'run', int: 'normal' }, { ex: 'rope', int: 'normal' }, null],
      [{ ex: 'defense', int: 'normal' }, { ex: 'shadow', int: 'light' }, null],
      [{ ex: 'speedbag', int: 'normal' }, { ex: 'doubleend', int: 'normal' }, null],
      [{ ex: 'active', int: 'normal' }, null, null],
      [{ ex: 'rest', int: 'normal' }, null, null],
    ],
  };
}

export function programTemplates() {
  return [
    defaultProgram(),
    { name: 'Camp d\'entraînement (pré-combat)', days: [
      [{ ex: 'mitts', int: 'intense' }, { ex: 'heavybag', int: 'normal' }, { ex: 'neck', int: 'light' }],
      [{ ex: 'cardio', int: 'intense' }, { ex: 'defense', int: 'normal' }, null],
      [{ ex: 'sparring', int: 'normal' }, { ex: 'video', int: 'normal' }, null],
      [{ ex: 'run', int: 'normal' }, { ex: 'speedbag', int: 'normal' }, { ex: 'doubleend', int: 'normal' }],
      [{ ex: 'sparring', int: 'normal' }, { ex: 'massage', int: 'normal' }, null],
      [{ ex: 'active', int: 'normal' }, { ex: 'meditation', int: 'normal' }, null],
      [{ ex: 'rest', int: 'normal' }, null, null],
    ] },
    { name: 'Force & puissance', days: [
      [{ ex: 'bench', int: 'intense' }, { ex: 'heavybag', int: 'intense' }, null],
      [{ ex: 'dumbbells', int: 'normal' }, { ex: 'battlerope', int: 'normal' }, null],
      [{ ex: 'active', int: 'normal' }, null, null],
      [{ ex: 'machines', int: 'intense' }, { ex: 'heavybag', int: 'normal' }, null],
      [{ ex: 'neck', int: 'normal' }, { ex: 'dummy', int: 'normal' }, null],
      [{ ex: 'run', int: 'light' }, null, null],
      [{ ex: 'rest', int: 'normal' }, null, null],
    ] },
    { name: 'Vitesse & défense', days: [
      [{ ex: 'speedbag', int: 'intense' }, { ex: 'doubleend', int: 'normal' }, null],
      [{ ex: 'defense', int: 'intense' }, { ex: 'mirror', int: 'normal' }, null],
      [{ ex: 'rope', int: 'intense' }, { ex: 'shadow', int: 'normal' }, null],
      [{ ex: 'sparring', int: 'light' }, { ex: 'video', int: 'normal' }, null],
      [{ ex: 'doubleend', int: 'intense' }, { ex: 'defense', int: 'normal' }, null],
      [{ ex: 'active', int: 'normal' }, null, null],
      [{ ex: 'rest', int: 'normal' }, null, null],
    ] },
    { name: 'Récupération / semaine légère', days: [
      [{ ex: 'shadow', int: 'light' }, { ex: 'active', int: 'normal' }, null],
      [{ ex: 'rest', int: 'normal' }, null, null],
      [{ ex: 'run', int: 'light' }, { ex: 'massage', int: 'normal' }, null],
      [{ ex: 'mirror', int: 'light' }, { ex: 'meditation', int: 'normal' }, null],
      [{ ex: 'active', int: 'normal' }, null, null],
      [{ ex: 'rest', int: 'normal' }, null, null],
      [{ ex: 'rest', int: 'normal' }, null, null],
    ] },
  ];
}

const INJURY_TYPES = {
  main:   [{ name: 'Contusion de la main', affects: ['power', 'accuracy'], days: [5, 15] }, { name: 'Fracture du métacarpe', affects: ['power', 'accuracy', 'speed'], days: [30, 50], severe: true }],
  tete:   [{ name: 'Arcade ouverte', affects: ['chin', 'mental'], days: [10, 21] }, { name: 'Commotion légère', affects: ['chin', 'reflexes', 'mental'], days: [14, 30], severe: true }],
  epaule: [{ name: 'Tendinite de l\'épaule', affects: ['power', 'strength', 'speed'], days: [7, 20] }, { name: 'Déchirure musculaire', affects: ['strength', 'power'], days: [20, 40], severe: true }],
  jambe:  [{ name: 'Entorse de la cheville', affects: ['footwork', 'evasion'], days: [7, 21] }, { name: 'Élongation', affects: ['footwork', 'cardio'], days: [5, 12] }],
  dos:    [{ name: 'Lumbago', affects: ['strength', 'power', 'evasion'], days: [5, 14] }],
  cotes:  [{ name: 'Côte fêlée', affects: ['endurance', 'cardio', 'blocking'], days: [21, 35], severe: true }],
};

export function makeInjury(zone, severityHint = 0) {
  const list = INJURY_TYPES[zone] || INJURY_TYPES.dos;
  const t = (severityHint > 0.6 && list.find((x) => x.severe)) || pick(list.filter((x) => !x.severe || chance(0.25 + severityHint * 0.5)));
  const days = randInt(t.days[0], t.days[1]);
  return { name: t.name, zone, affects: t.affects, days, total: days, severity: clamp((t.severe ? 0.65 : 0.35) + randRange(-0.1, 0.15), 0.1, 0.9) };
}

// Multiplicateur lié à l'âge : jeunes progressent vite, déclin après 31 ans.
export function ageGainFactor(age) {
  if (age < 21) return 1.2;
  if (age < 27) return 1.1;
  if (age < 31) return 1.0;
  if (age < 34) return 0.75;
  if (age < 37) return 0.5;
  return 0.3;
}

// Bonus de staff et qualité équipement.
export function staffBonus(gym, role) {
  const s = (gym.staff || []).filter((x) => x.role === role);
  if (!s.length) return 0;
  return Math.max(...s.map((x) => x.level));
}

export function exerciseAvailable(gym, exId) {
  const ex = EXERCISES[exId];
  if (!ex) return { ok: false, why: 'Inconnu' };
  if (ex.eq && !(gym.equipment[ex.eq] > 0)) return { ok: false, why: 'Équipement requis : ' + EQUIPMENT[ex.eq].name };
  if (ex.needsStaff === 'physio' && !staffBonus(gym, 'physio')) return { ok: false, why: 'Nécessite un kiné' };
  if (ex.needsStaff === 'sparring' && !staffBonus(gym, 'sparring')) return { ok: false, why: 'Nécessite un partenaire de sparring' };
  return { ok: true };
}

// Exécute une séance. Retourne un rapport détaillé {gains, fatigue, injury, xp, msg}.
export function runSession(state, exId, intId = 'normal') {
  const b = state.boxer, gym = state.gym;
  const ex = EXERCISES[exId], it = INTENSITY[intId] || INTENSITY.normal;
  const report = { ex: exId, name: ex.name, gains: {}, fatigueDelta: 0, injury: null, xp: 0, notes: [] };
  const av = exerciseAvailable(gym, exId);
  if (!av.ok) { report.notes.push('Séance impossible : ' + av.why); report.skipped = true; return report; }

  const c = b.condition;
  const age = ageYears(b, state.day);
  const eqQ = ex.eq ? 0.85 + gym.equipment[ex.eq] * 0.15 : 1;
  const coachLvl = staffBonus(gym, 'trainer');
  const sncLvl = staffBonus(gym, 'strength');
  const isPhysical = ['strength', 'power', 'endurance', 'cardio'].some((k) => ex.gains[k]);
  const staffF = 1 + coachLvl * 0.06 + (isPhysical ? sncLvl * 0.06 : 0) + (state.coach?.skill || 0) * 0.01;
  const fatigueF = c.fatigue > 70 ? 0.35 : c.fatigue > 50 ? 0.7 : 1;
  const motivF = 0.6 + c.motivation * 0.006;
  const ageF = ageGainFactor(age);
  const intensityGain = it.gain;

  if (!ex.rest) {
    for (const [k, base] of Object.entries(ex.gains)) {
      const cur = b.attrs[k], cap = b.potential[k];
      // Rendement décroissant à l'approche du plafond.
      const room = Math.max(0, cap - cur) / cap;
      const diminishing = room * (cur < 30 ? 1.4 : 1);
      let g = base * 0.32 * intensityGain * eqQ * staffF * fatigueF * motivF * ageF * diminishing * randRange(0.8, 1.2);
      if (cur >= cap) g = 0;
      g = Math.max(0, g);
      b.attrs[k] = clamp(cur + g, 1, cap);
      if (g > 0.0005) report.gains[k] = g;
    }
  }
  if (ex.muscle && it !== INTENSITY.light) b.naturalWeight = Math.round((b.naturalWeight + 0.02) * 100) / 100;
  // Fatigue (la récupération et le confort réduisent la fatigue des séances).
  let fd = ex.fatigue * (ex.fatigue > 0 ? it.fatigue * (1.15 - b.attrs.recovery * 0.004) : 1 + b.attrs.recovery * 0.004 + staffBonus(gym, 'physio') * 0.08 + (gym.comfort || 0) * 0.04);
  if (ex.fatigue > 0 && age > 32) fd *= 1.15;
  c.fatigue = clamp(c.fatigue + fd, 0, 100);
  report.fatigueDelta = fd;
  if (ex.sharp) c.form = clamp(c.form + ex.sharp * it.gain, 0, 100);
  if (ex.moraleUp) c.morale = clamp(c.morale + ex.moraleUp, 0, 100);
  if (ex.heal) for (const inj of b.injuries) inj.days = Math.max(0, inj.days - ex.heal * (1 + staffBonus(gym, 'physio') * 0.25));
  if (ex.scout) state.scouting = clamp((state.scouting || 0) + 20 * it.gain, 0, 100);
  if (!ex.rest && ex.fatigue > 0) c.motivation = clamp(c.motivation - 0.6 * it.fatigue, 0, 100);

  // Risque de blessure : surentraînement.
  if (ex.risk > 0) {
    const fatigueRisk = 1 + Math.max(0, c.fatigue - 40) * 0.06;
    const physioF = 1 - staffBonus(gym, 'physio') * 0.1;
    const p = ex.risk * it.risk * fatigueRisk * physioF * (age > 32 ? 1.4 : 1);
    if (chance(p)) {
      const inj = makeInjury(ex.zone || 'dos', c.fatigue / 100);
      b.injuries.push(inj);
      report.injury = inj;
      c.morale = clamp(c.morale - 8, 0, 100);
    }
  }
  // Apprentissage de techniques.
  if (ex.techLearn && !ex.rest) learnTechniques(b, ex.techLearn * it.gain * (1 + coachLvl * 0.15), report);
  // Expérience.
  const xp = Math.round(ex.xp * it.gain * (fatigueF > 0.5 ? 1 : 0.5));
  addXp(b, xp, report);
  report.xp = xp;
  if (c.fatigue > 85) report.notes.push('⚠ Surentraînement : fatigue extrême, risque de blessure élevé.');
  return report;
}

export function addXp(b, xp, report) {
  const before = levelFromXp(b.xp).level;
  b.xp += xp;
  const after = levelFromXp(b.xp).level;
  if (after > before && report) report.levelUp = after;
}

export function techAvailable(b, id) {
  const t = TECHNIQUES[id];
  const lvl = levelFromXp(b.xp).level;
  if (lvl < t.level) return false;
  for (const [k, v] of Object.entries(t.req)) if (b.attrs[k] < v) return false;
  return true;
}

function learnTechniques(b, amount, report) {
  for (const id of Object.keys(TECHNIQUES)) {
    if (b.techniques.includes(id) || !techAvailable(b, id)) continue;
    b.learning[id] = (b.learning[id] || 0) + amount * 0.5;
    if (b.learning[id] >= TECHNIQUES[id].learn) {
      b.techniques.push(id);
      delete b.learning[id];
      (report.learned = report.learned || []).push(TECHNIQUES[id].name);
    }
    break; // une technique à la fois
  }
}

// Évolution quotidienne passive : récupération, blessures, poids, déclin, âge.
export function dailyUpkeep(state, trainedToday) {
  const b = state.boxer, gym = state.gym, c = b.condition;
  const age = ageYears(b, state.day);
  // Récupération nocturne.
  const rec = 6 + b.attrs.recovery * 0.08 + (gym.comfort || 0) * 1.2 + staffBonus(gym, 'physio') * 1.0;
  c.fatigue = clamp(c.fatigue - rec * (age > 33 ? 0.8 : 1), 0, 100);
  // Blessures.
  for (const inj of b.injuries) inj.days -= 1 + staffBonus(gym, 'physio') * 0.2;
  const healed = b.injuries.filter((i) => i.days <= 0);
  b.injuries = b.injuries.filter((i) => i.days > 0);
  // Forme (sharpness) : baisse sans entraînement.
  if (!trainedToday) c.form = clamp(c.form - 0.6, 0, 100);
  else c.form = clamp(c.form + 0.35, 0, 100);
  // Motivation remonte lentement avec le repos et le moral.
  c.motivation = clamp(c.motivation + (c.morale - 50) * 0.02 + (trainedToday ? 0 : 1.5), 0, 100);
  c.morale = clamp(c.morale + (60 - c.morale) * 0.02, 0, 100);
  // Poids : régime alimentaire.
  const nutri = staffBonus(gym, 'nutrition');
  const diets = { bulk: 0.07, maintain: 0, cut: -0.09 - nutri * 0.01, hardcut: -0.2 - nutri * 0.02 };
  let target = b.naturalWeight;
  const d = diets[b.diet] ?? 0;
  if (b.diet === 'maintain') b.weight += (target - b.weight) * 0.08;
  else b.weight += d + (target - b.weight) * 0.005;
  if (b.diet === 'hardcut') { c.fatigue = clamp(c.fatigue + 3 - nutri * 0.5, 0, 100); c.morale = clamp(c.morale - 0.6, 0, 100); }
  if (b.diet === 'bulk') b.naturalWeight += 0.01;
  b.weight = Math.round(b.weight * 100) / 100;
  // Déclin : désentraînement + âge.
  if (!trainedToday) {
    for (const k of ['cardio', 'endurance']) b.attrs[k] = Math.max(5, b.attrs[k] - 0.03);
  }
  if (age > 31) {
    const decl = (age - 31) * 0.004;
    for (const k of ['speed', 'reflexes', 'cardio', 'recovery', 'chin']) b.attrs[k] = Math.max(5, b.attrs[k] - decl);
  }
  // Dégâts cérébraux chroniques réduisent lentement le menton.
  if (b.damage.brain > 30) b.attrs.chin = Math.max(5, b.attrs.chin - (b.damage.brain - 30) * 0.0005);
  return { healed };
}

// Exécute une journée du programme hebdomadaire actif.
export function runDay(state) {
  const prog = state.programs[state.activeProgram] || state.programs[0];
  const dow = state.day % 7;
  const sessions = prog.days[dow] || [];
  const reports = [];
  let trained = false;
  const injured = state.boxer.injuries.some((i) => i.severity > 0.5);
  for (const s of sessions) {
    if (!s) continue;
    let exId = s.ex;
    if (injured && EXERCISES[exId].fatigue > 0) {
      reports.push({ ex: exId, name: EXERCISES[exId].name, skipped: true, gains: {}, notes: ['Annulé : blessure sérieuse (repos forcé)'] });
      exId = 'active';
    }
    const r = runSession(state, exId, s.int);
    reports.push(r);
    if (!r.skipped && EXERCISES[exId].fatigue > 0) trained = true;
  }
  const up = dailyUpkeep(state, trained);
  return { dow, reports, healed: up.healed };
}

export function programLoad(prog) {
  // Charge hebdomadaire estimée (fatigue nette) — aide à éviter le surentraînement.
  let load = 0;
  for (const d of prog.days) for (const s of d) if (s) load += EXERCISES[s.ex].fatigue * (EXERCISES[s.ex].fatigue > 0 ? INTENSITY[s.int].fatigue : 1);
  return Math.round(load);
}
