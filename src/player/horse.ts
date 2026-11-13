import * as THREE from 'three';
import type { Game } from '../game';
import { CFG } from '../data/config';
import { lerp, turnToward } from '../core/rng';

const H = CFG.horse;
const BOX = new THREE.BoxGeometry(1, 1, 1);

export type HorseMode = 'idle' | 'coming' | 'ridden';

export class Horse {
  readonly group = new THREE.Group();
  readonly pos: THREE.Vector3;
  readonly vel = new THREE.Vector3();
  yaw = 0;
  speed = 0;
  mode: HorseMode = 'idle';
  private readonly legs: THREE.Group[] = [];
  private phase = 0;

  constructor(game: Game, x: number, z: number) {
    const coat = new THREE.MeshLambertMaterial({ color: 0x4a3324 });
    const dark = new THREE.MeshLambertMaterial({ color: 0x1e1612 });
    const saddle = new THREE.MeshLambertMaterial({ color: 0x5a1f24 });
    const add = (parent: THREE.Object3D, mat: THREE.Material, sx: number, sy: number, sz: number, x0: number, y0: number, z0: number) => {
      const m = new THREE.Mesh(BOX, mat);
      m.scale.set(sx, sy, sz);
      m.position.set(x0, y0, z0);
      parent.add(m);
      return m;
    };
    add(this.group, coat, 0.78, 0.75, 2.0, 0, 1.35, 0);
    add(this.group, saddle, 0.82, 0.12, 0.7, 0, 1.76, -0.05);
    const neck = add(this.group, coat, 0.32, 0.9, 0.4, 0, 1.95, 0.95);
    neck.rotation.x = 0.5;
    add(this.group, coat, 0.3, 0.34, 0.7, 0, 2.35, 1.4);
    add(this.group, dark, 0.1, 0.6, 0.12, 0, 2.05, 0.75);
    const tail = add(this.group, dark, 0.14, 0.8, 0.14, 0, 1.2, -1.0);
    tail.rotation.x = -0.35;
    for (const [lx, lz] of [[-0.28, 0.78], [0.28, 0.78], [-0.28, -0.78], [0.28, -0.78]]) {
      const g = new THREE.Group();
      g.position.set(lx, 1.05, lz);
      add(g, coat, 0.16, 1.05, 0.18, 0, -0.52, 0);
      this.group.add(g);
      this.legs.push(g);
    }
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
    this.phase += this.speed * dt * 0.75;
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
    const amp = Math.min(0.9, this.speed / 18);
    for (let i = 0; i < 4; i++) {
      this.legs[i].rotation.x = Math.sin(this.phase + (i === 0 || i === 3 ? 0 : Math.PI)) * amp;
    }
    this.group.position.y += Math.abs(Math.sin(this.phase)) * amp * 0.18;
  }
}
