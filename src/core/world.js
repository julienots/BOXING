// Monde de la boxe : boxeurs PNJ par catégorie, classements, ceintures, combats simulés.
import { clamp, rand, randInt, randRange, pick, chance, gauss, uid } from './util.js';
import { createBoxer, randomAppearance, randomOutfit, overall, ATTR_KEYS } from './boxer.js';
import { randomName, NATIONS } from '../data/names.js';
import { classRange, getClass } from '../data/weightClasses.js';
import { CREATOR_STYLES } from '../data/styles.js';

// Organisations fictives (4 ceintures mondiales → champion incontesté).
export const BODIES = [
  { id: 'GBC', name: 'Global Boxing Council', color: '#2f9e44' },
  { id: 'WPBA', name: 'World Pro Boxing Association', color: '#1c3f94' },
  { id: 'IFB', name: 'International Federation of Boxing', color: '#c92a2a' },
  { id: 'UBO', name: 'Universal Boxing Organization', color: '#a07d1c' },
];

export const TITLES = {
  regional: { name: 'Ceinture régionale', rounds: 10, prestige: 1 },
  national: { name: 'Champion national', rounds: 10, prestige: 2 },
  continental: { name: 'Champion continental', rounds: 12, prestige: 3 },
};

// Génère un PNJ dont le niveau dépend du rang mondial (1 = meilleur).
export function makeNPC(classId, quality, opts = {}) {
  const nm = randomName(opts.nation);
  const { lo, hi } = classRange(classId);
  const fightW = randRange(lo + (hi - lo) * 0.55, hi);
  const height = Math.round(clamp(150 + (fightW - 47) * 0.62 + gauss(0, 5), 152, 205));
  const app = randomAppearance(height);
  const style = opts.style || pick(CREATOR_STYLES);
  const b = createBoxer({
    ...nm, base: quality, spread: 7, style, stance: chance(0.22) ? 'southpaw' : 'orthodox', weightClass: classId,
    appearance: app, outfits: [randomOutfit()], age: randInt(20, 34), talent: randRange(0.4, 1),
  });
  // Spécialisation : forces et faiblesses marquées selon le style.
  const strong = { aggressive: ['power', 'endurance'], counter: ['reflexes', 'accuracy'], defensive: ['blocking', 'evasion'], technician: ['technique', 'accuracy'], puncher: ['power', 'strength'], outboxer: ['footwork', 'speed'], pressure: ['cardio', 'chin'], peekaboo: ['evasion', 'power'], swarmer: ['strength', 'chin'], slick: ['evasion', 'reflexes'], allround: ['technique', 'mental'] }[style] || [];
  for (const k of strong) b.attrs[k] = clamp(b.attrs[k] + randRange(6, 14), 5, 99);
  const weak = pick(ATTR_KEYS.filter((k) => !strong.includes(k)));
  b.attrs[weak] = clamp(b.attrs[weak] - randRange(8, 16), 5, 99);
  b.weakness = weak; b.strengths = strong;
  b.age = b.birthAge;
  b.weight = Math.round(fightW * 10) / 10;
  b.naturalWeight = Math.round(fightW * 1.05 * 10) / 10;
  b.experience = clamp(quality * 0.8 + randRange(-10, 15), 0, 100);
  // Palmarès cohérent avec le niveau.
  const fights = Math.max(0, Math.round((quality - 25) * 0.55 + randInt(0, 10)));
  const winRate = clamp(0.35 + (quality - 30) / 90, 0.2, 0.97);
  let w = 0, l = 0, d = 0;
  for (let i = 0; i < fights; i++) { const r = rand(); if (r < winRate) w++; else if (r < winRate + 0.04) d++; else l++; }
  b.record = { w, l, d, ko: Math.round(w * clamp(b.attrs.power / 110, 0.2, 0.85)), amW: 0, amL: 0, amD: 0, koLosses: 0 };
  b.rating = overall(b);
  b.points = 0;
  b.region = nm.region;
  b.npc = true;
  return b;
}

export function makeAmateur(classId, quality) {
  const b = makeNPC(classId, quality);
  b.record = { w: 0, l: 0, d: 0, ko: 0, amW: randInt(0, 12), amL: randInt(0, 6), amD: 0, koLosses: 0 };
  b.amateur = true;
  b.age = randInt(17, 24);
  return b;
}

// Crée l'univers d'une catégorie : ~70 pros classés + champions.
export function createDivision(classId, playerRegion = 'Europe') {
  const fighters = [];
  for (let i = 0; i < 70; i++) {
    const q = clamp(92 - i * 0.85 + gauss(0, 3), 25, 96);
    const nation = i > 25 && chance(0.4) ? pick(NATIONS.filter((n) => n.region === playerRegion)).id : undefined;
    fighters.push(makeNPC(classId, q, { nation }));
  }
  fighters.forEach((f) => (f.points = Math.round(f.rating * 10 + f.record.w * 4 - f.record.l * 6)));
  const div = { classId, fighters, belts: {}, regional: null, national: null, continental: null, history: [] };
  rerank(div);
  // Champions mondiaux : parmi le top 6 (titres éparpillés au départ).
  const top = div.fighters.slice(0, 8);
  BODIES.forEach((bd, i) => { div.belts[bd.id] = top[[0, 1, 2, 3][i] + (chance(0.4) ? 2 : 0)].id; });
  if (chance(0.25)) div.belts.WPBA = div.belts.GBC; // un champion unifié parfois
  // Ceintures inférieures : boxeurs classés plus bas, de la région du joueur.
  const regionals = div.fighters.filter((f) => f.region === playerRegion);
  div.continental = (regionals[3] || div.fighters[15]).id;
  div.national = (regionals[8] || div.fighters[30]).id;
  div.regional = (regionals[14] || div.fighters[45]).id;
  return div;
}

export function rerank(div, player) {
  const all = div.fighters.slice();
  if (player && player.pro && player.weightClass === div.classId) all.push(player);
  for (const f of all) {
    const beltBonus = Object.values(div.belts).filter((id) => id === f.id).length * 120;
    f.score = (f.points || 0) + beltBonus + (f.rating || overall(f)) * 4;
  }
  all.sort((a, b) => b.score - a.score);
  all.forEach((f, i) => (f.rank = i + 1));
  div.fighters.sort((a, b) => a.rank - b.rank);
  return all;
}

export function findFighter(div, id) { return div.fighters.find((f) => f.id === id); }

export function beltsOf(div, id) { return BODIES.filter((b) => div.belts[b.id] === id).map((b) => b.id); }

// Simulation rapide d'un combat entre PNJ (statistique, sans moteur temps réel).
export function quickSim(a, b, rounds = 10) {
  const ra = (a.rating || overall(a)) + gauss(0, 6), rb = (b.rating || overall(b)) + gauss(0, 6);
  const diff = ra - rb;
  const pA = 1 / (1 + Math.exp(-diff / 6));
  const winA = rand() < pA;
  const W = winA ? a : b;
  const L = winA ? b : a;
  const koP = clamp(0.15 + W.attrs.power / 200 - L.attrs.chin / 300 + Math.abs(diff) / 60, 0.08, 0.8);
  let method, round;
  if (chance(0.03)) { method = 'D'; round = rounds; }
  else if (chance(koP)) { method = chance(0.55) ? 'KO' : 'TKO'; round = randInt(1, rounds); }
  else { method = chance(0.7) ? 'UD' : chance(0.6) ? 'SD' : 'MD'; round = rounds; }
  return { winner: method === 'D' ? null : W, loser: method === 'D' ? null : L, method, round };
}

export function applyResultToRecord(f, won, draw, ko) {
  if (draw) f.record.d++;
  else if (won) { f.record.w++; if (ko) f.record.ko++; }
  else { f.record.l++; if (ko) f.record.koLosses = (f.record.koLosses || 0) + 1; }
}

// Activité hebdomadaire du monde : combats entre PNJ, progression, retraites, nouveaux venus.
export function simulateWorldWeek(div, day, newsOut, protectIds = []) {
  const n = div.fighters.length;
  const fights = randInt(2, 4);
  for (let k = 0; k < fights; k++) {
    const i = randInt(0, n - 1);
    const j = clamp(i + randInt(-6, 6), 0, n - 1);
    if (i === j) continue;
    const a = div.fighters[i], b = div.fighters[j];
    if (a.busyUntil > day || b.busyUntil > day) continue;
    // Combat de championnat ?
    let title = null;
    for (const bd of BODIES) if (div.belts[bd.id] === a.id && b.rank <= 15) title = bd.id;
    if (div.belts[title] !== a.id) for (const bd of BODIES) if (div.belts[bd.id] === b.id && a.rank <= 15) title = bd.id;
    const res = quickSim(a, b, title ? 12 : 10);
    a.busyUntil = b.busyUntil = day + randInt(50, 120);
    if (res.winner) {
      applyResultToRecord(res.winner, true, false, res.method === 'KO' || res.method === 'TKO');
      applyResultToRecord(res.loser, false, false, res.method === 'KO' || res.method === 'TKO');
      res.winner.points += 25 + Math.max(0, res.loser.rank < res.winner.rank ? 30 : 5);
      res.loser.points -= 20;
      // Transfert de ceinture.
      for (const bd of BODIES) if (div.belts[bd.id] === res.loser.id && title) { div.belts[bd.id] = res.winner.id; }
      for (const t of ['regional', 'national', 'continental']) if (div[t] === res.loser.id && chance(0.5)) div[t] = res.winner.id;
      if (title || res.winner.rank <= 10) newsOut.push(`${res.winner.firstName} ${res.winner.lastName} bat ${res.loser.firstName} ${res.loser.lastName} (${res.method}${res.method === 'KO' || res.method === 'TKO' ? ' R' + res.round : ''})${title ? ' — ceinture ' + title : ''}`);
    } else { a.record.d++; b.record.d++; }
  }
  // Évolution : jeunes progressent, vieux déclinent.
  if (day % 28 === 0) {
    for (const f of div.fighters) {
      f.age = (f.age || 26) + 28 / 365;
      const delta = f.age < 27 ? randRange(0, 0.8) : f.age > 32 ? -randRange(0.2, 1.2) : randRange(-0.3, 0.4);
      for (const k of ATTR_KEYS) f.attrs[k] = clamp(f.attrs[k] + delta * randRange(0.5, 1.5), 5, 99);
      f.rating = overall(f);
    }
    // Retraites et nouveaux talents.
    for (let i = div.fighters.length - 1; i >= 0; i--) {
      const f = div.fighters[i];
      if (protectIds.includes(f.id)) continue;
      if ((f.age > 37 || (f.record.l > 12 && f.rank > 40)) && chance(0.3) && !Object.values(div.belts).includes(f.id)) {
        div.fighters.splice(i, 1);
        div.fighters.push(makeNPC(div.classId, randRange(35, 70)));
        if (f.rank <= 20) newsOut.push(`${f.firstName} ${f.lastName} annonce sa retraite (${f.record.w}-${f.record.l}-${f.record.d}).`);
      }
    }
  }
  rerank(div);
}
