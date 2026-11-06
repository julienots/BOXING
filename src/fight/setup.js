// Prépare un combat (carrière ou exhibition) : moteur + contrôleurs.
import { FightEngine } from './engine.js';
import { AIController, HumanController } from './ai.js';
import { clamp } from '../core/util.js';
import { staffBonus } from '../core/training.js';

export const DIFFICULTY = { facile: 0.7, normal: 1.0, difficile: 1.2, legende: 1.4 };

export function setupFight({ player, opp, rounds, settings = {}, mode = 'play', input = null, drain = 0, oppDrain = 0, memory = null, instruction = 'none', amateur = false, gym = null, oppMotivation = 0 }) {
  const engine = new FightEngine({
    boxerA: player, boxerB: opp, rounds, roundLength: settings.roundLength || 90, amateur,
    headgear: amateur, drainA: drain, drainB: oppDrain, threeKnockdownRule: settings.threeKnockdown !== false,
    weightA: player.weight, weightB: opp.weight,
  });
  const diff = DIFFICULTY[settings.difficulty] ?? 1;
  // Adversaire motivé (conférence de presse) : léger bonus.
  if (oppMotivation > 0) { engine.b.a.mental = clamp(engine.b.a.mental + oppMotivation * 1.5, 1, 110); engine.b.a.power *= 1 + oppMotivation * 0.006; }
  let ctrlA;
  if (mode === 'play' && input) ctrlA = new HumanController(engine.a, input);
  else { ctrlA = new AIController(engine.a, { instruction, difficulty: 1 }); ctrlA.attach(engine); }
  const ctrlB = new AIController(engine.b, { difficulty: diff, memory });
  ctrlB.attach(engine);
  engine.cutmanA = gym ? staffBonus(gym, 'cutman') : 0;
  engine.cutmanB = 2;
  return { engine, ctrlA, ctrlB };
}

// Simule complètement un combat (mode coach "simulation rapide").
export function simulateFight(opts) {
  const { engine, ctrlA, ctrlB } = setupFight({ ...opts, mode: 'sim' });
  const result = engine.simulateToEnd((eng) => {
    // L'IA adverse peut abandonner dans son coin.
    if (eng.b.headHP < 18 && eng.round >= 4 && Math.random() < 0.3) eng.forfeit(1, 'Le coin adverse jette l\'éponge');
  });
  return { result, engine, memory: ctrlB.model.serialize() };
}
