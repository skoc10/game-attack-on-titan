import * as THREE from 'three';
import type { Game } from '../game';
import { CFG } from '../data/config';
import { Giant } from '../enemies/giant';
import { BOSSES, GIANT_TYPES, shifterType, type BossId, type CommonKind } from '../enemies/giantTypes';
import { TITANS, type TitanId } from '../data/titans';
import { GIANT_FOREST, inGiantForest, ringOf, spawnable } from './layout';
import { HUNTRESS, huntressType } from '../data/huntress';

const S = CFG.spawn;

/** Bölgelere göre dev türlerinin doğma olasılıkları (her tabloda toplam 1). */
export const SPAWN_TABLES: Record<'inner' | 'middle' | 'outer' | 'forest', [CommonKind, number][]> = {
  inner: [['normal', 0.6], ['runner', 0.09], ['leaper', 0.07], ['crawler', 0.06], ['screamer', 0.05], ['thrower', 0.04], ['pack', 0.06], ['longarm', 0.03]],
  middle: [['normal', 0.32], ['runner', 0.11], ['leaper', 0.1], ['armored', 0.11], ['crawler', 0.07], ['thrower', 0.07], ['screamer', 0.05], ['pack', 0.06], ['brute', 0.05], ['longarm', 0.04], ['climber', 0.02]],
  outer: [['normal', 0.2], ['runner', 0.11], ['leaper', 0.11], ['armored', 0.15], ['crawler', 0.07], ['thrower', 0.08], ['screamer', 0.05], ['pack', 0.07], ['brute', 0.07], ['longarm', 0.06], ['climber', 0.03]],
  // Dev ağaçlar ormanı: gövdelere tırmananlar çoğunlukta.
  forest: [['climber', 0.34], ['pack', 0.14], ['normal', 0.14], ['runner', 0.1], ['leaper', 0.1], ['longarm', 0.1], ['brute', 0.08]],
};

function pickKind(x: number, z: number, game: Game): CommonKind {
  if (game.save.level === 1 && game.save.kills < 3) return 'normal';
  const roll = Math.random();
  const zone = ringOf(x, z);
  const table = SPAWN_TABLES[inGiantForest(x, z, 80) ? 'forest' : zone <= 1 ? 'inner' : zone === 2 ? 'middle' : 'outer'];
  let acc = 0;
  for (const [k, w] of table) {
    acc += w;
    if (roll < acc) return k;
  }
  return 'normal';
}

/** Hangi surlar arasında hangi dönüşümcüler dolaşır: içte çevik formlar, dışta en ağırları. */
const SHIFTER_ZONES: Record<number, TitanId[]> = {
  1: ['ofke', 'firtina', 'buz'],
  2: ['kaya', 'isin', 'buz', 'ofke'],
  3: ['zirve', 'kaya', 'isin', 'firtina'],
};

/** Devleri oyuncunun çevresinde üretir, uzaklaşanları kaldırır. */
export class Spawner {
  private timer = 0;
  /** Sıradaki dönüşümcüye kalan süre. */
  private shifterT: number = CFG.shifter.first;
  /** Canavar Dev: yaşıyorsa kendisi; değilse yeniden doğmasına kalan süre. */
  shepherd: Giant | null = null;
  private shepherdT: number = CFG.shepherd.first;
  /** Canavar Dev'in sürüsü: o yaşadıkça uzaklaşınca kaybolmaz. */
  private herd: Giant[] = [];
  /** Avcı Dev: yaşıyorsa kendisi; değilse yeniden doğmasına kalan süre. */
  huntress: Giant | null = null;
  private huntressT: number = CFG.huntress.first;
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

  /** Dev doğurur; sürü türleri yanlarında birkaç eşiyle birlikte gelir. */
  spawn(kind: CommonKind, x: number, z: number, game: Game) {
    const type = GIANT_TYPES[kind];
    const g = new Giant(type, x, z, game);
    game.giants.push(g);
    for (let i = 1; i < (type.pack ?? 1); i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 6 + Math.random() * 10;
      game.giants.push(new Giant(type, x + Math.sin(a) * d, z + Math.cos(a) * d, game));
    }
    return g;
  }

  /** Bir dönüşümcü: yıldırım düşer, form buharın içinden yükselir ve avını aramaya başlar. */
  spawnShifter(id: TitanId, x: number, z: number, game: Game) {
    const form = TITANS[id];
    const g = new Giant(shifterType(form), x, z, game, form);
    g.yaw = Math.atan2(game.player.pos.x - x, game.player.pos.z - z);
    game.giants.push(g);
    game.strikeAt(x, g.pos.y, z, form.height, form.color);
    game.hud.banner(form.name.toLocaleUpperCase('tr'), 'Bir dönüşümcü belirdi — kendi güçleriyle saldıracak');
    return g;
  }

  /** Avcı Dev ormanın derinliklerinde doğar: yıldırım düşer, buharın içinden yükselir ve avına koşar. */
  spawnHuntress(x: number, z: number, game: Game) {
    const g = new Giant(huntressType(), x, z, game, HUNTRESS);
    g.home = new THREE.Vector3(GIANT_FOREST.x, 0, GIANT_FOREST.z);
    g.persistent = true;
    g.tag = 'huntress';
    g.yaw = Math.atan2(game.player.pos.x - x, game.player.pos.z - z);
    game.giants.push(g);
    game.strikeAt(x, g.pos.y, z, HUNTRESS.height, HUNTRESS.color);
    game.hud.banner('AVCI DEV', 'Ormanın derinliğinden biri seni fark etti — atına bin ve kaç, ya da ensesini kes');
    this.huntress = g;
    return g;
  }

  /** Canavar Dev, oyuncu Kalkan Suru'nun dışındayken (orman dışında) 350–500 m uzakta doğar ve orada sürüsüyle bekler. */
  private updateShepherd(dt: number, game: Game) {
    const s = this.shepherd;
    if (s && s.alive && !s.gone) return;
    if (s) {
      this.shepherd = null;
      this.shepherdT = CFG.shepherd.respawn;
      // Canavar Dev düştü: sürüsü sıradan devler gibi dolaşır.
      for (const h of this.herd) h.persistent = false;
      this.herd = [];
    }
    if (this.shepherdT > 0) this.shepherdT -= dt;
    const p = game.player;
    if (this.shepherdT > 0 || p.dead || ringOf(p.pos.x, p.pos.z) < 3 || inGiantForest(p.pos.x, p.pos.z, 200)) return;
    for (let tries = 0; tries < 20; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = 300 + Math.random() * 120;
      const x = p.pos.x + Math.sin(a) * d;
      const z = p.pos.z + Math.cos(a) * d;
      if (ringOf(x, z) < 3 || !spawnable(x, z, 80, 60) || inGiantForest(x, z, 200)) continue;
      const g = this.spawnBossAt('coban', x, z, game);
      g.tag = 'coban';
      g.yaw = Math.atan2(p.pos.x - x, p.pos.z - z);
      this.shepherd = g;
      // Çevresinde birkaç dev: sürüsü.
      for (let i = 0; i < 5; i++) {
        const b = Math.random() * Math.PI * 2;
        const h = this.spawn(i === 4 ? 'runner' : 'normal', x + Math.sin(b) * (30 + Math.random() * 40), z + Math.cos(b) * (30 + Math.random() * 40), game);
        h.persistent = true;
        h.home = new THREE.Vector3(x, 0, z);
        this.herd.push(h);
      }
      game.hud.banner('CANAVAR DEV', 'Kürklü, boynuzlu bir dev sürüsüyle ufukta — dev kayalar atar, devleri buyruğuna alır');
      return;
    }
    this.shepherdT = 5;
  }

  /** Oyuncu dev ağaçlar ormanına girince, Avcı Dev yoksa (ve yeniden doğma süresi dolduysa) doğar. */
  private updateHuntress(dt: number, game: Game) {
    const h = this.huntress;
    if (h && h.alive && !h.gone) return;
    if (h) {
      this.huntress = null;
      this.huntressT = CFG.huntress.respawn;
    }
    if (this.huntressT > 0) this.huntressT -= dt;
    const p = game.player;
    if (this.huntressT > 0 || p.dead || !inGiantForest(p.pos.x, p.pos.z, 60)) return;
    // Oyuncudan 200–280 m uzakta, ormanın içinde ve bir ağaç gövdesine denk gelmeyen bir yer.
    for (let tries = 0; tries < 20; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = 200 + Math.random() * 80;
      const x = p.pos.x + Math.sin(a) * d;
      const z = p.pos.z + Math.cos(a) * d;
      if (!inGiantForest(x, z, -60)) continue;
      if (game.world.solidAt(x, game.world.heightAt(x, z) + 2, z, 8) || game.world.treeNear(x, z, 10)) continue;
      this.spawnHuntress(x, z, game);
      return;
    }
    this.huntressT = 2;
  }

  /** Arada bir, oyuncudan uzakta, bulunduğu sur bölgesine uygun bir dönüşümcü doğar (aynı anda yalnızca biri). */
  private updateShifters(dt: number, game: Game) {
    const C = CFG.shifter;
    const p = game.player;
    if (game.giants.some((g) => g.form && g.alive && !g.tag)) return;
    this.shifterT -= dt;
    if (this.shifterT > 0 || p.inTown || p.dead) return;
    for (let tries = 0; tries < 14; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = C.dist[0] + Math.random() * (C.dist[1] - C.dist[0]);
      const x = p.pos.x + Math.sin(a) * d;
      const z = p.pos.z + Math.cos(a) * d;
      const zone = ringOf(x, z);
      const list = SHIFTER_ZONES[zone];
      if (!list || !spawnable(x, z, 80, 30)) continue;
      if (game.world.solidAt(x, game.world.heightAt(x, z) + 2, z, 6)) continue;
      this.spawnShifter(list[Math.floor(Math.random() * list.length)], x, z, game);
      this.shifterT = C.every[0] + Math.random() * (C.every[1] - C.every[0]);
      return;
    }
    this.shifterT = 5; // uygun yer yoksa biraz sonra yeniden dener
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

    // Baskın sürerken yalnızca baskının devleri gelir.
    if (game.raid.active) return;
    this.updateHuntress(dt, game);
    this.updateShepherd(dt, game);
    this.updateShifters(dt, game);
    this.timer -= dt;
    if (this.timer > 0 || alive >= S.maxAlive) return;
    this.timer = S.interval;
    for (let tries = 0; tries < 10; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = S.minDist + Math.random() * (S.maxDist - S.minDist);
      const x = p.x + Math.sin(a) * d;
      const z = p.z + Math.cos(a) * d;
      if (!spawnable(x, z, 60, 22)) continue;
      this.spawn(pickKind(x, z, game), x, z, game);
      return;
    }
  }
}
