// Sons synthétisés en temps réel (Web Audio) : aucun fichier audio, aucune API payante.
// Cloche, impacts, blocages, public, souffle. Voix de l'annonceur via la synthèse vocale du système (si dispo).

export class Sfx {
  constructor() {
    this.ctx = null; this.enabled = true; this.volume = 0.7; this.voice = true;
    this.crowdGain = null;
  }
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(this.ctx.destination);
      // Bruit blanc réutilisable.
      const len = this.ctx.sampleRate * 2;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ctx = null; }
  }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  _noise(dur, freq, q, gain, type = 'bandpass', t0 = 0) {
    const c = this.ctx, t = c.currentTime + t0;
    const src = c.createBufferSource(); src.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }
  _tone(freq, dur, gain, type = 'sine', t0 = 0, slide = 0) {
    const c = this.ctx, t = c.currentTime + t0;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  ok() { return this.enabled && this.ctx; }

  punch(power = 1, blocked = false, body = false) {
    if (!this.ok()) return;
    if (blocked) { this._noise(0.08, 1800, 1.5, 0.35 * power); this._tone(220, 0.06, 0.15, 'triangle'); return; }
    this._noise(0.12, body ? 400 : 900, 0.9, 0.6 * Math.min(1.5, power));
    this._tone(body ? 70 : 110, 0.18, 0.5 * Math.min(1.5, power), 'sine', 0, 0.5);
  }
  whoosh() { if (this.ok()) this._noise(0.15, 2500, 0.6, 0.08, 'highpass'); }
  bell(times = 1) {
    if (!this.ok()) return;
    for (let k = 0; k < times; k++) for (const [f, g] of [[830, 0.35], [1660, 0.15], [2490, 0.08], [415, 0.12]]) this._tone(f, 1.6, g, 'sine', k * 0.35);
  }
  thud() { if (this.ok()) { this._tone(55, 0.5, 0.8, 'sine', 0, 0.4); this._noise(0.3, 200, 0.8, 0.5); } }
  roar(amount = 1) {
    if (!this.ok()) return;
    this._noise(1.2 + amount, 700, 0.4, 0.25 * amount, 'bandpass');
    this._noise(1.0 + amount, 1500, 0.5, 0.12 * amount, 'bandpass', 0.1);
  }
  // Ambiance de foule continue.
  crowd(on, level = 0.3) {
    if (!this.ok()) return;
    if (on && !this.crowdSrc) {
      const c = this.ctx;
      const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 0.3;
      const g = c.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(this.master); src.start();
      this.crowdSrc = src; this.crowdGain = g;
    }
    if (this.crowdGain) this.crowdGain.gain.setTargetAtTime(on ? level * 0.12 : 0, this.ctx.currentTime, 0.4);
    if (!on && this.crowdSrc) { const s = this.crowdSrc; this.crowdSrc = null; setTimeout(() => { try { s.stop(); } catch (e) { /* */ } }, 1500); }
  }
  click() { if (this.ok()) this._tone(900, 0.04, 0.08, 'square'); }
  cash() { if (this.ok()) { this._tone(1200, 0.08, 0.1, 'triangle'); this._tone(1600, 0.12, 0.1, 'triangle', 0.08); } }
  levelUp() { if (this.ok()) [523, 659, 784, 1046].forEach((f, i) => this._tone(f, 0.25, 0.12, 'triangle', i * 0.09)); }

  say(text, opts = {}) {
    if (!this.voice || !this.enabled || !('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'fr-FR'; u.rate = opts.rate || 1.05; u.pitch = opts.pitch || 0.85; u.volume = this.volume;
      const v = speechSynthesis.getVoices().find((x) => x.lang && x.lang.startsWith('fr'));
      if (v) u.voice = v;
      if (opts.interrupt) speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (e) { /* synthèse vocale indisponible */ }
  }
}

export const sfx = new Sfx();
