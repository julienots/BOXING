// Styles de boxe : chaque style définit le comportement de l'IA et des bonus d'entraînement.
// Paramètres IA (0..1) :
//  aggression : envie d'avancer et d'attaquer
//  range      : distance préférée (0 = corps à corps, 1 = longue distance)
//  workrate   : volume de coups
//  counter    : tendance à attendre et contrer
//  defense    : priorité donnée à la défense
//  slipPref   : préférence esquive (vs blocage)
//  bodyWork   : proportion de coups au corps
//  power      : préférence pour les coups puissants
//  clinch     : recours au clinch
//  mobility   : déplacements latéraux / tourner autour
//  feint      : usage des feintes
// mix : poids relatifs des coups (jab, cross, lhook, rhook, lupper, rupper)

export const STYLES = {
  aggressive: {
    name: 'Agressif', desc: 'Attaque sans relâche, accepte l\'échange.',
    ai: { aggression: 0.85, range: 0.35, workrate: 0.8, counter: 0.15, defense: 0.25, slipPref: 0.35, bodyWork: 0.3, power: 0.65, clinch: 0.1, mobility: 0.25, feint: 0.15 },
    mix: [1.0, 1.0, 1.0, 0.9, 0.5, 0.6],
    combos: [['jab', 'cross', 'lhook'], ['cross', 'lhook', 'cross'], ['lhook', 'rhook']],
  },
  counter: {
    name: 'Contreur', desc: 'Laisse venir, punit chaque erreur.',
    ai: { aggression: 0.3, range: 0.6, workrate: 0.45, counter: 0.9, defense: 0.65, slipPref: 0.75, bodyWork: 0.2, power: 0.55, clinch: 0.15, mobility: 0.5, feint: 0.4 },
    mix: [1.0, 1.2, 0.8, 0.7, 0.5, 0.6],
    combos: [['cross', 'lhook'], ['jab', 'cross'], ['rupper', 'lhook']],
  },
  defensive: {
    highGuard: 0.6, name: 'Défensif', desc: 'Garde hermétique, épuise l\'adversaire.',
    ai: { aggression: 0.25, range: 0.65, workrate: 0.4, counter: 0.6, defense: 0.9, slipPref: 0.5, bodyWork: 0.2, power: 0.35, clinch: 0.35, mobility: 0.55, feint: 0.25 },
    mix: [1.6, 0.9, 0.6, 0.4, 0.3, 0.3],
    combos: [['jab', 'jab'], ['jab', 'cross']],
  },
  technician: {
    name: 'Technicien', desc: 'Précision, variété, sens du placement.',
    ai: { aggression: 0.5, range: 0.6, workrate: 0.65, counter: 0.55, defense: 0.6, slipPref: 0.6, bodyWork: 0.35, power: 0.45, clinch: 0.15, mobility: 0.55, feint: 0.6 },
    mix: [1.4, 1.0, 0.9, 0.6, 0.6, 0.5],
    combos: [['jab', 'cross', 'lhook'], ['jab', 'jab', 'cross'], ['jab', 'cross', 'lhook', 'cross'], ['lhook', 'cross']],
  },
  puncher: {
    name: 'Frappeur puissant', desc: 'Chaque coup peut finir le combat.',
    ai: { aggression: 0.65, range: 0.45, workrate: 0.45, counter: 0.35, defense: 0.35, slipPref: 0.3, bodyWork: 0.3, power: 0.95, clinch: 0.1, mobility: 0.2, feint: 0.2 },
    mix: [0.7, 1.3, 1.1, 1.3, 0.6, 1.0],
    combos: [['jab', 'cross'], ['cross', 'lhook'], ['rhook'], ['rupper', 'lhook']],
  },
  outboxer: {
    name: 'Out-boxer', desc: 'Jab, distance et mobilité permanente.',
    ai: { aggression: 0.35, range: 0.9, workrate: 0.7, counter: 0.4, defense: 0.6, slipPref: 0.55, bodyWork: 0.15, power: 0.3, clinch: 0.2, mobility: 0.9, feint: 0.45 },
    mix: [2.0, 1.0, 0.5, 0.3, 0.2, 0.2],
    combos: [['jab', 'jab', 'cross'], ['jab', 'cross'], ['jab', 'jab']],
  },
  pressure: {
    highGuard: 0.4, name: 'Pressure fighter', desc: 'Coupe le ring, étouffe, travaille au corps.',
    ai: { aggression: 0.95, range: 0.2, workrate: 0.9, counter: 0.2, defense: 0.45, slipPref: 0.6, bodyWork: 0.5, power: 0.6, clinch: 0.05, mobility: 0.15, feint: 0.25 },
    mix: [0.8, 0.9, 1.2, 1.1, 0.9, 0.9],
    combos: [['lhook', 'rhook', 'lhook'], ['jab', 'cross', 'lhook'], ['lupper', 'lhook', 'cross']],
  },
  peekaboo: {
    highGuard: 0.8, name: 'Peek-a-boo', desc: 'Garde haute, mouvement de tête, explosivité et puissance.',
    ai: { aggression: 0.95, range: 0.15, workrate: 0.75, counter: 0.45, defense: 0.6, slipPref: 0.95, bodyWork: 0.45, power: 0.95, clinch: 0.05, mobility: 0.35, feint: 0.3 },
    mix: [0.6, 1.0, 1.4, 1.2, 1.0, 1.3],
    combos: [['rhook', 'rupper'], ['lhook', 'rupper', 'lhook'], ['rhook', 'lhook', 'rupper']],
  },
  swarmer: {
    name: 'Combattant rapproché', desc: 'Guerre au corps à corps, rugosité.',
    ai: { aggression: 0.9, range: 0.1, workrate: 0.85, counter: 0.35, defense: 0.4, slipPref: 0.5, bodyWork: 0.55, power: 0.7, clinch: 0.3, mobility: 0.2, feint: 0.35 },
    mix: [0.6, 0.9, 1.3, 1.2, 1.1, 1.0],
    combos: [['lhook', 'lupper'], ['rupper', 'lhook', 'rhook'], ['lhook', 'lhook', 'cross']],
  },
  slick: {
    highGuard: 0.5, name: 'Défense épaule (Philly)', desc: 'Roulé d\'épaule, précision chirurgicale, contres.',
    ai: { aggression: 0.35, range: 0.55, workrate: 0.5, counter: 0.95, defense: 0.95, slipPref: 0.85, bodyWork: 0.25, power: 0.45, clinch: 0.15, mobility: 0.45, feint: 0.55 },
    mix: [1.3, 1.5, 0.7, 0.6, 0.4, 0.6],
    combos: [['cross'], ['jab', 'cross'], ['cross', 'lhook']],
  },
  allround: {
    name: 'Polyvalent', desc: 'Tout faire bien, s\'adapter à chaque adversaire.',
    ai: { aggression: 0.6, range: 0.5, workrate: 0.7, counter: 0.6, defense: 0.6, slipPref: 0.6, bodyWork: 0.35, power: 0.6, clinch: 0.12, mobility: 0.5, feint: 0.5 },
    mix: [1.2, 1.1, 1.0, 0.9, 0.7, 0.7],
    combos: [['jab', 'cross', 'lhook'], ['lhook', 'cross', 'lhook'], ['jab', 'rupper', 'lhook'], ['cross', 'lhook', 'cross']],
  },
};

// Styles proposés à la création de boxeur (liste du cahier des charges + extras).
export const CREATOR_STYLES = ['aggressive', 'counter', 'defensive', 'technician', 'puncher', 'outboxer', 'pressure', 'peekaboo', 'swarmer', 'slick', 'allround'];

export function styleOf(id) { return STYLES[id] || STYLES.allround; }
