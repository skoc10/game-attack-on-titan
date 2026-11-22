import * as THREE from 'three';
import type { Game } from '../game';
import { CFG } from '../data/config';

interface Flare {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  /** fly: havada; burn: yere düştü ya da patladı, yanıyor. */
  phase: 'fly' | 'burn';
  t: number;
}

const v = new THREE.Vector3();

/**
 * İşaret fişekleri: sandıklardan çıkar, J ile nişan alınan yere atılır. Düştüğü yerde kızıl yanar;
 * yandığı sürece çevresindeki devler o noktaya yürür. Yanına atarsan devleri yanına çekersin,
 * uzağa atarsan peşindekileri oraya saptırırsın.
 */
export class Flares {
  /** Taşınan fişek sayısı. */
  count: number = CFG.flare.start;
  private readonly list: Flare[] = [];
  private readonly geo = new THREE.SphereGeometry(0.35, 8, 6);
  private readonly mat = new THREE.MeshBasicMaterial({ color: 0xff3a1a });

  constructor(private readonly game: Game) {}

  /** Sandıktan fişek: taşınabilecek kadarını ekler, eklenen sayıyı döner. */
  give(n: number) {
    const got = Math.min(n, CFG.flare.max - this.count);
    this.count += Math.max(0, got);
    return Math.max(0, got);
  }

  /** Nişan alınan yere bir fişek atar. */
  fire() {
    const g = this.game;
    const p = g.player;
    if (p.dead || p.mode === 'titan' || p.grabbedBy) return;
    if (this.count <= 0) {
      g.hud.toast('Fişeğin yok — kızıl ışıklı sandıklardan çıkar');
      return;
    }
    this.count--;
    const F = CFG.flare;
    // Hedef: nişan yeri (çok uzaksa menzil sınırında); yere doğru yay çizerek uçar.
    const tx = g.aimPoint.x;
    const tz = g.aimPoint.z;
    const dx = tx - p.pos.x;
    const dz = tz - p.pos.z;
    const d = Math.min(F.range, Math.max(6, Math.hypot(dx, dz)));
    const l = Math.hypot(dx, dz) || 1;
    const ex = p.pos.x + (dx / l) * d;
    const ez = p.pos.z + (dz / l) * d;
    const ey = g.world.heightAt(ex, ez);
    const T = Math.max(0.6, d / F.speed);
    const sy = p.pos.y + 1.6;
    const mesh = new THREE.Mesh(this.geo, this.mat);
    mesh.position.set(p.pos.x, sy, p.pos.z);
    g.scene.add(mesh);
    const vel = new THREE.Vector3((ex - p.pos.x) / T, (ey - sy) / T + 0.5 * F.gravity * T, (ez - p.pos.z) / T);
    this.list.push({ mesh, vel, phase: 'fly', t: 0 });
    g.audio.spearFire();
    g.hud.toast(`İşaret fişeği atıldı — yandığı yere devler yürür (${this.count} kaldı)`);
  }

  update(dt: number) {
    const g = this.game;
    const F = CFG.flare;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      f.t += dt;
      const m = f.mesh;
      if (f.phase === 'fly') {
        f.vel.y -= F.gravity * dt;
        m.position.addScaledVector(f.vel, dt);
        g.particles.emit(m.position.x, m.position.y, m.position.z, 0, 0.5, 0, 0.6, 0xff6a3a, 0, 0.5, 0.15);
        const gy = g.world.heightAt(m.position.x, m.position.z);
        if (m.position.y <= gy + 0.3 || f.t > 6) {
          m.position.y = gy + 0.3;
          f.phase = 'burn';
          f.t = 0;
          g.particles.burst(m.position, 40, 14, 0.9, 0xff4a2a, 0.6, 6);
          g.audio.explosion(m.position.x, m.position.z);
          this.lure(m.position.x, m.position.z);
        }
        continue;
      }
      // Yanarken: kızıl ışık titrer, göğe kızıl duman yükselir.
      const s = 1 + Math.sin(f.t * 30) * 0.25;
      m.scale.setScalar(s * 1.6);
      if (Math.random() < 0.7) g.particles.emit(m.position.x, m.position.y + 0.5, m.position.z, (Math.random() - 0.5) * 2, 9 + Math.random() * 5, (Math.random() - 0.5) * 2, 1.6, 0xff5a3a, 0, 1.2, 0.5);
      if (Math.random() < 0.15) g.smoke.burst(v.set(m.position.x, m.position.y + 6, m.position.z), 1, 2, 2.5, 0xb84a3a, 1, 4, 3, 2);
      if (f.t > F.burn) {
        g.scene.remove(m);
        this.list.splice(i, 1);
      }
    }
  }

  /** Fişeğin yandığı yere çevredeki devleri çeker. */
  private lure(x: number, z: number) {
    const F = CFG.flare;
    let n = 0;
    for (const gi of this.game.giants) {
      if (!gi.alive || gi.heavy || gi.raid?.siege) continue;
      if (Math.hypot(gi.pos.x - x, gi.pos.z - z) > F.radius) continue;
      gi.lureTo(x, z, F.burn);
      n++;
    }
    if (n > 0) this.game.hud.toast(`${n} dev fişeğe yöneldi`);
  }

  clear() {
    for (const f of this.list) this.game.scene.remove(f.mesh);
    this.list.length = 0;
  }
}
