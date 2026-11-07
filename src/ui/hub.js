// Écrans de gestion (hub) : chaque onglet est entièrement fonctionnel.
import { esc, bind, bar, toast, modal } from './dom.js';
import { fmtMoney, clamp } from '../core/util.js';
import { ATTRS, ATTR_NAME, TECHNIQUES, overall, fullName, recordStr, levelFromXp, ageYears, injuryPenalty } from '../core/boxer.js';
import { EXERCISES, EQUIPMENT, INTENSITY, DAYS, SLOTS, programLoad, exerciseAvailable, techAvailable } from '../core/training.js';
import * as C from '../core/career.js';
import { BODIES, beltsOf, findFighter } from '../core/world.js';
import { STYLES, CREATOR_STYLES } from '../data/styles.js';
import { getClass, weightClasses, formatLimit, setWeightOverrides, DEFAULT_WEIGHT_CLASSES } from '../data/weightClasses.js';
import { saveGame, loadGame, slotInfo, SLOTS as SAVE_SLOTS, exportSave, importSave, deleteSlot, saveSettings } from '../core/save.js';
import { METHOD_NAMES } from '../fight/judges.js';
import { eventDef } from '../core/events.js';

export const TABS = [
  ['dash', 'Tableau de bord'], ['boxer', 'Mon boxeur'], ['gym', 'Gymnase'], ['training', 'Entraînement'], ['calendar', 'Calendrier'],
  ['rankings', 'Classements'], ['record', 'Palmarès'], ['manager', 'Manager'], ['inbox', 'Messages'], ['system', 'Sauvegarde & options'],
];

const DIETS = { bulk: 'Prise de masse', maintain: 'Maintien', cut: 'Sèche progressive', hardcut: 'Coupe sévère' };
const KIND_NAMES = { amateur: 'Combat amateur', regular: 'Combat pro', regional: 'Titre régional', national: 'Titre national', continental: 'Titre continental', eliminator: 'Éliminatoire mondial', world: 'Championnat du monde', unification: 'Réunification', undisputed: 'Titre incontesté', defense: 'Défense de titre', legend: 'Combat historique' };

export class Hub {
  constructor(app) { this.app = app; this.tab = 'dash'; this.sub = {}; }
  get s() { return this.app.state; }

  render() {
    const s = this.s, b = s.boxer;
    const unread = s.inbox.filter((m) => !m.read).length;
    const offers = s.offers.length + (s.pending.length ? 1 : 0);
    const nav = TABS.map(([k, n]) => `<button class="${k === this.tab ? 'on' : ''}" data-a="tab" data-v="${k}">${n}${k === 'inbox' && unread ? `<span class="badge">${unread}</span>` : ''}${k === 'calendar' && offers && !s.booked ? `<span class="badge">${offers}</span>` : ''}</button>`).join('');
    const content = this['tab_' + this.tab]();
    const split = ['dash', 'boxer', 'gym'].includes(this.tab);
    const nextEv = s.booked ? `Combat dans ${s.booked.day - s.day} j` : '';
    return `<div class="hub">
      <div class="topbar"><div class="brand">BOXING <b>LEGEND</b></div><div class="date">${C.dateOf(s.day)}</div>
        <div class="money ${s.money < 0 ? 'bad' : 'gold'}">${fmtMoney(s.money)}</div><span class="tag">${nextEv}</span>
        <div class="timebar">${s.career.retired ? '' : `<button class="sm" data-a="adv" data-v="1">Jour +1</button><button class="sm" data-a="adv" data-v="7">Semaine</button><button class="sm primary" data-a="adv" data-v="next">Prochain événement ▶</button>`}<button class="sm ghost" data-a="menu">☰</button></div></div>
      <nav class="nav">${nav}</nav>
      <div class="content ${split ? 'split' : ''}">${split ? `<div class="stage"></div><div class="col">${content}</div>` : content}</div></div>`;
  }

  mount() {
    const ui = this.app.ui;
    ui.innerHTML = this.render();
    bind(ui, this.actions());
    this.app.onHubTab(this.tab);
  }

  actions() {
    const s = this.s, app = this.app, re = () => this.mount();
    return {
      tab: (v) => { this.tab = v; if (v === 'inbox') s.inbox.forEach((m) => (m.read = true)); re(); },
      adv: (v) => app.advance(v === 'next' ? 'next' : +v),
      menu: () => app.pauseMenu(),
      // Boxeur
      diet: (v, el) => { s.boxer.diet = el.value; re(); },
      wclass: (v, el) => { if (s.booked) { toast('Impossible de changer de catégorie avec un combat signé.'); re(); return; } s.boxer.weightClass = el.value; C.division(s); s.offers = []; C.refreshOffers(s); toast('Nouvelle catégorie : ' + getClass(el.value).name); re(); },
      style: (v, el) => { s.boxer.style = el.value; re(); },
      editlook: () => app.openCreator('edit'),
      outfit: (v, el) => { s.boxer.outfit = +el.value; app.refreshBoxer3d(); re(); },
      retire: () => modal(`<h2>Prendre sa retraite ?</h2><p>${esc(fullName(s.boxer))} raccrochera les gants définitivement. Votre club, votre staff et votre argent sont conservés : vous pourrez former un nouveau poulain.</p><div class="row"><button data-a="no">Annuler</button><button class="danger" data-a="yes">Confirmer la retraite</button></div>`, { no: (v, e, ev, close) => close(), yes: (v, e, ev, close) => { close(); C.retire(s); app.autosave(); re(); } }),
      newprotege: () => app.openCreator('protege'),
      // Gymnase
      watch: (v) => { this.sub.watch = v; app.gymWatch(v); re(); },
      buy: (k) => { const err = C.buyEquipment(s, k); if (err) toast(err); else { toast('Acheté : ' + EQUIPMENT[k].name); app.sfx.cash(); app.rebuildGym(); } re(); },
      upgym: () => { const err = C.upgradeGym(s); if (err) toast(err); else { app.sfx.cash(); app.rebuildGym(); } re(); },
      comfort: () => { const err = C.upgradeComfort(s); if (err) toast(err); else app.sfx.cash(); re(); },
      // Entraînement
      prog: (v, el) => { s.activeProgram = +el.value; re(); },
      slot: (v, el) => { const [d, k] = v.split(':').map(Number); const p = s.programs[s.activeProgram]; if (!el.value) p.days[d][k] = null; else p.days[d][k] = { ex: el.value, int: (p.days[d][k] && p.days[d][k].int) || 'normal' }; re(); },
      sint: (v, el) => { const [d, k] = v.split(':').map(Number); const p = s.programs[s.activeProgram]; if (p.days[d][k]) p.days[d][k].int = el.value; re(); },
      progcopy: () => { const p = JSON.parse(JSON.stringify(s.programs[s.activeProgram])); p.name = 'Mon programme ' + (s.programs.length + 1); s.programs.push(p); s.activeProgram = s.programs.length - 1; re(); },
      progname: (v, el) => { s.programs[s.activeProgram].name = el.value.slice(0, 32); },
      progdel: () => { if (s.programs.length <= 1) return; s.programs.splice(s.activeProgram, 1); s.activeProgram = 0; re(); },
      // Calendrier
      accept: (id) => { if (C.acceptOffer(s, id)) { toast('Combat signé !'); app.autosave(); } re(); },
      decline: (id) => { C.declineOffer(s, id); re(); },
      nego: (v) => { const [id, pct] = v.split('|'); const r = C.negotiate(s, id, +pct); toast(r.msg); re(); },
      cancelfight: () => modal('<h2>Annuler le combat ?</h2><p>Le promoteur sera furieux : réputation -6 et indemnité de 10 % de la bourse.</p><div class="row"><button data-a="no">Non</button><button class="danger" data-a="yes">Annuler le combat</button></div>', { no: (v, e, ev, close) => close(), yes: (v, e, ev, close) => { close(); C.ledger(s, 'Indemnité d\'annulation', -Math.round(s.booked.purse * 0.1)); s.boxer.reputation = Math.max(0, s.boxer.reputation - 6); s.booked = null; C.refreshOffers(s); re(); } }),
      // Classements
      rclass: (v, el) => { this.sub.rclass = el.value; re(); },
      // Manager
      hire: (id) => { const err = C.hireStaff(s, id); if (err) toast(err); else { toast('Embauché !'); app.sfx.cash(); } re(); },
      fire: (id) => { C.fireStaff(s, id); re(); },
      sponsor: (id) => { const err = C.acceptSponsor(s, id); if (err) toast(err); re(); },
      sponsorno: (id) => { s.sponsorOffers = s.sponsorOffers.filter((x) => x.id !== id); re(); },
      contract: () => { C.acceptContract(s); re(); },
      contractno: () => { s.flags.contractOffer = null; re(); },
      gymname: (v, el) => { s.gym.name = el.value.slice(0, 30); },
      // Messages
      event: (id) => { const ev = s.pending.find((p) => p.id === id); if (ev) app.showEvent(ev); },
      // Système
      save: (slot) => { const r = saveGame(s, slot); toast(r.ok ? 'Sauvegardé (emplacement ' + slot + ')' : r.error); re(); },
      load: (slot) => { const st = loadGame(slot); if (st) { app.loadState(st); toast('Partie chargée'); } },
      del: (slot) => { deleteSlot(slot); re(); },
      export: () => { const blob = new Blob([exportSave(s)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `boxing-legend-${s.boxer.lastName}-${s.day}.json`; a.click(); },
      import: () => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json'; inp.onchange = async () => { try { const st = importSave(await inp.files[0].text()); app.loadState(st); toast('Sauvegarde importée'); } catch (e) { toast('Erreur : ' + e.message); } }; inp.click(); },
      setting: (k, el) => { const st = app.settings; let v = el.type === 'checkbox' ? el.checked : el.value; if (['roundLength'].includes(k)) v = +v; if (k === 'volume') v = +v; st[k] = v; saveSettings(st); app.applySettings(); },
      wlimit: (id, el) => { const st = app.settings; const v = parseFloat(el.value); if (!isNaN(v) && v > 90) { st.weightOverrides[id] = v; } else delete st.weightOverrides[id]; setWeightOverrides(st.weightOverrides); saveSettings(st); },
      wreset: () => { app.settings.weightOverrides = {}; setWeightOverrides({}); saveSettings(app.settings); re(); },
    };
  }

  // ------------------------------------------------------------------ onglets
  tab_dash() {
    const s = this.s, b = s.boxer;
    const lv = levelFromXp(b.xp);
    const rank = C.playerRank(s);
    const belts = C.playerBelts(s);
    const c = b.condition;
    const bk = s.booked;
    const lf = s.lastFight;
    const cls = getClass(b.weightClass);
    return `
      <div class="panel"><div class="row"><div class="grow"><div class="muted">${esc(b.nationality)} · ${Math.floor(ageYears(b, s.day))} ans · ${b.stance === 'southpaw' ? 'Gaucher' : 'Orthodoxe'} · ${STYLES[b.style].name}</div>
        <h1 style="margin:2px 0">${esc(fullName(b))}</h1>
        <div class="row"><span class="tag gold">${C.TIERS[s.career.tier]}</span>${belts.map((x) => `<span class="tag gold">🏆 ${x}</span>`).join('')}${s.career.retired ? '<span class="tag red">Retraité</span>' : ''}</div></div>
        <div class="kpi" style="text-align:right">${overall(b)}<small>Note globale</small></div></div>
        <div class="grid3" style="margin-top:12px">
          <div class="kpi">Niv. ${lv.level}<small>${lv.into}/${lv.need} XP</small></div>
          <div class="kpi">${b.pro ? recordStr(b) : `${b.record.amW}-${b.record.amL}-${b.record.amD}`}<small>${b.pro ? `Pro (${b.record.ko} KO)` : 'Amateur'}</small></div>
          <div class="kpi">${rank ? '#' + rank : '—'}<small>${esc(cls.name)}</small></div>
        </div></div>
      <div class="panel"><h3>Condition physique</h3>
        <div class="stat"><span>Fatigue</span>${bar(c.fatigue, 100, 'red')}<span class="v">${Math.round(c.fatigue)}</span></div>
        <div class="stat"><span>Forme</span>${bar(c.form)}<span class="v">${Math.round(c.form)}</span></div>
        <div class="stat"><span>Moral</span>${bar(c.morale, 100, 'green')}<span class="v">${Math.round(c.morale)}</span></div>
        <div class="stat"><span>Confiance</span>${bar(c.confidence, 100, 'blue')}<span class="v">${Math.round(c.confidence)}</span></div>
        <div class="stat"><span>Motivation</span>${bar(c.motivation, 100, 'green')}<span class="v">${Math.round(c.motivation)}</span></div>
        <div class="row" style="margin-top:6px"><span>Poids : <b>${b.weight.toFixed(1)} kg</b></span><span class="muted">limite ${formatLimit(cls)}</span>${cls.kg !== Infinity && b.weight > cls.kg ? `<span class="tag red">+${(b.weight - cls.kg).toFixed(1)} kg</span>` : '<span class="tag green">OK</span>'}</div>
        ${b.injuries.length ? `<div class="bad" style="margin-top:6px">🚑 ${b.injuries.map((i) => `${esc(i.name)} (${Math.ceil(i.days)} j)`).join(', ')}</div>` : ''}</div>
      <div class="grid2">
        <div class="card"><h3>Prochain combat</h3>${bk ? `<b>${esc(bk.oppName)}</b><div class="muted">${KIND_NAMES[bk.kind] || ''} · ${bk.rounds} rounds · ${C.shortDate(bk.day)}</div><div>Bourse ${fmtMoney(bk.purse)}</div>` : `<div class="muted">Aucun combat signé.</div><button class="sm" data-a="tab" data-v="calendar">Voir les offres (${s.offers.length})</button>`}</div>
        <div class="card"><h3>Dernier combat</h3>${lf ? `<b class="${lf.result === 'V' ? 'good' : lf.result === 'D' ? 'bad' : 'warn'}">${lf.result === 'V' ? 'Victoire' : lf.result === 'D' ? 'Défaite' : 'Nul'}</b> vs ${esc(lf.oppName)}<div class="muted">${esc(lf.label)}</div>` : '<div class="muted">—</div>'}</div>
      </div>
      <div class="panel"><h3>Objectifs</h3>${s.objectives.map((o) => `<div class="row" style="padding:3px 0">${o.done ? '✅' : '⬜'} <span class="${o.done ? 'muted' : ''}">${esc(o.text)}</span>${o.prog && !o.done ? `<span class="tag">${o.prog}</span>` : ''}</div>`).join('')}
        <div class="muted" style="margin-top:6px">Héritage : <b class="gold">${Math.round(s.career.legacy)}</b> pts — ${C.legacyRating(s)}</div></div>
      ${s.career.retired ? `<div class="panel"><h3>Carrière terminée</h3><p>Formez un nouveau boxeur en gardant votre club.</p><button class="primary" data-a="newprotege">Recruter un nouveau poulain</button></div>` : ''}
      <div class="panel"><h3>Derniers messages</h3>${s.inbox.slice(0, 4).map((m) => `<div style="padding:4px 0"><b>${esc(m.title)}</b> <span class="muted">${C.shortDate(m.day)}</span><div class="muted">${esc(m.body)}</div></div>`).join('')}</div>`;
  }

  tab_boxer() {
    const s = this.s, b = s.boxer;
    const pen = injuryPenalty(b);
    const lv = levelFromXp(b.xp).level;
    const attrs = ATTRS.map(([k, n]) => `<div class="stat"><span>${n}${pen[k] ? ' <span class="bad">↓</span>' : ''}</span><div class="bar"><i style="width:${b.attrs[k]}%"></i></div><span class="v">${Math.floor(b.attrs[k])}</span></div>`).join('');
    const pot = s.gym.staff.some((x) => x.role === 'scout') || s.coach.skill >= 3;
    const tech = Object.entries(TECHNIQUES).map(([id, t]) => {
      const has = b.techniques.includes(id), avail = techAvailable(b, id);
      const prog = b.learning[id] ? Math.round(b.learning[id] / t.learn * 100) : 0;
      return `<div class="card ${has ? 'hl' : ''}"><b>${has ? '✅' : avail ? '📘' : '🔒'} ${t.name}</b><div class="muted">${t.desc}</div>
        <div class="muted" style="font-size:12px">Niveau ${t.level} · ${Object.entries(t.req).map(([k, v]) => `${ATTR_NAME[k]} ${v}`).join(', ')}${!has && avail ? ` · Apprentissage ${prog}% (séances techniques)` : ''}</div></div>`;
    }).join('');
    const cls = weightClasses().map((c) => `<option value="${c.id}" ${c.id === b.weightClass ? 'selected' : ''}>${c.name} — ${formatLimit(c)}</option>`).join('');
    return `
      <div class="panel"><div class="row"><h2 class="grow">${esc(fullName(b))}</h2><button class="sm" data-a="editlook">Apparence & tenues</button></div>
        <div class="muted">${b.appearance.height} cm · allonge ${b.reach} cm · poids naturel ${b.naturalWeight.toFixed(1)} kg · niveau ${lv}</div>
        <div class="row" style="margin-top:8px"><label>Style <select data-a="style">${CREATOR_STYLES.map((x) => `<option value="${x}" ${x === b.style ? 'selected' : ''}>${STYLES[x].name}</option>`).join('')}</select></label>
        <label>Tenue <select data-a="outfit">${b.outfits.map((o, i) => `<option value="${i}" ${i === b.outfit ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></label></div></div>
      <div class="panel"><h3>Attributs</h3>${attrs}
        ${pot ? `<div class="muted" style="margin-top:6px">Potentiel estimé (analyste/coach expérimenté) : ${ATTRS.map(([k, n]) => `${n} ${b.potential[k]}`).join(' · ')}</div>` : '<div class="muted" style="margin-top:6px">Embauchez un analyste vidéo (ou gagnez en expérience de coach) pour estimer son potentiel maximum.</div>'}</div>
      <div class="panel"><h3>Poids & catégorie</h3>
        <div class="row"><label>Catégorie <select data-a="wclass">${cls}</select></label></div>
        <div class="row" style="margin-top:8px"><label>Régime <select data-a="diet">${Object.entries(DIETS).map(([k, n]) => `<option value="${k}" ${k === b.diet ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <span>Poids actuel <b>${b.weight.toFixed(1)} kg</b></span></div>
        <div class="muted">La coupe sévère fatigue et démoralise. Combattre très en dessous de son poids naturel (plus de 6 %) réduit endurance, cardio et menton le soir du combat. Un nutritionniste rend la coupe plus efficace.</div></div>
      <div class="panel"><h3>Techniques</h3><div class="col">${tech}</div></div>
      <div class="panel"><h3>Santé à long terme</h3><div class="stat"><span>Dégâts chroniques</span>${bar(b.damage.brain, 100, 'red')}<span class="v">${Math.round(b.damage.brain)}</span></div><div class="muted">Les guerres et les KO subis usent le menton au fil de la carrière.</div>
        ${s.career.retired ? '' : '<button class="sm danger" data-a="retire" style="margin-top:8px">Prendre sa retraite</button>'}</div>`;
  }

  tab_gym() {
    const s = this.s, g = s.gym, lvl = C.GYM_LEVELS[g.level], next = C.GYM_LEVELS[g.level + 1];
    const watch = this.sub.watch || 'shadow';
    const exs = Object.entries(EXERCISES).map(([k, e]) => { const av = exerciseAvailable(g, k); return `<option value="${k}" ${k === watch ? 'selected' : ''} ${av.ok ? '' : 'disabled'}>${e.name}${av.ok ? '' : ' (indisponible)'}</option>`; }).join('');
    const eq = Object.entries(EQUIPMENT).map(([k, e]) => {
      const cur = g.equipment[k] || 0; const price = e.price[cur + 1];
      return `<tr><td>${e.name}</td><td>${'★'.repeat(cur)}${'☆'.repeat(3 - cur)}</td><td>${cur >= 3 ? '<span class="muted">Max</span>' : g.level < e.minGym ? `<span class="muted">Salle niv. ${e.minGym}</span>` : `<button class="sm" data-a="buy" data-v="${k}">${cur ? 'Améliorer' : 'Acheter'} ${fmtMoney(price)}</button>`}</td></tr>`;
    }).join('');
    const comfortNext = C.COMFORT[g.comfort + 1];
    return `
      <div class="panel"><h2>${esc(g.name)}</h2><div class="row"><span class="tag gold">${lvl.name}</span><span class="muted">${g.members || 0} adhérents · réputation ${Math.round(g.reputation)}</span></div><div class="muted" style="margin-top:4px">${lvl.desc}</div>
        <div class="row" style="margin-top:8px">${next ? `<button class="primary" data-a="upgym">Déménager : ${next.name} (${fmtMoney(next.upgrade)})</button><span class="muted">Loyer ${fmtMoney(next.rent)}/sem, ${next.staffCap} staff max</span>` : '<span class="gold">Niveau maximum atteint</span>'}</div></div>
      <div class="panel"><h3>Observer une séance</h3><div class="row"><select data-a="watch" class="grow" onchange="">${exs}</select></div>
        <div class="muted">La caméra montre votre boxeur à l'atelier choisi. Les séances réelles s'effectuent en avançant le temps selon le programme d'entraînement.</div></div>
      <div class="panel"><h3>Équipements</h3><table>${eq}</table></div>
      <div class="panel"><h3>Confort</h3><div>${C.COMFORT[g.comfort].name}</div><div class="muted">Le confort accélère la récupération et attire des adhérents.</div>
        ${comfortNext ? `<button class="sm" data-a="comfort">${comfortNext.name} — ${fmtMoney(comfortNext.price)}</button>` : ''}</div>`;
  }

  tab_training() {
    const s = this.s, g = s.gym, p = s.programs[s.activeProgram];
    const dow = s.day % 7;
    const opt = (cur) => `<option value="">— libre —</option>` + Object.entries(EXERCISES).map(([k, e]) => { const av = exerciseAvailable(g, k).ok; return `<option value="${k}" ${k === cur ? 'selected' : ''}>${av ? '' : '✗ '}${e.name}</option>`; }).join('');
    const intOpt = (cur) => Object.entries(INTENSITY).map(([k, i]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${i.name}</option>`).join('');
    let grid = `<div class="week"><div></div>${SLOTS.map((x) => `<div class="d">${x}</div>`).join('')}`;
    DAYS.forEach((d, di) => {
      grid += `<div class="d ${di === dow ? 'today' : ''}">${d}${di === dow ? ' •' : ''}</div>`;
      for (let k = 0; k < 3; k++) {
        const sl = p.days[di][k];
        grid += `<div class="slot"><select data-a="slot" data-v="${di}:${k}">${opt(sl && sl.ex)}</select>${sl ? `<select data-a="sint" data-v="${di}:${k}">${intOpt(sl.int)}</select>` : ''}</div>`;
      }
    });
    grid += '</div>';
    const load = programLoad(p);
    const rec = 7 * (6 + s.boxer.attrs.recovery * 0.08 + g.comfort * 1.2);
    const net = load - rec;
    // Effets estimés : attributs les plus travaillés.
    const focus = {};
    for (const d of p.days) for (const sl of d) if (sl) for (const [k, v] of Object.entries(EXERCISES[sl.ex].gains)) focus[k] = (focus[k] || 0) + v * INTENSITY[sl.int].gain;
    const fl = Object.entries(focus).sort((a, b) => b[1] - a[1]);
    const unavailable = p.days.flat().filter((x) => x && !exerciseAvailable(g, x.ex).ok);
    return `
      <div class="panel"><div class="row"><h2 class="grow">Programme hebdomadaire</h2>
        <select data-a="prog">${s.programs.map((x, i) => `<option value="${i}" ${i === s.activeProgram ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
        <button class="sm" data-a="progcopy">Dupliquer / créer</button><button class="sm ghost" data-a="progdel">Supprimer</button></div>
        <div class="field" style="margin:8px 0"><span>Nom</span><input data-a="progname" value="${esc(p.name)}"></div>
        ${grid}</div>
      <div class="grid2">
        <div class="panel"><h3>Charge de travail</h3>
          <div class="stat"><span>Charge hebdo</span>${bar(load, 260, load > rec * 1.25 ? 'red' : '')}<span class="v">${load}</span></div>
          <div class="stat"><span>Récupération</span>${bar(rec, 260, 'green')}<span class="v">${Math.round(rec)}</span></div>
          <div class="${net > 40 ? 'bad' : net > 0 ? 'warn' : 'good'}">${net > 40 ? '⚠ Surcharge : la fatigue va s\'accumuler (blessures, baisse de performance).' : net > 0 ? 'Charge élevée : surveillez la fatigue.' : 'Charge soutenable.'}</div>
          ${unavailable.length ? `<div class="bad">✗ ${unavailable.length} séance(s) impossible(s) : équipement ou staff manquant.</div>` : ''}
          <div class="muted" style="margin-top:6px">Fatigue actuelle : ${Math.round(s.boxer.condition.fatigue)}. Au-delà de 50, les gains baissent ; au-delà de 70 ils s'effondrent et le risque de blessure explose.</div></div>
        <div class="panel"><h3>Effets principaux</h3>${fl.slice(0, 7).map(([k, v]) => `<div class="stat"><span>${ATTR_NAME[k]}</span>${bar(v, fl[0][1])}<span class="v">${v.toFixed(1)}</span></div>`).join('') || '<div class="muted">Programme vide.</div>'}</div>
      </div>
      <div class="panel"><h3>Catalogue des exercices</h3><table><tr><th>Exercice</th><th>Développe</th><th>Fatigue</th><th>Requis</th></tr>${Object.entries(EXERCISES).map(([k, e]) => { const av = exerciseAvailable(g, k); return `<tr><td>${e.name}</td><td class="muted">${Object.keys(e.gains).map((x) => ATTR_NAME[x]).join(', ') || 'Récupération'}</td><td>${e.fatigue > 0 ? '+' + e.fatigue : e.fatigue}</td><td>${av.ok ? '<span class="good">✓</span>' : `<span class="bad">${esc(av.why)}</span>`}</td></tr>`; }).join('')}</table></div>`;
  }

  tab_calendar() {
    const s = this.s, bk = s.booked;
    const oppInfo = (o) => {
      const scouted = s.gym.staff.some((x) => x.role === 'scout') || s.scouting >= 50;
      const opp = o === bk ? C.bookedOpponent(s) : (o.opp || findFighter(C.division(s), o.oppId));
      let extra = '';
      if (opp && scouted) extra = `<div class="muted">Analyse : forces ${(opp.strengths || []).map((k) => ATTR_NAME[k]).join(', ') || '—'} · faiblesse ${opp.weakness ? ATTR_NAME[opp.weakness] : '—'} · ${opp.appearance.height} cm · ${opp.stance === 'southpaw' ? 'gaucher' : 'orthodoxe'}</div>`;
      return extra;
    };
    const dangerTxt = (d) => d > 0.6 ? '<span class="tag red">Très dangereux</span>' : d > 0.2 ? '<span class="tag red">Dangereux</span>' : d > -0.2 ? '<span class="tag">Équilibré</span>' : '<span class="tag green">Abordable</span>';
    const offers = s.offers.map((o) => `<div class="card ${o.title ? 'hl' : ''}"><div class="row"><b class="grow">${esc(o.oppName)}</b>${o.oppRank ? `<span class="tag">#${o.oppRank}</span>` : ''}${dangerTxt(o.danger)}</div>
      <div class="muted">${KIND_NAMES[o.kind]}${o.note ? ' — ' + esc(o.note) : ''}</div>
      <div class="muted">${o.oppRecord} · ${STYLES[o.oppStyle]?.name || ''} · note ${o.oppRating} · ${o.rounds} rounds · ${C.shortDate(o.day)} · ${C.VENUES.find((v) => v.id === o.venue)?.name || ''}</div>
      ${oppInfo(o)}
      <div class="row" style="margin-top:6px"><b class="gold grow">${fmtMoney(o.purse)}</b><span class="muted">expire ${C.shortDate(o.expires)}</span></div>
      <div class="row"><button class="sm primary" data-a="accept" data-v="${o.id}">Accepter</button><button class="sm" data-a="nego" data-v="${o.id}|0.1">Négocier +10 %</button><button class="sm" data-a="nego" data-v="${o.id}|0.25">+25 %</button><button class="sm ghost" data-a="decline" data-v="${o.id}">Refuser</button></div></div>`).join('');
    const pending = s.pending.map((p) => `<div class="card hl"><b>${esc(eventDef(p.type)?.title(s, p) || p.type)}</b> <button class="sm primary" data-a="event" data-v="${p.id}">Décider</button></div>`).join('');
    return `
      ${pending ? `<div class="panel"><h3>Décisions en attente</h3>${pending}</div>` : ''}
      <div class="panel"><h2>Combat signé</h2>${bk ? `<div class="card hl"><b class="big">${esc(fullName(s.boxer))} vs ${esc(bk.oppName)}</b>
        <div class="muted">${KIND_NAMES[bk.kind]} · ${bk.rounds} rounds · ${C.dateOf(bk.day)} (${bk.day - s.day} jours) · ${C.VENUES.find((v) => v.id === bk.venue)?.name || ''}</div>
        <div>Bourse <b class="gold">${fmtMoney(bk.purse)}</b>${bk.hype ? ` · engouement +${Math.round(bk.hype * 4)} %` : ''}</div>${oppInfo(bk)}
        <div class="muted">Analyse vidéo de l'adversaire : ${Math.round(s.scouting)} % (séances « Analyse vidéo »).</div>
        <div class="muted">Conseil : passez au programme « Camp d'entraînement » puis allégez la dernière semaine pour arriver frais (fatigue &lt; 30).</div>
        <button class="sm ghost" data-a="cancelfight">Annuler le combat</button></div>` : '<div class="muted">Aucun combat prévu. Choisissez une offre ci-dessous. De nouvelles offres arrivent régulièrement.</div>'}</div>
      ${!bk ? `<div class="panel"><h2>Offres de combat</h2><div class="col">${offers || '<div class="muted">Pas d\'offre pour l\'instant. Avancez de quelques jours.</div>'}</div></div>` : ''}`;
  }

  tab_rankings() {
    const s = this.s;
    const clsId = this.sub.rclass || s.boxer.weightClass;
    const div = s.divisions[clsId] || C.division(s);
    const all = (s.boxer.pro && clsId === s.boxer.weightClass) ? (C.playerRank(s), [...div.fighters, s.boxer].sort((a, b) => a.rank - b.rank)) : div.fighters;
    const rows = all.slice(0, 50).map((f) => {
      const belts = beltsOf(div, f.id);
      const lower = ['regional', 'national', 'continental'].filter((t) => div[t] === f.id).map((t) => ({ regional: 'Rég.', national: 'Nat.', continental: 'Cont.' }[t]));
      return `<tr class="${f.id === s.boxer.id ? 'me' : ''}"><td>${f.rank}</td><td>${esc(f.firstName)} ${esc(f.lastName)}${f.nickname ? ` <span class="muted">« ${esc(f.nickname)} »</span>` : ''}</td><td>${f.flag}</td><td>${recordStr(f)}</td><td>${STYLES[f.style]?.name || ''}</td><td>${f.isPlayer ? overall(f) : f.rating}</td><td>${belts.map((x) => `<span class="tag gold">${x}</span>`).join(' ')}${lower.map((x) => `<span class="tag">${x}</span>`).join(' ')}</td></tr>`;
    }).join('');
    const champs = BODIES.map((bd) => { const id = div.belts[bd.id]; const f = id === s.boxer.id ? s.boxer : findFighter(div, id); return `<div class="card"><b style="color:${bd.color}">${bd.id}</b> <span class="muted">${bd.name}</span><div>${f ? esc(f.firstName + ' ' + f.lastName) : 'Vacant'}</div></div>`; }).join('');
    const classSel = Object.keys(s.divisions).map((id) => `<option value="${id}" ${id === clsId ? 'selected' : ''}>${getClass(id).name}</option>`).join('');
    return `<div class="panel"><div class="row"><h2 class="grow">Classement mondial</h2><select data-a="rclass">${classSel}</select></div>
      ${!s.boxer.pro ? '<div class="muted">Votre boxeur apparaîtra au classement après son passage professionnel.</div>' : ''}
      <div class="grid2" style="margin:10px 0">${champs}</div>
      <div class="scroll"><table><tr><th>#</th><th>Boxeur</th><th></th><th>Palmarès</th><th>Style</th><th>Note</th><th>Titres</th></tr>${rows}</table></div></div>
      <div class="panel"><h3>Actualité du monde de la boxe</h3>${s.news.slice(0, 12).map((n) => `<div style="padding:3px 0"><span class="muted">${C.shortDate(n.day)}</span> ${esc(n.text)}</div>`).join('') || '<div class="muted">—</div>'}</div>`;
  }

  tab_record() {
    const s = this.s, b = s.boxer, c = s.career;
    const hist = b.history.map((h) => `<tr><td>${C.shortDate(h.day)}</td><td class="${h.result === 'V' ? 'good' : h.result === 'D' ? 'bad' : 'warn'}">${h.result}</td><td>${esc(h.oppName)}</td><td>${METHOD_NAMES[h.method] || h.method}${['KO', 'TKO', 'RTD'].includes(h.method) ? ' R' + h.round : ''}</td><td>${h.amateur ? 'Amateur' : KIND_NAMES[h.kind] || ''}</td><td>${h.stats ? `${h.stats.landed}/${h.stats.thrown}` : ''}</td><td>${fmtMoney(h.purse)}</td></tr>`).join('');
    return `<div class="panel"><h2>Palmarès de ${esc(fullName(b))}</h2>
        <div class="grid3"><div class="kpi">${recordStr(b)}<small>Pro (V-D-N)</small></div><div class="kpi">${b.record.ko}<small>Victoires par KO</small></div><div class="kpi">${b.record.amW}-${b.record.amL}-${b.record.amD}<small>Amateur</small></div>
        <div class="kpi">${C.TIERS[c.peakTier]}<small>Sommet atteint</small></div><div class="kpi">${c.defenses}<small>Défenses de titre</small></div><div class="kpi gold">${Math.round(c.legacy)}<small>Héritage — ${C.legacyRating(s)}</small></div></div></div>
      <div class="panel"><h3>Titres</h3>${c.titlesWon.map((t) => `<div>🏆 ${esc(t.title)} <span class="muted">${C.shortDate(t.day)}</span></div>`).join('') || '<div class="muted">Aucun titre pour l\'instant.</div>'}</div>
      <div class="panel"><h3>Combats</h3><div class="scroll"><table><tr><th>Date</th><th></th><th>Adversaire</th><th>Méthode</th><th>Type</th><th>Touchés</th><th>Bourse</th></tr>${hist || '<tr><td colspan=7 class="muted">Aucun combat.</td></tr>'}</table></div></div>
      <div class="panel"><h3>Rivalités</h3>${Object.values(s.rivals).map((r) => `<div>🔥 ${esc(r.name)} — niveau ${r.level}/5 (${r.history.join(' ') || 'aucun combat'})</div>`).join('') || '<div class="muted">Aucune rivalité.</div>'}</div>
      <div class="panel"><h3>Jalons</h3>${c.milestones.map((m) => `<div><span class="muted">${C.shortDate(m.day)}</span> ${esc(m.text)}</div>`).join('') || '<div class="muted">—</div>'}</div>
      <div class="panel"><h3>Panthéon du club</h3>${s.hallOfFame.map((h) => `<div class="card"><b>${esc(h.name)}</b> ${h.record} (${h.ko} KO) — ${esc(h.peak)} · héritage ${h.legacy}<div class="muted">${h.titles.map(esc).join(', ')}</div></div>`).join('') || '<div class="muted">Vos anciens boxeurs apparaîtront ici.</div>'}
        <div class="muted">Héritage total du coach ${esc(s.coach.name)} : <b class="gold">${Math.round(s.coach.legacy)}</b> · niveau d'entraîneur ${s.coach.skill}/20</div></div>`;
  }

  tab_manager() {
    const s = this.s, g = s.gym;
    const lvl = C.GYM_LEVELS[g.level];
    const salaries = g.staff.reduce((a, x) => a + x.salary, 0);
    const sponsorsW = s.sponsors.reduce((a, x) => a + x.weekly, 0);
    const income = Math.round((g.members || lvl.members) * lvl.fee) + sponsorsW;
    const expense = lvl.rent + salaries + (s.boxer.pro ? 0 : 40);
    const staff = g.staff.map((x) => `<tr><td>${esc(x.name)}</td><td>${C.STAFF_ROLES[x.role].name}</td><td>${'★'.repeat(x.level)}</td><td>${fmtMoney(x.salary)}/sem</td><td><button class="sm ghost" data-a="fire" data-v="${x.id}">Licencier</button></td></tr>`).join('');
    const market = s.staffMarket.map((x) => `<tr><td>${esc(x.name)}</td><td title="${esc(C.STAFF_ROLES[x.role].desc)}">${C.STAFF_ROLES[x.role].name}</td><td>${'★'.repeat(x.level)}</td><td>${fmtMoney(x.salary)}/sem</td><td><button class="sm" data-a="hire" data-v="${x.id}">Embaucher (${fmtMoney(x.signing)})</button></td></tr>`).join('');
    const ct = s.flags.contractOffer;
    return `<div class="panel"><h2>Finances</h2>
        <div class="grid3"><div class="kpi ${s.money < 0 ? 'bad' : ''}">${fmtMoney(s.money)}<small>Trésorerie</small></div><div class="kpi good">${fmtMoney(income)}<small>Revenus / semaine</small></div><div class="kpi bad">${fmtMoney(expense)}<small>Dépenses / semaine</small></div></div>
        <div class="field" style="margin-top:10px"><span>Nom du club</span><input data-a="gymname" value="${esc(g.name)}"></div>
        <div class="scroll" style="max-height:220px;margin-top:8px"><table>${s.ledger.slice(0, 40).map((l) => `<tr><td class="muted">${C.shortDate(l.day)}</td><td>${esc(l.label)}</td><td class="${l.amount < 0 ? 'bad' : 'good'}" style="text-align:right">${fmtMoney(l.amount)}</td></tr>`).join('')}</table></div></div>
      <div class="panel"><h3>Équipe technique (${g.staff.length}/${lvl.staffCap})</h3><table>${staff || '<tr><td class="muted">Personne. Vous entraînez seul.</td></tr>'}</table></div>
      <div class="panel"><h3>Marché du staff</h3><div class="muted">Le niveau des candidats augmente avec le niveau du gymnase et sa réputation.</div><table>${market}</table>
        <div class="muted" style="margin-top:6px">${Object.values(C.STAFF_ROLES).map((r) => `<b>${r.name}</b> : ${r.desc}`).join('<br>')}</div></div>
      <div class="panel"><h3>Sponsors</h3>${s.sponsors.map((x) => `<div class="card"><b>${esc(x.name)}</b> ${fmtMoney(x.weekly)}/sem · prime victoire ${fmtMoney(x.winBonus)} · KO ${fmtMoney(x.koBonus)}<div class="muted">${esc(x.req.text)} · jusqu'au ${C.shortDate(x.end)}</div></div>`).join('') || '<div class="muted">Aucun sponsor actif.</div>'}
        ${s.sponsorOffers.map((x) => `<div class="card hl"><b>${esc(x.name)}</b> propose ${fmtMoney(x.weekly)}/sem pendant ${x.weeks} semaines<div class="muted">Prime victoire ${fmtMoney(x.winBonus)} · KO ${fmtMoney(x.koBonus)} · ${esc(x.req.text)}</div><div class="row"><button class="sm primary" data-a="sponsor" data-v="${x.id}">Signer</button><button class="sm ghost" data-a="sponsorno" data-v="${x.id}">Refuser</button></div></div>`).join('')}
        <div class="muted">Les sponsors arrivent avec la popularité (victoires, KO, titres, interviews).</div></div>
      <div class="panel"><h3>Contrat promoteur</h3>${s.contract ? `<b>${esc(s.contract.name)}</b> — ${s.contract.remaining} combat(s) restant(s), bourses +${Math.round((s.contract.purseBoost - 1) * 100)} %` : '<div class="muted">Aucun contrat.</div>'}
        ${ct ? `<div class="card hl"><b>${esc(ct.name)}</b> : ${ct.fights} combats, prime ${fmtMoney(ct.bonus)}, bourses +${Math.round((ct.purseBoost - 1) * 100)} %<div class="row"><button class="sm primary" data-a="contract">Signer</button><button class="sm ghost" data-a="contractno">Refuser</button></div></div>` : ''}
        <div class="muted">Vous touchez 30 % des bourses professionnelles (part du club / manager).</div></div>`;
  }

  tab_inbox() {
    const s = this.s;
    return `<div class="panel"><h2>Messages</h2>${s.inbox.map((m) => `<div class="card" style="margin-bottom:6px"><div class="row"><b class="grow ${m.kind === 'danger' ? 'bad' : m.kind === 'success' ? 'good' : ''}">${esc(m.title)}</b><span class="muted">${C.shortDate(m.day)}</span></div><div class="muted">${esc(m.body)}</div></div>`).join('') || '<div class="muted">Aucun message.</div>'}</div>`;
  }

  tab_system() {
    const s = this.s, st = this.app.settings;
    const slots = SAVE_SLOTS.map((sl) => { const i = slotInfo(sl); return `<tr><td>${sl === 'auto' ? 'Auto' : 'Emplacement ' + sl}</td><td>${i ? (i.corrupt ? 'Corrompue' : `${esc(i.name)} · ${i.record} · ${esc(i.date)}`) : '<span class="muted">Vide</span>'}</td><td>${sl !== 'auto' ? `<button class="sm" data-a="save" data-v="${sl}">Sauver</button>` : ''} ${i ? `<button class="sm" data-a="load" data-v="${sl}">Charger</button> <button class="sm ghost" data-a="del" data-v="${sl}">✕</button>` : ''}</td></tr>`; }).join('');
    const sel = (k, opts) => `<select data-a="setting" data-v="${k}">${opts.map(([v, n]) => `<option value="${v}" ${String(st[k]) === String(v) ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
    const chk = (k) => `<input type="checkbox" data-a="setting" data-v="${k}" ${st[k] ? 'checked' : ''}>`;
    return `<div class="panel"><h2>Sauvegardes</h2><table>${slots}</table><div class="row" style="margin-top:8px"><button class="sm" data-a="export">Exporter (fichier)</button><button class="sm" data-a="import">Importer</button></div><div class="muted">Sauvegarde automatique chaque semaine et après chaque combat. Tout est stocké localement sur cet appareil.</div></div>
      ${this.settingsHtml(sel, chk)}`;
  }

  settingsHtml(sel, chk) {
    const st = this.app.settings;
    const wc = DEFAULT_WEIGHT_CLASSES.slice(0, 16).map((c) => `<div class="field"><span>${c.name}</span><input type="number" step="0.5" value="${st.weightOverrides[c.id] ?? c.lb}" data-a="wlimit" data-v="${c.id}"> lb</div>`).join('');
    return `<div class="panel"><h2>Paramètres</h2>
      <div class="field"><span>Difficulté</span>${sel('difficulty', [['facile', 'Facile'], ['normal', 'Normal'], ['difficile', 'Difficile'], ['legende', 'Légende']])}</div>
      <div class="field"><span>Durée d'un round</span>${sel('roundLength', [[60, '60 s'], [90, '90 s'], [120, '2 min'], [180, '3 min (réel)']])}</div>
      <div class="field"><span>Qualité graphique</span>${sel('quality', [['low', 'Basse (mobile)'], ['medium', 'Moyenne'], ['high', 'Haute (bloom)']])}</div>
      <div class="field"><span>Caméra de combat</span>${sel('camera', [['top', 'Plongée de côté'], ['high', 'Vue du dessus'], ['low', 'Plongée rapprochée']])}</div>
      <div class="field"><span>Commandes tactiles</span>${sel('touchControls', [['auto', 'Auto'], ['on', 'Toujours'], ['off', 'Jamais']])}</div>
      <div class="field"><span>Son</span>${chk('sound')}</div>
      <div class="field"><span>Volume</span><input type="range" min="0" max="1" step="0.05" value="${st.volume}" data-a="setting" data-v="volume"></div>
      <div class="field"><span>Voix de l'annonceur</span>${chk('voice')}</div>
      <div class="field"><span>Secousses caméra</span>${chk('shake')}</div>
      <div class="field"><span>Règle des 3 knockdowns</span>${chk('threeKnockdown')}</div>
      <div class="field"><span>Pointage ouvert</span>${chk('openScoring')}</div></div>
      <div class="panel"><h3>Limites des catégories (livres)</h3><div class="muted">Valeurs officielles par défaut. Modifiables (s'appliquent aux nouvelles pesées).</div>${wc}<button class="sm" data-a="wreset">Rétablir les valeurs officielles</button></div>`;
  }
}
