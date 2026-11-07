// Gymnase 3D : la salle évolue avec son niveau, chaque équipement acheté apparaît et s'anime.
import * as THREE from 'three';
import { floorTexture, wallTexture, posterTexture, textPanel } from './textures.js';
import { BoxerModel } from './boxerModel.js';
import { Animator } from './animator.js';
import { EXERCISES } from '../core/training.js';
import { createBoxer, defaultAppearance } from '../core/boxer.js';

const m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });

// Positions des stations (x, z) et orientation de l'athlète (yaw) dans la salle.
const STATIONS = {
  heavybag:   { pos: [-4.2, -2.4], yaw: Math.PI, eq: 'heavybag' },
  speedbag:   { pos: [-1.6, -4.3], yaw: Math.PI, eq: 'speedbag' },
  doubleend:  { pos: [1.0, -2.6], yaw: Math.PI, eq: 'doubleend' },
  mitts:      { pos: [3.6, 1.6], yaw: Math.PI / 2, eq: 'ring' },
  sparring:   { pos: [3.6, 1.6], yaw: Math.PI / 2, eq: 'ring' },
  defense:    { pos: [3.6, 1.6], yaw: Math.PI / 2, eq: 'ring' },
  rope:       { pos: [-1.5, 0.5], yaw: 0.4, eq: 'ropes' },
  dumbbells:  { pos: [-4.5, 2.4], yaw: Math.PI / 2, eq: 'dumbbells' },
  bench:      { pos: [-4.0, 4.2], yaw: 0, eq: 'bench' },
  machines:   { pos: [-1.8, 4.6], yaw: Math.PI, eq: 'machines' },
  battlerope: { pos: [0.6, 3.6], yaw: Math.PI, eq: 'battlerope' },
  dummy:      { pos: [-3.0, -0.6], yaw: Math.PI / 2, eq: 'dummy' },
  cardio:     { pos: [5.2, -3.6], yaw: Math.PI, eq: 'cardio' },
  run:        { pos: [5.2, -3.6], yaw: Math.PI, eq: 'cardio' },
  mirror:     { pos: [1.4, -4.2], yaw: Math.PI, eq: 'mirror' },
  shadow:     { pos: [0, 0.6], yaw: Math.PI, eq: null },
  neck:       { pos: [1.2, 1.4], yaw: 0, eq: null },
  stretch:    { pos: [1.2, 1.4], yaw: 0, eq: null },
  rest:       { pos: [-0.2, 5.3], yaw: Math.PI, eq: null },
  video:      { pos: [-0.2, 5.3], yaw: Math.PI, eq: null },
  meditation: { pos: [-0.2, 5.3], yaw: Math.PI, eq: null },
  massage:    { pos: [-0.2, 5.3], yaw: Math.PI, eq: null },
  sauna:      { pos: [5.0, 4.4], yaw: Math.PI / 2, eq: 'recovery' },
  active:     { pos: [1.2, 1.4], yaw: 0, eq: null },
};

const ANIM_OF = { heavybag: 'heavybag', speedbag: 'speedbag', doubleend: 'doubleend', mitts: 'mitts', sparring: 'sparring', defense: 'defense', rope: 'rope', dumbbells: 'dumbbells', bench: 'bench', machines: 'machines', battlerope: 'battlerope', dummy: 'dummy', cardio: 'run', run: 'run', mirror: 'shadow', shadow: 'shadow', neck: 'core', stretch: 'stretch', active: 'stretch', rest: 'rest', video: 'rest', meditation: 'meditation', massage: 'rest', sauna: 'rest' };

export class GymScene {
  constructor(state) {
    this.state = state;
    this.scene = new THREE.Scene();
    this.props = {};
    this.t = 0;
    this.build();
  }

  build() {
    const g = this.state.gym, sc = this.scene;
    const lvl = g.level;
    sc.background = new THREE.Color(lvl <= 1 ? '#120f0c' : lvl <= 3 ? '#14171c' : '#0b0d12');
    sc.fog = new THREE.Fog(sc.background, 14, 30);
    // Sol et murs : de la cave délabrée au centre d'élite.
    const ft = floorTexture(lvl <= 1 ? 'concrete' : lvl <= 2 ? 'wood' : 'rubber');
    ft.repeat.set(5, 5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 12), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; sc.add(floor);
    const wt = wallTexture(lvl <= 2 ? 'brick' : 'gym');
    wt.repeat.set(4, 1);
    const wallM = new THREE.MeshStandardMaterial({ map: wt, roughness: 0.95, color: lvl <= 1 ? '#8a7a6a' : '#ffffff' });
    const walls = [[0, 4, -6, 0, 14], [0, 4, 6, Math.PI, 14], [-7, 4, 0, Math.PI / 2, 12], [7, 4, 0, -Math.PI / 2, 12]];
    for (const [x, y, z, ry, w] of walls) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, 8), wallM);
      wall.position.set(x, y, z); wall.rotation.y = ry; wall.receiveShadow = true; sc.add(wall);
    }
    // Nom du club sur le mur.
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.2), new THREE.MeshBasicMaterial({ map: textPanel([{ text: g.name.toUpperCase(), size: 110, color: lvl >= 4 ? '#f5c542' : '#e8e0d0', y: 0.5 }], 1024, 256, lvl <= 1 ? '#2a1d14' : '#0d0f14'), transparent: false }));
    sign.position.set(0, 5.2, -5.97); sc.add(sign);
    // Affiches.
    for (let i = 0; i < 3 + lvl; i++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.35), new THREE.MeshStandardMaterial({ map: posterTexture(['BOXE', 'GALA', 'FIGHT', 'K.O.'][i % 4], ['NUIT DES CHAMPIONS', 'TITRE EN JEU', 'GRAND GALA', 'REVANCHE'][i % 4], ['#b3121b', '#0f3d91', '#111', '#0e7a3a'][i % 4]) }));
      p.position.set(-6.97, 2.3, -4 + i * 1.3); p.rotation.y = Math.PI / 2; sc.add(p);
    }
    // Éclairage : néons grésillants → spots modernes.
    sc.add(new THREE.HemisphereLight('#cfd6e6', '#3a2c20', lvl <= 1 ? 0.35 : 0.6));
    const key = new THREE.DirectionalLight(lvl <= 1 ? '#fff0d0' : '#ffffff', lvl <= 1 ? 1.3 : 2.0);
    key.position.set(3, 9, 4); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 25 });
    key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
    sc.add(key);
    this.neons = [];
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j += 2) {
      const tube = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.12), new THREE.MeshStandardMaterial({ color: '#eee', emissive: lvl >= 4 ? '#cfe3ff' : '#fff6e0', emissiveIntensity: 2.5 }));
      tube.position.set(i * 4, 7.6, j * 3); sc.add(tube); this.neons.push(tube);
      const pl = new THREE.PointLight(lvl >= 4 ? '#dfe9ff' : '#fff1d6', lvl <= 1 ? 6 : 10, 12); pl.position.set(i * 4, 7, j * 3); sc.add(pl);
    }
    // Détails de délabrement ou de luxe.
    if (lvl <= 1) {
      for (let i = 0; i < 4; i++) { const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.6), m('#5a4632')); box.position.set(6 - i * 0.7, 0.25, 5.3); box.rotation.y = i; box.castShadow = true; sc.add(box); }
      const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.8, 24), new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.05, metalness: 0.6 }));
      puddle.rotation.x = -Math.PI / 2; puddle.position.set(4, 0.005, -1); sc.add(puddle);
    }
    if (lvl >= 3) {
      const led = new THREE.Mesh(new THREE.BoxGeometry(13.8, 0.06, 0.06), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#d4af37', emissiveIntensity: 3 }));
      led.position.set(0, 0.2, -5.95); sc.add(led);
    }
    if (lvl >= 4) {
      const trophy = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.1, 0.5, 16), new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 1, roughness: 0.2 }));
      trophy.position.set(6, 1.3, -5.6); sc.add(trophy);
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.08, 0.4), m('#222')); shelf.position.set(5.6, 1.0, -5.7); sc.add(shelf);
    }
    // Banc de repos (toujours présent).
    const rb = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.45, 0.5), m('#3a2a1a')); rb.position.set(-0.2, 0.225, 5.5); rb.castShadow = true; sc.add(rb);
    this.buildEquipment();
    // Boxeur + coach.
    this.boxerModel = new BoxerModel(this.state.boxer);
    this.anim = new Animator(this.boxerModel);
    sc.add(this.boxerModel.root);
    const coachB = createBoxer({ firstName: 'Coach', lastName: this.state.coach.name || 'Coach', appearance: { ...defaultAppearance(), skin: '#c68a5f', height: 176, muscle: 0.2, belly: 0.5, hair: 'chauve', beard: 'pleine', beardColor: '#888', hairColor: '#777' } });
    coachB.shirt = '#1d2533';
    this.coach = new BoxerModel(coachB, { kind: 'coach' });
    this.coachAnim = new Animator(this.coach);
    this.coach.setGloves(false);
    sc.add(this.coach.root);
    this.setActivity('shadow');
  }

  buildEquipment() {
    const eq = this.state.gym.equipment, sc = this.scene;
    const qual = (k) => eq[k] || 0;
    const chrome = (lvl) => new THREE.MeshStandardMaterial({ color: lvl >= 3 ? '#e6e6e6' : lvl >= 2 ? '#9a9a9a' : '#5b5550', metalness: 0.9, roughness: lvl >= 3 ? 0.15 : 0.45 });
    const leather = (c, lvl) => new THREE.MeshPhysicalMaterial({ color: c, roughness: lvl >= 3 ? 0.3 : 0.65, clearcoat: lvl >= 2 ? 0.6 : 0 });
    // Sac lourd (pendule).
    if (qual('heavybag')) {
      const st = STATIONS.heavybag.pos;
      const pivot = new THREE.Group(); pivot.position.set(st[0], 3.4, st[1] - 0.75); sc.add(pivot);
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.8, 6), chrome(2)); chain.position.y = -0.4; pivot.add(chain);
      const bagCol = ['#000', '#5b2a1a', '#7b1e1e', '#111'][qual('heavybag')];
      const bag = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.05, 8, 20), leather(bagCol, qual('heavybag')));
      bag.position.y = -1.45; bag.castShadow = true; pivot.add(bag);
      if (qual('heavybag') === 1) { const tape = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.12, 20), m('#777')); tape.position.y = -1.3; pivot.add(tape); }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 2), m('#333')); beam.position.set(st[0], 3.45, st[1] - 0.75); sc.add(beam);
      this.props.heavybag = { pivot, vx: 0, vz: 0, ax: 0, az: 0, target: new THREE.Vector3(st[0], 1.4, st[1] - 0.6), body: new THREE.Vector3(st[0], 1.1, st[1] - 0.6) };
    }
    if (qual('speedbag')) {
      const st = STATIONS.speedbag.pos;
      const board = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 24), m('#3a2a1a')); board.position.set(st[0], 2.05, st[1] - 0.5); sc.add(board);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.7), chrome(qual('speedbag'))); arm.position.set(st[0], 2.05, st[1] - 0.9); sc.add(arm);
      const sb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), leather('#7b1e1e', qual('speedbag'))); sb.scale.set(1, 1.4, 1); sb.position.set(st[0], 1.85, st[1] - 0.5); sc.add(sb);
      this.props.speedbag = { mesh: sb, base: sb.position.clone() };
    }
    if (qual('doubleend')) {
      const st = STATIONS.doubleend.pos;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), leather('#b3121b', qual('doubleend'))); ball.position.set(st[0], 1.6, st[1] - 0.6); ball.castShadow = true; sc.add(ball);
      const cordM = new THREE.LineBasicMaterial({ color: '#222' });
      const cg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(st[0], 0, st[1] - 0.6), ball.position.clone(), new THREE.Vector3(st[0], 4, st[1] - 0.6)]);
      const cord = new THREE.Line(cg, cordM); sc.add(cord);
      this.props.doubleend = { ball, cord, base: ball.position.clone(), vel: new THREE.Vector3(), target: ball.position.clone() };
    }
    if (qual('ring')) {
      const st = STATIONS.mitts.pos;
      const R = 2.1;
      const plat = new THREE.Mesh(new THREE.BoxGeometry(R * 2 + 0.6, 0.3, R * 2 + 0.6), m(qual('ring') >= 3 ? '#0f3d91' : qual('ring') >= 2 ? '#2b4b6b' : '#555'));
      plat.position.set(st[0] + 1.3, 0.15, st[1]); plat.receiveShadow = true; sc.add(plat);
      for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 10), chrome(qual('ring'))); post.position.set(st[0] + 1.3 + x * R, 1.05, st[1] + z * R); sc.add(post);
      }
      const rm = m(qual('ring') >= 3 ? '#d32f2f' : '#bbb');
      for (const h of [0.75, 1.1, 1.45]) for (let s = 0; s < 4; s++) {
        const a = [[-1, -1], [1, -1], [1, 1], [-1, 1]][s], b = [[-1, -1], [1, -1], [1, 1], [-1, 1]][(s + 1) % 4];
        const p0 = new THREE.Vector3(st[0] + 1.3 + a[0] * R, h, st[1] + a[1] * R), p1 = new THREE.Vector3(st[0] + 1.3 + b[0] * R, h, st[1] + b[1] * R);
        const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(p0, p1), 2, 0.022, 6), rm); sc.add(rope);
      }
      this.ringY = 0.3;
    }
    if (qual('dumbbells')) {
      const st = STATIONS.dumbbells.pos;
      const rack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 1.6), m('#222')); rack.position.set(st[0] - 0.9, 0.35, st[1]); sc.add(rack);
      for (let i = 0; i < 5; i++) { const db = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.32, 10), chrome(qual('dumbbells'))); db.rotation.z = Math.PI / 2; db.position.set(st[0] - 0.9, 0.75, st[1] - 0.6 + i * 0.3); sc.add(db); }
      // Haltères en main.
      const mk = () => { const g = new THREE.Group(); const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25, 8), chrome(2)); bar.rotation.z = Math.PI / 2; g.add(bar); for (const x of [-0.1, 0.1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 14), m('#111')); p.rotation.z = Math.PI / 2; p.position.x = x; g.add(p); } return g; };
      this.props.handDB = [mk(), mk()];
    }
    if (qual('bench')) {
      const st = STATIONS.bench.pos;
      const bench = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 1.3), leather('#111', qual('bench'))); bench.position.set(st[0], 0.21, st[1] - 0.1); bench.castShadow = true; sc.add(bench);
      const upr = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 0.08), chrome(qual('bench'))); upr.position.set(st[0], 0.6, st[1] - 0.85); sc.add(upr);
      const bar = new THREE.Group();
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.8, 8), chrome(3)); rod.rotation.z = Math.PI / 2; bar.add(rod);
      for (const x of [-0.75, 0.75]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 20), m('#111')); p.rotation.z = Math.PI / 2; p.position.x = x; bar.add(p); }
      bar.position.set(st[0], 1.15, st[1] - 0.75); sc.add(bar);
      this.props.barbell = { bar, base: bar.position.clone() };
    }
    if (qual('machines')) {
      const st = STATIONS.machines.pos;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 0.15), chrome(qual('machines'))); frame.position.set(st[0], 1.1, st[1] - 0.9); sc.add(frame);
      const stack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.3), m('#111')); stack.position.set(st[0], 0.4, st[1] - 0.95); sc.add(stack);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.1, 0.45), leather('#111', 2)); seat.position.set(st[0], 0.5, st[1]); sc.add(seat);
      this.props.stack = stack;
    }
    if (qual('battlerope')) {
      const st = STATIONS.battlerope.pos;
      const anchor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), m('#333')); anchor.position.set(st[0], 0.15, st[1] - 3.5); sc.add(anchor);
      this.props.ropes = [0, 1].map(() => { const mesh = new THREE.Mesh(new THREE.BufferGeometry(), m('#2b2b2b')); sc.add(mesh); return mesh; });
      this.props.ropeAnchor = anchor.position;
    }
    if (qual('dummy')) {
      const st = STATIONS.dummy.pos;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.5, 20), m('#222')); base.position.set(st[0] + 0.7, 0.25, st[1]); sc.add(base);
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.55, 6, 16), new THREE.MeshPhysicalMaterial({ color: '#e0c7a0', roughness: 0.5, clearcoat: 0.3 })); torso.position.set(st[0] + 0.7, 1.15, st[1]); torso.castShadow = true; sc.add(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), torso.material); head.position.set(st[0] + 0.7, 1.68, st[1]); sc.add(head);
      this.props.dummy = { head: head.position.clone(), body: new THREE.Vector3(st[0] + 0.7, 1.15, st[1]), torso, headM: head, wob: 0 };
    }
    if (qual('cardio')) {
      const st = STATIONS.cardio.pos;
      const belt = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 2.0), m('#151515')); belt.position.set(st[0], 0.075, st[1]); sc.add(belt);
      const console_ = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.15), new THREE.MeshStandardMaterial({ color: '#111', emissive: '#0af', emissiveIntensity: 0.6 })); console_.position.set(st[0], 1.3, st[1] - 0.95); sc.add(console_);
      for (const x of [-0.35, 0.35]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8), chrome(qual('cardio'))); p.position.set(st[0] + x, 0.7, st[1] - 0.9); sc.add(p); }
      const bike = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1, 1.1), m('#222')); bike.position.set(st[0] - 1.4, 0.5, st[1]); sc.add(bike);
    }
    if (qual('mirror')) {
      const st = STATIONS.mirror.pos;
      const mir = new THREE.Mesh(new THREE.PlaneGeometry(2.4 * qual('mirror'), 2.2), new THREE.MeshStandardMaterial({ color: '#cfd8e0', metalness: 1, roughness: 0.04 }));
      mir.position.set(st[0], 1.4, -5.96); sc.add(mir);
    }
    if (qual('recovery')) {
      const st = STATIONS.sauna.pos;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 1.6), m('#8a5a2b')); cabin.position.set(st[0] + 0.9, 1.1, st[1]); sc.add(cabin);
      const tub = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.7, 24), chrome(2)); tub.position.set(st[0] - 0.3, 0.35, st[1] - 1.4); sc.add(tub);
    }
    if (qual('ropes')) {
      // Corde à sauter (arc animé).
      this.props.jumprope = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.008, 6, 40, Math.PI * 1.2), m('#111'));
      sc.add(this.props.jumprope); this.props.jumprope.visible = false;
    }
  }

  setActivity(exId) {
    this.activity = exId;
    const stn = STATIONS[exId] || STATIONS.shadow;
    let [x, z] = stn.pos;
    if (stn.eq && !this.state.gym.equipment[stn.eq]) { [x, z] = STATIONS.shadow.pos; }
    const ringStation = ['mitts', 'sparring', 'defense'].includes(exId);
    const y = ringStation && this.ringY ? this.ringY : 0;
    this.boxerModel.root.position.set(x, y, z);
    this.boxerModel.root.rotation.y = stn.yaw;
    this.animKind = ANIM_OF[exId] || 'shadow';
    const gloves = ['heavybag', 'speedbag', 'doubleend', 'mitts', 'sparring', 'dummy', 'defense', 'shadow'].includes(this.animKind);
    this.boxerModel.setGloves(gloves);
    this.boxerModel.setHeadgear(exId === 'sparring');
    // Haltères en main.
    if (this.props.handDB) for (const [i, s] of ['L', 'R'].entries()) {
      const db = this.props.handDB[i];
      if (this.animKind === 'dumbbells') { this.boxerModel.arms[s].hand.add(db); db.position.set(0, -0.05, 0); db.rotation.set(0, 0, Math.PI / 2); }
      else if (db.parent) db.parent.remove(db);
    }
    // Coach : tient les pattes d'ours / observe / masse.
    const c = this.coach.root;
    if (ringStation) { c.position.set(x + 1.15, y, z); c.rotation.y = -Math.PI / 2; this.coachMode = exId === 'sparring' ? 'spar' : 'mitts'; this.coach.setGloves(exId === 'sparring'); }
    else if (exId === 'massage') { c.position.set(x + 0.8, 0, z - 0.6); c.rotation.y = -Math.PI / 2; this.coachMode = 'watch'; }
    else { c.position.set(x + 1.6, 0, z + 1.2); c.rotation.y = Math.atan2(x - (x + 1.6), z - (z + 1.2)); this.coachMode = 'watch'; }
    this.anim.script = null;
    this.anim.first = true;
    if (this.props.jumprope) this.props.jumprope.visible = this.animKind === 'rope';
    this.lastHit = 0;
  }

  // Cible du coup en espace "body" du boxeur.
  targetFor() {
    const bm = this.boxerModel;
    bm.root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(bm.body.matrixWorld).invert();
    const toB = (v) => v.clone().applyMatrix4(inv);
    switch (this.animKind) {
      case 'heavybag': { const p = this.props.heavybag; if (!p) break; const w = p.pivot.localToWorld(new THREE.Vector3(0, -1.2, 0.2)); const wb = p.pivot.localToWorld(new THREE.Vector3(0, -1.55, 0.2)); return { head: toB(w), body: toB(wb) }; }
      case 'doubleend': { const p = this.props.doubleend; if (!p) break; return { head: toB(p.ball.position.clone().add(new THREE.Vector3(0, 0, 0.1))), body: toB(p.ball.position) }; }
      case 'dummy': { const p = this.props.dummy; if (!p) break; return { head: toB(p.headM.position.clone().add(new THREE.Vector3(-0.12, 0, 0))), body: toB(p.body.clone().add(new THREE.Vector3(-0.18, 0, 0))) }; }
      case 'mitts': case 'sparring': { const h = this.coach.headWorld(new THREE.Vector3()); return { head: toB(h), body: toB(h.clone().add(new THREE.Vector3(0, -0.4, 0))) }; }
      default: break;
    }
    return null;
  }

  update(dt) {
    this.t += dt;
    const P = this.props;
    const target = this.targetFor();
    this.anim.updateTraining(dt, this.animKind, {
      style: this.state.boxer.style, target,
      onHit: (ac) => {
        const pw = { jab: 0.5, cross: 1, lhook: 1.1, rhook: 1.3, lupper: 0.9, rupper: 1.2 }[ac.type] * (0.5 + this.state.boxer.attrs.power / 100);
        if (this.animKind === 'heavybag' && P.heavybag) { P.heavybag.vz -= 0.35 * pw; P.heavybag.vx += (Math.random() - 0.5) * 0.2 * pw; }
        if (this.animKind === 'doubleend' && P.doubleend) { P.doubleend.vel.add(new THREE.Vector3((Math.random() - 0.5) * 1.5, (Math.random() - 0.3) * 0.8, -2.2 * pw)); }
        if (this.animKind === 'dummy' && P.dummy) P.dummy.wob += 0.15 * pw;
        if (this.onHit) this.onHit(ac, pw);
      },
    });
    // Sac lourd : pendule amorti.
    if (P.heavybag) {
      const b = P.heavybag;
      b.vx += -b.ax * 9 * dt; b.vz += -b.az * 9 * dt; b.vx *= 0.985; b.vz *= 0.985;
      b.ax += b.vx * dt; b.az += b.vz * dt;
      b.pivot.rotation.x = -b.az; b.pivot.rotation.z = b.ax;
    }
    if (P.speedbag) {
      const on = this.animKind === 'speedbag';
      P.speedbag.mesh.position.copy(P.speedbag.base);
      if (on) { P.speedbag.mesh.position.z += Math.sin(this.t * 36) * 0.1; P.speedbag.mesh.rotation.x = Math.sin(this.t * 36) * 0.8; }
    }
    if (P.doubleend) {
      const d = P.doubleend;
      d.vel.addScaledVector(d.ball.position.clone().sub(d.base), -60 * dt);
      d.vel.multiplyScalar(0.96);
      d.ball.position.addScaledVector(d.vel, dt);
      const pos = d.cord.geometry.attributes.position; pos.setXYZ(1, d.ball.position.x, d.ball.position.y, d.ball.position.z); pos.needsUpdate = true;
    }
    if (P.dummy) { P.dummy.wob *= 0.92; P.dummy.torso.rotation.z = Math.sin(this.t * 14) * P.dummy.wob * 0.3; }
    if (P.barbell) { const on = this.animKind === 'bench'; P.barbell.bar.position.copy(P.barbell.base); if (on) { const h = this.boxerModel.gloveWorld('L', new THREE.Vector3()); P.barbell.bar.position.set(P.barbell.base.x, h.y, h.z); } }
    if (P.stack) P.stack.position.y = 0.4 + (this.animKind === 'machines' ? (Math.sin(this.t * 2) + 1) * 0.15 : 0);
    if (P.ropes) {
      const on = this.animKind === 'battlerope';
      for (const [i, mesh] of P.ropes.entries()) {
        const hand = this.boxerModel.gloveWorld(i ? 'R' : 'L', new THREE.Vector3());
        if (!on) { hand.set(P.ropeAnchor.x + (i ? -0.2 : 0.2), 0.05, P.ropeAnchor.z + 3.2); }
        const pts = [];
        for (let k = 0; k <= 30; k++) {
          const t = k / 30;
          const p = hand.clone().lerp(P.ropeAnchor, t);
          p.y = hand.y * (1 - t) + P.ropeAnchor.y * t;
          if (on) p.y += Math.sin(t * 14 - this.t * 11 + i * Math.PI) * 0.15 * (1 - t) * Math.min(1, t * 6);
          else p.y = 0.04;
          pts.push(p);
        }
        mesh.geometry.dispose();
        mesh.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.025, 6);
      }
    }
    if (P.jumprope && P.jumprope.visible) {
      const r = this.boxerModel.root;
      P.jumprope.position.set(r.position.x, 0.95 + this.boxerModel.body.position.y, r.position.z);
      P.jumprope.rotation.set(this.t * 15, r.rotation.y + Math.PI / 2, 0, 'YXZ');
    }
    // Coach.
    if (this.coachMode === 'mitts' || this.coachMode === 'spar') {
      this.coachAnim.updateIdle(dt, { energy: 0.3, relaxed: false });
    } else this.coachAnim.updateIdle(dt, { relaxed: true });
    // Néons qui grésillent dans une salle délabrée.
    if (this.state.gym.level <= 1 && this.neons.length) {
      const n = this.neons[2];
      n.material.emissiveIntensity = Math.random() < 0.04 ? 0.2 : 2.5;
    }
    // Transpiration progressive pendant l'effort.
    const effort = !['rest', 'meditation', 'stretch'].includes(this.animKind);
    this.boxerModel.setSweat(Math.min(1, (this.state.boxer.condition.fatigue / 100) * 0.8 + (effort ? 0.15 : 0)));
  }

  boxerPosition() { return this.boxerModel.root.position.clone(); }
}

export { STATIONS };
