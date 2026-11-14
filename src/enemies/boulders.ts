import * as THREE from 'three';
import type { Game } from '../game';

const G = 30;

interface Rock {
  mesh: THREE.Mesh;
  ring: THREE.Mesh;
  vel: THREE.Vector3;
  alive: boolean;
  dmg: number;
}

/** Taşçı devlerin fırlattığı kayalar. Düşeceği yer kırmızı bir halkayla önceden belli olur. */
export class Boulders {
  private readonly rocks: Rock[] = [];
  static readonly RADIUS = 6;

  constructor(scene: THREE.Scene) {
    const geo = new THREE.DodecahedronGeometry(1.7, 0);
    const mat = new THREE.MeshLambertMaterial({ color: 0x6f6a60, flatShading: true });
    const ringGeo = new THREE.RingGeometry(Boulders.RADIUS - 0.7, Boulders.RADIUS, 32);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.visible = false;
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.7, depthWrite: false, fog: false }));
      ring.visible = false;
      scene.add(mesh, ring);
      this.rocks.push({ mesh, ring, vel: new THREE.Vector3(), alive: false, dmg: 0 });
    }
  }

  /** `from` noktasından (tx, tz) hedefine balistik bir kaya atar. */
  throw(from: THREE.Vector3, tx: number, tz: number, dmg: number, game: Game) {
    const r = this.rocks.find((x) => !x.alive);
    if (!r) return;
    const ty = game.world.heightAt(tx, tz);
    const d = Math.hypot(tx - from.x, tz - from.z);
    const T = Math.max(1, Math.min(2.6, d / 42));
    r.mesh.position.copy(from);
    r.vel.set((tx - from.x) / T, (ty - from.y) / T + 0.5 * G * T, (tz - from.z) / T);
    r.alive = true;
    r.dmg = dmg;
    r.mesh.visible = true;
    r.ring.position.set(tx, ty + 0.25, tz);
    r.ring.visible = true;
  }

  update(dt: number, game: Game) {
    const p = game.player;
    for (const r of this.rocks) {
      if (!r.alive) continue;
      r.vel.y -= G * dt;
      r.mesh.position.addScaledVector(r.vel, dt);
      r.mesh.rotation.x += dt * 4;
      r.mesh.rotation.z += dt * 2.5;
      (r.ring.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(performance.now() * 0.02) * 0.3;
      const m = r.mesh.position;
      const direct = !p.dead && m.distanceTo(p.pos) < (p.mode === 'titan' ? p.titan.def.radius + 3 : 2.6);
      if (!direct && m.y > game.world.heightAt(m.x, m.z) + 0.5) continue;
      r.alive = false;
      r.mesh.visible = false;
      r.ring.visible = false;
      game.particles.burst(m, 45, 20, 1.1, 0xa39a86, 2);
      game.particles.burst(m, 20, 8, 1.8, 0x777777, 2, 4);
      const dist = Math.hypot(m.x - p.pos.x, m.z - p.pos.z);
      game.audio.stomp(0.9);
      game.shakeCam(Math.max(0, 1 - dist / 60));
      if (direct || (dist < Boulders.RADIUS && Math.abs(m.y - p.pos.y) < 6)) p.takeHit(r.dmg, m, 18);
    }
  }
}
