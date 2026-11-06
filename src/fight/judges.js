// Trois juges, système des 10 points obligatoires. Chaque juge a ses préférences
// (coups propres, agressivité efficace, défense) et une part d'incertitude humaine.
import { gauss } from '../core/util.js';

export const JUDGES = [
  { name: 'Juge A', clean: 1.0, aggression: 0.6, defense: 0.4, power: 1.2 },
  { name: 'Juge B', clean: 1.2, aggression: 0.3, defense: 0.8, power: 0.9 },
  { name: 'Juge C', clean: 0.9, aggression: 1.0, defense: 0.2, power: 1.4 },
];

function roundScore(s, opp, j) {
  return s.landed * j.clean * 0.8 + s.powerLanded * j.power * 0.9 + s.damage * 0.12 * j.power +
    s.aggression * j.aggression * 0.35 + (s.evaded + s.blocked * 0.5) * j.defense * 0.25 + s.counters * 0.6;
}

export function scoreRound(engine) {
  const sa = engine.a.roundStats, sb = engine.b.roundStats;
  const cards = JUDGES.map((j) => {
    let va = roundScore(sa, sb, j) + gauss(0, 1.6);
    let vb = roundScore(sb, sa, j) + gauss(0, 1.6);
    let a = 10, b = 10;
    const diff = va - vb;
    if (Math.abs(diff) < 0.7) { /* round égal 10-10 */ }
    else if (diff > 0) b = Math.abs(diff) > 22 ? 8 : 9;
    else a = Math.abs(diff) > 22 ? 8 : 9;
    // Knockdowns : -1 point par chute.
    if (sa.knockdowns || sb.knockdowns) {
      a = 10; b = 10;
      const net = sa.knockdowns - sb.knockdowns;
      if (net > 0) b = 10 - net - (diff > 6 ? 1 : 0);
      else if (net < 0) a = 10 + net - (diff < -6 ? 1 : 0);
      else if (diff > 0) b = 9; else a = 9;
    }
    return [Math.max(6, a), Math.max(6, b)];
  });
  return { cards };
}

export function totals(scorecards) {
  return scorecards.map((card) => card.reduce((acc, r) => [acc[0] + r[0], acc[1] + r[1]], [0, 0]));
}

export function finalDecision(scorecards) {
  const t = totals(scorecards);
  let wa = 0, wb = 0, dr = 0;
  for (const [a, b] of t) { if (a > b) wa++; else if (b > a) wb++; else dr++; }
  const label = t.map(([a, b]) => `${a}-${b}`).join(', ');
  if (wa === 3) return { winner: 0, method: 'UD', label: 'Décision unanime (' + label + ')', totals: t };
  if (wb === 3) return { winner: 1, method: 'UD', label: 'Décision unanime (' + label + ')', totals: t };
  if (wa === 2 && wb === 1) return { winner: 0, method: 'SD', label: 'Décision partagée (' + label + ')', totals: t };
  if (wb === 2 && wa === 1) return { winner: 1, method: 'SD', label: 'Décision partagée (' + label + ')', totals: t };
  if (wa === 2 && dr === 1) return { winner: 0, method: 'MD', label: 'Décision majoritaire (' + label + ')', totals: t };
  if (wb === 2 && dr === 1) return { winner: 1, method: 'MD', label: 'Décision majoritaire (' + label + ')', totals: t };
  return { winner: null, method: 'D', label: 'Match nul (' + label + ')', totals: t };
}

export const METHOD_NAMES = { KO: 'KO', TKO: 'KO technique', UD: 'Décision unanime', SD: 'Décision partagée', MD: 'Décision majoritaire', D: 'Match nul', RTD: 'Abandon' };
