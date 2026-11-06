// Utilitaires partagés : RNG déterministe, maths, formatage.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// RNG global de la partie (remplaçable par une graine pour les tests).
let _rng = Math.random;
export function setRng(fn) { _rng = fn; }
export function rand() { return _rng(); }
export function randRange(a, b) { return a + (b - a) * _rng(); }
export function randInt(a, b) { return Math.floor(a + (b - a + 1) * _rng()); }
export function chance(p) { return _rng() < p; }
export function pick(arr) { return arr[Math.floor(_rng() * arr.length)]; }
export function gauss(mean = 0, sd = 1) {
  let u = 0, v = 0;
  while (u === 0) u = _rng();
  while (v === 0) v = _rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export function weightedPick(entries) {
  // entries: [[value, weight], ...]
  let total = 0;
  for (const e of entries) total += Math.max(0, e[1]);
  if (total <= 0) return entries[0][0];
  let r = _rng() * total;
  for (const e of entries) {
    r -= Math.max(0, e[1]);
    if (r <= 0) return e[0];
  }
  return entries[entries.length - 1][0];
}
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(_rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);

let _uid = Date.now() % 100000;
export function uid(prefix = 'id') { return prefix + '_' + (++_uid).toString(36) + Math.floor(_rng() * 1e6).toString(36); }

export function fmtMoney(v) {
  const s = Math.round(v).toLocaleString('fr-FR');
  return s.replace(/ | /g, ' ') + ' €';
}

export function deepClone(o) { return JSON.parse(JSON.stringify(o)); }
