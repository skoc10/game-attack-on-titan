import * as THREE from 'three';
import type { Game } from '../game';
import { CFG } from '../data/config';
import { lerp, turnToward } from '../core/rng';
import { GEO, Rig } from '../enemies/humanoid';

const H = CFG.horse;

export type HorseMode = 'idle' | 'coming' | 'ridden';

interface Leg {
  upper: THREE.Group;
  lower: THREE.Group;
  offset: number;
}

export class Horse {
  readonly group = new THREE.Group();
  readonly pos: THREE.Vector3;
  readonly vel = new THREE.Vector3();
  yaw = 0;
  speed = 0;
  mode: HorseMode = 'idle';
  private readonly legs: Leg[] = [];
  private readonly neck = new THREE.Group();
  private readonly tail: THREE.Mesh;
  private readonly body = new THREE.Group();
  private phase = 0;

  constructor(game: Game, x: number, z: number) {
    const rig = new Rig(0.014);
    const coat = rig.toon(0x7a5238);
    const belly = rig.toon(0x8d6447);
    const dark = rig.toon(0x231914);
    const saddle = rig.toon(0x5a3b26);
    const cloth = rig.toon(0x7a2230);
    const b = this.body;
    this.group.add(b);

    // Gövde: yatay kapsül, göğüs ve sağrı dolgun.
    const barrel = rig.part(b, GEO.capsule, coat, 0.37, 0.45, 0.4, 0, 1.36, 0);
    barrel.rotation.x = Math.PI / 2;
    rig.part(b, GEO.sphere, coat, 0.37, 0.43, 0.42, 0, 1.4, 0.66);
    rig.part(b, GEO.sphere, coat, 0.38, 0.44, 0.46, 0, 1.42, -0.68);
    rig.part(b, GEO.sphere, belly, 0.33, 0.3, 0.7, 0, 1.2, 0, false);

    // Boyun ve baş
    this.neck.position.set(0, 1.62, 0.82);
    b.add(this.neck);
    const neck = rig.part(this.neck, GEO.capsule, coat, 0.19, 0.2, 0.25, 0, 0.3, 0.2);
    neck.rotation.x = 0.62;
    const mane = rig.part(this.neck, GEO.box, dark, 0.07, 0.78, 0.13, 0, 0.36, 0.04, false);
    mane.rotation.x = 0.62;
    const head = rig.part(this.neck, GEO.capsule, coat, 0.13, 0.15, 0.15, 0, 0.72, 0.62);
    head.rotation.x = 1.95;
    rig.part(this.neck, GEO.sphere, belly, 0.105, 0.1, 0.12, 0, 0.58, 0.86, false); // burun
    for (const s of [-1, 1]) {
      const ear = rig.part(this.neck, GEO.cone, coat, 0.04, 0.13, 0.03, s * 0.08, 0.96, 0.42, false);
      ear.rotation.z = -s * 0.25;
      rig.part(this.neck, GEO.sphere, dark, 0.02, 0.026, 0.012, s * 0.115, 0.78, 0.62, false); // göz
    }
    rig.part(this.neck, GEO.box, dark, 0.06, 0.2, 0.1, 0, 0.9, 0.36, false); // perçem

    // Kuyruk
    this.tail = rig.part(b, GEO.capsule, dark, 0.075, 0.2, 0.075, 0, 1.2, -1.14);
    this.tail.rotation.x = -0.4;

    // Eyer ve örtü
    rig.part(b, GEO.box, cloth, 0.8, 0.05, 0.86, 0, 1.775, -0.05, false);
    rig.part(b, GEO.sphere, saddle, 0.3, 0.07, 0.34, 0, 1.83, -0.05);
    rig.part(b, GEO.sphere, saddle, 0.2, 0.09, 0.07, 0, 1.9, -0.36, false);

    // Bacaklar: üst + alt eklem, toynak
    const mkLeg = (lx: number, lz: number, offset: number) => {
      const upper = new THREE.Group();
      upper.position.set(lx, 1.12, lz);
      b.add(upper);
      rig.part(upper, GEO.capsule, coat, 0.095, 0.145, 0.11, 0, -0.29, 0);
      const lower = new THREE.Group();
      lower.position.set(0, -0.58, 0);
      upper.add(lower);
      rig.part(lower, GEO.capsule, coat, 0.058, 0.125, 0.062, 0, -0.25, 0);
      rig.part(lower, GEO.box, dark, 0.13, 0.09, 0.16, 0, -0.495, 0.012);
      this.legs.push({ upper, lower, offset });
    };
    mkLeg(-0.22, 0.7, 0);
    mkLeg(0.22, 0.7, Math.PI);
    mkLeg(-0.22, -0.72, Math.PI * 0.9);
    mkLeg(0.22, -0.72, Math.PI * 1.9);

    this.pos = this.group.position;
    this.pos.set(x, 0, z);
    game.scene.add(this.group);
  }

  /** Islıkla çağır: çok uzaktaysa görüş dışına ışınlanıp koşarak gelir. */
  call(game: Game) {
    if (this.mode === 'ridden') return;
    const p = game.player.pos;
    const d = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
    if (d > H.teleportDist) {
      const a = game.camYaw + Math.PI + (Math.random() - 0.5);
      this.pos.x = p.x + Math.sin(a) * 70;
      this.pos.z = p.z + Math.cos(a) * 70;
      game.world.resolve(this.pos, 1, { trees: true, buildings: true });
    }
    this.mode = 'coming';
    game.audio.whistle();
  }

  /** Binili sürüş: wish kamera yönüne göre istenen hareket vektörü. */
  drive(wish: THREE.Vector3, sprint: boolean, dt: number, game: Game) {
    const has = wish.lengthSq() > 0.01;
    if (has) this.yaw = turnToward(this.yaw, Math.atan2(wish.x, wish.z), H.turn * dt);
    const target = has ? (sprint ? H.speed : H.trot) : 0;
    this.speed += Math.max(-H.accel * 1.6 * dt, Math.min(H.accel * dt, target - this.speed));
    this.move(dt, game);
  }

  private move(dt: number, game: Game) {
    const px = this.pos.x;
    const pz = this.pos.z;
    this.pos.x += Math.sin(this.yaw) * this.speed * dt;
    this.pos.z += Math.cos(this.yaw) * this.speed * dt;
    this.pos.y = 0;
    if (game.world.resolve(this.pos, 1, { trees: true, buildings: true })) {
      const moved = Math.hypot(this.pos.x - px, this.pos.z - pz);
      this.speed = Math.min(this.speed, (moved / dt) * 0.98 + 2);
    }
    this.pos.y = game.world.heightAt(this.pos.x, this.pos.z);
    this.vel.set(Math.sin(this.yaw) * this.speed, 0, Math.cos(this.yaw) * this.speed);
    this.phase += this.speed * dt * 0.7;
  }

  update(dt: number, game: Game) {
    if (this.mode === 'coming') {
      const p = game.player.pos;
      const dx = p.x - this.pos.x;
      const dz = p.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 4 || game.player.mode !== 'foot') {
        this.mode = 'idle';
      } else {
        this.yaw = turnToward(this.yaw, Math.atan2(dx, dz), 6 * dt);
        this.speed = Math.min(H.speed * 1.15, Math.max(8, d * 1.5));
        this.move(dt, game);
      }
    }
    if (this.mode === 'idle') {
      this.speed = lerp(this.speed, 0, 1 - Math.exp(-dt * 6));
      this.pos.y = game.world.heightAt(this.pos.x, this.pos.z);
      this.vel.set(0, 0, 0);
    }
    this.group.rotation.y = this.yaw;

    // Dörtnal: bacak geriye giderken alt eklem kırılır, gövde hafifçe yaylanır.
    const amp = Math.min(0.95, this.speed / 17);
    for (const l of this.legs) {
      const s = Math.sin(this.phase + l.offset);
      l.upper.rotation.x = s * amp;
      l.lower.rotation.x = Math.max(0, Math.sin(this.phase + l.offset + 1.1)) * amp * 1.3;
    }
    const bob = Math.sin(this.phase * 2) * amp;
    this.body.position.y = Math.abs(bob) * 0.1;
    this.body.rotation.x = bob * 0.035;
    this.neck.rotation.x = 0.1 * amp + bob * 0.06;
    this.tail.rotation.x = -0.4 - amp * 0.7 + Math.sin(this.phase * 1.3) * 0.1;
  }
}
