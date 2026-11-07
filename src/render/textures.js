// Textures procédurales générées sur canvas (aucun fichier externe requis).
import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function tex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}
export function shade(hex, f) {
  const c = new THREE.Color(hex);
  if (f >= 0) c.lerp(new THREE.Color('#ffffff'), f); else c.lerp(new THREE.Color('#000000'), -f);
  return '#' + c.getHexString();
}
function noise(ctx, w, h, amount, size = 1, alpha = 0.08) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y += size) for (let x = 0; x < w; x += size) {
    const n = (Math.random() - 0.5) * amount;
    for (let yy = 0; yy < size && y + yy < h; yy++) for (let xx = 0; xx < size && x + xx < w; xx++) {
      const i = ((y + yy) * w + (x + xx)) * 4;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// ------------------------------------------------------------- peau du corps (tatouages, cicatrices)
const TATTOO_DRAW = {
  tribal: (g, x, y, s, col) => { g.strokeStyle = col; g.lineWidth = s * 0.09; g.lineCap = 'round'; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x - s * 0.5, y - s * 0.4 + i * s * 0.35); g.bezierCurveTo(x - s * 0.1, y - s * 0.7 + i * s * 0.35, x + s * 0.1, y + i * s * 0.2, x + s * 0.5, y - s * 0.3 + i * s * 0.35); g.stroke(); } },
  etoile: (g, x, y, s, col) => { g.fillStyle = col; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? s * 0.22 : s * 0.5; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.fill(); },
  couronne: (g, x, y, s, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(x - s * 0.5, y + s * 0.3); g.lineTo(x - s * 0.5, y - s * 0.2); g.lineTo(x - s * 0.25, y + s * 0.05); g.lineTo(x, y - s * 0.4); g.lineTo(x + s * 0.25, y + s * 0.05); g.lineTo(x + s * 0.5, y - s * 0.2); g.lineTo(x + s * 0.5, y + s * 0.3); g.closePath(); g.fill(); },
  texte: (g, x, y, s, col, txt) => { g.fillStyle = col; g.font = `italic bold ${Math.round(s * 0.32)}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt || 'FAMILY', x, y); },
  vagues: (g, x, y, s, col) => { g.strokeStyle = col; g.lineWidth = s * 0.06; for (let i = 0; i < 4; i++) { g.beginPath(); for (let k = 0; k <= 20; k++) { const xx = x - s * 0.5 + k * s / 20; g.lineTo(xx, y - s * 0.3 + i * s * 0.2 + Math.sin(k * 0.9 + i) * s * 0.06); } g.stroke(); } },
  croix: (g, x, y, s, col) => { g.fillStyle = col; g.fillRect(x - s * 0.06, y - s * 0.45, s * 0.12, s * 0.9); g.fillRect(x - s * 0.3, y - s * 0.22, s * 0.6, s * 0.12); },
  lion: (g, x, y, s, col) => { g.strokeStyle = col; g.lineWidth = s * 0.05; for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; g.beginPath(); g.moveTo(x + Math.cos(a) * s * 0.18, y + Math.sin(a) * s * 0.18); g.lineTo(x + Math.cos(a + 0.2) * s * 0.45, y + Math.sin(a + 0.2) * s * 0.45); g.stroke(); } g.fillStyle = col; g.beginPath(); g.arc(x, y, s * 0.17, 0, Math.PI * 2); g.fill(); },
  roses: (g, x, y, s, col) => { g.strokeStyle = col; g.lineWidth = s * 0.04; for (let r = 0.05; r < 0.35; r += 0.06) { g.beginPath(); g.arc(x, y, s * r, r * 10, r * 10 + 4.5); g.stroke(); } g.beginPath(); g.moveTo(x, y + s * 0.35); g.lineTo(x - s * 0.1, y + s * 0.6); g.stroke(); },
};

export function makeSkinTexture(app, region, opts = {}) {
  // region : 'torso' | 'arm_l' | 'arm_r' | 'forearm_l' | 'forearm_r' | 'plain'
  const w = region === 'torso' ? 512 : 256, h = 256;
  const c = canvas(w, h), g = c.getContext('2d');
  g.fillStyle = app.skin; g.fillRect(0, 0, w, h);
  noise(g, w, h, 14, 2);
  const ink = 'rgba(20,24,32,0.82)';
  const zoneMap = { torso: ['torse', 'dos'], arm_l: ['bras_g'], arm_r: ['bras_d'], forearm_l: ['avantbras_g'], forearm_r: ['avantbras_d'] };
  for (const t of app.tattoos || []) {
    if (!(zoneMap[region] || []).includes(t.zone)) continue;
    const draw = TATTOO_DRAW[t.design] || TATTOO_DRAW.tribal;
    if (region === 'torso') {
      // u=0.25 → face avant (torse), u=0.75 → dos.
      const cx = t.zone === 'torse' ? w * 0.25 : w * 0.75;
      draw(g, cx, h * 0.38, h * 0.34, ink, opts.name);
    } else {
      // Bras : deux faces pour être visibles sous tous les angles.
      draw(g, w * 0.25, h * 0.4, h * 0.36, ink); draw(g, w * 0.75, h * 0.45, h * 0.3, ink);
    }
  }
  if (region === 'torso' && (app.scars || []).includes('torse')) {
    g.strokeStyle = shade(app.skin, 0.25); g.lineWidth = 3;
    g.beginPath(); g.moveTo(w * 0.22, h * 0.5); g.lineTo(w * 0.3, h * 0.62); g.stroke();
  }
  return tex(c);
}

// ------------------------------------------------------------- visage dynamique (dégâts)
// Coordonnées UV de la sphère de tête : u=0.25 → face, v → angle polaire.
export class FaceTexture {
  constructor(app) {
    this.app = app;
    this.c = canvas(512, 256);
    this.g = this.c.getContext('2d');
    this.texture = tex(this.c);
    this.base = canvas(512, 256);
    this.drawBase();
    this.state = { bruiseL: 0, bruiseR: 0, jaw: 0, cutL: 0, cutR: 0, nose: 0, swellL: 0, swellR: 0 };
    this.redraw();
  }
  drawBase() {
    const g = this.base.getContext('2d'), w = 512, h = 256, a = this.app;
    g.fillStyle = a.skin; g.fillRect(0, 0, w, h);
    noise(g, w, h, 10, 2);
    const fx = w * 0.25;
    // Joues légèrement rosées, lèvres.
    const cheek = (x) => { const gr = g.createRadialGradient(x, h * 0.6, 2, x, h * 0.6, 28); gr.addColorStop(0, 'rgba(170,60,50,0.12)'); gr.addColorStop(1, 'rgba(170,60,50,0)'); g.fillStyle = gr; g.fillRect(x - 30, h * 0.6 - 30, 60, 60); };
    cheek(fx - 34); cheek(fx + 34);
    // Barbe naissante / ombre.
    if (a.beard === 'barbe3j' || a.beard === 'pleine' || a.beard === 'collier' || a.beard === 'bouc') {
      g.fillStyle = 'rgba(25,18,14,0.22)';
      g.beginPath(); g.ellipse(fx, h * 0.76, 52, 24, 0, 0, Math.PI * 2); g.fill();
    }
    // Sourcils peints (en plus des mèches 3D).
    // Cicatrices.
    g.strokeStyle = shade(a.skin, 0.3); g.lineWidth = 2.5; g.lineCap = 'round';
    const scar = (x1, y1, x2, y2) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
    for (const s of a.scars || []) {
      if (s === 'sourcil_g') scar(fx + 22, h * 0.36, fx + 36, h * 0.43);
      if (s === 'sourcil_d') scar(fx - 22, h * 0.36, fx - 36, h * 0.43);
      if (s === 'joue') scar(fx + 30, h * 0.58, fx + 44, h * 0.68);
      if (s === 'nez') scar(fx - 4, h * 0.46, fx + 5, h * 0.5);
      if (s === 'levre') scar(fx + 6, h * 0.66, fx + 9, h * 0.72);
    }
  }
  set(dmg) {
    let changed = false;
    for (const k in dmg) if (Math.abs((this.state[k] || 0) - dmg[k]) > 0.02) { this.state[k] = dmg[k]; changed = true; }
    if (changed) this.redraw();
  }
  redraw() {
    const g = this.g, w = 512, h = 256, s = this.state, fx = w * 0.25;
    g.drawImage(this.base, 0, 0);
    const bruise = (x, y, r, amt, hue = 'purple') => {
      if (amt <= 0.02) return;
      const gr = g.createRadialGradient(x, y, 1, x, y, r);
      const col = hue === 'red' ? [150, 30, 35] : [85, 25, 70];
      gr.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${Math.min(0.75, amt * 0.8)})`);
      gr.addColorStop(0.6, `rgba(${col[0] + 30},${col[1] + 20},${col[2]},${Math.min(0.4, amt * 0.45)})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    };
    // Gauche du boxeur = vers u plus grand.
    bruise(fx + 30, h * 0.45, 26 + s.swellL * 14, s.bruiseL + s.swellL);
    bruise(fx - 30, h * 0.45, 26 + s.swellR * 14, s.bruiseR + s.swellR);
    bruise(fx + 40, h * 0.62, 24, s.bruiseL * 0.7, 'red');
    bruise(fx - 40, h * 0.62, 24, s.bruiseR * 0.7, 'red');
    bruise(fx, h * 0.78, 30, s.jaw, 'red');
    bruise(fx, h * 0.52, 14, s.nose, 'red');
    const cut = (x, y, amt, dir) => {
      if (amt <= 0.05) return;
      g.strokeStyle = 'rgba(110,8,10,0.95)'; g.lineWidth = 2 + amt * 3;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + dir * 16 * (0.5 + amt), y + 4); g.stroke();
      // Sang qui coule.
      g.fillStyle = `rgba(150,10,15,${0.5 + amt * 0.4})`;
      const len = amt * 60;
      g.beginPath(); g.moveTo(x + dir * 4, y + 2); g.quadraticCurveTo(x + dir * 8, y + len * 0.6, x + dir * 5, y + len); g.lineTo(x + dir * 2, y + len); g.quadraticCurveTo(x + dir * 3, y + len * 0.5, x, y + 2); g.fill();
    };
    cut(fx + 24, h * 0.37, s.cutL, 1);
    cut(fx - 24, h * 0.37, s.cutR, -1);
    this.texture.needsUpdate = true;
  }
}

// ------------------------------------------------------------- cheveux / poils
export function hairTexture(color, kind = 'hair') {
  const c = canvas(256, 256), g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 256, 256);
  const dark = shade(color, -0.4), light = shade(color, 0.18);
  for (let i = 0; i < 2400; i++) {
    g.strokeStyle = Math.random() < 0.5 ? dark : light;
    g.globalAlpha = 0.35;
    const x = Math.random() * 256, y = Math.random() * 256;
    g.beginPath(); g.moveTo(x, y);
    if (kind === 'braids') g.lineTo(x + (Math.random() - 0.5) * 2, y + 6);
    else g.lineTo(x + (Math.random() - 0.5) * 4, y + (kind === 'curly' ? (Math.random() - 0.5) * 6 : 5));
    g.stroke();
  }
  g.globalAlpha = 1;
  if (kind === 'braids') {
    g.strokeStyle = dark; g.lineWidth = 3;
    for (let x = 0; x < 256; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  }
  return tex(c);
}

export function stubbleTexture(color) {
  const c = canvas(128, 128), g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  g.fillStyle = color;
  for (let i = 0; i < 2600; i++) { g.globalAlpha = 0.5 + Math.random() * 0.5; g.fillRect(Math.random() * 128, Math.random() * 128, 1, 1); }
  return tex(c);
}

// ------------------------------------------------------------- équipement
export function gloveTexture(color, accent, label = 'BL') {
  const c = canvas(256, 128), g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 256, 128);
  noise(g, 256, 128, 8, 2);
  // Bande et logo sur le dos de la main (u≈0.25 = face avant de la sphère).
  g.fillStyle = accent; g.fillRect(0, 96, 256, 8);
  g.font = 'bold 26px Oswald, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = accent; g.fillText(label, 64, 54);
  g.fillText(label, 192, 54);
  return tex(c);
}

export function shortsTexture(color, trim, text = '') {
  const c = canvas(512, 128), g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 512, 128);
  noise(g, 512, 128, 6, 2);
  // Ceinture large.
  g.fillStyle = trim; g.fillRect(0, 0, 512, 34);
  g.fillStyle = color; g.fillRect(0, 12, 512, 10);
  // Bandes latérales.
  g.fillStyle = trim; g.fillRect(118, 34, 12, 94); g.fillRect(382, 34, 12, 94);
  if (text) {
    g.font = 'bold 22px Oswald, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = trim; g.fillText(text.toUpperCase(), 128 + 0, 70);
    g.fillText(text.toUpperCase(), 384, 70);
  }
  return tex(c);
}

export function ringCanvasTexture(color = '#1d3d7a', logo = 'BOXING LEGEND', sub = '') {
  const c = canvas(1024, 1024), g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 1024, 1024);
  noise(g, 1024, 1024, 10, 3);
  // Usure et traces.
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`;
    g.beginPath(); g.ellipse(512 + (Math.random() - 0.5) * 700, 512 + (Math.random() - 0.5) * 700, 20 + Math.random() * 80, 10 + Math.random() * 30, Math.random() * 3, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = 'rgba(255,255,255,0.15)'; g.lineWidth = 6; g.strokeRect(40, 40, 944, 944);
  g.save(); g.translate(512, 512);
  g.fillStyle = 'rgba(255,255,255,0.14)';
  g.beginPath(); g.arc(0, 0, 230, 0, Math.PI * 2); g.fill();
  g.font = 'bold 84px Oswald, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillText(logo, 0, -10);
  if (sub) { g.font = '600 40px Oswald, Impact, sans-serif'; g.fillText(sub, 0, 70); }
  g.restore();
  // Sponsors en périphérie.
  g.font = 'bold 44px Oswald, Impact, sans-serif'; g.fillStyle = 'rgba(255,255,255,0.28)'; g.textAlign = 'center';
  g.fillText('TITAN NUTRITION', 512, 140); g.save(); g.translate(512, 884); g.rotate(Math.PI); g.fillText('VELOCITY', 0, 0); g.restore();
  const t = tex(c);
  return t;
}

export function apronTexture(text = 'BOXING LEGEND', color = '#111') {
  const c = canvas(1024, 128), g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 1024, 128);
  g.font = 'bold 64px Oswald, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#f5c542'; g.fillText(text, 512, 64);
  const t = tex(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export function textPanel(lines, w = 1024, h = 512, bg = '#05070c') {
  const c = canvas(w, h), g = c.getContext('2d');
  const draw = (ls) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, 'rgba(245,197,66,0.15)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    ls.forEach((l, i) => {
      g.font = `${l.weight || 'bold'} ${l.size || 60}px Oswald, Impact, sans-serif`;
      g.fillStyle = l.color || '#fff';
      g.fillText(l.text, w / 2, l.y != null ? l.y * h : h * (0.25 + i * 0.25));
    });
  };
  draw(lines);
  const t = tex(c);
  t.redraw = (ls) => { draw(ls); t.needsUpdate = true; };
  return t;
}

export function floorTexture(kind = 'wood') {
  const c = canvas(512, 512), g = c.getContext('2d');
  if (kind === 'wood') {
    for (let i = 0; i < 16; i++) {
      g.fillStyle = shade('#6b4a2e', (Math.random() - 0.5) * 0.25);
      g.fillRect(0, i * 32, 512, 31);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, i * 32 + 31, 512, 1);
    }
    noise(g, 512, 512, 18, 2);
  } else if (kind === 'rubber') {
    g.fillStyle = '#26292e'; g.fillRect(0, 0, 512, 512); noise(g, 512, 512, 22, 2);
    g.strokeStyle = 'rgba(0,0,0,0.4)'; for (let i = 0; i <= 512; i += 128) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
  } else if (kind === 'concrete') {
    g.fillStyle = '#4a4a4c'; g.fillRect(0, 0, 512, 512); noise(g, 512, 512, 30, 3);
    for (let i = 0; i < 12; i++) { g.strokeStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); let x = Math.random() * 512, y = Math.random() * 512; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
  } else {
    g.fillStyle = '#121418'; g.fillRect(0, 0, 512, 512); noise(g, 512, 512, 8, 2);
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function wallTexture(kind = 'brick') {
  const c = canvas(512, 512), g = c.getContext('2d');
  if (kind === 'brick') {
    g.fillStyle = '#3a2a22'; g.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 32) for (let x = -64; x < 512; x += 64) {
      const off = (y / 32) % 2 ? 32 : 0;
      g.fillStyle = shade('#7a3b2a', (Math.random() - 0.5) * 0.35);
      g.fillRect(x + off + 2, y + 2, 60, 28);
    }
    noise(g, 512, 512, 25, 2);
    // Taches d'humidité.
    for (let i = 0; i < 6; i++) { const gr = g.createRadialGradient(Math.random() * 512, Math.random() * 512, 5, Math.random() * 512, Math.random() * 512, 120); gr.addColorStop(0, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512); }
  } else {
    g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, 512, 512); noise(g, 512, 512, 10, 2);
    g.fillStyle = '#b3121b'; g.fillRect(0, 380, 512, 30);
    g.fillStyle = '#111'; g.fillRect(0, 410, 512, 102);
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function posterTexture(title, sub, color = '#b3121b') {
  const c = canvas(256, 384), g = c.getContext('2d');
  g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, 256, 384);
  noise(g, 256, 384, 30, 2);
  g.fillStyle = color; g.fillRect(14, 14, 228, 70);
  g.fillStyle = '#fff'; g.font = 'bold 40px Oswald, Impact, sans-serif'; g.textAlign = 'center'; g.fillText(title, 128, 64);
  g.fillStyle = '#222'; g.font = 'bold 26px Oswald, Impact, sans-serif'; g.fillText(sub, 128, 140);
  g.fillStyle = '#333'; g.beginPath(); g.arc(80, 250, 50, 0, Math.PI * 2); g.arc(176, 250, 50, 0, Math.PI * 2); g.fill();
  g.font = 'bold 30px Oswald, Impact, sans-serif'; g.fillStyle = color; g.fillText('VS', 128, 262);
  g.fillStyle = '#222'; g.font = '18px Oswald, sans-serif'; g.fillText('SAMEDI 20H — ENTRÉE 10 €', 128, 350);
  return tex(c);
}

export function noiseTextureCSS() {
  const c = canvas(128, 128), g = c.getContext('2d');
  const img = g.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 40; }
  g.putImageData(img, 0, 0);
  return c.toDataURL();
}
