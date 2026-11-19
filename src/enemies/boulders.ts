import * as THREE from 'three';
import type { Game } from '../game';

const G = 30;

interface Rock {
  mesh: THREE.Mesh;
  ring: THREE.Mesh;
  vel: THREE.Vector3;
  alive: boolean;
  dmg: number;
  /** Boyut çarpanı: büyük kayalar daha geniş alanı ezer. */
  size: number;
}

/** Ezilen kayadan saçılan küçük parçalar. */
interface Shard {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  alive: boolean;
  dmg: number;
}

/** Devin elinde tuttuğu (fırlatmak üzere kaldırdığı) kaya. */
interface Held {
  mesh: THREE.Mesh;
  hands: () => THREE.Vector3;
}

/** Taşçı devlerin fırlattığı kayalar. Düşeceği yer kırmızı bir halkayla önceden belli olur. */
export class Boulders {
  private readonly rocks: Rock[] = [];
  private readonly shards: Shard[] = [];
  private readonly held = new Map<object, Held>();
  private readonly geo: THREE.BufferGeometry;
  private readonly mat: THREE.Material;
  private readonly scene: THREE.Scene;
  static readonly RADIUS = 6;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const geo = new THREE.DodecahedronGeometry(1.7, 0);
    const mat = new THREE.MeshLambertMaterial({ color: 0x6f6a60, flatShading: true });
    this.geo = geo;
    this.mat = mat;
    const shardGeo = new THREE.DodecahedronGeometry(1, 0);
    for (let i = 0; i < 90; i++) {
      const mesh = new THREE.Mesh(shardGeo, mat);
      mesh.castShadow = true;
      mesh.visible = false;
      scene.add(mesh);
      this.shards.push({ mesh, vel: new THREE.Vector3(), spin: new THREE.Vector3(), alive: false, dmg: 0 });
    }
    const ringGeo = new THREE.RingGeometry(Boulders.RADIUS - 0.7, Boulders.RADIUS, 32);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.visible = false;
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.7, depthWrite: false, fog: false }));
      ring.visible = false;
      scene.add(mesh, ring);
      this.rocks.push({ mesh, ring, vel: new THREE.Vector3(), alive: false, dmg: 0, size: 1 });
    }
  }

  /** Dev yerden bir kaya kaldırır: kaya fırlatılana dek iki elinin arasında durur. */
  grip(owner: object, size: number, hands: () => THREE.Vector3) {
    this.drop(owner);
    const mesh = new THREE.Mesh(this.geo, this.mat);
    mesh.scale.setScalar(size);
    mesh.castShadow = true;
    mesh.position.copy(hands());
    this.scene.add(mesh);
    this.held.set(owner, { mesh, hands });
  }

  /** Elindeki kayayı bırakır (fırlattı, ezdi ya da saldırısı kesildi). */
  drop(owner: object) {
    const h = this.held.get(owner);
    if (!h) return;
    this.scene.remove(h.mesh);
    this.held.delete(owner);
  }

  /**
   * Avucunda ezdiği kayanın parçalarını (x, z) çevresine saçar: her parça ayrı bir yayla uçar,
   * hedefin `spread` metre çevresine dağılır; oyuncuya değen parça hasar verir.
   */
  spray(from: THREE.Vector3, tx: number, tz: number, n: number, spread: number, dmg: number, game: Game) {
    for (let i = 0; i < n; i++) {
      const sh = this.shards.find((x) => !x.alive);
      if (!sh) return;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * spread;
      const x = tx + Math.sin(a) * r;
      const z = tz + Math.cos(a) * r;
      const y = game.world.heightAt(x, z);
      const d = Math.hypot(x - from.x, z - from.z);
      const T = Math.max(0.6, Math.min(1.8, d / 75)) * (0.85 + Math.random() * 0.3);
      sh.mesh.position.copy(from).add(new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2));
      sh.vel.set((x - from.x) / T, (y - from.y) / T + 0.5 * G * T, (z - from.z) / T);
      sh.spin.set(Math.random() * 12, Math.random() * 12, Math.random() * 12);
      sh.mesh.scale.setScalar(0.35 + Math.random() * 0.6);
      sh.mesh.visible = true;
      sh.alive = true;
      sh.dmg = dmg;
    }
  }

  /** `from` noktasından (tx, tz) hedefine balistik bir kaya atar. */
  throw(from: THREE.Vector3, tx: number, tz: number, dmg: number, game: Game, size = 1) {
    const r = this.rocks.find((x) => !x.alive);
    if (!r) return;
    r.size = size;
    r.mesh.scale.setScalar(size);
    r.ring.scale.setScalar(Math.sqrt(size));
    const ty = game.world.heightAt(tx, tz);
    const d = Math.hypot(tx - from.x, tz - from.z);
    // Büyük kaya daha yüksek bir yayla, daha uzun uçar: düşeceği yer görülüp kaçılabilsin.
    const T = Math.max(1, Math.min(2.6 + (size - 1) * 0.6, d / (42 - (size - 1) * 6)));
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
    for (const h of this.held.values()) {
      h.mesh.position.copy(h.hands());
      h.mesh.rotation.y += dt * 0.6;
    }
    for (const sh of this.shards) {
      if (!sh.alive) continue;
      sh.vel.y -= G * dt;
      sh.mesh.position.addScaledVector(sh.vel, dt);
      sh.mesh.rotation.x += sh.spin.x * dt;
      sh.mesh.rotation.y += sh.spin.y * dt;
      const m = sh.mesh.position;
      if (Math.random() < 0.15) game.particles.emit(m.x, m.y, m.z, 0, 0, 0, 0.5, 0x9a948a, 0, 0.9, 0.6);
      const hit = !p.dead && m.distanceTo(p.pos) < (p.mode === 'titan' ? p.titan.def.radius + 1.5 : 1.8);
      if (!hit && m.y > game.world.heightAt(m.x, m.z) + 0.3) continue;
      sh.alive = false;
      sh.mesh.visible = false;
      game.particles.burst(m, 8, 8, 0.6, 0xa39a86, 0.8);
      if (hit) p.takeHit(sh.dmg, m, 6);
    }
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
      const S = r.size;
      const blast = Boulders.RADIUS * Math.sqrt(S);
      game.particles.burst(m, Math.round(45 * S), 20 * S, 1.1, 0xa39a86, 2 * S);
      game.particles.burst(m, Math.round(20 * S), 8, 1.8, 0x777777, 2 * S, 4, 3 * S, 2);
      if (S > 1.4) {
        // Büyük kaya: toz bulutu, kopan taşlar ve yere düşen sarsıntı halkası.
        game.smoke.burst(m, 10, 10, 2.6, 0x9a9080, 3 * S, 2, 4 * S, 2);
        this.spray(m, m.x, m.z, Math.round(4 * S), blast * 1.4, r.dmg * 0.15, game);
      }
      game.rings.spawn(m.x, m.y, m.z, blast * 1.7, 0xd8cdb4, 0.5);
      const dist = Math.hypot(m.x - p.pos.x, m.z - p.pos.z);
      game.audio.stomp(0.9 * Math.min(1.6, S));
      game.shakeCam(Math.max(0, 1 - dist / (60 * S)));
      if (direct || (dist < blast && Math.abs(m.y - p.pos.y) < 6 * S)) p.takeHit(r.dmg, m, 18 * Math.min(1.6, S));
    }
  }
}
