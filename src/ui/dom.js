// Petits utilitaires DOM.
export const $ = (sel, root = document) => root.querySelector(sel);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Lie les éléments [data-a] à des fonctions : data-a="nom" data-v="valeur".
export function bind(root, actions) {
  root.querySelectorAll('[data-a]').forEach((el) => {
    const ev = el.tagName === 'SELECT' || el.tagName === 'INPUT' ? (el.type === 'range' || el.type === 'color' || el.type === 'text' ? 'input' : 'change') : 'click';
    el.addEventListener(ev, (e) => {
      const fn = actions[el.dataset.a];
      if (!fn) { console.warn('Action inconnue', el.dataset.a); return; }
      e.stopPropagation();
      fn(el.dataset.v, el, e);
    });
  });
}

export function toast(msg) {
  const t = document.getElementById('toast');
  const d = document.createElement('div');
  d.innerHTML = msg;
  t.appendChild(d);
  setTimeout(() => d.remove(), 3600);
}

export function bar(v, max = 100, cls = '') {
  const p = Math.max(0, Math.min(100, (v / max) * 100));
  return `<div class="bar ${cls}"><i style="width:${p}%"></i></div>`;
}

export function modal(html, actions, opts = {}) {
  const ui = document.getElementById('ui');
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal panel">${html}</div>`;
  ui.appendChild(bg);
  const close = () => bg.remove();
  const wrapped = {};
  for (const k in actions) wrapped[k] = (v, el, e) => actions[k](v, el, e, close);
  bind(bg, wrapped);
  if (opts.dismiss) bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
  return { close, el: bg };
}
