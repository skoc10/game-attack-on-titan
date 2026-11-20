import * as THREE from 'three';
import type { Game } from '../game';
import type { Building } from './ruins';

/** Savrulan bir moloz parçası: yere düşünce orada kalır. */
interface Chunk {
  m: THREE.Mesh;
  v: THREE.Vector3;
  spin: THREE.Vector3;
  rest: boolean;
  size: number;
}

const MAX = 320;
const GRAVITY = 30;
const v = new THREE.Vector3();

/**
 * Ev yıkımı: dev formundaki oyuncunun tekmesi değdiği evleri yıkar. Duvarlar kırık bir harabeye iner,
 * çatı çöker; sıva, kiremit ve kiriş parçaları tekmenin yönünde savrulup yere yığılır, toz kalkar.
 */
export class Demolition {
  private readonly chunks: Chunk[] = [];
  private readonly geo = new THREE.DodecahedronGeometry(1, 0);
  private readonly beam = new THREE.BoxGeometry(0.35, 0.35, 3);
  private readonly mats = [0xd8cfbf, 0xc9bca6, 0xa0553f, 0x8a4636, 0x5a4030].map((c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true }));
  /** Yıkılan ev sayısı. */
  count = 0;

  constructor(private readonly game: Game) {}

  /**
   * Tekme (x, z)'de `r` metrelik alana değdi: oradaki evleri yıkar. `from` tekmeyi atanın yeri.
   * Yıkılan ev sayısını döner.
   */
  kickAt(x: number, z: number, r: number, from: THREE.Vector3) {
    let n = 0;
    for (const b of this.game.world.housesNear(x, z, r)) if (this.wreck(b, from)) n++;
    return n;
  }

  wreck(b: Building, from: THREE.Vector3) {
    const g = this.game;
    const h = b.eave - b.base + b.roofH;
    if (!g.world.wreckHouse(b)) return false;
    this.count++;
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    const w = b.maxX - b.minX;
    const d = b.maxZ - b.minZ;
    const gy = g.world.heightAt(cx, cz);
    let dx = cx - from.x;
    let dz = cz - from.z;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    // Moloz: sıva ve kiremit parçaları ile kırık kirişler; tekmenin yönüne savrulur.
    const n = 14 + Math.round(Math.min(14, (w * d) / 10));
    for (let i = 0; i < n; i++) {
      const beam = i % 6 === 5;
      const mat = beam ? this.mats[4] : this.mats[Math.floor(Math.random() * 4)];
      const m = new THREE.Mesh(beam ? this.beam : this.geo, mat);
      const size = beam ? 1 : 0.45 + Math.random() * 1.1;
      m.scale.setScalar(size);
      if (!beam) m.scale.y *= 0.6;
      m.position.set(cx + (Math.random() - 0.5) * w * 0.8, gy + 1 + Math.random() * Math.max(2, h * 0.7), cz + (Math.random() - 0.5) * d * 0.8);
      m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      m.castShadow = true;
      g.scene.add(m);
      const sp = 6 + Math.random() * 12;
      const vel = new THREE.Vector3(dx * sp + (Math.random() - 0.5) * 10, 4 + Math.random() * 10, dz * sp + (Math.random() - 0.5) * 10);
      const spin = new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
      this.chunks.push({ m, v: vel, spin, rest: false, size });
    }
    // Eski parçalar kaldırılır: sahnede çok fazla moloz birikmesin.
    while (this.chunks.length > MAX) g.scene.remove(this.chunks.shift()!.m);
    // Toz bulutu, savrulan kırıntı, çöküş sesi ve sarsıntı.
    for (let i = 0; i < 3; i++) {
      v.set(cx + (Math.random() - 0.5) * w, gy + 1.5 + i * h * 0.25, cz + (Math.random() - 0.5) * d);
      g.smoke.burst(v, 10, 9, 2.4, 0xb4aa98, Math.max(w, d) * 0.5, 2, 5 + h * 0.3, 1.8);
    }
    v.set(cx, gy + h * 0.5, cz);
    g.particles.burst(v, 40, 16, 1.4, 0xd0c4ae, Math.max(w, d) * 0.4, -12, 1.6, -0.1);
    g.audio.crumble(cx, cz, Math.min(1.4, 0.6 + (w * d) / 180));
    g.shakeCam(0.5);
    g.onHouseWrecked();
    return true;
  }

  update(dt: number) {
    const w = this.game.world;
    for (const c of this.chunks) {
      if (c.rest) continue;
      c.v.y -= GRAVITY * dt;
      c.m.position.addScaledVector(c.v, dt);
      c.m.rotation.x += c.spin.x * dt;
      c.m.rotation.y += c.spin.y * dt;
      c.m.rotation.z += c.spin.z * dt;
      const floor = w.heightAt(c.m.position.x, c.m.position.z) + c.size * 0.25;
      if (c.m.position.y <= floor && c.v.y < 0) {
        c.m.position.y = floor;
        // Bir kez seker, sonra yerinde kalır.
        if (c.v.y < -8) {
          c.v.set(c.v.x * 0.35, -c.v.y * 0.25, c.v.z * 0.35);
          c.spin.multiplyScalar(0.4);
        } else c.rest = true;
      }
    }
  }
}
