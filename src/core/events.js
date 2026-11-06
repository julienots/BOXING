// Événements dynamiques à choix multiples (avec conséquences réelles).
import { clamp, chance, pick, randInt, randRange, uid, fmtMoney } from './util.js';
import { fullName, overall } from './boxer.js';
import { makeInjury } from './training.js';
import { legendBoxer, LEGENDS } from '../data/legends.js';

// Import différé pour éviter la dépendance circulaire avec career.js.
let C = null;
export function bindCareer(mod) { C = mod; }

const EVENT_DEFS = {
  proOffer: {
    title: () => 'Proposition de licence professionnelle',
    text: (s) => `Après ${s.boxer.record.amW} victoires en amateur, un promoteur local propose à ${s.boxer.firstName} de passer professionnel. Plus d'argent, plus de risques, et des combats plus longs.`,
    choices: [
      { label: 'Passer professionnel', apply: (s) => { C.turnPro(s); return 'Nouvelle ère : la carrière professionnelle commence !'; } },
      { label: 'Rester amateur pour progresser', apply: (s) => { s.flags.proOffered = false; s.flags.proDelay = s.day + 60; s.boxer.attrs.technique += 0.5; return 'Vous gardez votre boxeur chez les amateurs encore un peu. L\'offre reviendra.'; } },
    ],
  },
  injuryCamp: {
    title: () => 'Blessure pendant le camp',
    text: (s, ev) => `${s.boxer.firstName} s'est blessé à l'entraînement (${ev.data.inj.name}). Le combat a lieu dans ${s.booked.day - s.day} jours.`,
    choices: [
      { label: 'Combattre quand même', apply: (s, ev) => { s.boxer.injuries.push(ev.data.inj); s.boxer.condition.morale -= 5; return 'Il combattra blessé. Les attributs touchés seront diminués.'; } },
      { label: 'Reporter le combat (réputation -)', apply: (s, ev) => { s.boxer.injuries.push(ev.data.inj); s.boxer.reputation = Math.max(0, s.boxer.reputation - 4); C.message(s, 'Combat annulé', 'Le promoteur est mécontent mais comprend.'); s.booked = null; C.refreshOffers(s); return 'Combat annulé. Priorité à la guérison.'; } },
    ],
  },
  oppChange: {
    title: () => 'Changement d\'adversaire',
    text: (s, ev) => `${s.booked.oppName} déclare forfait (blessure). Le promoteur propose un remplaçant : ${ev.data.name} (${ev.data.record}), ${ev.data.harder ? 'plus dangereux' : 'moins coté'}.`,
    choices: [
      { label: 'Accepter le remplaçant', apply: (s, ev) => { const o = ev.data.opp; s.booked.oppId = o.id; s.booked.opp = o.amateur || o.temp ? o : null; s.booked.oppName = fullName(o); s.booked.oppStyle = o.style; s.booked.oppRating = overall(o); s.booked.purse = Math.round(s.booked.purse * (ev.data.harder ? 1.2 : 0.85)); s.scouting = 0; return 'Nouveau plan de combat à préparer : l\'analyse vidéo repart de zéro.'; } },
      { label: 'Annuler le combat', apply: (s) => { s.booked = null; C.refreshOffers(s); return 'Combat annulé.'; } },
    ],
  },
  bigOffer: {
    title: () => 'Offre inattendue !',
    text: (s, ev) => `Un boxeur s'est blessé à 12 jours d'un gros gala. On vous propose de le remplacer face à ${ev.data.name} (#${ev.data.rank}), bourse ${fmtMoney(ev.data.offer.purse)}. Préavis très court !`,
    choices: [
      { label: 'Accepter (préavis court)', apply: (s, ev) => { s.offers = [ev.data.offer]; C.acceptOffer(s, ev.data.offer.id); return 'Pari risqué : préparez-vous vite !'; } },
      { label: 'Décliner', apply: () => 'Vous refusez : trop risqué sans camp complet.' },
    ],
  },
  tournament: {
    title: () => 'Tournoi amateur',
    text: () => 'Le comité régional organise un tournoi à élimination directe (quarts, demies, finale) dans 2 semaines. Le vainqueur gagne un trophée et une forte réputation.',
    choices: [
      { label: 'Inscrire le boxeur', apply: (s) => {
        const opp = C.__makeAmateurFor(s, 0);
        const off = C.makeOffer(s, opp, 'amateur', { lead: 14, note: 'Tournoi — quart de finale' });
        off.tournament = { stage: 1 }; s.offers = [off]; C.acceptOffer(s, off.id); return 'Inscription validée. Quart de finale dans 14 jours.'; } },
      { label: 'Pas cette fois', apply: () => 'Vous passez votre tour.' },
    ],
  },
  trashTalk: {
    title: () => 'Provocation sur les réseaux',
    text: (s, ev) => `${ev.data.name} se moque publiquement de ${s.boxer.firstName} : « Il est surcoté, je le mets KO quand il veut. »`,
    choices: [
      { label: 'Répondre avec du feu', apply: (s, ev) => { s.boxer.reputation += 3; s.boxer.condition.confidence = clamp(s.boxer.condition.confidence + 4, 0, 100); const rv = s.rivals[ev.data.id] || { name: ev.data.name, level: 0, history: [] }; rv.level = clamp(rv.level + 1, 0, 5); rv.wantsRematch = true; s.rivals[ev.data.id] = rv; return 'Le buzz explose. Une rivalité médiatique est née — un combat pourrait être proposé.'; } },
      { label: 'Ignorer, rester pro', apply: (s) => { s.boxer.condition.morale = clamp(s.boxer.condition.morale + 2, 0, 100); return 'Silence professionnel. Le public apprécie votre sérieux.'; } },
    ],
  },
  interview: {
    title: () => 'Demande d\'interview',
    text: (s) => `Une chaîne sportive veut une interview de ${s.boxer.firstName}.`,
    choices: [
      { label: 'Humble et travailleur', apply: (s) => { s.boxer.reputation += 1; s.gym.reputation += 2; return 'Image propre, le club gagne en crédibilité.'; } },
      { label: 'Showman, annonce des KO', apply: (s) => { s.boxer.reputation += 4; s.boxer.condition.confidence = clamp(s.boxer.condition.confidence + 3, 0, 100); s.flags.hypeBonus = (s.flags.hypeBonus || 0) + 1; return 'Les fans adorent ou détestent : la popularité grimpe.'; } },
      { label: 'Refuser (concentration)', apply: (s) => { s.boxer.condition.motivation = clamp(s.boxer.condition.motivation + 3, 0, 100); return 'Concentration maximale.'; } },
    ],
  },
  party: {
    title: () => 'Soirée tentante',
    text: (s) => `${s.boxer.firstName} est invité à une grosse soirée ce week-end. Il en a envie.`,
    choices: [
      { label: 'Autoriser', apply: (s) => { s.boxer.condition.morale = clamp(s.boxer.condition.morale + 12, 0, 100); s.boxer.condition.fatigue = clamp(s.boxer.condition.fatigue + 15, 0, 100); s.boxer.weight += 0.6; return 'Moral au top, mais fatigue et poids en hausse.'; } },
      { label: 'Refuser fermement', apply: (s) => { s.boxer.condition.morale = clamp(s.boxer.condition.morale - 6, 0, 100); s.boxer.condition.motivation = clamp(s.boxer.condition.motivation + 4, 0, 100); return 'Il boude un peu, mais reste focalisé.'; } },
    ],
  },
  raise: {
    title: () => 'Le boxeur négocie',
    text: (s, ev) => `${s.boxer.firstName} estime mériter plus : il demande une prime de ${fmtMoney(ev.data.amount)} pour rester motivé.`,
    choices: [
      { label: 'Payer la prime', apply: (s, ev) => { C.ledger(s, 'Prime au boxeur', -ev.data.amount); s.boxer.condition.motivation = clamp(s.boxer.condition.motivation + 15, 0, 100); s.boxer.condition.morale = clamp(s.boxer.condition.morale + 10, 0, 100); return 'Il est ravi et s\'entraîne avec rage.'; } },
      { label: 'Refuser', apply: (s) => { s.boxer.condition.motivation = clamp(s.boxer.condition.motivation - 15, 0, 100); s.boxer.condition.morale = clamp(s.boxer.condition.morale - 10, 0, 100); return 'Tension dans le vestiaire : la motivation chute.'; } },
    ],
  },
  roof: {
    title: () => 'Fuite dans la toiture',
    text: () => 'Une fuite inonde une partie de la salle. Réparation estimée : 900 €.',
    choices: [
      { label: 'Réparer (900 €)', apply: (s) => { C.ledger(s, 'Réparation toiture', -900); return 'Réparé.'; } },
      { label: 'Bricoler (gratuit)', apply: (s) => { s.gym.reputation = Math.max(0, s.gym.reputation - 3); s.boxer.condition.morale -= 4; return 'Seau et bâche... Les adhérents ne sont pas impressionnés.'; } },
    ],
  },
  youngTalent: {
    title: () => 'Les jeunes affluent',
    text: () => 'Les résultats de votre boxeur attirent des jeunes du quartier qui veulent s\'inscrire. Organiser une journée portes ouvertes (300 €) ?',
    choices: [
      { label: 'Organiser (300 €)', apply: (s) => { C.ledger(s, 'Portes ouvertes', -300); s.gym.reputation += 6; return 'Succès ! Nouveaux adhérents à venir.'; } },
      { label: 'Pas le temps', apply: () => 'Une autre fois.' },
    ],
  },
  campInvite: {
    title: () => 'Invitation dans un camp d\'élite',
    text: (s, ev) => `Le champion ${ev.data.name} invite ${s.boxer.firstName} comme partenaire de sparring pour 5 jours. Payé ${fmtMoney(ev.data.pay)}, très formateur mais éprouvant.`,
    choices: [
      { label: 'Accepter', apply: (s, ev) => { const b = s.boxer; C.ledger(s, 'Sparring camp ' + ev.data.name, ev.data.pay); for (const k of ['mental', 'reflexes', 'evasion', 'blocking', 'technique']) b.attrs[k] = Math.min(b.potential[k], b.attrs[k] + randRange(0.6, 1.6)); b.condition.fatigue = clamp(b.condition.fatigue + 30, 0, 100); if (chance(0.15)) { const inj = makeInjury('tete', 0.3); b.injuries.push(inj); return 'Énorme expérience acquise... mais il revient avec : ' + inj.name; } return 'Énorme expérience acquise face à un champion.'; } },
      { label: 'Décliner', apply: () => 'Vous préférez votre propre plan.' },
    ],
  },
  legendChallenge: {
    title: () => '📜 Combat historique',
    text: (s, ev) => `Un promoteur visionnaire organise un « combat hors du temps » : ${s.boxer.firstName} contre la légende ${ev.data.name} (${ev.data.era}), reconstituée à son apogée. Bourse : ${fmtMoney(ev.data.offer.purse)}.`,
    choices: [
      { label: 'Accepter le défi', apply: (s, ev) => { s.offers = [ev.data.offer]; C.acceptOffer(s, ev.data.offer.id); return 'Le monde entier regardera.'; } },
      { label: 'Refuser', apply: () => 'Peut-être plus tard...'},
    ],
  },
};

export function eventDef(type) { return EVENT_DEFS[type]; }

export function rollRandomEvent(state) {
  const b = state.boxer;
  if (state.pending.length) return null;
  if (state.flags.proOffered === false && state.flags.proDelay && state.day >= state.flags.proDelay && !b.pro) {
    state.flags.proOffered = true; state.flags.proDelay = 0;
    return mk('proOffer');
  }
  if (!chance(0.06)) return null;
  const options = [];
  if (state.booked && state.booked.day - state.day > 4 && b.condition.fatigue > 55) {
    options.push(['injuryCamp', 3, () => ({ inj: makeInjury(pick(['main', 'epaule', 'jambe', 'dos']), b.condition.fatigue / 120) })]);
  }
  if (state.booked && state.booked.day - state.day > 6 && !state.booked.tournament && state.booked.kind !== 'legend') {
    options.push(['oppChange', 0.8, () => {
      const harder = chance(0.5);
      const q = clamp((state.booked.oppRating || 40) + (harder ? randRange(3, 9) : -randRange(3, 9)), 10, 95);
      const opp = b.pro ? C.__npcFor(state, q) : C.__makeAmateurFor(state, harder ? 6 : -6);
      return { opp, name: fullName(opp), record: b.pro ? `${opp.record.w}-${opp.record.l}-${opp.record.d}` : `${opp.record.amW}-${opp.record.amL}`, harder };
    }]);
  }
  if (!state.booked && b.pro) {
    options.push(['bigOffer', 0.6, () => {
      const div = C.division(state);
      const rank = C.playerRank(state);
      const pool = div.fighters.filter((f) => f.rank < rank && f.rank >= Math.max(1, rank - 20) && !(f.busyUntil > state.day));
      if (!pool.length) return null;
      const opp = pick(pool);
      const offer = C.makeOffer(state, opp, 'regular', { lead: 12, note: 'Remplacement de dernière minute' });
      offer.purse = Math.round(offer.purse * 2.5);
      return { offer, name: fullName(opp), rank: opp.rank };
    }]);
  }
  if (!state.booked && !b.pro) options.push(['tournament', 1.2, () => ({})]);
  if (b.pro && b.reputation > 15) {
    options.push(['trashTalk', 1, () => { const div = C.division(state); const f = pick(div.fighters.slice(0, 40)); return { id: f.id, name: fullName(f) }; }]);
    options.push(['interview', 1, () => ({})]);
  }
  options.push(['party', 0.8, () => ({})]);
  if (b.pro && b.reputation > 40) options.push(['raise', 0.6, () => ({ amount: Math.round(300 + b.reputation * 25) })]);
  if (state.gym.level <= 2) options.push(['roof', 0.5, () => ({})]);
  if (b.reputation > 10) options.push(['youngTalent', 0.6, () => ({})]);
  if (b.pro && overall(b) > 45) options.push(['campInvite', 0.7, () => { const div = C.division(state); const f = div.fighters[0]; return { name: fullName(f), pay: Math.round(1000 + overall(b) * 40) }; }]);
  if (b.pro && state.career.legacy > 120 && !state.booked && !state.flags.legendFought) {
    options.push(['legendChallenge', 1.5, () => {
      const pool = LEGENDS.filter((l) => !state.flags['beat_' + l.id]);
      const L = pick(pool.length ? pool : LEGENDS);
      const opp = legendBoxer(L.id);
      opp.weightClass = b.weightClass;
      opp.rating = overall(opp);
      const offer = C.makeOffer(state, opp, 'legend', { lead: 45, note: 'Combat historique' });
      offer.purse = Math.round(offer.purse * 1.5);
      return { offer, name: fullName(opp), era: L.eraName, legendId: L.id };
    }]);
  }
  if (!options.length) return null;
  let total = options.reduce((a, o) => a + o[1], 0), r = Math.random() * total;
  for (const o of options) {
    r -= o[1];
    if (r <= 0) { const data = o[2](); if (!data) return null; return mk(o[0], data); }
  }
  return null;
}

function mk(type, data = {}) { return { id: uid('ev'), type, data }; }

export function resolveEvent(state, ev, choiceIdx) {
  const def = EVENT_DEFS[ev.type];
  state.pending = state.pending.filter((p) => p.id !== ev.id);
  if (!def) return '';
  const ch = def.choices[choiceIdx];
  const msg = ch.apply(state, ev);
  if (ev.type === 'legendChallenge' && choiceIdx === 0) state.flags.legendFought = true;
  return msg;
}

// ------------------------------------------------------------------ conférence de presse
const PRESS_Q = [
  'Votre adversaire dit que vous n\'avez jamais affronté quelqu\'un de son niveau. Votre réponse ?',
  'Comment se passe le camp d\'entraînement ?',
  'Un pronostic pour ce combat ?',
  'On dit que vous avez du mal à faire le poids. C\'est vrai ?',
  'Que pensez-vous du style de votre adversaire ?',
  'Ce combat est-il le plus important de votre carrière ?',
];
export const PRESS_TONES = [
  { id: 'respect', label: 'Respectueux', text: ['C\'est un grand boxeur, je le respecte. Que le meilleur gagne.', 'Le camp s\'est très bien passé, on a beaucoup travaillé.', 'Je me suis préparé sérieusement, le ring décidera.'] },
  { id: 'confident', label: 'Confiant', text: ['Je suis prêt. Il va découvrir un autre niveau.', 'Je n\'ai jamais été aussi affûté.', 'Victoire, et nette.'] },
  { id: 'trash', label: 'Provocateur', text: ['Il parle beaucoup pour quelqu\'un qui va dormir au tapis.', 'Qu\'il profite de son visage tant qu\'il est intact.', 'KO avant la mi-combat. Notez-le.'] },
];

export function pressQuestions() {
  const qs = PRESS_Q.slice().sort(() => Math.random() - 0.5).slice(0, 3);
  return qs;
}

// Applique les réponses (liste d'ids de ton). Retourne un résumé.
export function applyPress(state, tones) {
  const b = state.boxer, bk = state.booked;
  let hype = 0, conf = 0, oppMot = 0, rep = 0;
  for (const t of tones) {
    if (t === 'respect') { rep += 1; conf += 1; }
    if (t === 'confident') { hype += 1; conf += 3; oppMot += 1; rep += 1; }
    if (t === 'trash') { hype += 2.5; conf += 2; oppMot += 3; rep += chance(0.5) ? 2 : -1; }
  }
  bk.hype = (bk.hype || 0) + hype + (state.flags.hypeBonus || 0);
  state.flags.hypeBonus = 0;
  bk.oppMotivation = (bk.oppMotivation || 0) + oppMot;
  bk.trashTalk = tones.filter((t) => t === 'trash').length >= 2;
  b.condition.confidence = clamp(b.condition.confidence + conf, 0, 100);
  b.reputation = Math.max(0, b.reputation + rep);
  const lines = [];
  if (hype > 0) lines.push(`Engouement +${Math.round(hype * 4)} % sur la bourse (pay-per-view).`);
  if (oppMot > 2) lines.push('Votre adversaire est piqué au vif : il sera ultra-motivé.');
  if (bk.trashTalk) lines.push('Le ton monte : une rivalité se dessine.');
  lines.push(`Confiance du boxeur +${conf}.`);
  return lines;
}

export const FACEOFF = [
  { id: 'stare', label: 'Regard noir, ne pas cligner', apply: (s) => { s.boxer.condition.confidence = clamp(s.boxer.condition.confidence + 4, 0, 100); return 'Duel de regards : votre boxeur ne recule pas.'; } },
  { id: 'smile', label: 'Sourire, rester détendu', apply: (s) => { s.boxer.condition.morale = clamp(s.boxer.condition.morale + 4, 0, 100); s.booked.oppMotivation = (s.booked.oppMotivation || 0) - 1; return 'Le calme déstabilise l\'adversaire.'; } },
  { id: 'shove', label: 'Le pousser (amende possible)', apply: (s) => { s.booked.hype = (s.booked.hype || 0) + 3; s.booked.oppMotivation = (s.booked.oppMotivation || 0) + 2; if (chance(0.5)) { C.ledger(s, 'Amende de la commission (face-à-face)', -Math.round(250 + s.booked.purse * 0.03)); return 'Échauffourée ! La vidéo fait le tour du monde... amende infligée.'; } return 'Échauffourée ! La vidéo fait le tour du monde.'; } },
];
