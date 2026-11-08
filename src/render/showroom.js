// Scène « vitrine » : boxeur mis en valeur (menu, tableau de bord, créateur de personnage).
import * as THREE from 'three';
import { BoxerModel } from './boxerModel.js';
import { Animator } from './animator.js';
import { floorTexture } from './textures.js';

export class Showroom {
  constructor() {
    const sc = this.scene = new THREE.Scene();
    sc.background = new THREE.Color('#07080b');
    sc.fog = new THREE.Fog('#07080b', 6, 16);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const ft = floorTexture('dark'); ft.repeat.set(6, 6);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(8, 48), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.35, metalness: 0.3 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; sc.add(floor);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.16, 64), new THREE.MeshBasicMaterial({ color: '#f5c542' }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.005; sc.add(ring);
    sc.add(new THREE.HemisphereLight('#8090b0', '#201810', 0.35));
    const key = new THREE.SpotLight('#fff3e0', 160, 20, Math.PI / 7, 0.5, 1.5);
    key.position.set(2.5, 6, 3.5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
    sc.add(key, key.target);
    const rim = new THREE.SpotLight('#5b7bff', 120, 20, Math.PI / 6, 0.6, 1.5); rim.position.set(-3, 3.5, -3.5); sc.add(rim, rim.target);
    const rim2 = new THREE.SpotLight('#ff4b3a', 80, 20, Math.PI / 6, 0.6, 1.5); rim2.position.set(3.5, 2.5, -3); sc.add(rim2, rim2.target);
    this.key = key;
    this.model = null; this.anim = null;
    this.t = 0;
    this.layout = 'center'; // center | left | right | close
    this.yaw = 0.35; this.dragYaw = 0;
    this.camPos = new THREE.Vector3(0, 1.4, 5); this.look = new THREE.Vector3(0, 1.1, 0);
  }

  setBoxer(boxer, opts = {}) {
    if (this.model) { this.scene.remove(this.model.root); this.model.dispose(); }
    this.model = new BoxerModel(boxer);
    this.anim = new Animator(this.model);
    this.model.setRobe(!!opts.robe);
    this.model.setSweat(0.15);
    this.scene.add(this.model.root);
    this.key.target.position.set(0, 1, 0);
    this.boxer = boxer;
  }

  rebuild() { if (this.boxer) { const r = this.model.root.rotation.y; this.setBoxer(this.boxer); this.model.root.rotation.y = r; } }

  update(dt) {
    this.t += dt;
    if (!this.model) return;
    this.anim.updateIdle(dt, { energy: 0.6, shadow: this.layout !== 'close', style: this.boxer.style });
    this.model.root.rotation.y = this.yaw + this.dragYaw + Math.sin(this.t * 0.3) * 0.15;
    const H = this.model.D.H;
    const w = window.innerWidth, narrow = w < 860 && window.innerHeight > w; // portrait étroit
    let pos, look;
    if (this.layout === 'close') { look = new THREE.Vector3(0, H * 0.9, 0); pos = new THREE.Vector3(0, H * 0.92, 1.25); }
    else if (narrow) { look = new THREE.Vector3(0, H * 0.55 - (this.layout === 'center' ? 0 : -0.35), 0); pos = new THREE.Vector3(0, H * 0.7, 5.6); }
    else {
      const off = (this.layout === 'left' ? 1.25 : this.layout === 'right' ? -1.25 : 0) * (window.innerHeight < 540 ? 1.15 : 1);
      look = new THREE.Vector3(off, H * 0.55, 0); pos = new THREE.Vector3(off, H * 0.62, 5.2);
    }
    this.camPos.lerp(pos, Math.min(1, dt * 3)); this.look.lerp(look, Math.min(1, dt * 3));
    this.camera.position.copy(this.camPos); this.camera.lookAt(this.look);
  }
}
