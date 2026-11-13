import * as THREE from 'three';
import { mulberry32 } from '../core/rng';
import { CFG } from '../data/config';
import { buildSky, buildTerrain, heightAt } from './terrain';
import { buildWalls, wallPush, wallTopAt } from './walls';
import { buildForest, generateTrees, type Tree } from './forest';
import { buildRuins, generateBuildings, type Building, type Village } from './ruins';

const CELL = 32;
const key = (cx: number, cz: number) => (cx + 512) * 1024 + (cz + 512);

export interface CollideOpts {
  trees: boolean;
  buildings: boolean;
}

/** Statik dünya: görseller + çarpışma sorguları + kanca hedefleri. */
export class World {
  readonly trees: Tree[];
  readonly buildings: Building[];
  readonly villages: Village[];
  readonly grappleTargets: THREE.Object3D[] = [];
  private readonly treeGrid = new Map<number, Tree[]>();
  private readonly buildingGrid = new Map<number, Building[]>();

  constructor(scene: THREE.Scene, fogColor: THREE.Color) {
    const rng = mulberry32(20261113);
    scene.add(buildSky(fogColor));
    scene.add(buildTerrain());

    const walls = buildWalls();
    scene.add(walls);

    this.trees = generateTrees(rng);
    const forest = buildForest(this.trees, rng);
    scene.add(forest.trunks, forest.leaves);

    const gen = generateBuildings(rng);
    this.buildings = gen.buildings;
    this.villages = gen.villages;
    const ruins = buildRuins(this.buildings, rng);
    scene.add(ruins.walls, ruins.roofs);

    this.grappleTargets.push(walls, forest.trunks, forest.leaves, ruins.walls, ruins.roofs);

    for (const t of this.trees) {
      const k = key(Math.floor(t.x / CELL), Math.floor(t.z / CELL));
      let cell = this.treeGrid.get(k);
      if (!cell) this.treeGrid.set(k, (cell = []));
      cell.push(t);
    }
    for (const b of this.buildings) {
      for (let cx = Math.floor((b.minX - 1) / CELL); cx <= Math.floor((b.maxX + 1) / CELL); cx++) {
        for (let cz = Math.floor((b.minZ - 1) / CELL); cz <= Math.floor((b.maxZ + 1) / CELL); cz++) {
          const k = key(cx, cz);
          let cell = this.buildingGrid.get(k);
          if (!cell) this.buildingGrid.set(k, (cell = []));
          cell.push(b);
        }
      }
    }
  }

  heightAt(x: number, z: number) {
    return heightAt(x, z);
  }

  /** y hizasındaki bir cismi taşıyabilecek en yüksek yüzey (arazi, sur üstü, çatı). */
  groundAt(x: number, z: number, y: number) {
    let g = heightAt(x, z);
    const wt = wallTopAt(x, z);
    if (wt > g && y >= wt - 1.2) g = wt;
    const cell = this.buildingGrid.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (cell) {
      for (const b of cell) {
        if (b.top > g && y >= b.top - 0.9 && x > b.minX - 0.3 && x < b.maxX + 0.3 && z > b.minZ - 0.3 && z < b.maxZ + 0.3) {
          g = b.top;
        }
      }
    }
    return g;
  }

  /** Nokta katı bir yapının (sur gövdesi ya da bina) içinde mi? Kamera engeli için. */
  solidAt(x: number, y: number, z: number, margin = 0.3) {
    const W = CFG.world;
    if (y < W.wallH + margin) {
      const r = Math.hypot(x, z);
      for (const w of W.walls) {
        if (Math.abs(r - w.r) >= W.wallT / 2 + margin) continue;
        const inGate = z > 0 && Math.abs(x) < W.gateHalfW - margin && y < W.gateH - margin;
        if (!inGate) return true;
      }
    }
    const cell = this.buildingGrid.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (cell) {
      for (const b of cell) {
        if (y < b.top + margin && x > b.minX - margin && x < b.maxX + margin && z > b.minZ - margin && z < b.maxZ + margin) return true;
      }
    }
    return false;
  }

  /** Yatay çarpışma çözümü: surlar, ağaç gövdeleri, binalar. pos.x/z değişir. */
  resolve(pos: THREE.Vector3, radius: number, opts: CollideOpts) {
    let hit = wallPush(pos, radius, pos.y);
    const cx0 = Math.floor((pos.x - radius - 3) / CELL);
    const cx1 = Math.floor((pos.x + radius + 3) / CELL);
    const cz0 = Math.floor((pos.z - radius - 3) / CELL);
    const cz1 = Math.floor((pos.z + radius + 3) / CELL);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cz = cz0; cz <= cz1; cz++) {
        const k = key(cx, cz);
        if (opts.trees) {
          const cell = this.treeGrid.get(k);
          if (cell) {
            for (const t of cell) {
              if (pos.y > t.y + t.h * 0.55) continue;
              const dx = pos.x - t.x;
              const dz = pos.z - t.z;
              const min = t.r + radius;
              const d2 = dx * dx + dz * dz;
              if (d2 < min * min) {
                const d = Math.sqrt(d2) || 0.001;
                pos.x = t.x + (dx / d) * min;
                pos.z = t.z + (dz / d) * min;
                hit = true;
              }
            }
          }
        }
        if (opts.buildings) {
          const cell = this.buildingGrid.get(k);
          if (cell) {
            for (const b of cell) {
              if (pos.y >= b.top - 0.6) continue;
              const l = pos.x - (b.minX - radius);
              const r = b.maxX + radius - pos.x;
              const n = pos.z - (b.minZ - radius);
              const f = b.maxZ + radius - pos.z;
              if (l <= 0 || r <= 0 || n <= 0 || f <= 0) continue;
              const m = Math.min(l, r, n, f);
              if (m === l) pos.x = b.minX - radius;
              else if (m === r) pos.x = b.maxX + radius;
              else if (m === n) pos.z = b.minZ - radius;
              else pos.z = b.maxZ + radius;
              hit = true;
            }
          }
        }
      }
    }
    return hit;
  }
}
