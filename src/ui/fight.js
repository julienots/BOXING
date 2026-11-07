// Déroulé d'un combat : présentation, rounds, coin, knockdowns, ralenti, résultat.
import { esc, bind, bar, modal, toast } from './dom.js';
import { setupFight } from '../fight/setup.js';
import { FightView } from '../render/fightView.js';
import { buildTouchControls, KEY_HELP } from './input.js';
import { INSTRUCTIONS, HabitModel, MODE_NAMES } from '../fight/ai.js';
import { PUNCHES, punchLabel } from '../fight/punches.js';
import { totals, METHOD_NAMES } from '../fight/judges.js';
import { fullName, recordStr, ATTR_NAME } from '../core/boxer.js';
import { styleOf } from '../data/styles.js';

const fmtClock = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export class FightScreen {
  // cfg : { player, opp, rounds, venue, mode, amateur, drain, memory, title, subtitle, onEnd(result, ctx) }
  constructor(app, cfg) {
    this.app = app; this.cfg = cfg;
    const st = app.settings;
    this.mode = cfg.mode || 'play';
    const { engine, ctrlA, ctrlB } = setupFight({
      player: cfg.player, opp: cfg.opp, rounds: cfg.rounds, settings: st, mode: this.mode === 'play' ? 'play' : 'coach',
      input: app.input, drain: cfg.drain || 0, memory: cfg.memory, amateur: cfg.amateur, gym: cfg.gym, oppMotivation: cfg.oppMotivation || 0,
      instruction: 'none',
    });
    this.engine = engine; this.ctrlA = ctrlA; this.ctrlB = ctrlB;
    // Analyse des habitudes adverses par votre coin (conseils entre les rounds).
    this.scout = new HabitModel();
    engine.on((ev) => this.onEvent(ev));
    this.view = new FightView(engine, { venue: cfg.venue, headgear: cfg.amateur, title: cfg.title, subtitle: cfg.subtitle, shake: st.shake, camMode: st.camera });
    this.paused = false;
    this.feed = [];
    this.lastBell = -1;
    this.done = false;
  }

  start() {
    const app = this.app;
    app.setView(this.view.scene, this.view.camera, (dt) => this.update(dt));
    document.getElementById('gl').classList.toggle('sepia', this.cfg.venue === 'historic');
    document.getElementById('grain').classList.toggle('on', this.cfg.venue === 'historic');
    app.sfx.crowd(true, 0.4);
    app.input.reset();
    app.input.enabled = this.mode === 'play';
    app.input.onPause = () => this.pause();
    app.input.onCamera = () => this.cycleCamera();
    if (this.mode === 'sim') { this.simulate(); return; }
    this.intro();
  }

  // ------------------------------------------------------------------ présentation
  intro() {
    const E = this.engine, A = E.a.boxer, B = E.b.boxer;
    this.view.mode = 'intro';
    this.app.ui.innerHTML = `<div class="hud"><div class="panel" style="position:absolute;left:50%;bottom:8vh;transform:translateX(-50%);width:min(760px,94vw);text-align:center">
      <div class="muted">${esc(this.cfg.subtitle || '')}</div>
      <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;margin:8px 0"><div style="text-align:left"><div class="big" style="color:#ff6b6b">${esc(A.firstName)} ${esc(A.lastName)}</div><div class="muted">${esc(A.nickname ? '« ' + A.nickname + ' »' : '')} ${A.pro || A.isLegend ? recordStr(A) : 'Amateur'} · ${A.appearance.height} cm · ${A.weight.toFixed(1)} kg</div></div>
      <div class="big gold">VS</div>
      <div style="text-align:right"><div class="big" style="color:#74a9ff">${esc(B.firstName)} ${esc(B.lastName)}</div><div class="muted">${esc(B.nickname ? '« ' + B.nickname + ' »' : '')} ${B.amateur ? 'Amateur' : recordStr(B)} · ${B.appearance.height} cm · ${(B.weight || 0).toFixed(1)} kg · ${styleOf(B.style).name}</div></div></div>
      <div class="muted">${this.cfg.rounds} rounds · ${esc(this.cfg.venueName || '')}</div>
      <button class="primary" data-a="go" style="margin-top:10px">Les boxeurs au centre du ring ▶</button></div></div>`;
    bind(this.app.ui, { go: () => this.beginRound() });
    const s = this.app.sfx;
    s.say(`Mesdames et messieurs ! Dans le coin rouge, ${A.firstName} ${A.lastName} ! Dans le coin bleu, ${B.firstName} ${B.lastName} !`, { interrupt: true });
    s.roar(1.5);
    this.introTimer = setTimeout(() => { if (this.view.mode === 'intro') this.beginRound(); }, 14000);
  }

  beginRound() {
    clearTimeout(this.introTimer);
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    this.view.mode = 'fight';
    this.view.syncModels(0, true);
    this.buildHud();
    this.app.sfx.bell(1);
    this.pop(`Round ${this.engine.round}`);
    this.app.sfx.say(`Round ${this.engine.round}`, { interrupt: true });
  }

  buildHud() {
    const E = this.engine, A = E.a.boxer, B = E.b.boxer;
    const coach = this.mode !== 'play';
    this.app.ui.innerHTML = `<div class="hud">
      <div class="top">
        <div class="fighter"><div class="nm"><span style="color:#ff8080">${esc(A.lastName)}</span><span class="muted" id="hA"></span></div>
          <div class="lbl">Endurance</div><div class="bar green" id="sA"><i></i></div><div class="lbl">Santé</div><div class="bar red" id="lA"><i></i></div><div class="dmgfig" id="zA"></div></div>
        <div class="clock"><div class="rd" id="rd"></div><div class="tm" id="tm"></div><div class="muted" id="ps" style="font-size:11px"></div></div>
        <div class="fighter right"><div class="nm"><span style="color:#8ab4ff">${esc(B.lastName)}</span><span class="muted" id="hB"></span></div>
          <div class="lbl">Endurance</div><div class="bar green" id="sB"><i></i></div><div class="lbl">Santé</div><div class="bar red" id="lB"><i></i></div><div class="dmgfig" id="zB"></div></div>
      </div>
      <div class="btns"><button class="sm" data-a="pause">❚❚ Pause</button><button class="sm" data-a="cam">🎥 Caméra</button><button class="sm danger" data-a="towel">Éponge</button></div>
      ${coach ? `<div class="panel coachtip" style="display:block"><h3>Consignes en direct</h3><div class="opts">${Object.entries(INSTRUCTIONS).map(([k, i]) => `<button class="${(this.ctrlA.instruction || 'none') === k ? 'on' : ''}" data-a="instr" data-v="${k}">${i.name}</button>`).join('')}</div></div>` : `<div class="panel coachtip" id="tip"><b class="gold">Coin :</b> <span id="tipt">Contrôle avec le jab, garde haute.</span></div>`}
      <div class="feed" id="feed"></div><div id="over"></div></div>`;
    const ui = this.app.ui;
    bind(ui, {
      pause: () => this.pause(), cam: () => this.cycleCamera(), towel: () => this.towel(),
      instr: (k) => { this.ctrlA.instruction = k; ui.querySelectorAll('[data-a=instr]').forEach((b) => b.classList.toggle('on', b.dataset.v === k)); },
    });
    const showTouch = this.app.settings.touchControls === 'on' || (this.app.settings.touchControls === 'auto' && ('ontouchstart' in window || navigator.maxTouchPoints > 0));
    if (showTouch && this.mode === 'play') buildTouchControls(ui.querySelector('.hud'), this.app.input);
    this.el = {
      sA: ui.querySelector('#sA i'), sB: ui.querySelector('#sB i'), lA: ui.querySelector('#lA i'), lB: ui.querySelector('#lB i'),
      hA: ui.querySelector('#hA'), hB: ui.querySelector('#hB'), rd: ui.querySelector('#rd'), tm: ui.querySelector('#tm'), ps: ui.querySelector('#ps'),
      zA: ui.querySelector('#zA'), zB: ui.querySelector('#zB'), feed: ui.querySelector('#feed'), over: ui.querySelector('#over'), tip: ui.querySelector('#tipt'),
    };
  }

  cycleCamera() {
    const modes = ['top', 'high', 'low'];
    const i = (modes.indexOf(this.view.camMode) + 1) % modes.length;
    this.view.setCameraMode(modes[i]);
    toast('Caméra : ' + { top: 'plongée de côté', high: 'vue du dessus', low: 'plongée rapprochée' }[modes[i]]);
  }

  pop(text) {
    if (!this.el || !this.el.over) return;
    const d = document.createElement('div'); d.className = 'pop'; d.textContent = text;
    this.el.over.appendChild(d); setTimeout(() => d.remove(), 1700);
  }
  log(html) {
    if (!this.el || !this.el.feed) return;
    const d = document.createElement('div'); d.innerHTML = html;
    this.el.feed.appendChild(d);
    while (this.el.feed.children.length > 6) this.el.feed.firstChild.remove();
    setTimeout(() => d.remove(), 4200);
  }

  // ------------------------------------------------------------------ événements
  onEvent(ev) {
    const s = this.app.sfx, E = this.engine;
    const nm = (i) => E.actors[i].boxer.lastName;
    if (this.mode === 'sim' && ev.type !== 'end') return;
    if (ev.type === 'punch') { if (ev.who === 1) this.scout.observePunch(ev.punch, ev.target, ev.t); s.whoosh(); }
    if (ev.type === 'hit') {
      const P = PUNCHES[ev.punch];
      s.punch(ev.dmg / 8, ev.blocked, ev.zone !== 'tete' && ev.zone !== 'machoire');
      if (ev.who === 1) this.scout.observeDefense(ev.blocked ? 'high' : 'none');
      if (!ev.blocked && (ev.dmg > 9 || ev.counter || ev.combo)) {
        const lbl = punchLabel(ev.punch, E.actors[ev.by].stance, ev.zone === 'tete' || ev.zone === 'machoire' ? 'head' : 'body');
        this.log(`<b>${esc(nm(ev.by))}</b> : ${lbl}${ev.zone === 'machoire' ? ' <span class="gold">à la mâchoire</span>' : ''}${ev.counter ? ' <span class="gold">— CONTRE !</span>' : ''}${ev.combo ? ` <span class="gold">(${esc(ev.combo)})</span>` : ''}`);
        if (ev.counter && ev.by === 0 && this.mode === 'play') this.pop('Contre !');
      }
      if (ev.dmg > 14 && !ev.blocked) s.roar(0.8);
    }
    if (ev.type === 'evade' && ev.who === 0 && this.mode === 'play' && Math.random() < 0.3) this.log('<span class="good">Esquive !</span>');
    if (ev.type === 'evade' && ev.who === 1) this.scout.observeDefense(ev.how === 'shoulder' ? 'high' : ev.how);
    if (ev.type === 'stun') { this.log(`<b class="warn">${esc(nm(ev.who))} est sonné !</b>`); s.roar(1); }
    if (ev.type === 'liver') this.log(`<b class="warn">Crochet au foie !</b>`);
    if (ev.type === 'cut') this.log(`<span class="bad">${esc(nm(ev.who))} est ouvert à l'arcade</span>`);
    if (ev.type === 'clinch') this.log('Clinch');
    if (ev.type === 'knockdown') { this.pop('Knockdown !'); s.thud(); s.roar(2); this.log(`<b class="bad">${esc(nm(ev.who))} va au tapis !</b>`); }
    if (ev.type === 'count') this.showCount(ev);
    if (ev.type === 'getup') { this.hideCount(); this.log(`${esc(nm(ev.who))} se relève.`); s.roar(1); }
    if (ev.type === 'aiMode' && ev.who === 1 && this.el && this.el.tip) this.el.tip.textContent = this.adviceFromMode(ev);
    if (ev.type === 'roundEnd') { s.bell(1); setTimeout(() => this.corner(), 1200); }
    if (ev.type === 'end') this.onEnd(ev.result);
  }

  adviceFromMode(ev) {
    const m = { finish: 'Il sent le sang ! Couvre-toi, clinch si tu es touché !', allout: 'Il va tout donner : reste calme et contre-le.', survive: 'Il est en difficulté : mets la pression maintenant !', defend: 'Il gère son avance : force l\'échange.', counter: 'Il attend pour contrer : feinte avant d\'attaquer.', pressure: 'Il avance : jab, recule en diagonale, tourne.', outbox: 'Il garde la distance : coupe le ring.' };
    return m[ev.mode] || ev.why;
  }

  showCount(ev) {
    if (!this.el) return;
    const human = ev.who === 0 && this.mode === 'play';
    const E = this.engine, a = E.actors[ev.who];
    this.el.over.querySelector('.count')?.remove(); this.el.over.querySelector('.mash')?.remove();
    const c = document.createElement('div'); c.className = 'count'; c.textContent = ev.n;
    this.el.over.appendChild(c);
    if (human) {
      const need = 10 + a.downs * 6 + (100 - a.headHP) * 0.25 - a.a.mental * 0.08;
      const m = document.createElement('div'); m.className = 'mash';
      m.innerHTML = `Martelez les touches de coup (ou les boutons) pour vous relever !${bar(a.getUp, need, 'green')}`;
      this.el.over.appendChild(m);
    }
    this.app.sfx.say(['un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'][ev.n - 1] || '', { rate: 1.2 });
  }
  hideCount() { this.el?.over.querySelector('.count')?.remove(); this.el?.over.querySelector('.mash')?.remove(); }

  // ------------------------------------------------------------------ boucle
  update(dt) {
    if (this.paused) { this.view.update(0); return; }
    if (this.view.mode === 'fight' && this.engine.phase !== 'over') this.engine.update(dt);
    this.view.update(dt);
    if (this.el && this.el.sA && this.view.mode === 'fight') this.updateHud();
  }

  updateHud() {
    const E = this.engine, el = this.el;
    const [a, b] = E.actors;
    el.sA.style.width = (a.stamina / a.staminaMax * 100) + '%'; el.sB.style.width = (b.stamina / b.staminaMax * 100) + '%';
    el.lA.style.width = Math.max(0, a.headHP * 0.65 + a.bodyHP * 0.35 - a.daze * 0.3) + '%'; el.lB.style.width = Math.max(0, b.headHP * 0.65 + b.bodyHP * 0.35 - b.daze * 0.3) + '%';
    el.hA.textContent = `${a.stats.landed}/${a.stats.thrown}`; el.hB.textContent = `${b.stats.landed}/${b.stats.thrown}`;
    el.rd.textContent = `ROUND ${E.round}/${E.rounds}`;
    el.tm.textContent = fmtClock(E.roundLength - E.clock);
    el.ps.textContent = E.phase === 'count' ? 'COMPTE' : a.state === 'stun' ? 'SONNÉ !' : a.stamina < a.staminaMax * 0.2 ? 'À BOUT DE SOUFFLE' : '';
    if (!this._zt || E.time - this._zt > 0.5) {
      this._zt = E.time;
      const z = (act) => [['tete', 'Tête'], ['machoire', 'Mâch.'], ['corps', 'Corps'], ['cotes', 'Côtes'], ['abdomen', 'Abdo']].map(([k, n]) => { const v = act.zones[k]; const c = v > 120 ? '#b91c1c' : v > 60 ? '#b45309' : v > 20 ? '#6b5d1a' : ''; return `<span style="${c ? 'background:' + c + ';color:#fff' : ''}">${n}</span>`; }).join('');
      el.zA.innerHTML = z(a); el.zB.innerHTML = z(b);
      if (this.mode === 'play' && el.tip && Math.random() < 0.15) el.tip.textContent = this.liveTip();
    }
  }

  liveTip() {
    const E = this.engine, a = E.a, b = E.b;
    if (a.stamina < a.staminaMax * 0.25) return 'Respire ! Garde haute, laisse passer l\'orage, clinch si besoin (C).';
    if (b.state === 'stun') return 'Il est sonné ! Enchaîne les crochets !';
    if (b.bodyHP < 55) return 'Son corps lâche : continue au foie (Maj + U) !';
    if (this.scout.hookRate() > 0.38) return 'Il arme ses crochets : baisse la tête (X) et contre au direct.';
    if (this.scout.jabRate() > 0.5) return 'Il jabbe beaucoup : esquive (E) et remise du direct.';
    if (b.block === 'high') return 'Sa garde est haute : va au corps et à l\'uppercut.';
    return 'Jab, bouge la tête, ne reste pas dans l\'axe.';
  }

  pause() {
    if (this.done || this.view.mode !== 'fight') return;
    this.paused = true;
    const help = KEY_HELP.map(([k, d]) => `<tr><td><b>${k}</b></td><td>${d}</td></tr>`).join('');
    modal(`<h2>Pause</h2><table>${help}</table><div class="muted">* technique à débloquer. Déplacements relatifs à l'écran. Les coups enchaînés main avant / main arrière sont plus rapides.</div>
      <div class="row" style="margin-top:12px"><button class="primary" data-a="resume">Reprendre</button><button class="danger" data-a="quit">Abandonner le combat</button></div>`, {
      resume: (v, e, ev, close) => { close(); this.paused = false; },
      quit: (v, e, ev, close) => { close(); this.paused = false; this.engine.forfeit(0, 'Abandon'); },
    });
  }

  towel() {
    modal('<h2>Jeter l\'éponge ?</h2><p>Vous arrêtez le combat pour protéger votre boxeur. Défaite par abandon.</p><div class="row"><button data-a="no">Non</button><button class="danger" data-a="yes">Jeter l\'éponge</button></div>', {
      no: (v, e, ev, close) => close(),
      yes: (v, e, ev, close) => { close(); this.engine.forfeit(0, 'L\'entraîneur jette l\'éponge'); },
    });
  }

  // ------------------------------------------------------------------ coin entre les rounds
  corner() {
    const E = this.engine;
    if (E.phase === 'over' || this.done) return;
    this.view.mode = 'corner';
    this.app.input.enabled = false;
    const a = E.a, b = E.b;
    const r = E.roundSummaries[E.roundSummaries.length - 1];
    const tot = totals(E.scorecards);
    const open = this.app.settings.openScoring;
    // Estimation du coin : qui gagne les rounds.
    let est = 0; for (const rs of E.roundSummaries) est += Math.sign((rs.a.landed + rs.a.powerLanded + rs.a.knockdowns * 8) - (rs.b.landed + rs.b.powerLanded + rs.b.knockdowns * 8));
    const advice = this.cornerAdvice();
    const coach = this.mode !== 'play';
    const opp = b.boxer;
    const scouted = this.cfg.scouted;
    // L'IA adverse peut abandonner.
    if (b.headHP < 20 && E.round >= 3 && Math.random() < 0.35 && !this.cfg.legendExhibition) {
      setTimeout(() => E.forfeit(1, 'Le coin adverse jette l\'éponge'), 600);
      this.app.ui.innerHTML = '<div class="hud"><div class="pop">Le coin adverse abandonne !</div></div>';
      return;
    }
    this.app.ui.innerHTML = `<div class="modal-bg" style="background:rgba(0,0,0,.35)"><div class="modal panel" style="width:min(820px,96vw)">
      <div class="row"><h2 class="grow">Fin du round ${E.round} — dans le coin</h2><span class="tag gold">${open ? `Cartes : ${tot.map(([x, y]) => `${x}-${y}`).join(' / ')}` : est > 0 ? 'Le coin vous voit devant' : est < 0 ? 'Le coin vous voit derrière' : 'Combat serré'}</span></div>
      <div class="grid2">
        <div class="card"><h3>Votre boxeur</h3>
          <div class="stat"><span>Endurance</span>${bar(a.stamina, a.staminaMax, 'green')}<span class="v">${Math.round(a.stamina / a.staminaMax * 100)}</span></div>
          <div class="stat"><span>Tête</span>${bar(a.headHP, 100, 'red')}<span class="v">${Math.round(a.headHP)}</span></div>
          <div class="stat"><span>Corps</span>${bar(a.bodyHP, 100, 'red')}<span class="v">${Math.round(a.bodyHP)}</span></div>
          ${Math.max(a.cuts.left, a.cuts.right) > 0.1 ? `<div class="bad">Coupure : ${Math.round(Math.max(a.cuts.left, a.cuts.right) * 100)} % ${this.cfg.cutman ? '(le soigneur travaille dessus)' : '(pas de soigneur !)'}</div>` : ''}
          <div class="muted">Round : ${r.a.landed}/${r.a.thrown} coups touchés, ${r.a.powerLanded} puissants, ${r.a.bodyLanded} au corps.</div></div>
        <div class="card"><h3>${esc(opp.lastName)}</h3>
          <div class="stat"><span>Endurance</span>${bar(b.stamina, b.staminaMax, 'green')}<span class="v">${Math.round(b.stamina / b.staminaMax * 100)}</span></div>
          <div class="stat"><span>Tête</span>${bar(b.headHP, 100, 'red')}<span class="v">${Math.round(b.headHP)}</span></div>
          <div class="stat"><span>Corps</span>${bar(b.bodyHP, 100, 'red')}<span class="v">${Math.round(b.bodyHP)}</span></div>
          <div class="muted">Round : ${r.b.landed}/${r.b.thrown} touchés. Plan actuel : ${MODE_NAMES[this.ctrlB.mode] || ''}.</div>
          ${scouted && opp.weakness ? `<div class="gold">Analyse vidéo : point faible = ${ATTR_NAME[opp.weakness]}</div>` : ''}</div>
      </div>
      <div class="card" style="margin-top:10px"><h3>Analyse du coin</h3>${advice.map((x) => `<div>• ${x}</div>`).join('')}</div>
      <div class="card" style="margin-top:10px"><h3>Consigne pour le round ${E.round + 1}</h3>
        <div class="opts">${Object.entries(INSTRUCTIONS).map(([k, i]) => `<button class="${(this.instruction || 'none') === k ? 'on' : ''}" data-a="instr" data-v="${k}" title="${esc(i.desc)}">${i.name}</button>`).join('')}</div>
        <div class="muted">${coach ? 'Mode coach : votre boxeur appliquera la consigne.' : 'Mode joueur : la consigne est un rappel tactique ; c\'est vous qui boxez.'}</div></div>
      <div class="row" style="margin-top:12px"><button class="danger" data-a="towel">Jeter l'éponge</button><span class="grow"></span><button class="primary" data-a="next">Round ${E.round + 1} ▶</button></div></div></div>`;
    bind(this.app.ui, {
      instr: (k) => { this.instruction = k; this.app.ui.querySelectorAll('[data-a=instr]').forEach((x) => x.classList.toggle('on', x.dataset.v === k)); },
      towel: () => { E.forfeit(0, 'L\'entraîneur jette l\'éponge'); },
      next: () => this.nextRound(),
    });
    if (this.cfg.autoCorner) setTimeout(() => this.nextRound(), 2500);
  }

  cornerAdvice() {
    const E = this.engine, a = E.a, b = E.b, sc = this.scout;
    const out = [];
    const preds = sc.predict(E.time);
    const fav = Object.entries(preds).sort((x, y) => y[1] - x[1])[0];
    if (sc.total > 6) out.push(`Son coup favori : <b>${punchLabel(fav[0], b.stance)}</b> (${Math.round(sc.counts[fav[0]] / (sc.total + 6) * 100)} %). ${PUNCHES[fav[0]].kind === 'hook' ? 'Baisse-toi dessous et remise au direct.' : PUNCHES[fav[0]].kind === 'straight' ? 'Esquive sur le côté et contre au crochet.' : 'Recule d\'un pas : son uppercut est court.'}`);
    if (sc.rate('high') > 0.4) out.push('Il bloque beaucoup en garde haute : <b>travaille au corps</b> et à l\'uppercut.');
    if (sc.rate('slip') + sc.rate('duck') > 0.35) out.push('Il bouge bien la tête : les <b>crochets</b> et les coups au corps passeront mieux que les directs.');
    if (b.stamina < b.staminaMax * 0.4) out.push('Il est <b>fatigué</b> : augmente le rythme.');
    if (b.bodyHP < 60) out.push('Son <b>corps</b> souffre : continue au foie, il va baisser les bras.');
    if (Math.max(b.swell.left, b.swell.right) > 0.3) out.push(`Son œil ${b.swell.left > b.swell.right ? 'gauche' : 'droit'} se ferme : attaque de ce côté.`);
    if (a.stamina < a.staminaMax * 0.4) out.push('Tu es <b>à court d\'énergie</b> : moins de coups dans le vide, gère.');
    if (a.headHP < 50) out.push('Tu prends trop de coups à la tête : <b>garde haute</b>, bouge, clinch si touché.');
    if (!out.length) out.push('Bon round. Continue à travailler derrière le jab.');
    return out;
  }

  nextRound() {
    const E = this.engine;
    if (E.phase !== 'break') return;
    if (this.mode !== 'play') this.ctrlA.instruction = this.instruction || this.ctrlA.instruction;
    const ok = E.restBetweenRounds({ cutmanA: this.cfg.cutman || 0, cutmanB: 2 });
    this.view.mode = 'fight';
    this.app.input.enabled = this.mode === 'play';
    this.app.input.reset();
    if (ok) this.beginRound();
  }

  // ------------------------------------------------------------------ fin
  onEnd(result) {
    if (this.done) return;
    this.done = true;
    this.app.input.enabled = false;
    this.app.sfx.bell(3);
    this.app.sfx.roar(2.5);
    this.hideCount();
    const ko = ['KO', 'TKO'].includes(result.method);
    const show = () => { this.view.mode = 'end'; this.showResult(result); };
    if (ko && this.mode !== 'sim') {
      setTimeout(() => {
        if (this.app.ui.querySelector('.hud')) this.app.ui.innerHTML = '<div class="hud"><div class="pop" style="animation-duration:3s">Ralenti</div></div>';
        this.view.startReplay(show);
      }, 1800);
    } else setTimeout(show, ko ? 0 : 1200);
  }

  simulate() {
    this.view.mode = 'fight';
    this.app.ui.innerHTML = '<div class="hud"><div class="pop">Simulation…</div></div>';
    setTimeout(() => {
      this.engine.simulateToEnd((eng) => {
        if (eng.b.headHP < 18 && eng.round >= 4 && Math.random() < 0.3) eng.forfeit(1, 'Le coin adverse jette l\'éponge');
      });
    }, 60);
  }

  showResult(result) {
    const E = this.engine, A = E.a.boxer, B = E.b.boxer;
    const won = result.winner === 0, draw = result.winner == null;
    this.view.mode = 'end';
    const ctx = this.cfg.onEnd ? this.cfg.onEnd(result, { engine: E, memory: this.ctrlB.model.serialize() }) : null;
    const cards = result.scorecards[0].length ? `<table><tr><th>Juge</th>${result.scorecards[0].map((_, i) => `<th>R${i + 1}</th>`).join('')}<th>Total</th></tr>${result.scorecards.map((card, j) => { const t = totals([card])[0]; return `<tr><td>${['A', 'B', 'C'][j]}</td>${card.map(([x, y]) => `<td>${x}-${y}</td>`).join('')}<td><b>${t[0]}-${t[1]}</b></td></tr>`; }).join('')}</table>` : '';
    const st = result.stats;
    const row = (n, k) => `<tr><td>${n}</td><td style="text-align:right">${st[0][k]}</td><td style="text-align:right">${st[1][k]}</td></tr>`;
    const pct = (x) => (x.thrown ? Math.round(x.landed / x.thrown * 100) : 0) + ' %';
    this.app.ui.innerHTML = `<div class="modal-bg" style="background:rgba(0,0,0,.45)"><div class="modal panel" style="width:min(820px,96vw)">
      <div style="text-align:center"><div class="muted">${METHOD_NAMES[result.method] || result.method}</div>
      <h1 class="${won ? 'gold' : draw ? '' : 'bad'}">${draw ? 'Match nul' : won ? 'Victoire de ' + esc(A.lastName) : 'Victoire de ' + esc(B.lastName)}</h1>
      <div>${esc(result.label)}</div></div>
      ${cards ? `<div class="card" style="margin-top:10px"><h3>Cartes des juges</h3><div class="scroll">${cards}</div></div>` : ''}
      <div class="card" style="margin-top:10px"><h3>Statistiques</h3><table><tr><th></th><th style="text-align:right">${esc(A.lastName)}</th><th style="text-align:right">${esc(B.lastName)}</th></tr>
        ${row('Coups lancés', 'thrown')}${row('Coups touchés', 'landed')}<tr><td>Précision</td><td style="text-align:right">${pct(st[0])}</td><td style="text-align:right">${pct(st[1])}</td></tr>${row('Jabs touchés', 'jabsLanded')}${row('Coups puissants touchés', 'powerLanded')}${row('Au corps', 'bodyLanded')}${row('Contres', 'counters')}${row('Esquivés', 'evaded')}${row('Knockdowns', 'knockdowns')}</table></div>
      ${ctx && ctx.html ? ctx.html : ''}
      <div class="row" style="margin-top:12px;justify-content:flex-end">${this.view.replayBuf.length > 60 ? '<button data-a="replay">Revoir le ralenti</button>' : ''}<button class="primary" data-a="cont">Continuer</button></div></div></div>`;
    bind(this.app.ui, {
      replay: () => { const html = this.app.ui.innerHTML; this.app.ui.innerHTML = ''; this.view.startReplay(() => { this.view.mode = 'end'; this.app.ui.innerHTML = html; bind(this.app.ui, { cont: () => this.leave(ctx), replay: () => {} }); }); },
      cont: () => this.leave(ctx),
    });
  }

  leave(ctx) {
    this.app.sfx.crowd(false);
    document.getElementById('gl').classList.remove('sepia');
    document.getElementById('grain').classList.remove('on');
    this.view.dispose();
    if (ctx && ctx.after) ctx.after(); else this.app.goHub();
  }
}
