// Sauvegardes locales (localStorage) : 3 emplacements + sauvegarde auto, export/import JSON.
import { SAVE_VERSION, dateOf } from './career.js';
import { fullName, recordStr } from './boxer.js';

const KEY = 'boxinglegend.save.';
const SETTINGS_KEY = 'boxinglegend.settings';
export const SLOTS = ['auto', '1', '2', '3'];

function storage() {
  try { const s = globalThis.localStorage; if (s) { s.setItem('__t', '1'); s.removeItem('__t'); return s; } } catch (e) { /* indisponible */ }
  return memoryStorage;
}
const memoryStorage = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; })();

export function saveGame(state, slot = 'auto') {
  const data = JSON.stringify({ v: SAVE_VERSION, savedAt: Date.now(), state });
  try {
    storage().setItem(KEY + slot, data);
    return { ok: true, size: data.length };
  } catch (e) {
    return { ok: false, error: 'Stockage plein ou indisponible : ' + e.message };
  }
}

export function loadGame(slot = 'auto') {
  const raw = storage().getItem(KEY + slot);
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    return migrate(d.state);
  } catch (e) {
    console.error('Sauvegarde corrompue', e);
    return null;
  }
}

export function slotInfo(slot) {
  const raw = storage().getItem(KEY + slot);
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    const s = d.state;
    return { slot, savedAt: d.savedAt, name: fullName(s.boxer), record: s.boxer.pro ? recordStr(s.boxer) : `${s.boxer.record.amW}-${s.boxer.record.amL} (am.)`, date: dateOf(s.day), money: s.money, gym: s.gym.name };
  } catch (e) { return { slot, corrupt: true }; }
}

export function deleteSlot(slot) { storage().removeItem(KEY + slot); }

export function latestSlot() {
  let best = null;
  for (const s of SLOTS) {
    const i = slotInfo(s);
    if (i && !i.corrupt && (!best || i.savedAt > best.savedAt)) best = i;
  }
  return best;
}

export function exportSave(state) {
  return JSON.stringify({ v: SAVE_VERSION, savedAt: Date.now(), state }, null, 0);
}

export function importSave(text) {
  const d = JSON.parse(text);
  if (!d.state || !d.state.boxer) throw new Error('Fichier de sauvegarde invalide');
  return migrate(d.state);
}

function migrate(s) {
  // Compatibilité ascendante des sauvegardes.
  s.flags = s.flags || {};
  s.memory = s.memory || {};
  s.rivals = s.rivals || {};
  s.hallOfFame = s.hallOfFame || [];
  s.sponsorOffers = s.sponsorOffers || [];
  s.pending = s.pending || [];
  s.boxer.damage = s.boxer.damage || { head: 0, brain: 0 };
  s.boxer.learning = s.boxer.learning || {};
  s.version = SAVE_VERSION;
  return s;
}

export const DEFAULT_SETTINGS = {
  roundLength: 90, difficulty: 'normal', quality: 'high', sound: true, volume: 0.7, voice: true,
  camera: 'side', threeKnockdown: true, showHud: true, openScoring: false, weightOverrides: {}, touchControls: 'auto', shake: true,
};

export function loadSettings() {
  try {
    const raw = storage().getItem(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
  } catch (e) { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(s) { storage().setItem(SETTINGS_KEY, JSON.stringify(s)); }
