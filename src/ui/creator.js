// Éditeur de boxeur : identité, visage, corps, style, tenues — aperçu 3D en direct.
import { esc, bind } from './dom.js';
import { createBoxer, defaultAppearance, defaultOutfit, naturalWeightFor, reachFor, HAIR_STYLES, HAIR_NAMES, BEARD_STYLES, BEARD_NAMES, SCAR_ZONES, TATTOO_ZONES, TATTOO_DESIGNS, SKIN_TONES } from '../core/boxer.js';
import { STYLES, CREATOR_STYLES } from '../data/styles.js';
import { NATIONS } from '../data/names.js';
import { weightClasses, classForWeight, getClass } from '../data/weightClasses.js';

const HAIR_COLS = ['#111111', '#2b1d14', '#3b2a1e', '#6b4a2a', '#a8763e', '#d9b56b', '#7a2a12', '#9a9a9a', '#e8e8e8'];
const EYE_COLS = ['#2a1b12', '#3b2a1e', '#6b4e2a', '#3e6b45', '#4a6b8a', '#2e4a7a'];
const GEAR_COLS = ['#b3121b', '#7b1e1e', '#0f3d91', '#1c3f94', '#111111', '#f2f2f2', '#f5c542', '#d4af37', '#0e7a3a', '#6a1b9a', '#d35400', '#00838f', '#c0c0c0', '#ff69b4'];

export class Creator {
  // mode : 'new' (nouvelle carrière / nouveau poulain) | 'edit' (apparence & tenues seulement)
  constructor(app, opts) {
    this.app = app; this.opts = opts;
    this.tab = opts.mode === 'edit' ? 'visage' : 'identite';
    this.b = opts.boxer || createBoxer({ isPlayer: true, appearance: defaultAppearance(), weightClass: 'welter', firstName: 'Sam', lastName: 'Moreau', age: 19 });
    if (!opts.boxer) this.b.weightClass = classForWeight(this.b.naturalWeight * 0.96).id;
    this.coachName = opts.coachName || 'Coach';
    this.gymName = opts.gymName || 'Boxing Club du Port';
    this.outfitIdx = this.b.outfit || 0;
    app.showroom.setBoxer(this.b);
    app.showroom.layout = 'left';
    this._t = null;
  }

  refresh3d() {
    clearTimeout(this._t);
    this._t = setTimeout(() => {
      const b = this.b;
      if (this.opts.mode !== 'edit') { b.naturalWeight = naturalWeightFor(b.appearance, b.attrs.strength); b.weight = b.naturalWeight; b.reach = reachFor(b.appearance); }
      b.outfit = this.outfitIdx;
      this.app.showroom.rebuild();
    }, 80);
  }

  render() {
    const b = this.b, a = b.appearance, F = a.face, o = b.outfits[this.outfitIdx];
    const tabs = this.opts.mode === 'edit' ? [['visage', 'Visage'], ['corps', 'Corps'], ['marques', 'Cicatrices'], ['tenue', 'Tenues']] : [['identite', 'Identité'], ['visage', 'Visage'], ['corps', 'Corps'], ['marques', 'Marques'], ['style', 'Style'], ['tenue', 'Tenue']];
    const slider = (label, path, min, max, step = 0.01, val) => `<div class="field"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-a="set" data-v="${path}"></div>`;
    const sw = (path, cols, cur) => `<div class="swatches">${cols.map((c) => `<i style="background:${c}" class="${c === cur ? 'on' : ''}" data-a="setc" data-v="${path}|${c}"></i>`).join('')}<input type="color" value="${cur}" data-a="setcol" data-v="${path}"></div>`;
    let body = '';
    if (this.tab === 'identite') {
      const nat = NATIONS.map((n) => `<option value="${n.id}" ${n.id === b.flag ? 'selected' : ''}>${n.name}</option>`).join('');
      const cls = weightClasses().map((c) => `<option value="${c.id}" ${c.id === b.weightClass ? 'selected' : ''}>${c.name} (${c.kg === Infinity ? '+90,7' : c.kg.toFixed(1)} kg)</option>`).join('');
      body = `
        ${this.opts.mode === 'new' && !this.opts.protege ? `<h3>Vous, l'entraîneur</h3>
        <div class="field"><span>Nom du coach</span><input data-a="coach" value="${esc(this.coachName)}"></div>
        <div class="field"><span>Nom du club</span><input data-a="gym" value="${esc(this.gymName)}"></div>` : ''}
        <h3>Votre boxeur</h3>
        <div class="field"><span>Prénom</span><input data-a="txt" data-v="firstName" value="${esc(b.firstName)}"></div>
        <div class="field"><span>Nom</span><input data-a="txt" data-v="lastName" value="${esc(b.lastName)}"></div>
        <div class="field"><span>Surnom</span><input data-a="txt" data-v="nickname" value="${esc(b.nickname)}" placeholder="(optionnel)"></div>
        <div class="field"><span>Nationalité</span><select data-a="nation">${nat}</select></div>
        <div class="field"><span>Âge de départ</span><input type="range" min="16" max="26" step="1" value="${b.birthAge}" data-a="age"> </div>
        <div class="muted">${b.birthAge} ans — plus il est jeune, plus il progresse vite et longtemps.</div>
        <div class="field"><span>Catégorie visée</span><select data-a="wclass">${cls}</select></div>
        <div class="muted">Poids naturel estimé : <b>${b.naturalWeight.toFixed(1)} kg</b> (dépend de la taille et du physique). Catégorie naturelle : <b>${classForWeight(b.naturalWeight * 0.95).name}</b>. Limite choisie : <b>${getClass(b.weightClass).kg === Infinity ? 'aucune' : getClass(b.weightClass).kg.toFixed(1) + ' kg'}</b>.</div>`;
    } else if (this.tab === 'visage') {
      body = `<h3>Peau</h3>${sw('skin', SKIN_TONES, a.skin)}
        <h3>Forme du visage</h3>
        ${slider('Mâchoire', 'face.jaw', 0, 1, 0.01, F.jaw)}${slider('Menton', 'face.chin', 0, 1, 0.01, F.chin)}${slider('Pommettes', 'face.cheek', 0, 1, 0.01, F.cheek)}
        ${slider('Arcades', 'face.brow', 0, 1, 0.01, F.brow)}${slider('Taille du nez', 'face.nose', 0, 1, 0.01, F.nose)}${slider('Largeur du nez', 'face.noseWidth', 0, 1, 0.01, F.noseWidth)}
        ${slider('Nez cassé', 'face.noseBroken', 0, 1, 0.01, F.noseBroken)}${slider('Yeux', 'face.eyes', 0, 1, 0.01, F.eyes)}${slider('Lèvres', 'face.lips', 0, 1, 0.01, F.lips)}${slider('Oreilles', 'face.ears', 0, 1, 0.01, F.ears)}
        <h3>Couleur des yeux</h3>${sw('face.eyeColor', EYE_COLS, F.eyeColor)}
        <h3>Cheveux</h3><div class="opts">${HAIR_STYLES.map((h) => `<button class="${h === a.hair ? 'on' : ''}" data-a="opt" data-v="hair|${h}">${HAIR_NAMES[h]}</button>`).join('')}</div>
        ${sw('hairColor', HAIR_COLS, a.hairColor)}
        <h3>Barbe</h3><div class="opts">${BEARD_STYLES.map((h) => `<button class="${h === a.beard ? 'on' : ''}" data-a="opt" data-v="beard|${h}">${BEARD_NAMES[h]}</button>`).join('')}</div>
        ${sw('beardColor', HAIR_COLS, a.beardColor)}
        <button class="sm" data-a="close">Zoom visage / corps</button>`;
    } else if (this.tab === 'corps') {
      const locked = this.opts.mode === 'edit';
      body = `${locked ? '<div class="muted">La taille et l\'allonge sont fixées. La musculature évolue avec l\'entraînement de force.</div>' : `
        <div class="field"><span>Taille</span><input type="range" min="155" max="205" step="1" value="${a.height}" data-a="set" data-v="height"></div>
        <div class="muted">${a.height} cm — allonge ${reachFor(a)} cm</div>
        ${slider('Allonge (bras)', 'reach', 0, 1, 0.01, a.reach)}`}
        ${slider('Musculature', 'muscle', 0, 1, 0.01, a.muscle)}${slider('Épaules', 'shoulders', 0, 1, 0.01, a.shoulders)}${slider('Torse', 'chest', 0, 1, 0.01, a.chest)}
        ${slider('Jambes', 'legs', 0, 1, 0.01, a.legs)}${slider('Ventre', 'belly', 0, 1, 0.01, a.belly)}
        <div class="muted">Poids naturel : <b>${b.naturalWeight.toFixed(1)} kg</b>.</div>`;
    } else if (this.tab === 'marques') {
      body = `<h3>Cicatrices</h3><div class="opts">${Object.entries(SCAR_ZONES).map(([k, n]) => `<button class="${a.scars.includes(k) ? 'on' : ''}" data-a="scar" data-v="${k}">${n}</button>`).join('')}</div>
        <h3>Tatouages</h3>
        ${a.tattoos.map((t, i) => `<div class="row"><span class="tag gold">${TATTOO_ZONES[t.zone]}</span> ${TATTOO_DESIGNS[t.design]} <button class="sm ghost" data-a="deltat" data-v="${i}">Retirer</button></div>`).join('') || '<div class="muted">Aucun tatouage.</div>'}
        <div class="row"><select id="tz">${Object.entries(TATTOO_ZONES).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select>
        <select id="td">${Object.entries(TATTOO_DESIGNS).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select>
        <button class="sm" data-a="addtat">Ajouter</button></div>`;
    } else if (this.tab === 'style') {
      body = `<h3>Garde</h3><div class="opts"><button class="${b.stance === 'orthodox' ? 'on' : ''}" data-a="stance" data-v="orthodox">Orthodoxe (droitier)</button><button class="${b.stance === 'southpaw' ? 'on' : ''}" data-a="stance" data-v="southpaw">Gaucher (southpaw)</button></div>
        <h3>Style de boxe</h3>
        ${CREATOR_STYLES.map((s) => `<div class="card ${b.style === s ? 'hl' : ''}" data-a="style" data-v="${s}" style="cursor:pointer"><b>${STYLES[s].name}</b><div class="muted">${STYLES[s].desc}</div></div>`).join('')}
        <div class="muted">Le style détermine son comportement en mode coach et sa garde. Vous pourrez en changer plus tard.</div>`;
    } else if (this.tab === 'tenue') {
      body = `<div class="row">${b.outfits.map((x, i) => `<button class="sm ${i === this.outfitIdx ? 'primary' : ''}" data-a="outfit" data-v="${i}">${esc(x.name)}</button>`).join('')}<button class="sm" data-a="newoutfit">+ Nouvelle tenue</button></div>
        <div class="field"><span>Nom</span><input data-a="oname" value="${esc(o.name)}"></div>
        <h3>Gants</h3>${sw('o.gloves', GEAR_COLS, o.gloves)}<div class="muted">Liseré</div>${sw('o.glovesAccent', GEAR_COLS, o.glovesAccent)}
        <h3>Short</h3>${sw('o.shorts', GEAR_COLS, o.shorts)}<div class="muted">Bandes</div>${sw('o.shortsTrim', GEAR_COLS, o.shortsTrim)}
        <h3>Chaussures</h3>${sw('o.shoes', GEAR_COLS, o.shoes)}<div class="muted">Chaussettes</div>${sw('o.socks', GEAR_COLS, o.socks)}
        <h3>Bandages</h3>${sw('o.wraps', GEAR_COLS, o.wraps)}
        <h3>Protège-dents</h3>${sw('o.mouthguard', GEAR_COLS, o.mouthguard)}
        <h3>Peignoir</h3>${sw('o.robe', GEAR_COLS, o.robe)}<div class="muted">Bordure</div>${sw('o.robeTrim', GEAR_COLS, o.robeTrim)}
        <h3>Casque d'entraînement</h3>${sw('o.headgear', GEAR_COLS, o.headgear)}
        <div class="row"><button class="sm" data-a="robe">Voir le peignoir</button></div>`;
    }
    const title = this.opts.mode === 'edit' ? 'Apparence & tenues' : this.opts.protege ? 'Nouveau poulain' : 'Nouvelle carrière';
    return `<div class="creator"><div style="padding:12px 14px 0"><h2>${title}</h2></div>
      <div class="tabs">${tabs.map(([k, n]) => `<button class="${k === this.tab ? 'on' : ''}" data-a="tab" data-v="${k}">${n}</button>`).join('')}</div>
      <div class="body">${body}</div>
      <div class="foot"><button class="ghost" data-a="cancel">Retour</button>${this.opts.mode !== 'edit' ? '<button class="ghost" data-a="random">Aléatoire</button>' : ''}<button class="primary grow" data-a="done">${this.opts.mode === 'edit' ? 'Enregistrer' : 'Commencer la carrière'}</button></div></div>`;
  }

  mount(ui) {
    ui.innerHTML = this.render();
    const setPath = (path, v) => {
      const b = this.b;
      if (path.startsWith('o.')) { b.outfits[this.outfitIdx][path.slice(2)] = v; return; }
      if (path.startsWith('face.')) { b.appearance.face[path.slice(5)] = v; return; }
      b.appearance[path] = v;
    };
    const rerender = () => this.mount(ui);
    bind(ui, {
      tab: (v) => { this.tab = v; this.app.showroom.layout = v === 'visage' ? 'close' : 'left'; rerender(); },
      set: (path, el) => { const v = parseFloat(el.value); setPath(path, path === 'height' ? Math.round(v) : v); this.refresh3d(); if (path === 'height' || path === 'reach') { const m = el.closest('.field').nextElementSibling; if (m && m.classList.contains('muted')) m.textContent = `${this.b.appearance.height} cm — allonge ${reachFor(this.b.appearance)} cm`; } },
      setc: (v) => { const [p, c] = v.split('|'); setPath(p, c); this.refresh3d(); rerender(); },
      setcol: (p, el) => { setPath(p, el.value); this.refresh3d(); },
      opt: (v) => { const [p, c] = v.split('|'); setPath(p, c); this.refresh3d(); rerender(); },
      txt: (k, el) => { this.b[k] = el.value.slice(0, 24); },
      coach: (v, el) => { this.coachName = el.value.slice(0, 24); },
      gym: (v, el) => { this.gymName = el.value.slice(0, 30); },
      nation: (v, el) => { const n = NATIONS.find((x) => x.id === el.value); this.b.flag = n.id; this.b.nationality = n.name; },
      age: (v, el) => { this.b.birthAge = parseInt(el.value, 10); const m = el.closest('.field').nextElementSibling; if (m) m.textContent = `${this.b.birthAge} ans — plus il est jeune, plus il progresse vite et longtemps.`; },
      wclass: (v, el) => { this.b.weightClass = el.value; rerender(); },
      scar: (k) => { const s = this.b.appearance.scars; const i = s.indexOf(k); if (i >= 0) s.splice(i, 1); else s.push(k); this.refresh3d(); rerender(); },
      addtat: () => { this.b.appearance.tattoos.push({ zone: ui.querySelector('#tz').value, design: ui.querySelector('#td').value }); this.refresh3d(); rerender(); },
      deltat: (i) => { this.b.appearance.tattoos.splice(+i, 1); this.refresh3d(); rerender(); },
      stance: (v) => { this.b.stance = v; this.refresh3d(); rerender(); },
      style: (v) => { this.b.style = v; rerender(); },
      outfit: (i) => { this.outfitIdx = +i; this.refresh3d(); rerender(); },
      newoutfit: () => { if (this.b.outfits.length >= 5) return; this.b.outfits.push(defaultOutfit('Tenue ' + (this.b.outfits.length + 1))); this.outfitIdx = this.b.outfits.length - 1; this.refresh3d(); rerender(); },
      oname: (v, el) => { this.b.outfits[this.outfitIdx].name = el.value.slice(0, 20); },
      robe: () => { this.app.showroom.model.setRobe(!this.app.showroom.model.robe.visible); },
      close: () => { this.app.showroom.layout = this.app.showroom.layout === 'close' ? 'left' : 'close'; },
      random: () => this.randomize(rerender),
      cancel: () => this.opts.onCancel(),
      done: () => { this.b.outfit = this.outfitIdx; if (this.opts.mode !== 'edit') { this.b.naturalWeight = naturalWeightFor(this.b.appearance, this.b.attrs.strength); this.b.weight = this.b.naturalWeight; this.b.reach = reachFor(this.b.appearance); } this.opts.onDone(this.b, { coachName: this.coachName, gymName: this.gymName }); },
    });
  }

  async randomize(rerender) {
    const { randomAppearance, randomOutfit } = await import('../core/boxer.js');
    const { randomName } = await import('../data/names.js');
    const a = randomAppearance();
    a.muscle = Math.min(a.muscle, 0.4); // débutant : peu musclé
    this.b.appearance = a;
    const n = randomName();
    Object.assign(this.b, { firstName: n.firstName, lastName: n.lastName, nationality: n.nationality, flag: n.flag, nickname: '' });
    this.b.outfits[this.outfitIdx] = { ...randomOutfit(), name: this.b.outfits[this.outfitIdx].name };
    this.b.style = CREATOR_STYLES[Math.floor(Math.random() * CREATOR_STYLES.length)];
    this.refresh3d(); rerender();
  }
}
