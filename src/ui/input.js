// Entrées : clavier (AZERTY et QWERTY) + commandes tactiles (mobile / Android).
// Déplacements : ZQSD / WASD / flèches. Coups : J U I K N M (+ Maj = au corps).
// Défense : Espace = garde haute (maintenir), B = garde au corps, E = esquive, X = baisser la tête,
// V = pas de recul, R = pivot, C = clinch, F = feinte.

export const KEY_HELP = [
  ['Z/W ou ↑', 'Monter (écran)'], ['S ou ↓', 'Descendre'], ['Q/A ou ←', 'Gauche'], ['D ou →', 'Droite'],
  ['J', 'Jab'], ['K', 'Direct'], ['U', 'Crochet avant'], ['I', 'Crochet arrière'], ['N', 'Uppercut avant'], ['M', 'Uppercut arrière'],
  ['Maj + coup', 'Coup au corps'], ['Espace (maintenir)', 'Garde haute'], ['B (maintenir)', 'Garde au corps'],
  ['E', 'Esquive rotative'], ['X', 'Baisser la tête'], ['V', 'Pas de recul'], ['R', 'Pivot*'], ['C', 'Clinch'], ['F', 'Feinte*'],
  ['Entrée / Échap', 'Pause'], ['Tab', 'Changer de caméra'],
];

const PUNCH_KEYS = { j: 'jab', k: 'cross', u: 'lhook', i: 'rhook', n: 'lupper', m: 'rupper' };

export class Input {
  constructor() {
    this.keys = new Set();
    this.queue = [];
    this.actions = [];
    this.mash = 0;
    this.touch = { f: 0, l: 0, block: false, blockBody: false, body: false };
    this.enabled = false;
    this.onPause = null; this.onCamera = null;
    this._kd = (e) => this.keydown(e);
    this._ku = (e) => this.keys.delete(this.norm(e));
    window.addEventListener('keydown', this._kd);
    window.addEventListener('keyup', this._ku);
    window.addEventListener('blur', () => this.keys.clear());
  }
  norm(e) {
    if (e.key === ' ' || e.code === 'Space') return 'space';
    if (e.key && e.key.startsWith('Arrow')) return e.key;
    if (e.key === 'Shift') return 'shift';
    return (e.key || '').toLowerCase();
  }
  keydown(e) {
    if (!this.enabled) return;
    const k = this.norm(e);
    if (['space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'tab'].includes(k)) e.preventDefault();
    if (e.repeat) { this.keys.add(k); return; }
    this.keys.add(k);
    if (k === 'escape' || k === 'enter') { this.onPause && this.onPause(); return; }
    if (k === 'tab') { this.onCamera && this.onCamera(); return; }
    if (PUNCH_KEYS[k]) { this.punch(PUNCH_KEYS[k], e.shiftKey ? 'body' : 'head'); return; }
    if (k === 'e') this.actions.push({ slip: this.axisL() > 0.3 ? 'left' : this.axisL() < -0.3 ? 'right' : (this._slipAlt = !this._slipAlt) ? 'left' : 'right' });
    if (k === 'x') this.actions.push({ duck: true });
    if (k === 'v') this.actions.push({ back: true });
    if (k === 'r') this.actions.push({ pivot: this.axisL() < -0.3 ? 'right' : 'left' });
    if (k === 'c') this.actions.push({ clinch: true });
    if (k === 'f') this.actions.push({ feint: 'jab' });
  }
  punch(type, target) {
    this.queue.push({ type, target: target || (this.touch.body ? 'body' : 'head') });
    if (this.queue.length > 3) this.queue.shift();
    this.mash++;
  }
  action(a) { this.actions.push(a); this.mash++; }
  held(name) {
    if (name === 'block') return this.keys.has('space') || this.touch.block;
    if (name === 'blockBody') return this.keys.has('b') || this.touch.blockBody;
    return false;
  }
  axisF() {
    let v = this.touch.f;
    if (this.keys.has('z') || this.keys.has('w') || this.keys.has('ArrowUp')) v += 1;
    if (this.keys.has('s') || this.keys.has('ArrowDown')) v -= 1;
    return Math.max(-1, Math.min(1, v));
  }
  axisL() {
    let v = this.touch.l;
    if (this.keys.has('q') || this.keys.has('a') || this.keys.has('ArrowLeft')) v += 1;
    if (this.keys.has('d') || this.keys.has('ArrowRight')) v -= 1;
    return Math.max(-1, Math.min(1, v));
  }
  // Déplacement relatif à l'écran (caméra fixe en plongée) → repère du boxeur.
  moveFor(act) {
    const up = this.axisF(), right = -this.axisL();
    const dx = right, dz = -up;
    const fx = Math.cos(act.face), fz = Math.sin(act.face);
    let f = dx * fx + dz * fz, l = dx * -fz + dz * fx;
    const m = Math.hypot(f, l); if (m > 1) { f /= m; l /= m; }
    return { f, l };
  }
  consumePunch() { return this.queue.shift() || null; }
  consumeAction() { return this.actions.shift() || null; }
  consumeMash() { const m = this.mash; this.mash = 0; return m; }
  reset() { this.queue = []; this.actions = []; this.mash = 0; this.keys.clear(); }
}

// Commandes tactiles : joystick virtuel + boutons.
export function buildTouchControls(container, input) {
  const wrap = document.createElement('div');
  wrap.className = 'touch';
  wrap.innerHTML = `
    <div class="tstick"><div class="tknob"></div></div>
    <div class="tbtns">
      <button data-p="jab">Jab</button><button data-p="cross">Direct</button>
      <button data-p="lhook">Crochet AV</button><button data-p="rhook">Crochet AR</button>
      <button data-p="lupper">Upper AV</button><button data-p="rupper">Upper AR</button>
      <button data-h="block" class="def">Garde</button><button data-h="blockBody" class="def">Garde corps</button>
      <button data-a="slip" class="def">Esquive</button><button data-a="duck" class="def">Baisser</button>
      <button data-a="back" class="def">Recul</button><button data-a="clinch" class="def">Clinch</button>
      <button data-t="body" class="tog">Corps</button>
    </div>`;
  container.appendChild(wrap);
  const stick = wrap.querySelector('.tstick'), knob = wrap.querySelector('.tknob');
  let sid = null, cx = 0, cy = 0;
  stick.addEventListener('pointerdown', (e) => { sid = e.pointerId; const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; stick.setPointerCapture(sid); move(e); });
  const move = (e) => {
    if (e.pointerId !== sid) return;
    let dx = (e.clientX - cx) / 50, dy = (e.clientY - cy) / 50;
    const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
    knob.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`;
    input.touch.f = -dy; input.touch.l = -dx;
  };
  stick.addEventListener('pointermove', move);
  const end = (e) => { if (e.pointerId !== sid) return; sid = null; knob.style.transform = ''; input.touch.f = 0; input.touch.l = 0; };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  for (const b of wrap.querySelectorAll('button')) {
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (b.dataset.p) input.punch(b.dataset.p);
      if (b.dataset.h) input.touch[b.dataset.h] = true;
      if (b.dataset.a === 'slip') input.action({ slip: input.touch.l > 0 ? 'left' : 'right' });
      else if (b.dataset.a) input.action({ [b.dataset.a]: true });
      if (b.dataset.t) { input.touch.body = !input.touch.body; b.classList.toggle('on', input.touch.body); }
    });
    const up = () => { if (b.dataset.h) input.touch[b.dataset.h] = false; };
    b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
  }
  return wrap;
}
