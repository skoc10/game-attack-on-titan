import * as THREE from 'three';
import type { Game } from '../game';
import type { World } from './world';
import { CFG } from '../data/config';

export interface Station {
  x: number;
  y: number;
  z: number;
}

/** Gaz ikmal noktaları: gaz yalnızca burada (ve gaz kutularında) dolar. */
export class Stations {
  readonly list: Station[] = [];
  /** Oyuncu şu an bir ikmal noktasında gaz dolduruyor mu? */
  filling = false;
  private hissT = 0;

  constructor(scene: THREE.Scene, world: World) {
    const steel = new THREE.MeshLambertMaterial({ color: 0x9fb4c4 });
    const dark = new THREE.MeshLambertMaterial({ color: 0x2c2f33 });
    const wood = new THREE.MeshLambertMaterial({ color: 0x5b4330 });
    const flag = new THREE.MeshLambertMaterial({ color: 0x4f9fd0, side: THREE.DoubleSide });
    const tankGeo = new THREE.CylinderGeometry(0.42, 0.42, 2.2, 10);
    const capGeo = new THREE.SphereGeometry(0.42, 10, 6);
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const poleGeo = new THREE.CylinderGeometry(0.07, 0.07, 9, 6);
    const beamGeo = new THREE.CylinderGeometry(0.35, 0.35, 46, 6, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x7fc8f0,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    const add = (x0: number, z0: number) => {
      // Bina ya da sur içine denk gelirse yakındaki boş bir noktaya kaydır.
      let x = x0;
      let z = z0;
      for (let i = 0; i < 12 && world.solidAt(x, world.heightAt(x, z) + 1, z, 2.2); i++) {
        const a = i * 2.4;
        x = x0 + Math.sin(a) * (6 + i * 2.5);
        z = z0 + Math.cos(a) * (6 + i * 2.5);
      }
      const y = world.heightAt(x, z);
      const g = new THREE.Group();
      g.position.set(x, y, z);
      const base = new THREE.Mesh(boxGeo, wood);
      base.scale.set(3.4, 0.3, 2.2);
      base.position.y = 0.15;
      g.add(base);
      for (const sx of [-1, 0, 1]) {
        const t = new THREE.Mesh(tankGeo, steel);
        t.position.set(sx * 0.95, 1.4, 0);
        const cap = new THREE.Mesh(capGeo, steel);
        cap.position.set(sx * 0.95, 2.5, 0);
        const valve = new THREE.Mesh(boxGeo, dark);
        valve.scale.set(0.18, 0.3, 0.18);
        valve.position.set(sx * 0.95, 3.0, 0);
        t.castShadow = true;
        g.add(t, cap, valve);
      }
      const rail = new THREE.Mesh(boxGeo, dark);
      rail.scale.set(3.2, 0.14, 0.14);
      rail.position.set(0, 1.9, 0.48);
      g.add(rail);
      const pole = new THREE.Mesh(poleGeo, dark);
      pole.position.set(-1.9, 4.5, 0);
      const pennant = new THREE.Mesh(boxGeo, flag);
      pennant.scale.set(1.6, 0.9, 0.04);
      pennant.position.set(-1.05, 8.4, 0);
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.y = 23;
      g.add(pole, pennant, beam);
      scene.add(g);
      this.list.push({ x, y, z });
    };

    const [inner, mid, outer] = CFG.world.walls.map((w) => w.r);
    add(-9, CFG.player.spawn.z + 8); // şehir, doğuş noktasının yanı
    add(-24, inner + 46);
    add(-24, mid - 150);
    add(-24, mid + 50);
    add(-24, outer - 50);
    add(-24, outer + 50);
    for (const v of world.villages) add(v.x, v.z);
  }

  /** En yakın ikmal noktası ve yatay uzaklığı. */
  nearest(x: number, z: number) {
    let best: Station | null = null;
    let bd = Infinity;
    for (const s of this.list) {
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return { station: best, dist: bd };
  }

  update(dt: number, game: Game) {
    const p = game.player;
    this.filling = false;
    if (p.mode === 'titan' || p.dead || p.gas >= p.maxGas) return;
    const { station, dist } = this.nearest(p.pos.x, p.pos.z);
    if (!station || dist > CFG.gas.stationReach || Math.abs(p.pos.y - station.y) > 5) return;
    this.filling = true;
    p.gas = Math.min(p.maxGas, p.gas + CFG.gas.stationRate * dt);
    this.hissT -= dt;
    if (this.hissT <= 0) {
      this.hissT = 0.35;
      game.audio.gas();
      game.particles.emit(station.x + (Math.random() - 0.5) * 2, station.y + 3, station.z, 0, 3, 0, 0.8, 0xcfe4ee, 3);
    }
    if (p.gas >= p.maxGas) game.hud.toast('Gaz tüpleri doldu');
  }
}
