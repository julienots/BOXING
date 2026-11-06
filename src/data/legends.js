// Légendes fictives inspirées de grands STYLES de l'histoire de la boxe.
// Aucun nom, apparence ou licence de boxeur réel n'est reproduit : personnages originaux.
import { createBoxer, defaultAppearance, defaultOutfit } from '../core/boxer.js';

const L = (o) => o;

export const LEGENDS = [
  L({
    id: 'cyclone', firstName: 'Darnell', lastName: 'Kingsley', nickname: 'The Cyclone', flag: 'US', nationality: 'États-Unis',
    era: '1986', eraName: 'Années 80', weightClass: 'heavy', style: 'peekaboo', stance: 'orthodox',
    inspiration: 'Style peek-a-boo : garde haute, rotation de tête, explosivité et pression offensive dévastatrice.',
    attrs: { strength: 95, power: 99, speed: 92, reflexes: 95, endurance: 82, cardio: 80, accuracy: 90, evasion: 94, blocking: 85, footwork: 84, technique: 90, chin: 92, mental: 90, recovery: 85 },
    app: { skin: '#4e2c1b', height: 178, muscle: 1, shoulders: 0.95, arms: 0.95, reach: 0.15, chest: 1, legs: 0.9, belly: 0.05, hair: 'rase', beard: 'aucune', face: { jaw: 0.95, chin: 0.7, nose: 0.6, noseWidth: 0.85, noseBroken: 0.3, eyes: 0.35, brow: 0.85, cheek: 0.6, ears: 0.5, lips: 0.65 } },
    outfit: { gloves: '#121212', glovesAccent: '#121212', shorts: '#121212', shortsTrim: '#121212', shoes: '#121212', socks: '#121212', robe: '#f2f2f2', robeTrim: '#121212' },
    techniques: ['combo3', 'combo4', 'weave', 'liver', 'finisher', 'counterPro', 'pivot', 'feint'],
  }),
  L({
    id: 'butterfly', firstName: 'Elijah', lastName: 'Monroe', nickname: 'Silver Tongue', flag: 'US', nationality: 'États-Unis',
    era: '1971', eraName: 'Années 60-70', weightClass: 'heavy', style: 'outboxer', stance: 'orthodox',
    inspiration: 'Mobilité extraordinaire, vitesse de mains et de jambes, jab fouetté, mental de fer.',
    attrs: { strength: 82, power: 84, speed: 99, reflexes: 97, endurance: 94, cardio: 95, accuracy: 90, evasion: 97, blocking: 70, footwork: 99, technique: 92, chin: 97, mental: 99, recovery: 90 },
    app: { skin: '#8a5636', height: 191, muscle: 0.75, shoulders: 0.8, arms: 0.7, reach: 0.85, chest: 0.75, legs: 0.7, belly: 0.05, hair: 'court', beard: 'aucune', face: { jaw: 0.5, chin: 0.5, nose: 0.45, noseWidth: 0.55, noseBroken: 0, eyes: 0.6, brow: 0.4, cheek: 0.55, ears: 0.45, lips: 0.55 } },
    outfit: { gloves: '#b3121b', glovesAccent: '#f2f2f2', shorts: '#f2f2f2', shortsTrim: '#121212', shoes: '#f2f2f2', socks: '#f2f2f2', robe: '#f2f2f2', robeTrim: '#b3121b' },
    techniques: ['combo3', 'combo4', 'pivot', 'feint', 'counterPro', 'clinchPro', 'shoulder'],
  }),
  L({
    id: 'untouchable', firstName: 'Dorian', lastName: 'Vance', nickname: 'Untouchable', flag: 'US', nationality: 'États-Unis',
    era: '2007', eraName: 'Années 2000', weightClass: 'welter', style: 'slick', stance: 'orthodox',
    inspiration: 'Défense hermétique (roulé d\'épaule), précision chirurgicale, contres fulgurants, QI de ring.',
    attrs: { strength: 70, power: 78, speed: 96, reflexes: 99, endurance: 90, cardio: 92, accuracy: 99, evasion: 98, blocking: 98, footwork: 94, technique: 99, chin: 88, mental: 98, recovery: 92 },
    app: { skin: '#6b3f26', height: 173, muscle: 0.85, shoulders: 0.7, arms: 0.7, reach: 0.9, chest: 0.7, legs: 0.6, belly: 0, hair: 'degrade', beard: 'collier', face: { jaw: 0.55, chin: 0.45, nose: 0.4, noseWidth: 0.5, noseBroken: 0, eyes: 0.5, brow: 0.5, cheek: 0.5, ears: 0.4, lips: 0.5 } },
    outfit: { gloves: '#111111', glovesAccent: '#d4af37', shorts: '#111111', shortsTrim: '#d4af37', shoes: '#111111', socks: '#111111', robe: '#111111', robeTrim: '#d4af37' },
    techniques: ['combo3', 'combo4', 'pivot', 'feint', 'counterPro', 'clinchPro', 'shoulder'],
  }),
  L({
    id: 'manodehierro', firstName: 'Rafael', lastName: 'Quintero', nickname: 'Mano de Hierro', flag: 'PA', nationality: 'Panama',
    era: '1980', eraName: 'Années 70-80', weightClass: 'light', style: 'swarmer', stance: 'orthodox',
    inspiration: 'Agressivité féroce, combat rapproché, travail au corps, rage de vaincre.',
    attrs: { strength: 88, power: 92, speed: 90, reflexes: 92, endurance: 95, cardio: 92, accuracy: 90, evasion: 88, blocking: 84, footwork: 88, technique: 93, chin: 96, mental: 97, recovery: 90 },
    app: { skin: '#a86e48', height: 170, muscle: 0.9, shoulders: 0.8, arms: 0.8, reach: 0.45, chest: 0.8, legs: 0.7, belly: 0.05, hair: 'boucles', beard: 'pleine', face: { jaw: 0.8, chin: 0.6, nose: 0.6, noseWidth: 0.6, noseBroken: 0.5, eyes: 0.4, brow: 0.8, cheek: 0.6, ears: 0.5, lips: 0.5 } },
    outfit: { gloves: '#b3121b', glovesAccent: '#b3121b', shorts: '#0f3d91', shortsTrim: '#f2f2f2', shoes: '#141414', socks: '#141414', robe: '#0f3d91', robeTrim: '#f2f2f2' },
    techniques: ['combo3', 'combo4', 'liver', 'finisher', 'counterPro', 'feint', 'clinchPro'],
  }),
  L({
    id: 'velvet', firstName: 'Augustus', lastName: 'Bellamy', nickname: 'Velvet', flag: 'US', nationality: 'États-Unis',
    era: '1951', eraName: 'Années 40-50', weightClass: 'welter', style: 'allround', stance: 'orthodox',
    inspiration: 'Technique parfaite et polyvalence absolue : puissance, vitesse, défense, combinaisons.',
    attrs: { strength: 85, power: 93, speed: 97, reflexes: 96, endurance: 95, cardio: 95, accuracy: 97, evasion: 94, blocking: 90, footwork: 97, technique: 99, chin: 93, mental: 96, recovery: 93 },
    app: { skin: '#6b3f26', height: 180, muscle: 0.75, shoulders: 0.75, arms: 0.7, reach: 0.75, chest: 0.7, legs: 0.7, belly: 0, hair: 'court', beard: 'moustache', face: { jaw: 0.5, chin: 0.5, nose: 0.45, noseWidth: 0.55, noseBroken: 0, eyes: 0.55, brow: 0.45, cheek: 0.55, ears: 0.45, lips: 0.5 } },
    outfit: { gloves: '#7b1e1e', glovesAccent: '#7b1e1e', shorts: '#f2f2f2', shortsTrim: '#7b1e1e', shoes: '#141414', socks: '#f2f2f2', robe: '#f2f2f2', robeTrim: '#7b1e1e' },
    techniques: ['combo3', 'combo4', 'pivot', 'feint', 'counterPro', 'liver', 'finisher', 'clinchPro'],
  }),
  L({
    id: 'martillo', firstName: 'Héctor', lastName: 'Ríos Salvatierra', nickname: 'El Martillo', flag: 'MX', nationality: 'Mexique',
    era: '1990', eraName: 'Années 90', weightClass: 'superlight', style: 'pressure', stance: 'orthodox',
    inspiration: 'Pression constante, crochets au foie, menton de granit, guerre d\'usure.',
    attrs: { strength: 86, power: 88, speed: 84, reflexes: 86, endurance: 97, cardio: 96, accuracy: 89, evasion: 80, blocking: 88, footwork: 86, technique: 90, chin: 99, mental: 96, recovery: 94 },
    app: { skin: '#c68a5f', height: 171, muscle: 0.8, shoulders: 0.75, arms: 0.75, reach: 0.4, chest: 0.8, legs: 0.75, belly: 0.1, hair: 'court', beard: 'moustache', face: { jaw: 0.75, chin: 0.65, nose: 0.6, noseWidth: 0.65, noseBroken: 0.4, eyes: 0.4, brow: 0.7, cheek: 0.65, ears: 0.55, lips: 0.5 } },
    outfit: { gloves: '#0e7a3a', glovesAccent: '#f2f2f2', shorts: '#0e7a3a', shortsTrim: '#b3121b', shoes: '#141414', socks: '#141414', robe: '#0e7a3a', robeTrim: '#b3121b' },
    techniques: ['combo3', 'combo4', 'liver', 'finisher', 'counterPro', 'clinchPro'],
  }),
  L({
    id: 'tornado', firstName: 'Tomás', lastName: 'Bayani', nickname: 'Tornado', flag: 'PH', nationality: 'Philippines',
    era: '2009', eraName: 'Années 2000', weightClass: 'welter', style: 'aggressive', stance: 'southpaw',
    inspiration: 'Gaucher explosif, volume de coups ahurissant, angles imprévisibles, vitesse.',
    attrs: { strength: 78, power: 88, speed: 99, reflexes: 94, endurance: 95, cardio: 97, accuracy: 90, evasion: 88, blocking: 80, footwork: 96, technique: 90, chin: 92, mental: 95, recovery: 92 },
    app: { skin: '#a86e48', height: 166, muscle: 0.85, shoulders: 0.7, arms: 0.75, reach: 0.45, chest: 0.75, legs: 0.75, belly: 0, hair: 'court', beard: 'aucune', face: { jaw: 0.5, chin: 0.45, nose: 0.5, noseWidth: 0.6, noseBroken: 0, eyes: 0.4, brow: 0.5, cheek: 0.6, ears: 0.5, lips: 0.5 } },
    outfit: { gloves: '#f5c542', glovesAccent: '#0f3d91', shorts: '#0f3d91', shortsTrim: '#f5c542', shoes: '#f2f2f2', socks: '#f2f2f2', robe: '#0f3d91', robeTrim: '#f5c542' },
    techniques: ['combo3', 'combo4', 'pivot', 'feint', 'counterPro', 'finisher'],
  }),
  L({
    id: 'mountain', firstName: 'Titus', lastName: 'Okonjo', nickname: 'The Mountain', flag: 'NG', nationality: 'Nigeria',
    era: '1974', eraName: 'Années 70', weightClass: 'heavy', style: 'puncher', stance: 'orthodox',
    inspiration: 'Puissance brute terrifiante, jab-massue, pression lente mais inexorable.',
    attrs: { strength: 99, power: 99, speed: 72, reflexes: 78, endurance: 80, cardio: 74, accuracy: 85, evasion: 68, blocking: 85, footwork: 72, technique: 82, chin: 95, mental: 88, recovery: 82 },
    app: { skin: '#3a2016', height: 192, muscle: 1, shoulders: 1, arms: 1, reach: 0.7, chest: 1, legs: 0.95, belly: 0.25, hair: 'chauve', beard: 'moustache', face: { jaw: 1, chin: 0.7, nose: 0.7, noseWidth: 0.85, noseBroken: 0.2, eyes: 0.35, brow: 0.9, cheek: 0.7, ears: 0.6, lips: 0.7 } },
    outfit: { gloves: '#b3121b', glovesAccent: '#b3121b', shorts: '#b3121b', shortsTrim: '#f2f2f2', shoes: '#141414', socks: '#141414', robe: '#b3121b', robeTrim: '#f2f2f2' },
    techniques: ['combo3', 'liver', 'finisher', 'clinchPro'],
  }),
  L({
    id: 'professor', firstName: 'Viktor', lastName: 'Halvorsen', nickname: 'The Professor', flag: 'UA', nationality: 'Ukraine',
    era: '2004', eraName: 'Années 2000', weightClass: 'heavy', style: 'technician', stance: 'orthodox',
    inspiration: 'Géant technicien : jab métronome, direct du droit dévastateur, contrôle de la distance.',
    attrs: { strength: 94, power: 95, speed: 80, reflexes: 82, endurance: 90, cardio: 88, accuracy: 94, evasion: 78, blocking: 92, footwork: 85, technique: 95, chin: 80, mental: 92, recovery: 88 },
    app: { skin: '#f3d2b8', height: 199, muscle: 0.85, shoulders: 0.95, arms: 0.8, reach: 0.8, chest: 0.85, legs: 0.85, belly: 0, hair: 'court', beard: 'aucune', face: { jaw: 0.85, chin: 0.7, nose: 0.55, noseWidth: 0.5, noseBroken: 0.1, eyes: 0.45, brow: 0.6, cheek: 0.5, ears: 0.5, lips: 0.45 } },
    outfit: { gloves: '#0f3d91', glovesAccent: '#f5c542', shorts: '#0f3d91', shortsTrim: '#f5c542', shoes: '#0f3d91', socks: '#f2f2f2', robe: '#0f3d91', robeTrim: '#f5c542' },
    techniques: ['combo3', 'combo4', 'feint', 'counterPro', 'clinchPro', 'pivot'],
  }),
  L({
    id: 'wall', firstName: 'Raymond', lastName: 'Achterberg', nickname: 'The Wall', flag: 'GB', nationality: 'Royaume-Uni',
    era: '1995', eraName: 'Années 90', weightClass: 'supermiddle', style: 'counter', stance: 'southpaw',
    inspiration: 'Contreur gaucher patient, timing parfait, transforme chaque attaque en piège.',
    attrs: { strength: 82, power: 86, speed: 88, reflexes: 97, endurance: 88, cardio: 88, accuracy: 96, evasion: 92, blocking: 94, footwork: 90, technique: 95, chin: 90, mental: 94, recovery: 88 },
    app: { skin: '#e8b896', height: 183, muscle: 0.75, shoulders: 0.75, arms: 0.7, reach: 0.65, chest: 0.75, legs: 0.7, belly: 0.05, hair: 'degrade', beard: 'barbe3j', face: { jaw: 0.6, chin: 0.55, nose: 0.5, noseWidth: 0.5, noseBroken: 0.3, eyes: 0.45, brow: 0.55, cheek: 0.5, ears: 0.5, lips: 0.45 } },
    outfit: { gloves: '#f2f2f2', glovesAccent: '#111111', shorts: '#111111', shortsTrim: '#f2f2f2', shoes: '#111111', socks: '#111111', robe: '#111111', robeTrim: '#f2f2f2' },
    techniques: ['combo3', 'combo4', 'pivot', 'feint', 'counterPro', 'shoulder', 'clinchPro'],
  }),
];

export function legendBoxer(id) {
  const d = LEGENDS.find((l) => l.id === id) || LEGENDS[0];
  const app = defaultAppearance();
  Object.assign(app, d.app);
  app.face = { ...defaultAppearance().face, ...(d.app.face || {}) };
  app.hairColor = '#111'; app.beardColor = '#111';
  const out = { ...defaultOutfit('Tenue historique'), ...d.outfit };
  const b = createBoxer({
    id: 'legend_' + d.id, firstName: d.firstName, lastName: d.lastName, nickname: d.nickname, nationality: d.nationality, flag: d.flag,
    age: 27, style: d.style, stance: d.stance, weightClass: d.weightClass, appearance: app, outfits: [out], attrs: { ...d.attrs },
    talent: 1, techniques: d.techniques.slice(),
  });
  b.condition = { fatigue: 0, morale: 90, confidence: 95, motivation: 95, form: 95, health: 100 };
  b.record = { w: 60 + Math.floor(d.attrs.power / 10), l: 2, d: 1, ko: 40, amW: 0, amL: 0, amD: 0, koLosses: 0 };
  b.isLegend = true; b.legendId = d.id; b.era = d.era; b.eraName = d.eraName; b.inspiration = d.inspiration;
  b.experience = 100;
  return b;
}
