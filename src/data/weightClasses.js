// Catégories officielles de la boxe professionnelle masculine (17).
// Limites exactes en livres (référence officielle), converties en kg (1 lb = 0.45359237 kg).
// Les limites sont configurables via les paramètres (overrides sauvegardés).

export const LB = 0.45359237;

export const DEFAULT_WEIGHT_CLASSES = [
  { id: 'minimum',      name: 'Poids minimum',  en: 'Minimumweight',     lb: 105 },
  { id: 'lightfly',     name: 'Mi-mouches',     en: 'Light Flyweight',   lb: 108 },
  { id: 'fly',          name: 'Mouches',        en: 'Flyweight',         lb: 112 },
  { id: 'superfly',     name: 'Super-mouches',  en: 'Super Flyweight',   lb: 115 },
  { id: 'bantam',       name: 'Coqs',           en: 'Bantamweight',      lb: 118 },
  { id: 'superbantam',  name: 'Super-coqs',     en: 'Super Bantamweight',lb: 122 },
  { id: 'feather',      name: 'Plumes',         en: 'Featherweight',     lb: 126 },
  { id: 'superfeather', name: 'Super-plumes',   en: 'Super Featherweight', lb: 130 },
  { id: 'light',        name: 'Légers',         en: 'Lightweight',       lb: 135 },
  { id: 'superlight',   name: 'Super-légers',   en: 'Super Lightweight', lb: 140 },
  { id: 'welter',       name: 'Welters',        en: 'Welterweight',      lb: 147 },
  { id: 'superwelter',  name: 'Super-welters',  en: 'Super Welterweight',lb: 154 },
  { id: 'middle',       name: 'Moyens',         en: 'Middleweight',      lb: 160 },
  { id: 'supermiddle',  name: 'Super-moyens',   en: 'Super Middleweight',lb: 168 },
  { id: 'lightheavy',   name: 'Mi-lourds',      en: 'Light Heavyweight', lb: 175 },
  { id: 'cruiser',      name: 'Lourds-légers',  en: 'Cruiserweight',     lb: 200 },
  { id: 'heavy',        name: 'Lourds',         en: 'Heavyweight',       lb: Infinity },
];

let overrides = {};

export function setWeightOverrides(o) { overrides = o || {}; }
export function getWeightOverrides() { return { ...overrides }; }

export function weightClasses() {
  return DEFAULT_WEIGHT_CLASSES.map((c) => {
    const lb = overrides[c.id] != null ? overrides[c.id] : c.lb;
    return { ...c, lb, kg: lb === Infinity ? Infinity : Math.round(lb * LB * 1000) / 1000 };
  });
}

export function getClass(id) {
  return weightClasses().find((c) => c.id === id) || weightClasses()[10];
}

export function classIndex(id) {
  return DEFAULT_WEIGHT_CLASSES.findIndex((c) => c.id === id);
}

// Limite basse (= limite de la catégorie précédente), utile pour générer les adversaires.
export function classRange(id) {
  const all = weightClasses();
  const i = all.findIndex((c) => c.id === id);
  const lo = i > 0 ? all[i - 1].kg : 44;
  const hi = all[i].kg === Infinity ? 115 : all[i].kg;
  return { lo, hi };
}

// Catégorie naturelle pour un poids de combat donné.
export function classForWeight(kg) {
  const all = weightClasses();
  for (const c of all) if (kg <= c.kg) return c;
  return all[all.length - 1];
}

export function formatLimit(c) {
  if (c.kg === Infinity) return '+ ' + weightClasses()[15].kg.toFixed(1) + ' kg';
  return c.kg.toFixed(1) + ' kg (' + c.lb + ' lb)';
}
