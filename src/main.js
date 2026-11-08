// BOXING LEGEND — point d'entrée : boucle de rendu, navigation entre écrans, flux de carrière.
import * as THREE from 'three';
import { Renderer } from './render/renderer.js';
import { Showroom } from './render/showroom.js';
import { GymScene } from './render/gym.js';
import { Input } from './ui/input.js';
import { sfx } from './audio/sfx.js';
import { esc, bind, modal, toast, bar } from './ui/dom.js';
import { Hub } from './ui/hub.js';
import { Creator } from './ui/creator.js';
import { FightScreen } from './ui/fight.js';
import * as C from './core/career.js';
import { resolveEvent, eventDef, pressQuestions, PRESS_TONES, applyPress, FACEOFF } from './core/events.js';
import { saveGame, loadGame, latestSlot, loadSettings, saveSettings } from './core/save.js';
import { ATTR_NAME, ATTR_KEYS, fullName, recordStr, overall, createBoxer, defaultAppearance } from './core/boxer.js';
import { getClass, setWeightOverrides } from './data/weightClasses.js';
import { LEGENDS, legendBoxer } from './data/legends.js';
import { styleOf } from './data/styles.js';
import { fmtMoney } from './core/util.js';
import { staffBonus } from './core/training.js';
import { noiseTextureCSS } from './render/textures.js';

class App {
  constructor() {
    this.settings = loadSettings();
    setWeightOverrides(this.settings.weightOverrides);
    this.ui = document.getElementById('ui');
    this.renderer = new Renderer(document.getElementById('gl'), this.settings.quality);
    this.input = new Input();
    this.sfx = sfx;
    this.showroom = new Showroom();
    this.state = null;
    this.hub = new Hub(this);
    this.gym = null;
    this.viewUpdate = null;
    this.clock = new THREE.Clock();
    document.getElementById('grain').style.backgroundImage = `url(${noiseTextureCSS()})`;
    const unlock = () => { sfx.init(); sfx.resume(); this.applySettings(); };
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
    this.applySettings();
    this.loop();
  }

  applySettings() {
    const st = this.settings;
    sfx.enabled = st.sound; sfx.setVolume(st.volume); sfx.voice = st.voice;
    if (this.renderer.quality !== st.quality) this.renderer.setQuality(st.quality);
  }

  setView(scene, camera, update) {
    this.renderer.setScene(scene, camera);
    this.viewUpdate = update;
  }

  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.viewUpdate) this.viewUpdate(dt);
    this.renderer.render();
  }

  // ------------------------------------------------------------------ menu principal
  menu() {
    const demo = legendBoxer(LEGENDS[Math.floor(Math.random() * LEGENDS.length)].id);
    const latest = latestSlot();
    this.showroom.setBoxer(this.state ? this.state.boxer : demo);
    this.showroom.layout = 'right';
    this.setView(this.showroom.scene, this.showroom.camera, (dt) => this.showroom.update(dt));
    this.ui.innerHTML = `<div class="menu">
      <div class="logo">Boxing<b>Legend</b></div><div class="logo-sub">Rise to Immortality</div>
      ${this.state ? '<button class="primary" data-a="resume">Reprendre la partie</button>' : ''}
      ${latest ? `<button class="${this.state ? '' : 'primary'}" data-a="cont">Continuer la carrière<div class="muted" style="font-family:Inter;text-transform:none;letter-spacing:0;font-size:12px">${esc(latest.name)} · ${esc(latest.record)} · ${esc(latest.date)}</div></button>` : ''}
      <button class="${latest || this.state ? '' : 'primary'}" data-a="new">Nouvelle carrière</button>
      <button data-a="legends">Mode légendes</button>
      <button data-a="load">Charger / importer</button>
      <button data-a="settings">Paramètres</button>
      <div class="muted" style="margin-top:10px">Coach, manager, entraîneur : transformez un inconnu en légende.</div></div>`;
    bind(this.ui, {
      resume: () => this.goHub(),
      cont: () => { const s = loadGame(latest.slot); if (s) this.loadState(s); else toast('Sauvegarde illisible'); },
      new: () => this.openCreator('new'),
      legends: () => this.legendsMenu(),
      load: () => this.loadMenu(),
      settings: () => this.settingsMenu(),
    });
  }

  loadMenu() {
    const SLOTS = ['auto', '1', '2', '3'];
    import('./core/save.js').then(({ slotInfo, importSave }) => {
      const rows = SLOTS.map((sl) => { const i = slotInfo(sl); return `<tr><td>${sl === 'auto' ? 'Auto' : 'Emplacement ' + sl}</td><td>${i ? `${esc(i.name)} · ${i.record} · ${esc(i.date)}` : '<span class="muted">Vide</span>'}</td><td>${i ? `<button class="sm" data-a="load" data-v="${sl}">Charger</button>` : ''}</td></tr>`; }).join('');
      modal(`<h2>Charger une partie</h2><table>${rows}</table><div class="row" style="margin-top:10px"><button data-a="imp">Importer un fichier</button><span class="grow"></span><button data-a="close">Fermer</button></div>`, {
        load: (sl, e, ev, close) => { const s = loadGame(sl); if (s) { close(); this.loadState(s); } },
        imp: (v, e, ev, close) => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json'; inp.onchange = async () => { try { const s = importSave(await inp.files[0].text()); close(); this.loadState(s); } catch (err) { toast('Erreur : ' + err.message); } }; inp.click(); },
        close: (v, e, ev, close) => close(),
      }, { dismiss: true });
    });
  }

  settingsMenu() {
    const h = new Hub(this);
    const st = this.settings;
    const sel = (k, opts) => `<select data-a="setting" data-v="${k}">${opts.map(([v, n]) => `<option value="${v}" ${String(st[k]) === String(v) ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
    const chk = (k) => `<input type="checkbox" data-a="setting" data-v="${k}" ${st[k] ? 'checked' : ''}>`;
    const m = modal(h.settingsHtml(sel, chk) + '<div class="row" style="margin-top:10px"><button class="primary" data-a="close">Fermer</button></div>', {
      ...Object.fromEntries(Object.entries(h.actions()).filter(([k]) => ['setting', 'wlimit', 'wreset'].includes(k)).map(([k, f]) => [k, (v, el) => f(v, el)])),
      close: (v, e, ev, close) => close(),
    }, { dismiss: true });
    return m;
  }

  pauseMenu() {
    modal(`<h2>Menu</h2><div class="col"><button data-a="save">Sauvegarder (emplacement 1)</button><button data-a="menu">Menu principal</button><button data-a="close" class="primary">Retour</button></div>`, {
      save: (v, e, ev, close) => { const r = saveGame(this.state, '1'); toast(r.ok ? 'Sauvegardé' : r.error); close(); },
      menu: (v, e, ev, close) => { this.autosave(); close(); this.menu(); },
      close: (v, e, ev, close) => close(),
    }, { dismiss: true });
  }

  // ------------------------------------------------------------------ création
  openCreator(mode) {
    const isEdit = mode === 'edit';
    const boxer = isEdit ? this.state.boxer : undefined;
    const cr = new Creator(this, {
      mode: isEdit ? 'edit' : 'new', protege: mode === 'protege', boxer,
      coachName: this.state?.coach.name, gymName: this.state?.gym.name,
      onCancel: () => (this.state ? this.goHub() : this.menu()),
      onDone: (b, extra) => {
        if (isEdit) { this.autosave(); this.gym = null; this.goHub(); return; }
        if (mode === 'protege') { C.newProtege(this.state, b); this.gym = null; this.autosave(); this.goHub(); return; }
        this.state = C.newCareer({ boxer: b, coachName: extra.coachName, gymName: extra.gymName });
        this.gym = null;
        this.autosave();
        this.hub.tab = 'dash';
        this.goHub();
        setTimeout(() => this.tutorial(), 400);
      },
    });
    this.setView(this.showroom.scene, this.showroom.camera, (dt) => this.showroom.update(dt));
    cr.mount(this.ui);
  }

  tutorial() {
    modal(`<h2>Votre aventure commence</h2>
      <p>Votre boxeur est <b>catastrophique</b> : note globale ${overall(this.state.boxer)}. À vous d'en faire une légende.</p>
      <div class="col">
      <div>1. <b>Entraînement</b> : composez son programme hebdomadaire (3 séances par jour). Chaque exercice développe des attributs précis. Attention à la fatigue : le surentraînement blesse.</div>
      <div>2. <b>Gymnase</b> : achetez de l'équipement, agrandissez la salle, observez les séances en 3D.</div>
      <div>3. <b>Calendrier</b> : acceptez des combats amateurs, négociez, puis passez pro.</div>
      <div>4. Avancez le temps avec <b>Jour +1 / Semaine / Prochain événement</b>.</div>
      <div>5. En combat, jouez vous-même, coachez en direct, ou simulez. Vue plongeante de côté, déplacements relatifs à l'écran.</div>
      <div>6. <b>Manager</b> : staff, sponsors, contrats, finances. Ne faites pas faillite !</div></div>
      <button class="primary" data-a="ok" style="margin-top:12px">C'est parti</button>`, { ok: (v, e, ev, close) => close() });
  }

  loadState(s) {
    this.state = s;
    this.gym = null;
    this.hub.tab = 'dash';
    this.goHub();
  }

  autosave() { if (this.state) saveGame(this.state, 'auto'); }

  // ------------------------------------------------------------------ hub
  goHub() {
    this.input.enabled = false;
    this.hub.mount();
  }

  onHubTab(tab) {
    if (tab === 'gym') {
      if (!this.gym) this.gym = new GymScene(this.state);
      if (this.hub.sub.watch) this.gym.setActivity(this.hub.sub.watch);
      const cam = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      let ang = 0.6, drag = null;
      const stage = this.ui.querySelector('.stage');
      if (stage) { stage.style.pointerEvents = 'auto'; stage.style.cursor = 'grab'; stage.onpointerdown = (e) => { drag = e.clientX; stage.setPointerCapture(e.pointerId); }; stage.onpointermove = (e) => { if (drag != null) { ang += (e.clientX - drag) * 0.01; drag = e.clientX; } }; stage.onpointerup = () => { drag = null; }; }
      const look = new THREE.Vector3();
      this.setView(this.gym.scene, cam, (dt) => {
        this.gym.update(dt);
        const p = this.gym.boxerPosition();
        const narrow = window.innerWidth < 860 && window.innerHeight > window.innerWidth;
        look.lerp(new THREE.Vector3(p.x, 1.0, p.z), Math.min(1, dt * 3));
        const dist = narrow ? 5.2 : 4.6;
        cam.position.set(look.x + Math.sin(ang) * dist, 2.6, look.z + Math.cos(ang) * dist);
        cam.lookAt(look);
        if (!narrow) { cam.setViewOffset(window.innerWidth, window.innerHeight, window.innerWidth * 0.22, 0, window.innerWidth, window.innerHeight); }
        else cam.clearViewOffset();
      });
      return;
    }
    if (this.showroom.boxer !== this.state.boxer) this.showroom.setBoxer(this.state.boxer);
    this.showroom.layout = ['dash', 'boxer'].includes(tab) ? 'left' : 'center';
    this.setView(this.showroom.scene, this.showroom.camera, (dt) => this.showroom.update(dt));
  }

  refreshBoxer3d() { this.showroom.setBoxer(this.state.boxer); this.gym = null; }
  rebuildGym() { this.gym = null; }
  gymWatch(ex) { if (this.gym) this.gym.setActivity(ex); }

  // ------------------------------------------------------------------ temps
  advance(n) {
    const s = this.state;
    if (!s || s.career.retired) return;
    const before = { ...s.boxer.attrs };
    const fatigue0 = s.boxer.condition.fatigue;
    const maxDays = n === 'next' ? 90 : n;
    let interrupt = null, days = 0;
    for (let i = 0; i < maxDays; i++) {
      const out = C.advanceDay(s);
      if (out.reports) days++;
      if (out.interrupts.length) { interrupt = out.interrupts[0]; break; }
      if (s.day % 7 === 0) this.autosave();
      if (n === 'next' && (s.offers.length && !s.booked && days >= 3 && i > 5)) break;
    }
    if (days) {
      const gains = ATTR_KEYS.map((k) => [k, s.boxer.attrs[k] - before[k]]).filter(([, v]) => Math.abs(v) >= 0.05).sort((a, b) => b[1] - a[1]);
      if (gains.length) toast(`<b>${days} jour(s) d'entraînement</b> · ${gains.slice(0, 4).map(([k, v]) => `${ATTR_NAME[k]} ${v > 0 ? '+' : ''}${v.toFixed(1)}`).join(' · ')} · fatigue ${Math.round(fatigue0)}→${Math.round(s.boxer.condition.fatigue)}`);
    }
    this.hub.mount();
    if (interrupt) this.handleInterrupt(interrupt);
  }

  handleInterrupt(it) {
    const s = this.state;
    if (it.type === 'event') this.showEvent(it.event);
    else if (it.type === 'press') this.pressConference();
    else if (it.type === 'weighin') this.weighIn();
    else if (it.type === 'fight') this.preFight();
    else if (it.type === 'bankrupt') modal(`<h2>Faillite</h2><p>Le club ne peut plus payer ses dettes (${fmtMoney(s.money)}). Un investisseur rachète vos dettes contre 50 % de la réputation du club et le licenciement du staff.</p><button class="primary" data-a="ok">Accepter le plan de sauvetage</button>`, { ok: (v, e, ev, close) => { close(); s.money = 2000; s.gym.staff = []; s.gym.reputation *= 0.5; C.message(s, 'Plan de sauvetage', 'Le club repart de zéro financièrement.'); this.hub.mount(); } });
    else if (it.type === 'forcedRetire') modal(`<h2>La fin d'une carrière</h2><p>À 42 ans, ${esc(fullName(s.boxer))} doit raccrocher.</p><button class="primary" data-a="ok">Retraite</button>`, { ok: (v, e, ev, close) => { close(); C.retire(s); this.autosave(); this.hub.mount(); } });
  }

  showEvent(ev) {
    const s = this.state, def = eventDef(ev.type);
    if (!def) { s.pending = s.pending.filter((p) => p.id !== ev.id); return; }
    modal(`<h2>${esc(def.title(s, ev))}</h2><p>${esc(def.text(s, ev))}</p><div class="choices">${def.choices.map((c, i) => `<button data-a="ch" data-v="${i}">${esc(c.label)}</button>`).join('')}</div>`, {
      ch: (i, e, evt, close) => { close(); const msg = resolveEvent(s, ev, +i); if (msg) toast(msg); this.autosave(); this.hub.mount(); },
    });
  }

  // ------------------------------------------------------------------ semaine du combat
  pressConference() {
    const s = this.state, bk = s.booked;
    const qs = pressQuestions();
    const answers = [];
    const step = () => {
      const k = answers.length;
      if (k >= qs.length) {
        const lines = applyPress(s, answers);
        modal(`<h2>Conférence de presse — bilan</h2>${lines.map((l) => `<div>• ${esc(l)}</div>`).join('')}<button class="primary" data-a="ok" style="margin-top:12px">Continuer</button>`, { ok: (v, e, ev, close) => { close(); this.hub.mount(); } });
        return;
      }
      modal(`<div class="muted">Conférence de presse · ${esc(fullName(s.boxer))} vs ${esc(bk.oppName)} · question ${k + 1}/${qs.length}</div><h2>« ${esc(qs[k])} »</h2>
        <div class="choices">${PRESS_TONES.map((t) => `<button data-a="t" data-v="${t.id}"><b>${t.label}</b> — « ${esc(t.text[k % t.text.length])} »</button>`).join('')}</div>`, {
        t: (id, e, ev, close) => { close(); answers.push(id); step(); },
      });
    };
    step();
  }

  weighIn() {
    const s = this.state, b = s.boxer, bk = s.booked;
    const cls = getClass(b.weightClass);
    const over = cls.kg !== Infinity && b.weight > cls.kg;
    const faceoff = () => {
      if (!b.pro && !bk.title) { this.hub.mount(); return; }
      modal(`<h2>Face-à-face</h2><p>Les deux boxeurs se retrouvent nez à nez devant les photographes. ${esc(bk.oppName)} vous fixe.</p><div class="choices">${FACEOFF.map((f) => `<button data-a="f" data-v="${f.id}">${esc(f.label)}</button>`).join('')}</div>`, {
        f: (id, e, ev, close) => { close(); toast(FACEOFF.find((x) => x.id === id).apply(s)); this.hub.mount(); },
      });
    };
    const done = (choice) => {
      const r = C.weighIn(s, choice);
      modal(`<h2>Pesée officielle</h2>${r.msgs.map((m) => `<div>${esc(m)}</div>`).join('')}<div class="muted" style="margin-top:6px">Poids naturel ${b.naturalWeight.toFixed(1)} kg · affaiblissement estimé ${Math.round(Math.max(0, r.drain - 0.06) * 350)} %</div><button class="primary" data-a="ok" style="margin-top:12px">Continuer</button>`, { ok: (v, e, ev, close) => { close(); faceoff(); } });
    };
    if (over) {
      modal(`<h2>Veille de la pesée</h2><p>${esc(b.firstName)} pèse <b>${b.weight.toFixed(1)} kg</b> pour une limite de <b>${cls.kg.toFixed(1)} kg</b> (+${(b.weight - cls.kg).toFixed(1)} kg).</p>
        <div class="choices"><button data-a="c" data-v="sauna">Sauna et déshydratation (perte rapide, combat diminué)</button><button data-a="c" data-v="normal">Se présenter tel quel (risque de rater le poids : amende)</button></div>`, { c: (v, e, ev, close) => { close(); done(v); } });
    } else done('normal');
  }

  preFight() {
    const s = this.state, bk = s.booked;
    const opp = C.bookedOpponent(s);
    if (!opp) { C.message(s, 'Combat annulé', 'L\'adversaire est introuvable.'); s.booked = null; this.hub.mount(); return; }
    if (!bk.weigh) C.weighIn(s, 'normal');
    const venue = C.VENUES.find((v) => v.id === bk.venue);
    modal(`<h2>Soir de combat</h2><div class="big">${esc(fullName(s.boxer))} <span class="gold">vs</span> ${esc(fullName(opp))}</div>
      <div class="muted">${bk.rounds} rounds · ${esc(venue?.name || '')} · ${esc(styleOf(opp.style).name)} · note ${overall(opp)} (vous : ${overall(s.boxer)})</div>
      <div class="muted">Fatigue de votre boxeur : ${Math.round(s.boxer.condition.fatigue)} · confiance ${Math.round(s.boxer.condition.confidence)}${s.boxer.injuries.length ? ' · <span class="bad">blessé</span>' : ''}</div>
      <div class="choices">
        <button data-a="go" data-v="play"><b>Boxer moi-même</b> — vous contrôlez le boxeur (clavier ou tactile).</button>
        <button data-a="go" data-v="coach"><b>Coacher en direct</b> — l'IA boxe avec ses capacités, vous donnez les consignes.</button>
        <button data-a="go" data-v="sim"><b>Simulation rapide</b> — résultat immédiat.</button></div>`, {
      go: (mode, e, ev, close) => { close(); this.startCareerFight(mode, opp); },
    });
  }

  startCareerFight(mode, opp) {
    const s = this.state, bk = s.booked;
    const venue = C.VENUES.find((v) => v.id === bk.venue);
    // Poids le soir du combat (réhydratation).
    const fightW = s.boxer.weight + (bk.weigh?.dehydrated || 0);
    const player = s.boxer;
    const savedW = player.weight; player.weight = fightW;
    if (!opp.weight) opp.weight = getClass(player.weightClass).kg === Infinity ? 100 : getClass(player.weightClass).kg;
    const scouted = s.scouting >= 50 || s.gym.staff.some((x) => x.role === 'scout');
    const fs = new FightScreen(this, {
      player, opp, rounds: bk.rounds, venue: venue ? venue.id : 'club', venueName: venue?.name, mode, amateur: !player.pro,
      drain: bk.weigh?.drain || 0, memory: s.memory[opp.id], gym: s.gym, cutman: staffBonus(s.gym, 'cutman'), oppMotivation: bk.oppMotivation || 0, scouted,
      title: bk.title ? 'TITRE ' + String(bk.title).toUpperCase() : 'BOXING LEGEND', subtitle: `${bk.note || ''}`,
      onEnd: (result, ctx) => {
        player.weight = savedW;
        const sum = C.applyFightResult(s, null, result, { opp, memory: ctx.memory });
        this.autosave();
        const html = `<div class="card hl" style="margin-top:10px"><h3>Carrière</h3>
          <div>${s.boxer.pro ? 'Part du club' : 'Indemnité'} : <b class="gold">${fmtMoney(s.boxer.pro ? sum.purse * 0.3 : sum.purse)}</b> (bourse ${fmtMoney(sum.purse)})</div>
          <div>Palmarès : <b>${s.boxer.pro ? recordStr(s.boxer) : `${s.boxer.record.amW}-${s.boxer.record.amL}-${s.boxer.record.amD} (amateur)`}</b>${s.boxer.pro ? ` · classement #${C.playerRank(s)}` : ''} · héritage +${sum.legacy}</div>
          ${sum.notes.map((n) => `<div class="gold">${esc(n)}</div>`).join('')}</div>`;
        return { html, after: () => this.postFight(result) };
      },
    });
    fs.start();
  }

  postFight(result) {
    const s = this.state;
    this.goHub();
    if (s.boxer.pro && result.winner === 0) {
      modal(`<h2>Interview d'après-combat</h2><p>Le micro est tendu vers ${esc(s.boxer.firstName)}.</p><div class="choices">
        <button data-a="i" data-v="thanks">Remercier son équipe et ses fans</button><button data-a="i" data-v="callout">Défier publiquement le champion</button><button data-a="i" data-v="humble">Saluer l'adversaire, rester humble</button></div>`, {
        i: (v, e, ev, close) => {
          close();
          if (v === 'thanks') { s.boxer.condition.morale = Math.min(100, s.boxer.condition.morale + 6); s.gym.reputation += 2; toast('Le vestiaire est soudé.'); }
          if (v === 'callout') { s.boxer.reputation += 4; s.flags.hypeBonus = (s.flags.hypeBonus || 0) + 2; toast('Le buzz monte : les promoteurs vous regardent.'); }
          if (v === 'humble') { s.boxer.reputation += 1; s.boxer.condition.confidence = Math.min(100, s.boxer.condition.confidence + 3); toast('Le public apprécie la classe.'); }
          this.hub.mount();
        },
      });
    }
    const p = s.pending[0];
    if (p) setTimeout(() => this.showEvent(p), 300);
  }

  // ------------------------------------------------------------------ mode légendes
  legendsMenu() {
    const opts = LEGENDS.map((l) => `<option value="${l.id}">${esc(l.firstName)} « ${esc(l.nickname)} » ${esc(l.lastName)} — ${esc(l.eraName)}</option>`).join('');
    const mine = this.state ? `<option value="__me">Mon boxeur : ${esc(fullName(this.state.boxer))}</option>` : '';
    const cards = LEGENDS.map((l) => `<div class="card"><b>${esc(l.firstName)} « ${esc(l.nickname)} » ${esc(l.lastName)}</b> <span class="tag">${esc(l.eraName)}</span> <span class="tag gold">${esc(getClass(l.weightClass).name)}</span><div class="muted">${esc(l.inspiration)}</div></div>`).join('');
    this.showroom.setBoxer(legendBoxer(LEGENDS[0].id)); this.showroom.layout = 'right';
    this.setView(this.showroom.scene, this.showroom.camera, (dt) => this.showroom.update(dt));
    this.ui.innerHTML = `<div class="panel" style="position:absolute;left:3vw;top:3vh;bottom:3vh;width:min(560px,94vw);overflow:auto">
      <h1>Mode légendes</h1><div class="muted">Combats de rêve entre boxeurs fictifs inspirés des grands styles de l'histoire (aucun boxeur réel reproduit). Exhibition : sans effet sur la carrière.</div>
      <div class="field" style="margin-top:10px"><span>Coin rouge</span><select id="la">${mine}${opts}</select></div>
      <div class="field"><span>Coin bleu</span><select id="lb">${opts.replace(`value="${LEGENDS[1].id}"`, `value="${LEGENDS[1].id}" selected`)}</select></div>
      <div class="field"><span>Rounds</span><select id="lr"><option>4</option><option>6</option><option>8</option><option>10</option><option selected>12</option></select></div>
      <div class="field"><span>Mode</span><select id="lm"><option value="play">Je boxe (coin rouge)</option><option value="coach">Je coache (coin rouge)</option><option value="sim">Simulation</option></select></div>
      <div class="row" style="margin:10px 0"><button data-a="back">Retour</button><button class="primary grow" data-a="go">Combat historique ▶</button></div>
      <div class="col">${cards}</div></div>`;
    const preview = () => { const v = this.ui.querySelector('#la').value; this.showroom.setBoxer(v === '__me' ? this.state.boxer : legendBoxer(v)); };
    this.ui.querySelector('#la').onchange = preview;
    this.ui.querySelector('#lb').onchange = (e) => this.showroom.setBoxer(legendBoxer(e.target.value));
    bind(this.ui, {
      back: () => this.menu(),
      go: () => {
        const va = this.ui.querySelector('#la').value, vb = this.ui.querySelector('#lb').value;
        const A = va === '__me' ? JSON.parse(JSON.stringify(this.state.boxer)) : legendBoxer(va);
        const B = legendBoxer(vb);
        if (va === vb) B.lastName += ' (II)';
        const old = LEGENDS.find((l) => l.id === vb);
        const fs = new FightScreen(this, {
          player: A, opp: B, rounds: +this.ui.querySelector('#lr').value, mode: this.ui.querySelector('#lm').value,
          venue: +old.era < 1985 ? 'historic' : 'world', venueName: 'Combat historique', legendExhibition: true, cutman: 3, scouted: true,
          title: 'DREAM FIGHT', subtitle: `${A.eraName || 'Aujourd\'hui'} vs ${old.eraName}`,
          onEnd: () => ({ html: '<div class="muted" style="margin-top:8px">Exhibition : aucun effet sur la carrière.</div>', after: () => this.legendsMenu() }),
        });
        fs.start();
      },
    });
  }
}

// Démarrage.
try {
  const app = new App();
  window.__app = app;
  app.menu();
  const boot = document.getElementById('boot');
  boot.style.opacity = '0';
  setTimeout(() => boot.remove(), 600);
  window.__ready = true;
} catch (e) {
  console.error(e);
  document.getElementById('boot').innerHTML = `<div style="color:#f88;max-width:600px;padding:20px">Erreur au démarrage : ${e.message}<br>Votre navigateur doit supporter WebGL.</div>`;
}
