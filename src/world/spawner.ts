import * as THREE from 'three';
import type { Game } from '../game';
import { CFG } from '../data/config';
import { Giant } from '../enemies/giant';
import { BOSSES, GIANT_TYPES, type BossId, type GiantKind } from '../enemies/giantTypes';

const S = CFG.spawn;

function pickKind(r: number, game: Game): GiantKind {
  if (game.save.level === 1 && game.save.kills < 3) return 'normal';
  const x = Math.random();
  const table: [GiantKind, number][] =
    r < CFG.world.walls[1].r
      ? [['normal', 0.66], ['runner', 0.1], ['leaper', 0.08], ['crawler', 0.07], ['screamer', 0.05], ['thrower', 0.04]]
      : r < CFG.world.walls[2].r
        ? [['normal', 0.4], ['runner', 0.13], ['leaper', 0.12], ['armored', 0.13], ['crawler', 0.08], ['thrower', 0.08], ['screamer', 0.06]]
        : [['normal', 0.27], ['runner', 0.14], ['leaper', 0.14], ['armored', 0.19], ['crawler', 0.09], ['thrower', 0.1], ['screamer', 0.07]];
  let acc = 0;
  for (const [k, w] of table) {
    acc += w;
    if (x < acc) return k;
  }
  return 'normal';
}

/** Devleri oyuncunun çevresinde üretir, uzaklaşanları kaldırır. */
export class Spawner {
  private timer = 0;
  boss: Giant | null = null;

  /** Kapı Kıran: Demir Sur kapısının önünde bekler. */
  spawnBoss(game: Game) {
    this.boss = this.spawnBossAt('gate', 0, CFG.world.walls[1].r - 70, game);
    this.boss.tag = 'gate';
    return this.boss;
  }

  spawnBossAt(id: BossId, x: number, z: number, game: Game) {
    const g = new Giant(BOSSES[id], x, z, game);
    g.home = new THREE.Vector3(x, 0, z);
    g.yaw = Math.PI;
    g.persistent = true;
    game.giants.push(g);
    return g;
  }

  spawn(kind: GiantKind, x: number, z: number, game: Game) {
    const g = new Giant(GIANT_TYPES[kind], x, z, game);
    game.giants.push(g);
    return g;
  }

  update(dt: number, game: Game) {
    const p = game.player.pos;
    const list = game.giants;
    let alive = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      const g = list[i];
      const far = !g.persistent && Math.hypot(g.pos.x - p.x, g.pos.z - p.z) > S.despawn;
      if (g.gone || far) {
        g.dispose(game.scene);
        list.splice(i, 1);
        if (g === this.boss) this.boss = null;
        continue;
      }
      if (!g.persistent && !g.tag && g.alive) alive++;
    }

    // Devler birbirinin içine girmesin.
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a.alive || a.state === 'leap') continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (!b.alive || b.state === 'leap') continue;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const min = a.radius + b.radius + 1;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 1e-4) {
          const d = Math.sqrt(d2);
          const push = (min - d) / 2;
          const ka = a.persistent ? 0 : 1;
          const kb = b.persistent ? 0 : 1;
          a.pos.x -= (dx / d) * push * ka;
          a.pos.z -= (dz / d) * push * ka;
          b.pos.x += (dx / d) * push * kb;
          b.pos.z += (dz / d) * push * kb;
        }
      }
    }

    this.timer -= dt;
    if (this.timer > 0 || alive >= S.maxAlive) return;
    this.timer = S.interval;
    for (let tries = 0; tries < 10; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = S.minDist + Math.random() * (S.maxDist - S.minDist);
      const x = p.x + Math.sin(a) * d;
      const z = p.z + Math.cos(a) * d;
      const r = Math.hypot(x, z);
      if (r < CFG.world.walls[0].r + 60 || r > 2500) continue;
      if (CFG.world.walls.some((w) => Math.abs(r - w.r) < 22)) continue;
      this.spawn(pickKind(r, game), x, z, game);
      return;
    }
  }
}
