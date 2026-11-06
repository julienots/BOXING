// Définition des coups. Temps en secondes (avant modificateur de vitesse), portée relative à l'allonge.
// kind : straight (direct), hook (crochet), upper (uppercut). hand : lead (main avant) / rear (main arrière).

export const PUNCHES = {
  jab:    { name: 'Jab',             kind: 'straight', hand: 'lead', dmg: 4.0,  startup: 0.11, active: 0.06, recovery: 0.17, reach: 1.00, stam: 1.6, acc: 0.80, risk: 0.10 },
  cross:  { name: 'Direct',          kind: 'straight', hand: 'rear', dmg: 9.0,  startup: 0.18, active: 0.07, recovery: 0.25, reach: 0.98, stam: 3.4, acc: 0.70, risk: 0.30 },
  lhook:  { name: 'Crochet avant',   kind: 'hook',     hand: 'lead', dmg: 10.0, startup: 0.20, active: 0.07, recovery: 0.28, reach: 0.78, stam: 3.8, acc: 0.66, risk: 0.35 },
  rhook:  { name: 'Crochet arrière', kind: 'hook',     hand: 'rear', dmg: 12.5, startup: 0.25, active: 0.08, recovery: 0.33, reach: 0.76, stam: 4.8, acc: 0.60, risk: 0.45 },
  lupper: { name: 'Uppercut avant',  kind: 'upper',    hand: 'lead', dmg: 10.0, startup: 0.19, active: 0.07, recovery: 0.30, reach: 0.62, stam: 3.8, acc: 0.64, risk: 0.40 },
  rupper: { name: 'Uppercut arrière',kind: 'upper',    hand: 'rear', dmg: 13.0, startup: 0.24, active: 0.08, recovery: 0.34, reach: 0.60, stam: 4.8, acc: 0.58, risk: 0.50 },
};
export const PUNCH_KEYS = Object.keys(PUNCHES);

// Libellé selon la garde (orthodoxe : main avant = gauche).
export function punchLabel(type, stance, target = 'head') {
  const p = PUNCHES[type];
  const leadSide = stance === 'southpaw' ? 'droit' : 'gauche';
  const rearSide = stance === 'southpaw' ? 'gauche' : 'droit';
  const side = p.hand === 'lead' ? leadSide : rearSide;
  let n;
  if (type === 'jab') n = 'Jab';
  else if (type === 'cross') n = 'Direct du ' + side;
  else if (p.kind === 'hook') n = 'Crochet ' + side;
  else n = 'Uppercut ' + side;
  return target === 'body' ? n + ' au corps' : n;
}

// Combinaisons nommées (notation boxe : 1 jab, 2 direct, 3 crochet avant, 4 crochet arrière, 5 uppercut avant, 6 uppercut arrière).
export const NUMBER = { jab: 1, cross: 2, lhook: 3, rhook: 4, lupper: 5, rupper: 6 };
export const NAMED_COMBOS = [
  { seq: ['jab', 'jab'], name: 'Double jab' },
  { seq: ['jab', 'cross'], name: 'Un-deux' },
  { seq: ['jab', 'cross', 'lhook'], name: '1-2-3' },
  { seq: ['jab', 'jab', 'cross'], name: '1-1-2' },
  { seq: ['cross', 'lhook', 'cross'], name: '2-3-2' },
  { seq: ['jab', 'rupper', 'lhook', 'cross'], name: '1-6-3-2' },
  { seq: ['lhook', 'rupper'], name: '3-6' },
  { seq: ['rhook', 'rupper'], name: 'Peek-a-boo 4-6' },
  { seq: ['lhook', 'rhook', 'lhook'], name: 'Rafale de crochets' },
  { seq: ['jab', 'cross', 'lhook', 'cross'], name: '1-2-3-2' },
  { seq: ['lupper', 'lhook', 'cross'], name: '5-3-2' },
];

export function detectCombo(seq) {
  let best = null;
  for (const c of NAMED_COMBOS) {
    if (seq.length < c.seq.length) continue;
    const tail = seq.slice(-c.seq.length);
    if (tail.every((t, i) => t === c.seq[i]) && (!best || c.seq.length > best.seq.length)) best = c;
  }
  return best;
}
