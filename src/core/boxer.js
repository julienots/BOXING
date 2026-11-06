// Modèle de boxeur : attributs, condition physique, apparence, équipement, techniques.
import { clamp, rand, randRange, randInt, pick, gauss, uid } from './util.js';
import { classForWeight, getClass } from '../data/weightClasses.js';

export const ATTRS = [
  ['strength', 'Force'],
  ['power', 'Puissance'],
  ['speed', 'Vitesse'],
  ['reflexes', 'Réflexes'],
  ['endurance', 'Endurance'],
  ['cardio', 'Cardio'],
  ['accuracy', 'Précision'],
  ['evasion', 'Esquive'],
  ['blocking', 'Blocage'],
  ['footwork', 'Déplacements'],
  ['technique', 'Technique'],
  ['chin', 'Résistance aux coups'],
  ['mental', 'Mental'],
  ['recovery', 'Récupération'],
];
export const ATTR_KEYS = ATTRS.map((a) => a[0]);
export const ATTR_NAME = Object.fromEntries(ATTRS);

// Attributs "physiques" qui déclinent avec l'âge, et "acquis" qui déclinent peu.
const PHYSICAL = ['speed', 'reflexes', 'endurance', 'cardio', 'recovery', 'chin'];

// Techniques débloquables : effets réels dans le moteur de combat.
export const TECHNIQUES = {
  combo3:     { name: 'Combinaisons à 3 coups', desc: 'Enchaîner 3 coups sans perte de vitesse.', level: 2, req: { technique: 30 }, learn: 3 },
  feint:      { name: 'Feintes', desc: 'Débloque la feinte (F) pour ouvrir la garde adverse.', level: 3, req: { technique: 35, mental: 30 }, learn: 4 },
  pivot:      { name: 'Pivot', desc: 'Débloque le pivot (R) pour sortir des cordes.', level: 4, req: { footwork: 40 }, learn: 4 },
  clinchPro:  { name: 'Clinch maîtrisé', desc: 'Clinch plus efficace : récupère de l\'endurance, neutralise les coups.', level: 4, req: { strength: 35, technique: 35 }, learn: 3 },
  counterPro: { name: 'Contre parfait', desc: 'Fenêtre de contre élargie et dégâts de contre accrus.', level: 6, req: { reflexes: 50, accuracy: 45 }, learn: 6 },
  combo4:     { name: 'Combinaisons à 4+ coups', desc: 'Enchaînements longs fluides.', level: 7, req: { technique: 55, endurance: 45 }, learn: 6 },
  liver:      { name: 'Crochet au foie', desc: 'Crochet gauche au corps pouvant provoquer un KO différé.', level: 7, req: { power: 50, accuracy: 50 }, learn: 5 },
  shoulder:   { name: 'Roulé d\'épaule', desc: 'Le blocage haut dévie aussi les directs (Philly shell).', level: 9, req: { blocking: 60, reflexes: 55 }, learn: 7 },
  weave:      { name: 'Rotation peek-a-boo', desc: 'Les esquives chargent un contre explosif.', level: 10, req: { evasion: 60, power: 55 }, learn: 7 },
  finisher:   { name: 'Instinct de finisseur', desc: 'Dégâts accrus contre un adversaire sonné.', level: 12, req: { power: 65, mental: 60 }, learn: 8 },
};

export const HAIR_STYLES = ['rase', 'court', 'degrade', 'afro', 'tresses', 'iroquoise', 'chauve', 'boucles', 'queue'];
export const HAIR_NAMES = { rase: 'Rasé', court: 'Court', degrade: 'Dégradé', afro: 'Afro', tresses: 'Tresses', iroquoise: 'Iroquoise', chauve: 'Chauve', boucles: 'Boucles', queue: 'Chignon' };
export const BEARD_STYLES = ['aucune', 'barbe3j', 'bouc', 'moustache', 'pleine', 'collier'];
export const BEARD_NAMES = { aucune: 'Aucune', barbe3j: 'Barbe de 3 jours', bouc: 'Bouc', moustache: 'Moustache', pleine: 'Barbe pleine', collier: 'Collier' };
export const SCAR_ZONES = { sourcil_g: 'Sourcil gauche', sourcil_d: 'Sourcil droit', joue: 'Joue', nez: 'Arête du nez', torse: 'Torse', levre: 'Lèvre' };
export const TATTOO_ZONES = { bras_g: 'Bras gauche', bras_d: 'Bras droit', torse: 'Torse', dos: 'Dos', avantbras_g: 'Avant-bras gauche', avantbras_d: 'Avant-bras droit' };
export const TATTOO_DESIGNS = { tribal: 'Tribal', etoile: 'Étoile', couronne: 'Couronne', texte: 'Lettrage', vagues: 'Vagues', croix: 'Croix', lion: 'Lion stylisé', roses: 'Roses' };
export const SKIN_TONES = ['#f3d2b8', '#e8b896', '#d9a27a', '#c68a5f', '#a86e48', '#8a5636', '#6b3f26', '#4e2c1b', '#3a2016'];

export function defaultAppearance() {
  return {
    skin: '#c68a5f', height: 178, muscle: 0.25, shoulders: 0.45, arms: 0.4, reach: 0.5, chest: 0.4, legs: 0.45, belly: 0.35,
    face: { jaw: 0.5, chin: 0.5, nose: 0.5, noseWidth: 0.5, noseBroken: 0, eyes: 0.5, eyeColor: '#3b2a1e', brow: 0.5, cheek: 0.5, ears: 0.5, lips: 0.5 },
    hair: 'court', hairColor: '#1b1410', beard: 'barbe3j', beardColor: '#1b1410',
    scars: [], tattoos: [],
  };
}

export function defaultOutfit(name = 'Tenue principale') {
  return {
    name,
    gloves: '#b3121b', glovesAccent: '#f2f2f2', shorts: '#b3121b', shortsTrim: '#f5c542',
    shoes: '#141414', socks: '#f2f2f2', wraps: '#f2f2f2', mouthguard: '#1d4ed8',
    robe: '#b3121b', robeTrim: '#f5c542', headgear: '#b3121b',
  };
}

export function naturalWeightFor(app, strength = 30) {
  const h = app.height / 100;
  const bmi = 20.3 + app.muscle * 3.2 + strength * 0.022 + app.belly * 2.4 + app.shoulders * 0.9 + app.legs * 0.6;
  return Math.round(bmi * h * h * 10) / 10;
}

export function reachFor(app) {
  return Math.round(app.height * (0.97 + app.reach * 0.1));
}

// Musculature visible : dépend de la base morphologique ET de la force réelle acquise.
export function visualMuscle(b) {
  return clamp(b.appearance.muscle * 0.55 + (b.attrs.strength / 100) * 0.55 - b.condition.fatigue * 0.0008, 0, 1);
}

export function overall(b) {
  const a = b.attrs;
  const v = a.strength * 0.05 + a.power * 0.1 + a.speed * 0.09 + a.reflexes * 0.08 + a.endurance * 0.08 + a.cardio * 0.06 +
    a.accuracy * 0.09 + a.evasion * 0.07 + a.blocking * 0.06 + a.footwork * 0.06 + a.technique * 0.09 + a.chin * 0.08 +
    a.mental * 0.06 + a.recovery * 0.03;
  return Math.round(v);
}

export function levelFromXp(xp) {
  // Courbe longue : niveau 2 = 100 xp, niveau 10 ≈ 6 000 xp, niveau 20 ≈ 30 000 xp.
  let lvl = 1, need = 100, acc = 0;
  while (xp >= acc + need && lvl < 40) { acc += need; lvl++; need = Math.round(need * 1.22); }
  return { level: lvl, into: xp - acc, need };
}

export function ageYears(b, day) { return b.birthAge + (day - b.startDay) / 365; }

export function createBoxer(opts = {}) {
  const app = opts.appearance || defaultAppearance();
  const isPlayer = !!opts.isPlayer;
  const base = opts.base != null ? opts.base : (isPlayer ? 14 : 50);
  const spread = opts.spread != null ? opts.spread : (isPlayer ? 6 : 10);
  const attrs = {};
  for (const k of ATTR_KEYS) attrs[k] = clamp(Math.round(base + gauss(0, spread)), 5, 99);
  if (opts.attrs) Object.assign(attrs, opts.attrs);
  // Potentiel (plafonds cachés) : le talent brut du boxeur.
  const talent = opts.talent != null ? opts.talent : (isPlayer ? 0.9 : randRange(0.5, 0.95));
  const potential = {};
  for (const k of ATTR_KEYS) potential[k] = clamp(Math.round(55 + talent * 40 + gauss(0, 5)), 45, 100);
  if (opts.potential) Object.assign(potential, opts.potential);
  const b = {
    id: opts.id || uid('bx'),
    firstName: opts.firstName || 'Sam',
    lastName: opts.lastName || 'Moreau',
    nickname: opts.nickname || '',
    nationality: opts.nationality || 'France',
    flag: opts.flag || 'FR',
    birthAge: opts.age || 19,
    startDay: opts.startDay || 0,
    stance: opts.stance || 'orthodox',
    style: opts.style || 'allround',
    isPlayer,
    attrs, potential, talent,
    xp: 0,
    techniques: opts.techniques || [],
    learning: {},
    condition: { fatigue: 10, morale: 60, confidence: isPlayer ? 30 : 60, motivation: 70, form: 40, health: 100 },
    injuries: [],
    weight: 0, naturalWeight: 0, weightClass: opts.weightClass || 'welter', diet: 'maintain',
    record: { w: 0, l: 0, d: 0, ko: 0, amW: 0, amL: 0, amD: 0, koLosses: 0 },
    history: [],
    appearance: app,
    outfits: opts.outfits || [defaultOutfit()],
    outfit: 0,
    reputation: opts.reputation || 0,
    damage: { head: 0, brain: 0 }, // dégâts chroniques (carrière)
  };
  b.naturalWeight = naturalWeightFor(app, attrs.strength);
  b.weight = opts.weight || b.naturalWeight;
  b.reach = reachFor(app);
  return b;
}

export function fullName(b) {
  return b.nickname ? `${b.firstName} « ${b.nickname} » ${b.lastName}` : `${b.firstName} ${b.lastName}`;
}
export function shortName(b) { return `${b.firstName[0]}. ${b.lastName}`; }
export function recordStr(b) { return `${b.record.w}-${b.record.l}-${b.record.d}`; }

export function hasTech(b, t) { return b.techniques.includes(t); }

// Pénalités dues aux blessures en cours (par attribut, multiplicateur).
export function injuryPenalty(b) {
  const pen = {};
  for (const inj of b.injuries) {
    for (const k of inj.affects) pen[k] = (pen[k] || 1) * (1 - inj.severity * 0.35);
  }
  return pen;
}

// Attributs effectifs pour un combat : condition, blessures, poids, moral, âge.
export function effectiveAttrs(b, ctx = {}) {
  const pen = injuryPenalty(b);
  const c = b.condition;
  const fatigueF = 1 - Math.max(0, c.fatigue - 25) * 0.005;
  const formF = 0.92 + c.form * 0.0012;
  const confF = 0.96 + c.confidence * 0.0006;
  const drain = ctx.drain || 0; // part de poids perdue sous le poids naturel
  const drainF = drain > 0.06 ? 1 - (drain - 0.06) * 3.5 : 1;
  const out = {};
  for (const k of ATTR_KEYS) {
    let v = b.attrs[k] * fatigueF * formF * (pen[k] || 1);
    if (k === 'mental') v *= confF;
    if (k === 'endurance' || k === 'chin' || k === 'cardio') v *= drainF;
    out[k] = clamp(v, 1, 110);
  }
  return out;
}

export function weightClassOf(b) { return getClass(b.weightClass); }
export function naturalClass(b) { return classForWeight(b.naturalWeight * 0.95); }

// Génère une apparence aléatoire crédible (adversaires, PNJ).
export function randomAppearance(heightCm) {
  const a = defaultAppearance();
  a.skin = pick(SKIN_TONES);
  a.height = heightCm || randInt(165, 195);
  a.muscle = randRange(0.35, 0.95);
  a.shoulders = randRange(0.3, 0.9);
  a.arms = randRange(0.3, 0.9);
  a.reach = randRange(0.2, 0.9);
  a.chest = randRange(0.3, 0.9);
  a.legs = randRange(0.3, 0.85);
  a.belly = randRange(0.0, 0.45);
  for (const k of Object.keys(a.face)) if (typeof a.face[k] === 'number') a.face[k] = randRange(0.1, 0.9);
  a.face.noseBroken = rand() < 0.4 ? randRange(0.2, 0.9) : 0;
  a.face.eyeColor = pick(['#3b2a1e', '#2a1b12', '#4a6b8a', '#3e6b45', '#6b4e2a']);
  a.hair = pick(HAIR_STYLES);
  const dark = a.skin < '#a' ? true : rand() < 0.7;
  a.hairColor = pick(dark ? ['#111', '#1b1410', '#2b1d14'] : ['#111', '#3b2a1e', '#6b4a2a', '#a8763e', '#d9b56b', '#7a2a12']);
  a.beard = pick(BEARD_STYLES);
  a.beardColor = a.hairColor;
  if (rand() < 0.4) a.scars.push(pick(Object.keys(SCAR_ZONES)));
  if (rand() < 0.45) a.tattoos.push({ zone: pick(Object.keys(TATTOO_ZONES)), design: pick(Object.keys(TATTOO_DESIGNS)) });
  if (rand() < 0.2) a.tattoos.push({ zone: pick(Object.keys(TATTOO_ZONES)), design: pick(Object.keys(TATTOO_DESIGNS)) });
  return a;
}

export function randomOutfit() {
  const cols = ['#b3121b', '#0f3d91', '#111111', '#f2f2f2', '#0e7a3a', '#f5c542', '#6a1b9a', '#d35400', '#00838f', '#7b1e1e', '#c0c0c0'];
  const o = defaultOutfit();
  o.gloves = pick(cols); o.glovesAccent = pick(cols); o.shorts = pick(cols); o.shortsTrim = pick(cols);
  o.shoes = pick(['#141414', '#f2f2f2', o.shorts]); o.robe = o.shorts; o.robeTrim = o.shortsTrim; o.mouthguard = pick(cols);
  return o;
}
