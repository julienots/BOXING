// Build : génère dist/index.html, un fichier unique jouable hors-ligne (double-clic, sans serveur).
// JS (Three.js inclus), CSS et polices sont intégrés.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
fs.mkdirSync(out, { recursive: true });

const res = await build({
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true, format: 'esm', minify: true, write: false, target: 'es2020',
  alias: { three: path.join(root, 'vendor/three/build/three.module.min.js') },
  plugins: [{ name: 'addons', setup(b) { b.onResolve({ filter: /^three\/addons\// }, (a) => ({ path: path.join(root, 'vendor/three/addons', a.path.slice('three/addons/'.length)) })); } }],
});
const js = res.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
let css = fs.readFileSync(path.join(root, 'styles/main.css'), 'utf8');
css = css.replace(/url\('\.\.\/vendor\/fonts\/([^']+)'\)/g, (m, f) => `url(data:font/woff2;base64,${fs.readFileSync(path.join(root, 'vendor/fonts', f)).toString('base64')})`);
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet"[^>]*>/, `<style>${css}</style>`)
  .replace(/<script type="importmap">[\s\S]*?<\/script>/, '')
  .replace(/<script type="module" src="src\/main.js"><\/script>/, () => `<script type="module">${js}</script>`);
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log(`dist/index.html : ${(html.length / 1024 / 1024).toFixed(2)} Mo`);
