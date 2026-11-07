import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
// Test de bout en bout : lancer `npm start` dans un autre terminal, puis `npm run e2e`.
const S = process.env.OUT || './test-results/'; await import('node:fs').then((fs) => fs.mkdirSync(S, { recursive: true }));
const URL_ = process.env.URL || 'http://localhost:8080/index.html';
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message + ' ' + e.stack));
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.addInitScript(() => localStorage.setItem('boxinglegend.settings', JSON.stringify({ quality: 'low', sound: false, roundLength: 30 })));
await p.goto(URL_);
await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
// Simulation complète d'un combat de carrière via l'UI réelle.
const r = await p.evaluate(async () => {
  const C = await import('./src/core/career.js');
  const { createBoxer } = await import('./src/core/boxer.js');
  const app = window.__app;
  const st = C.newCareer({ boxer: createBoxer({ isPlayer: true, weightClass: 'welter' }) });
  app.loadState(st);
  C.acceptOffer(st, st.offers[0].id);
  st.day = st.booked.day;
  app.preFight();
  return st.booked.oppName;
});
await p.waitForTimeout(800);
await p.click('[data-a=go][data-v=sim]');
await p.waitForFunction(() => document.querySelector('[data-a=cont]'), null, { timeout: 120000 });
await p.screenshot({ path: S+'m_sim.png' });
await p.click('[data-a=cont]');
await p.waitForTimeout(1500);
const after = await p.evaluate(() => ({ rec: window.__app.state.boxer.record, hist: window.__app.state.boxer.history.length, money: window.__app.state.money, booked: !!window.__app.state.booked }));
console.log(r, JSON.stringify(after));
// Mode coach : quelques secondes
await p.evaluate(async () => {
  const { legendBoxer } = await import('./src/data/legends.js');
  const { FightScreen } = await import('./src/ui/fight.js');
  window.__fs = new FightScreen(window.__app, { player: legendBoxer('velvet'), opp: legendBoxer('wall'), rounds: 2, venue: 'historic', mode: 'coach', onEnd: () => ({}) });
  window.__fs.start();
});
await p.waitForTimeout(1500); await p.click('[data-a=go]');
await p.waitForTimeout(8000);
await p.click('[data-a=instr][data-v=pressure]').catch(e=>errs.push('instr '+e.message));
await p.waitForTimeout(3000);
const c = await p.evaluate(() => ({ t: window.__fs.engine.a.stats.thrown, ins: window.__fs.ctrlA.instruction }));
console.log('coach', JSON.stringify(c));
await p.screenshot({ path: S+'m_coach.png' });
if (errs.length) { console.error(errs.join('\n')); process.exitCode = 1; } else console.log('E2E OK');
await b.close();
