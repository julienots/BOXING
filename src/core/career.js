// Carrière : état de jeu, calendrier, offres de combat, titres, classements, finances, staff, sponsors.
import { clamp, rand, randInt, randRange, pick, chance, uid, fmtMoney, gauss } from './util.js';
import { createBoxer, overall, fullName, recordStr, ageYears, levelFromXp, effectiveAttrs } from './boxer.js';
import { createDivision, rerank, makeAmateur, findFighter, beltsOf, BODIES, simulateWorldWeek, makeNPC } from './world.js';
import { runDay, defaultProgram, programTemplates, EQUIPMENT, staffBonus } from './training.js';
import { getClass } from '../data/weightClasses.js';
import { nationById } from '../data/names.js';
import { rollRandomEvent, bindCareer } from './events.js';

export const SAVE_VERSION = 3;
export const START_DATE = Date.UTC(2027, 0, 4); // lundi 4 janvier 2027

export const GYM_LEVELS = [
  null,
  { name: 'Hangar délabré', upgrade: 0, rent: 120, staffCap: 2, members: 12, fee: 9, desc: 'Murs fissurés, néons qui grésillent, un vieux sac rapiécé.' },
  { name: 'Club de quartier', upgrade: 9000, rent: 380, staffCap: 4, members: 45, fee: 11, desc: 'Salle propre, ring d\'entraînement possible, premiers licenciés.' },
  { name: 'Salle moderne', upgrade: 38000, rent: 1100, staffCap: 6, members: 120, fee: 14, desc: 'Plateau de musculation complet, zone cardio, vestiaires.' },
  { name: 'Centre d\'élite', upgrade: 140000, rent: 3200, staffCap: 8, members: 260, fee: 20, desc: 'Équipements haut de gamme, espace récupération, analyse vidéo.' },
  { name: 'Académie légendaire', upgrade: 480000, rent: 8500, staffCap: 10, members: 500, fee: 28, desc: 'Le temple mondial de la boxe. Les meilleurs veulent s\'y entraîner.' },
];

export const COMFORT = [
  { name: 'Aucun confort', price: 0 },
  { name: 'Vestiaires & douches rénovés', price: 2500 },
  { name: 'Salon des athlètes & cuisine', price: 12000 },
  { name: 'Suite de récupération premium', price: 45000 },
];

export const STAFF_ROLES = {
  trainer:   { name: 'Entraîneur adjoint', desc: 'Améliore les gains techniques, débloque les pattes d\'ours, accélère l\'apprentissage.', base: 160 },
  strength:  { name: 'Préparateur physique', desc: 'Améliore les gains de force, puissance, endurance, cardio.', base: 150 },
  physio:    { name: 'Kinésithérapeute', desc: 'Récupération accrue, blessures plus rares et plus courtes.', base: 170 },
  cutman:    { name: 'Soigneur (cutman)', desc: 'Referme les coupures et réduit les gonflements entre les rounds.', base: 120 },
  nutrition: { name: 'Nutritionniste', desc: 'Coupe de poids plus efficace et moins pénible.', base: 130 },
  sparring:  { name: 'Partenaire de sparring', desc: 'Permet le sparring : expérience, mental, défense.', base: 110 },
  scout:     { name: 'Analyste vidéo', desc: 'Révèle les forces, faiblesses et habitudes des adversaires.', base: 140 },
};

export const TIERS = [
  null,
  'Combats amateurs', 'Premiers combats professionnels', 'Championnat régional', 'Championnat national', 'Classement continental',
  'Top 10 mondial', 'Top 5 mondial', 'Challenger mondial', 'Champion du monde', 'Champion unifié', 'Champion incontesté', 'Légende historique',
];

export const VENUES = [
  { id: 'club', name: 'Petit club de boxe', crowd: 60, size: 1 },
  { id: 'amateur', name: 'Gala amateur (gymnase municipal)', crowd: 140, size: 1.4 },
  { id: 'regional', name: 'Salle régionale', crowd: 450, size: 2 },
  { id: 'arena', name: 'Grande arène professionnelle', crowd: 1100, size: 3 },
  { id: 'intl', name: 'Arena internationale', crowd: 1700, size: 3.6 },
  { id: 'stadium', name: 'Stade gigantesque', crowd: 2600, size: 5 },
  { id: 'world', name: 'Championnat du monde — Palais des sports', crowd: 2000, size: 4 },
  { id: 'historic', name: 'Combat historique — salle d\'époque', crowd: 900, size: 2.6 },
];

export function dateOf(day) {
  const d = new Date(START_DATE + day * 86400000);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
export function shortDate(day) {
  const d = new Date(START_DATE + day * 86400000);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

// ------------------------------------------------------------------ nouvelle partie
export function newCareer(opts) {
  const boxer = opts.boxer;
  boxer.isPlayer = true;
  boxer.startDay = 0;
  boxer.pro = false;
  const state = {
    version: SAVE_VERSION,
    day: 0,
    coach: { name: opts.coachName || 'Coach', skill: 0, xp: 0, legacy: 0, boxersTrained: 1 },
    money: opts.money ?? 2500,
    boxer,
    gym: {
      name: opts.gymName || 'Boxing Club',
      level: 1,
      equipment: { heavybag: 1, speedbag: 0, doubleend: 0, ring: 0, ropes: 1, dumbbells: 1, bench: 0, machines: 0, battlerope: 0, dummy: 0, cardio: 0, mirror: 1, recovery: 0 },
      staff: [],
      comfort: 0,
      reputation: 0,
    },
    programs: programTemplates(),
    activeProgram: 0,
    divisions: {},
    career: { tier: 1, peakTier: 1, legacy: 0, titlesWon: [], defenses: 0, beltsHeld: [], amateurTitle: false, milestones: [], streak: 0, retired: false },
    offers: [], booked: null, contract: null, sponsors: [], sponsorOffers: [],
    staffMarket: [],
    inbox: [], news: [], ledger: [],
    rivals: {}, memory: {},
    pending: [], // événements nécessitant une décision
    scouting: 0,
    objectives: [],
    hallOfFame: [],
    lastFight: null,
    flags: {},
    settingsSnapshot: {},
  };
  const div = createDivision(boxer.weightClass, nationById(boxer.flag).region);
  state.divisions[boxer.weightClass] = div;
  state.staffMarket = genStaffMarket(state);
  message(state, 'Bienvenue au ' + state.gym.name, `Tout commence ici : une salle délabrée, ${fmtMoney(state.money)} en caisse et un jeune boxeur, ${boxer.firstName}, qui ne sait pas encore boxer. Organisez son entraînement dans l'onglet Entraînement, puis acceptez ses premiers combats amateurs dans le Calendrier.`);
  refreshOffers(state);
  updateObjectives(state);
  return state;
}

export function message(state, title, body, kind = 'info') {
  state.inbox.unshift({ id: uid('msg'), day: state.day, title, body, kind, read: false });
  if (state.inbox.length > 80) state.inbox.length = 80;
}

export function ledger(state, label, amount) {
  state.money += amount;
  state.ledger.unshift({ day: state.day, label, amount: Math.round(amount) });
  if (state.ledger.length > 150) state.ledger.length = 150;
}

export function division(state) {
  const id = state.boxer.weightClass;
  if (!state.divisions[id]) state.divisions[id] = createDivision(id, nationById(state.boxer.flag).region);
  return state.divisions[id];
}

export function playerRank(state) {
  const b = state.boxer;
  if (!b.pro) return null;
  const all = rerank(division(state), b);
  return all.findIndex((f) => f.id === b.id) + 1;
}

export function playerBelts(state) {
  return beltsOf(division(state), state.boxer.id);
}

// ------------------------------------------------------------------ paliers de carrière
export function computeTier(state) {
  const b = state.boxer, div = division(state), c = state.career;
  if (!b.pro) return 1;
  const belts = playerBelts(state).length;
  if (c.legacy >= 450 && c.peakTier >= 11) return 12;
  if (c.legacy >= 700) return 12;
  if (belts >= 4) return 11;
  if (belts >= 2) return 10;
  if (belts === 1) return 9;
  const rank = playerRank(state);
  if (rank <= 2 || state.flags.mandatory) return 8;
  if (rank <= 5) return 7;
  if (rank <= 10) return 6;
  if (div.continental === b.id || rank <= 22) return 5;
  if (div.national === b.id || rank <= 38) return 4;
  if (div.regional === b.id || rank <= 55 || b.record.w >= 6) return 3;
  return 2;
}

export function updateTier(state) {
  const t = computeTier(state);
  const c = state.career;
  if (t > c.peakTier) {
    c.peakTier = t;
    c.milestones.push({ day: state.day, text: 'Nouveau palier : ' + TIERS[t] });
    message(state, '🏆 Nouveau palier atteint', `${fullName(state.boxer)} atteint le palier « ${TIERS[t]} ». La réputation du club grimpe.`, 'success');
    state.gym.reputation += t * 3;
  }
  c.tier = t;
  return t;
}

export function updateObjectives(state) {
  const b = state.boxer, c = state.career;
  const o = [];
  if (!b.pro) {
    o.push({ text: 'Remporter 5 combats amateurs', done: b.record.amW >= 5, prog: `${b.record.amW}/5` });
    o.push({ text: 'Passer professionnel', done: b.pro });
  } else {
    const nextT = Math.min(12, c.tier + 1);
    o.push({ text: 'Atteindre : ' + TIERS[nextT], done: false });
  }
  o.push({ text: 'Atteindre une technique de 50', done: b.attrs.technique >= 50, prog: Math.floor(b.attrs.technique) + '/50' });
  o.push({ text: 'Agrandir le gymnase (niveau 2)', done: state.gym.level >= 2 });
  if (state.gym.level >= 2) o.push({ text: 'Gymnase niveau 4 — Centre d\'élite', done: state.gym.level >= 4 });
  o.push({ text: 'Devenir champion du monde', done: c.peakTier >= 9 });
  o.push({ text: 'Unifier les 4 ceintures (incontesté)', done: c.peakTier >= 11 });
  o.push({ text: 'Entrer dans la légende', done: c.peakTier >= 12 });
  state.objectives = o;
}

// ------------------------------------------------------------------ popularité & bourses
export function popularity(state) {
  const b = state.boxer;
  return clamp(b.reputation + state.gym.reputation * 0.3, 0, 1000);
}

function purseFor(state, opp, rounds, kind) {
  const b = state.boxer;
  if (!b.pro) return Math.round(randRange(60, 160) * (1 + b.record.amW * 0.08));
  const rank = playerRank(state);
  const pop = popularity(state);
  const oppPop = opp.rank ? clamp(80 - opp.rank, 0, 80) : 10;
  let base = 900 * Math.pow(1 + pop / 60, 1.5) * (1 + rounds / 8) * (1 + oppPop / 40);
  if (rank && rank <= 10) base *= 2.2;
  const mult = { regional: 2, national: 3.2, continental: 5, eliminator: 6, world: 14, unification: 22, undisputed: 35, defense: 12, legend: 30 }[kind] || 1;
  return Math.round(base * mult * randRange(0.85, 1.2) / 10) * 10;
}

export function fightRounds(state, kind) {
  const b = state.boxer;
  if (!b.pro) return 3;
  if (['world', 'unification', 'undisputed', 'defense', 'eliminator', 'continental', 'legend'].includes(kind)) return 12;
  if (kind === 'regional' || kind === 'national') return 10;
  const n = b.record.w + b.record.l + b.record.d;
  if (n < 3) return 4;
  if (n < 7) return 6;
  if (n < 12) return 8;
  return 10;
}

export function venueFor(state, kind) {
  const b = state.boxer;
  if (kind === 'legend') return 'historic';
  if (!b.pro) return state.boxer.record.amW >= 3 ? 'amateur' : 'club';
  if (['world', 'defense', 'unification'].includes(kind)) return 'world';
  if (kind === 'undisputed') return 'stadium';
  const rank = playerRank(state) || 99;
  if (rank <= 5) return 'intl';
  if (rank <= 20 || kind === 'continental') return 'arena';
  if (rank <= 45 || kind === 'regional' || kind === 'national') return 'regional';
  return 'club';
}

export function makeOffer(state, opp, kind = 'regular', extra = {}) {
  const rounds = extra.rounds || fightRounds(state, kind);
  const purse = extra.purse || purseFor(state, opp, rounds, kind);
  const lead = extra.lead || randInt(28, 63);
  const day = state.day + lead;
  const myR = overall(state.boxer);
  const oppR = opp.rating || overall(opp);
  return {
    id: uid('off'), oppId: opp.id, opp: opp.amateur || opp.isLegend || opp.temp ? opp : null,
    oppName: fullName(opp), oppRecord: opp.amateur ? `${opp.record.amW}-${opp.record.amL} (am.)` : recordStr(opp), oppRank: opp.rank || null,
    oppStyle: opp.style, oppRating: oppR, kind, rounds, purse, day, expires: state.day + randInt(5, 9),
    venue: extra.venue || venueFor(state, kind), danger: clamp((oppR - myR) / 20, -1, 1.5),
    title: extra.title || null, note: extra.note || '', negotiated: 0, amateur: !state.boxer.pro, shortNotice: lead < 21,
  };
}

function inDivisionOpp(state, minRank, maxRank, excludeIds = []) {
  const div = division(state);
  const pool = div.fighters.filter((f) => f.rank >= minRank && f.rank <= maxRank && !excludeIds.includes(f.id) && !(f.busyUntil > state.day + 20));
  return pool.length ? pick(pool) : pick(div.fighters.slice(-20));
}

export function refreshOffers(state) {
  const b = state.boxer;
  state.offers = state.offers.filter((o) => o.expires > state.day);
  if (state.booked || state.career.retired) return;
  if (state.offers.length >= 3) return;
  const myR = overall(b);
  const n = randInt(1, 3) - state.offers.length;
  for (let i = 0; i < Math.max(1, n); i++) {
    if (!b.pro) {
      const opp = makeAmateur(b.weightClass, clamp(myR + randRange(-8, 9), 8, 70));
      const kind = 'amateur';
      state.offers.push(makeOffer(state, opp, kind, { lead: randInt(10, 24), note: chance(0.2) ? 'Gala du club voisin' : '' }));
      continue;
    }
    const rank = playerRank(state);
    const div = division(state);
    const belts = playerBelts(state);
    const used = state.offers.map((o) => o.oppId);
    // Offres titres selon le rang.
    if (belts.length) {
      const others = BODIES.filter((bd) => !belts.includes(bd.id) && div.belts[bd.id] && div.belts[bd.id] !== b.id);
      if (others.length && chance(0.5)) {
        const bd = pick(others);
        const opp = findFighter(div, div.belts[bd.id]);
        const kind = belts.length === 3 ? 'undisputed' : 'unification';
        if (opp) { state.offers.push(makeOffer(state, opp, kind, { title: bd.id, note: kind === 'undisputed' ? 'Combat pour le titre INCONTESTÉ' : 'Réunification : ceinture ' + bd.id + ' en jeu' })); continue; }
      }
      const opp = inDivisionOpp(state, 2, 12, used);
      state.offers.push(makeOffer(state, opp, 'defense', { title: belts[0], note: 'Défense de titre ' + belts.join('/') }));
      continue;
    }
    if (rank <= 4 || state.flags.mandatory) {
      const holders = BODIES.filter((bd) => div.belts[bd.id] && div.belts[bd.id] !== b.id);
      const bd = pick(holders);
      const opp = findFighter(div, div.belts[bd.id]);
      if (opp && chance(0.7)) { state.offers.push(makeOffer(state, opp, 'world', { title: bd.id, note: 'Championnat du monde ' + bd.id })); continue; }
    }
    if (rank <= 10 && chance(0.5)) {
      const opp = inDivisionOpp(state, 2, 9, used);
      state.offers.push(makeOffer(state, opp, 'eliminator', { note: 'Éliminatoire mondial : le vainqueur devient challenger officiel' })); continue;
    }
    if (rank <= 28 && div.continental !== b.id && chance(0.45)) {
      const opp = findFighter(div, div.continental);
      if (opp) { state.offers.push(makeOffer(state, opp, 'continental', { title: 'continental', note: 'Titre continental en jeu' })); continue; }
    }
    if (rank <= 42 && div.national !== b.id && div.continental !== b.id && chance(0.45)) {
      const opp = findFighter(div, div.national);
      if (opp) { state.offers.push(makeOffer(state, opp, 'national', { title: 'national', note: 'Titre national en jeu' })); continue; }
    }
    if (rank <= 60 && div.regional !== b.id && div.national !== b.id && chance(0.45)) {
      const opp = findFighter(div, div.regional);
      if (opp) { state.offers.push(makeOffer(state, opp, 'regional', { title: 'regional', note: 'Ceinture régionale en jeu' })); continue; }
    }
    // Combats classiques : prudent, équilibré ou dangereux et lucratif.
    const r = rand();
    let opp, note = '';
    if (r < 0.4) { opp = inDivisionOpp(state, rank + 4, rank + 25, used); note = 'Combat de préparation'; }
    else if (r < 0.8) { opp = inDivisionOpp(state, Math.max(1, rank - 6), rank + 6, used); note = 'Combat de classement'; }
    else { opp = inDivisionOpp(state, Math.max(1, rank - 25), Math.max(2, rank - 8), used); note = '⚠ Combat dangereux mais très rémunérateur'; }
    const off = makeOffer(state, opp, 'regular', { note });
    if (r >= 0.8) off.purse = Math.round(off.purse * 1.9);
    state.offers.push(off);
  }
  // Rivalités : revanche.
  for (const [id, rv] of Object.entries(state.rivals)) {
    if (rv.wantsRematch && !state.offers.some((o) => o.oppId === id) && b.pro) {
      const opp = findFighter(division(state), id);
      if (opp) {
        const off = makeOffer(state, opp, 'regular', { note: '🔥 Revanche ! Rivalité : ' + rv.level + '/5' });
        off.purse = Math.round(off.purse * (1.3 + rv.level * 0.15));
        off.rematch = true;
        state.offers.push(off);
        rv.wantsRematch = false;
      }
    }
  }
}

export function negotiate(state, offerId, pct) {
  const o = state.offers.find((x) => x.id === offerId);
  if (!o) return { ok: false };
  const pop = popularity(state);
  const leverage = clamp(0.35 + pop / 600 + (o.kind === 'amateur' ? -0.2 : 0) - o.negotiated * 0.25 + (state.contract ? 0.1 : 0), 0.05, 0.9);
  const p = clamp(leverage - pct * 1.2 + 0.25, 0.05, 0.95);
  o.negotiated++;
  if (chance(p)) {
    o.purse = Math.round(o.purse * (1 + pct));
    return { ok: true, msg: `Le promoteur accepte : nouvelle bourse ${fmtMoney(o.purse)}.` };
  }
  if (chance(0.45)) {
    state.offers = state.offers.filter((x) => x.id !== offerId);
    return { ok: false, withdrawn: true, msg: 'Le promoteur est vexé et retire son offre.' };
  }
  return { ok: false, msg: 'Le promoteur refuse, mais l\'offre initiale tient toujours.' };
}

export function acceptOffer(state, offerId) {
  const o = state.offers.find((x) => x.id === offerId);
  if (!o || state.booked) return false;
  state.booked = { ...o, accepted: state.day, pressDone: false, weighDone: false, faceoffDone: false };
  state.offers = [];
  const opp = bookedOpponent(state);
  if (opp) opp.busyUntil = o.day + 30;
  state.scouting = Math.min(state.scouting, 20);
  message(state, 'Combat signé', `${fullName(state.boxer)} affrontera ${o.oppName} le ${dateOf(o.day)} (${o.rounds} rounds). Bourse : ${fmtMoney(o.purse)}.`);
  return true;
}

export function declineOffer(state, offerId) {
  const o = state.offers.find((x) => x.id === offerId);
  state.offers = state.offers.filter((x) => x.id !== offerId);
  if (o && o.title && state.boxer.pro && playerBelts(state).length && o.kind === 'defense') {
    state.flags.declinedDefenses = (state.flags.declinedDefenses || 0) + 1;
  }
}

// Récupère l'objet adversaire du combat réservé.
export function bookedOpponent(state) {
  const bk = state.booked;
  if (!bk) return null;
  return findFighter(division(state), bk.oppId) || bk.opp;
}

// ------------------------------------------------------------------ staff
export function genStaffMarket(state) {
  const out = [];
  const maxLvl = clamp(1 + state.gym.level + Math.floor(state.gym.reputation / 60), 1, 5);
  const firsts = ['Eddie', 'Marco', 'Sylvie', 'Rachid', 'Ana', 'Bruno', 'Freddie', 'Nadia', 'Hakim', 'Joe', 'Léon', 'Inès', 'Ray', 'Paco', 'Olga', 'Moussa'];
  const lasts = ['Garcia', 'Benoît', 'Okoro', 'Stein', 'Duval', 'Martins', 'Kowalski', 'Haddad', 'Price', 'Lambert', 'Silva', 'Novak'];
  for (const role of Object.keys(STAFF_ROLES)) {
    const n = randInt(1, 2);
    for (let i = 0; i < n; i++) {
      const level = clamp(randInt(1, maxLvl), 1, 5);
      out.push({ id: uid('st'), role, name: pick(firsts) + ' ' + pick(lasts), level, salary: Math.round(STAFF_ROLES[role].base * Math.pow(level, 1.7) / 5) * 5, signing: Math.round(STAFF_ROLES[role].base * level * level * 1.5) });
    }
  }
  return out;
}

export function hireStaff(state, id) {
  const s = state.staffMarket.find((x) => x.id === id);
  if (!s) return 'Introuvable';
  const cap = GYM_LEVELS[state.gym.level].staffCap;
  if (state.gym.staff.length >= cap) return `Capacité du gymnase atteinte (${cap}). Agrandissez la salle.`;
  if (state.money < s.signing) return 'Fonds insuffisants pour la prime d\'embauche.';
  ledger(state, 'Embauche : ' + s.name, -s.signing);
  state.gym.staff.push({ ...s, hired: state.day });
  state.staffMarket = state.staffMarket.filter((x) => x.id !== id);
  return null;
}

export function fireStaff(state, id) {
  const s = state.gym.staff.find((x) => x.id === id);
  if (!s) return;
  ledger(state, 'Indemnité de départ : ' + s.name, -s.salary * 2);
  state.gym.staff = state.gym.staff.filter((x) => x.id !== id);
}

// ------------------------------------------------------------------ gymnase
export function buyEquipment(state, key) {
  const eq = EQUIPMENT[key];
  const cur = state.gym.equipment[key] || 0;
  if (cur >= 3) return 'Niveau maximum';
  if (state.gym.level < eq.minGym) return `Nécessite un gymnase de niveau ${eq.minGym}`;
  const price = eq.price[cur + 1];
  if (state.money < price) return 'Fonds insuffisants';
  ledger(state, `${eq.name} (niv. ${cur + 1})`, -price);
  state.gym.equipment[key] = cur + 1;
  updateObjectives(state);
  return null;
}

export function upgradeGym(state) {
  const next = GYM_LEVELS[state.gym.level + 1];
  if (!next) return 'Niveau maximum';
  if (state.money < next.upgrade) return 'Fonds insuffisants';
  ledger(state, 'Nouveaux locaux : ' + next.name, -next.upgrade);
  state.gym.level++;
  state.gym.reputation += 10;
  message(state, 'Nouveaux locaux', `Le club déménage : « ${next.name} ». ${next.desc}`, 'success');
  state.staffMarket = genStaffMarket(state);
  updateObjectives(state);
  return null;
}

export function upgradeComfort(state) {
  const next = COMFORT[state.gym.comfort + 1];
  if (!next) return 'Niveau maximum';
  if (state.gym.level < state.gym.comfort + 2) return 'Agrandissez d\'abord le gymnase';
  if (state.money < next.price) return 'Fonds insuffisants';
  ledger(state, 'Confort : ' + next.name, -next.price);
  state.gym.comfort++;
  return null;
}

// ------------------------------------------------------------------ sponsors & contrats
const SPONSOR_NAMES = ['Titan Nutrition', 'Velocity Sportswear', 'IronClad Gloves', 'Brasserie du Coin', 'NeoFit Gym', 'Apex Energy', 'Garage Moreau', 'Kaiser Watches', 'StreetKing Apparel', 'Monarch Bank', 'Vortex Drinks', 'Atlas Mobile', 'Phoenix Airlines', 'Imperium Motors', 'Royal Casino Resort'];

export function genSponsorOffer(state) {
  const pop = popularity(state);
  const tierS = clamp(Math.floor(pop / 40), 0, SPONSOR_NAMES.length - 1);
  const name = SPONSOR_NAMES[clamp(tierS + randInt(-2, 1), 0, SPONSOR_NAMES.length - 1)];
  const weekly = Math.round((40 + pop * pop * 0.12 + pop * 4) * randRange(0.7, 1.3) / 10) * 10;
  const reqs = [
    { id: 'none', text: 'Aucune condition particulière' },
    { id: 'nolose2', text: 'Rompu après 2 défaites consécutives' },
    { id: 'activity', text: 'Combattre au moins tous les 120 jours' },
    { id: 'rep', text: 'Maintenir la réputation au-dessus de ' + Math.round(pop * 0.7), min: Math.round(pop * 0.7) },
  ];
  const req = pick(reqs);
  return { id: uid('sp'), name, weekly, winBonus: Math.round(weekly * randRange(2, 5)), koBonus: Math.round(weekly * randRange(3, 8)), weeks: randInt(12, 52), req, expires: state.day + 14 };
}

export function acceptSponsor(state, id) {
  const s = state.sponsorOffers.find((x) => x.id === id);
  if (!s) return;
  if (state.sponsors.length >= 4) return 'Maximum 4 sponsors simultanés';
  state.sponsors.push({ ...s, start: state.day, end: state.day + s.weeks * 7 });
  state.sponsorOffers = state.sponsorOffers.filter((x) => x.id !== id);
  message(state, 'Nouveau sponsor', `${s.name} sponsorise votre boxeur : ${fmtMoney(s.weekly)}/semaine.`, 'success');
}

export function genPromoterContract(state) {
  const pop = popularity(state);
  const names = ['Golden Fist Promotions', 'Top Rank Events', 'Crown Boxing', 'Matchroom Royale', 'Thunder Promotions', 'Premier Ring'];
  const fights = randInt(3, 6);
  return { id: uid('ct'), name: pick(names), fights, remaining: fights, bonus: Math.round((1500 + pop * 80) * randRange(0.8, 1.4) / 100) * 100, purseBoost: randRange(1.1, 1.35), expires: state.day + 20 };
}

// ------------------------------------------------------------------ avance du temps
// Retourne { interrupts: [...], reports } : les interruptions demandent une action UI.
export function advanceDay(state) {
  const out = { interrupts: [], reports: null, news: [] };
  if (state.career.retired) return out;
  const b = state.boxer;
  // Le jour du combat : interruption.
  if (state.booked && state.day >= state.booked.day) {
    out.interrupts.push({ type: 'fight' });
    return out;
  }
  // Événements de semaine de combat.
  if (state.booked) {
    const daysLeft = state.booked.day - state.day;
    if (daysLeft <= 5 && !state.booked.pressDone && b.pro) { out.interrupts.push({ type: 'press' }); state.booked.pressDone = true; return out; }
    if (daysLeft <= 1 && !state.booked.weighDone) { out.interrupts.push({ type: 'weighin' }); state.booked.weighDone = true; return out; }
  }
  if (state.pending.length) { out.interrupts.push({ type: 'event', event: state.pending[0] }); return out; }

  // Journée d'entraînement.
  out.reports = runDay(state);
  for (const r of out.reports.reports) {
    if (r.injury) message(state, '🚑 Blessure : ' + r.injury.name, `Pendant « ${r.name} ». Indisponibilité estimée : ${Math.round(r.injury.days)} jours. Adaptez le programme (repos, kiné).`, 'danger');
    if (r.levelUp) message(state, '⭐ Niveau ' + r.levelUp, `${b.firstName} passe au niveau ${r.levelUp}. De nouvelles techniques deviennent accessibles.`, 'success');
    if (r.learned) for (const t of r.learned) message(state, '🥊 Technique apprise : ' + t, `${b.firstName} maîtrise désormais : ${t}.`, 'success');
  }
  for (const h of out.reports.healed) message(state, 'Guérison', `${h.name} : guéri.`, 'success');
  state.day++;
  // Fin de semaine : finances, monde, marché.
  if (state.day % 7 === 0) weekly(state, out);
  // Nouvelles offres.
  if (state.day % 3 === 0) refreshOffers(state);
  // Événement aléatoire.
  const ev = rollRandomEvent(state);
  if (ev) { state.pending.push(ev); out.interrupts.push({ type: 'event', event: ev }); }
  // Âge : retraite forcée.
  if (ageYears(b, state.day) >= 42 && !state.career.retired) {
    out.interrupts.push({ type: 'forcedRetire' });
  }
  return out;
}

function weekly(state, out) {
  const g = state.gym, lvl = GYM_LEVELS[g.level];
  // Dépenses.
  ledger(state, 'Loyer & charges : ' + lvl.name, -lvl.rent);
  const salaries = g.staff.reduce((s, x) => s + x.salary, 0);
  if (salaries) ledger(state, 'Salaires du staff', -salaries);
  const allowance = state.boxer.pro ? 0 : 40;
  if (allowance) ledger(state, 'Frais du boxeur (nourriture, transport)', -allowance);
  // Revenus des adhérents.
  const members = Math.round(lvl.members * (1 + g.reputation / 120) * (0.8 + g.comfort * 0.1));
  g.members = members;
  ledger(state, `Cotisations (${members} adhérents)`, members * lvl.fee);
  // Sponsors.
  for (const s of state.sponsors) ledger(state, 'Sponsor ' + s.name, s.weekly);
  state.sponsors = state.sponsors.filter((s) => {
    if (state.day >= s.end) { message(state, 'Fin de contrat sponsor', s.name + ' : contrat arrivé à terme.'); return false; }
    if (s.req.id === 'rep' && popularity(state) < s.req.min) { message(state, 'Sponsor perdu', s.name + ' rompt le contrat (réputation insuffisante).', 'danger'); return false; }
    if (s.req.id === 'activity' && state.lastFight && state.day - state.lastFight.day > 120 && !state.booked) { message(state, 'Sponsor perdu', s.name + ' rompt le contrat (inactivité).', 'danger'); return false; }
    return true;
  });
  // Offres de sponsors.
  state.sponsorOffers = state.sponsorOffers.filter((s) => s.expires > state.day);
  if (popularity(state) > 8 && chance(0.25 + popularity(state) / 800) && state.sponsorOffers.length < 3) {
    state.sponsorOffers.push(genSponsorOffer(state));
    message(state, 'Proposition de sponsor', 'Une marque souhaite s\'associer à votre boxeur. Consultez l\'onglet Manager.');
  }
  // Marché du staff renouvelé.
  if (state.day % 28 === 0) state.staffMarket = genStaffMarket(state);
  // Monde.
  const div = division(state);
  const news = [];
  simulateWorldWeek(div, state.day, news, [state.boxer.id, state.booked && state.booked.oppId]);
  for (const n of news) state.news.unshift({ day: state.day, text: n });
  if (state.news.length > 60) state.news.length = 60;
  // Ceintures : défense obligatoire.
  const belts = playerBelts(state);
  if (belts.length && state.lastFight && state.day - state.lastFight.day > 240 && !state.booked) {
    const bd = belts[belts.length - 1];
    const top = div.fighters.find((f) => f.id !== state.boxer.id && f.rank <= 3);
    if (top) {
      div.belts[bd] = top.id;
      message(state, 'Ceinture retirée', `Le ${bd} retire sa ceinture à ${state.boxer.lastName} faute de défense obligatoire. Elle est attribuée à ${top.lastName}.`, 'danger');
    }
  }
  // Faillite.
  if (state.money < -15000) {
    out.interrupts.push({ type: 'bankrupt' });
  } else if (state.money < 0) {
    message(state, '⚠ Trésorerie négative', 'Vos comptes sont dans le rouge. Réduisez le staff ou trouvez des combats/sponsors rapidement. En dessous de -15 000 €, le club fait faillite.', 'danger');
  }
  // Contrat promoteur.
  if (state.boxer.pro && !state.contract && chance(0.08 + popularity(state) / 1500) && !state.flags.contractOffer) {
    state.flags.contractOffer = genPromoterContract(state);
    message(state, 'Offre de contrat promoteur', `${state.flags.contractOffer.name} propose un contrat de ${state.flags.contractOffer.fights} combats avec prime de signature. Voir onglet Manager.`);
  }
  if (state.flags.contractOffer && state.flags.contractOffer.expires < state.day) state.flags.contractOffer = null;
  updateTier(state);
  updateObjectives(state);
}

export function acceptContract(state) {
  const c = state.flags.contractOffer;
  if (!c) return;
  state.contract = { ...c };
  state.flags.contractOffer = null;
  ledger(state, 'Prime de signature ' + c.name, c.bonus);
  message(state, 'Contrat signé', `${c.name} : ${c.fights} combats, bourses majorées de ${Math.round((c.purseBoost - 1) * 100)} %.`, 'success');
}

// ------------------------------------------------------------------ pesée
export function weighIn(state, choice = 'normal') {
  const b = state.boxer;
  const cls = getClass(b.weightClass);
  const limit = cls.kg;
  let w = b.weight;
  const res = { limit, start: w, final: w, made: true, drain: 0, msgs: [] };
  if (limit !== Infinity && w > limit) {
    if (choice === 'sauna') {
      const nutri = staffBonus(state.gym, 'nutrition');
      const maxCut = w * (0.03 + nutri * 0.004);
      const cut = Math.min(maxCut, w - limit + 0.05);
      w -= cut;
      res.msgs.push(`Séance de sauna et déshydratation : -${cut.toFixed(1)} kg.`);
      b.condition.fatigue = clamp(b.condition.fatigue + 12 - nutri * 2, 0, 100);
      res.dehydrated = cut;
    }
    res.made = w <= limit + 0.001;
  }
  res.final = Math.round(w * 100) / 100;
  // Rapport poids naturel / poids de pesée → affaiblissement.
  res.drain = clamp((b.naturalWeight - res.final) / b.naturalWeight + (res.dehydrated ? res.dehydrated / b.naturalWeight * 0.8 : 0), 0, 0.3);
  if (!res.made) res.msgs.push(`Poids manqué ! ${res.final.toFixed(1)} kg pour une limite de ${limit.toFixed(1)} kg. Amende de 20 % de la bourse${state.booked?.title ? ' et le titre ne peut pas être gagné' : ''}.`);
  else res.msgs.push(`Poids validé : ${res.final.toFixed(1)} kg (limite ${limit === Infinity ? 'aucune' : limit.toFixed(1) + ' kg'}).`);
  if (res.drain > 0.08) res.msgs.push('⚠ Coupe de poids excessive : endurance et résistance diminuées pour le combat.');
  state.booked.weigh = res;
  return res;
}

// ------------------------------------------------------------------ après combat
export function applyFightResult(state, fight, result, opts = {}) {
  const b = state.boxer;
  const bk = state.booked;
  const opp = opts.opp;
  const won = result.winner === 0, draw = result.winner === null, lost = result.winner === 1;
  const ko = result.method === 'KO' || result.method === 'TKO' || result.method === 'RTD';
  const div = division(state);
  const summary = { day: state.day, oppId: opp.id, oppName: fullName(opp), result: won ? 'V' : draw ? 'N' : 'D', method: result.method, label: result.label, round: result.round, rounds: bk.rounds, purse: 0, kind: bk.kind, title: bk.title, amateur: !b.pro, stats: result.stats[0], oppStats: result.stats[1], venue: bk.venue };
  const notes = [];
  // Palmarès.
  if (!b.pro) {
    if (won) b.record.amW++; else if (draw) b.record.amD++; else b.record.amL++;
  } else {
    if (won) { b.record.w++; if (ko) b.record.ko++; } else if (draw) b.record.d++; else { b.record.l++; if (ko) b.record.koLosses++; }
  }
  if (opp.record && !opp.isLegend) {
    if (opp.amateur) { if (won) opp.record.amL++; else if (lost) opp.record.amW++; }
    else { if (won) opp.record.l++; else if (lost) { opp.record.w++; if (ko) opp.record.ko++; } else opp.record.d++; }
  }
  // Argent.
  let purse = bk.purse;
  if (bk.weigh && !bk.weigh.made) purse *= 0.8;
  if (state.contract) purse *= state.contract.purseBoost;
  if (bk.hype) purse *= 1 + bk.hype * 0.04;
  const cut = b.pro ? 0.3 : 1; // part manager/club (le boxeur garde le reste)
  summary.purse = Math.round(purse);
  ledger(state, `${b.pro ? 'Part du club (30 %) — ' : 'Indemnité amateur — '}combat vs ${opp.lastName}`, purse * cut);
  if (b.pro) ledger(state, 'Frais de camp & déplacement', -Math.round(purse * 0.05 + 150));
  if (won) for (const s of state.sponsors) ledger(state, `Prime ${ko ? 'KO' : 'victoire'} ${s.name}`, ko ? s.koBonus : s.winBonus);
  if (state.contract) { state.contract.remaining--; if (state.contract.remaining <= 0) { message(state, 'Fin du contrat promoteur', state.contract.name + ' : contrat terminé.'); state.contract = null; } }
  // Réputation, moral, confiance.
  const oppQ = (opp.rating || overall(opp));
  const qDiff = oppQ - overall(b);
  if (won) {
    b.reputation += Math.max(1, 3 + qDiff * 0.3 + (ko ? 3 : 0) + (bk.title ? 15 : 0) + (b.pro ? 2 : 0));
    b.condition.confidence = clamp(b.condition.confidence + 10 + (ko ? 5 : 0), 0, 100);
    b.condition.morale = clamp(b.condition.morale + 15, 0, 100);
    state.career.streak = Math.max(1, state.career.streak + 1);
    state.gym.reputation += 2 + (bk.title ? 8 : 0);
  } else if (lost) {
    b.reputation = Math.max(0, b.reputation - 4 - (ko ? 4 : 0));
    b.condition.confidence = clamp(b.condition.confidence - 15 - (ko ? 10 : 0), 0, 100);
    b.condition.morale = clamp(b.condition.morale - 20, 0, 100);
    state.career.streak = Math.min(-1, state.career.streak - 1);
  }
  // Sponsors : 2 défaites de suite.
  if (state.career.streak <= -2) state.sponsors = state.sponsors.filter((s) => { if (s.req.id === 'nolose2') { message(state, 'Sponsor perdu', s.name + ' se retire après deux défaites.', 'danger'); return false; } return true; });
  // Classement & titres.
  if (b.pro && opp.npc) {
    if (won) { b.points = (b.points || 0) + 40 + Math.max(0, (opp.rank ? 70 - opp.rank : 0)); opp.points -= 25; }
    else if (lost) { b.points = (b.points || 0) - 30; opp.points += 45; }
  }
  let legacy = 0;
  if (won) legacy += 1 + Math.max(0, qDiff * 0.08) + (ko ? 0.5 : 0) + (opp.rank && opp.rank <= 10 ? 4 : 0);
  if (won && bk.title && !(bk.weigh && !bk.weigh.made)) {
    if (['regional', 'national', 'continental'].includes(bk.title)) {
      div[bk.title] = b.id;
      const lab = { regional: 'Champion régional', national: 'Champion national', continental: 'Champion continental' }[bk.title];
      state.career.titlesWon.push({ day: state.day, title: lab });
      legacy += { regional: 5, national: 8, continental: 12 }[bk.title];
      notes.push('🏆 ' + lab + ' !');
    } else if (BODIES.some((bd) => bd.id === bk.title)) {
      const already = div.belts[bk.title] === b.id;
      // Le vainqueur récupère toutes les ceintures de l'adversaire.
      const taken = BODIES.filter((bd) => div.belts[bd.id] === opp.id).map((bd) => bd.id);
      if (!taken.includes(bk.title) && !already) taken.push(bk.title);
      for (const t of taken) div.belts[t] = b.id;
      if (bk.kind === 'defense') { state.career.defenses++; legacy += 10; notes.push('🛡 Défense de titre réussie'); }
      else {
        for (const t of taken) state.career.titlesWon.push({ day: state.day, title: 'Champion du monde ' + t });
        legacy += 25 * taken.length;
        notes.push('👑 CHAMPION DU MONDE ' + taken.join(' / ') + ' !');
      }
      const nb = playerBelts(state).length;
      if (nb === 4 && !state.flags.undisputed) { state.flags.undisputed = true; legacy += 50; notes.push('🌍 CHAMPION INCONTESTÉ — les 4 ceintures !'); state.career.titlesWon.push({ day: state.day, title: 'Champion incontesté' }); }
    }
    state.flags.mandatory = false;
  }
  if (won && bk.kind === 'eliminator') { state.flags.mandatory = true; notes.push('Challenger officiel : un combat pour le titre mondial arrive.'); }
  if (won && bk.kind === 'legend') { legacy += 40; notes.push('📜 Victoire historique contre une légende !'); state.career.titlesWon.push({ day: state.day, title: 'Vainqueur du combat historique vs ' + opp.lastName }); }
  if (lost && bk.title) {
    // Perte des ceintures en jeu.
    for (const bd of BODIES) if (div.belts[bd.id] === b.id) div.belts[bd.id] = opp.id;
    for (const t of ['regional', 'national', 'continental']) if (div[t] === b.id) div[t] = opp.id;
    if (state.flags.undisputed && playerBelts(state).length < 4) state.flags.undisputed = false;
  }
  if (!b.pro && won && !state.career.amateurTitle && b.record.amW >= 8) { state.career.amateurTitle = true; legacy += 3; notes.push('🥇 Champion amateur régional'); state.career.titlesWon.push({ day: state.day, title: 'Champion amateur régional' }); }
  state.career.legacy += legacy;
  state.coach.legacy += legacy;
  // Rivalités.
  const close = result.decision && (result.method === 'SD' || result.method === 'MD' || result.method === 'D');
  if (b.pro && (lost || close || bk.trashTalk)) {
    const rv = state.rivals[opp.id] || { name: fullName(opp), level: 0, history: [] };
    rv.level = clamp(rv.level + (lost ? 2 : 1) + (bk.trashTalk ? 1 : 0), 0, 5);
    rv.history.push(summary.result);
    rv.wantsRematch = lost || close;
    state.rivals[opp.id] = rv;
    if (rv.level >= 2) notes.push(`🔥 Rivalité avec ${opp.lastName} (niveau ${rv.level}/5)`);
  }
  // Mémoire de l'IA (revanche : l'adversaire se souvient de vos habitudes).
  if (opts.memory) state.memory[opp.id] = opts.memory;
  // Dégâts physiques et condition.
  const dmg = result.damage[0];
  b.damage.head += dmg.head * 0.1;
  b.damage.brain += (dmg.head > 60 ? 4 : 1) + (ko && lost ? 8 : 0) + dmg.downs * 2;
  b.condition.fatigue = clamp(b.condition.fatigue + 30 + bk.rounds * 2, 0, 100);
  b.condition.form = clamp(b.condition.form + 8, 0, 100);
  if (dmg.cuts > 0.4) b.injuries.push({ name: 'Arcade ouverte (points de suture)', zone: 'tete', affects: ['chin', 'mental'], days: 14, total: 14, severity: 0.3 });
  if (dmg.head > 55 || (ko && lost)) b.injuries.push({ name: 'Commotion (repos médical obligatoire)', zone: 'tete', affects: ['chin', 'reflexes', 'mental'], days: ko && lost ? 45 : 21, total: 30, severity: 0.6 });
  if (dmg.body > 55) b.injuries.push({ name: 'Côtes contusionnées', zone: 'cotes', affects: ['endurance', 'cardio'], days: 14, total: 14, severity: 0.35 });
  // Expérience de combat : gains réels sur les attributs.
  const xp = 60 + bk.rounds * 12 + (won ? 50 : 20) + Math.max(0, qDiff * 2);
  const before = levelFromXp(b.xp).level;
  b.xp += Math.round(xp);
  const after = levelFromXp(b.xp).level;
  if (after > before) notes.push('⭐ Niveau ' + after);
  b.experience = clamp((b.experience || 0) + 2 + bk.rounds * 0.3, 0, 100);
  const grow = (k, v) => { b.attrs[k] = clamp(b.attrs[k] + v * (b.potential[k] - b.attrs[k]) / b.potential[k], 1, b.potential[k]); };
  grow('mental', 1.8); grow('chin', 0.4); grow('technique', 0.9); grow('reflexes', 0.6); grow('footwork', 0.5);
  state.coach.xp += Math.round(xp / 2);
  state.coach.skill = clamp(Math.floor(state.coach.xp / 600), 0, 20);
  // Passage pro.
  if (!b.pro && (b.record.amW >= 5 || b.record.amW + b.record.amL >= 9) && !state.flags.proOffered) {
    state.flags.proOffered = true;
    state.pending.push({ type: 'proOffer', id: uid('ev') });
  }
  // Tournoi amateur : enchaîner les tours.
  if (bk.tournament) {
    const stageNames = ['', 'quart de finale', 'demi-finale', 'finale'];
    if (won && bk.tournament.stage < 3) {
      const st = bk.tournament.stage + 1;
      const o2 = __makeAmateurFor(state, 3 * st);
      const off = makeOffer(state, o2, 'amateur', { lead: 2, note: 'Tournoi — ' + stageNames[st] });
      off.tournament = { stage: st };
      summary._next = off;
      notes.push('Qualifié pour la ' + stageNames[st] + ' du tournoi');
    } else if (won) {
      notes.push('🏆 Vainqueur du tournoi amateur !');
      state.career.titlesWon.push({ day: state.day, title: 'Vainqueur du tournoi amateur' });
      b.reputation += 8; state.gym.reputation += 5; state.career.legacy += 2;
    } else notes.push('Éliminé en ' + stageNames[bk.tournament.stage]);
  }
  if (bk.kind === 'legend' && won && opp.legendId) state.flags['beat_' + opp.legendId] = true;
  summary.notes = notes;
  summary.legacy = Math.round(legacy * 10) / 10;
  b.history.unshift(summary);
  state.lastFight = summary;
  state.booked = null;
  state.scouting = 0;
  rerank(div, b);
  updateTier(state);
  updateObjectives(state);
  if (summary._next) { const off = summary._next; delete summary._next; state.offers = [off]; acceptOffer(state, off.id); }
  else refreshOffers(state);
  return summary;
}

export function turnPro(state) {
  const b = state.boxer;
  b.pro = true;
  b.points = 0;
  b.reputation += 10;
  message(state, '🎉 Passage professionnel', `${fullName(b)} signe sa licence professionnelle ! Premiers combats en 4 rounds, puis 6, 8, 10 et 12 rounds pour les titres.`, 'success');
  state.career.milestones.push({ day: state.day, text: 'Passage professionnel (' + b.record.amW + '-' + b.record.amL + ' en amateur)' });
  state.offers = [];
  refreshOffers(state);
  updateTier(state);
  updateObjectives(state);
}

export function retire(state) {
  const b = state.boxer;
  state.career.retired = true;
  const entry = { name: fullName(b), record: recordStr(b), ko: b.record.ko, titles: state.career.titlesWon.map((t) => t.title), peak: TIERS[state.career.peakTier], legacy: Math.round(state.career.legacy), retiredDay: state.day };
  state.hallOfFame.push(entry);
  message(state, 'Retraite', `${fullName(b)} raccroche les gants. Palmarès : ${entry.record} (${entry.ko} KO). Sommet : ${entry.peak}.`);
  return entry;
}

// Nouveau poulain : on garde le club, le staff, l'argent et l'héritage du coach.
export function newProtege(state, boxer) {
  boxer.isPlayer = true;
  boxer.startDay = state.day;
  boxer.pro = false;
  state.boxer = boxer;
  state.career = { tier: 1, peakTier: 1, legacy: 0, titlesWon: [], defenses: 0, beltsHeld: [], amateurTitle: false, milestones: [], streak: 0, retired: false };
  state.flags = {};
  state.offers = []; state.booked = null; state.rivals = {}; state.memory = {};
  state.coach.boxersTrained++;
  division(state);
  refreshOffers(state);
  updateObjectives(state);
}

export function legacyRating(state) {
  const l = state.career.legacy;
  if (l >= 700) return 'Plus grand de tous les temps';
  if (l >= 450) return 'Légende immortelle';
  if (l >= 250) return 'Futur Hall of Fame';
  if (l >= 120) return 'Grand champion';
  if (l >= 50) return 'Boxeur respecté';
  if (l >= 15) return 'Espoir prometteur';
  return 'Inconnu';
}

export function __makeAmateurFor(state, delta) {
  return makeAmateur(state.boxer.weightClass, clamp(overall(state.boxer) + delta + randRange(-4, 4), 8, 80));
}
export function __npcFor(state, q) {
  const o = makeNPC(state.boxer.weightClass, q);
  o.temp = true; o.rank = null;
  return o;
}

bindCareer({ turnPro, message, refreshOffers, acceptOffer, makeOffer, division, playerRank, ledger, __makeAmateurFor, __npcFor });
