import * as THREE from 'three';
import { mulberry32 } from '../core/rng';
import { buildMountains, buildSky, buildTerrain, heightAt } from './terrain';
import { buildWalls } from './walls';
import { wallPush, wallSolid, wallTopAt } from './layout';
import { buildForest, buildProps, generateTrees, type Tree } from './forest';
import { buildRuins, generateBuildings, roofY, type Building, type Village } from './ruins';

const CELL = 32;

/** Gövdenin `y` yüksekliğindeki yarıçapı: dev ağaçlar yukarı doğru incelir. */
function trunkR(t: Tree, y: number) {
  if (t.kind !== 2) return t.r;
  const f = Math.min(1, Math.max(0, (y - t.y) / (t.h * 0.92)));
  return t.r * (1 - 0.52 * f);
}
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
  /** Kamerayı izleyen gökyüzü kubbesi. */
  readonly sky: THREE.Mesh;
  /** Ufuktaki dağ halkaları; kamerayla birlikte kayar. */
  readonly mountains: THREE.Group;
  private readonly treeGrid = new Map<number, Tree[]>();
  private readonly buildingGrid = new Map<number, Building[]>();

  constructor(scene: THREE.Scene, fogColor: THREE.Color) {
    const rng = mulberry32(20261113);
    this.sky = buildSky(fogColor);
    this.mountains = buildMountains(fogColor);
    scene.add(this.sky, this.mountains);
    scene.add(buildTerrain());

    const walls = buildWalls();
    scene.add(walls);

    this.trees = generateTrees(rng);
    const forest = buildForest(this.trees, rng);
    scene.add(...forest, ...buildProps(this.trees, rng));

    const gen = generateBuildings(rng);
    this.buildings = gen.buildings;
    this.villages = gen.villages;
    const ruins = buildRuins(this.buildings, rng);
    scene.add(ruins.walls, ruins.roofs);

    this.grappleTargets.push(walls, ...forest, ruins.walls, ruins.roofs);

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
        if (x <= b.minX - 0.3 || x >= b.maxX + 0.3 || z <= b.minZ - 0.3 || z >= b.maxZ + 0.3) continue;
        // Beşik çatının eğimi üzerinde yürünür.
        const ry = roofY(b, x, z);
        if (ry > g && y >= ry - 0.9) g = ry;
      }
    }
    return g;
  }

  /** Nokta katı bir yapının (sur gövdesi ya da bina) içinde mi? Kamera engeli için. */
  solidAt(x: number, y: number, z: number, margin = 0.3) {
    if (wallSolid(x, y, z, margin)) return true;
    // Dev ağaç gövdeleri de katıdır (kamera içlerine girmesin).
    const tc = this.treeGrid.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (tc) {
      for (const t of tc) {
        if (t.kind === 2 && y < t.y + t.h * 0.9 && Math.hypot(t.x - x, t.z - z) < trunkR(t, y) + margin) return true;
      }
    }
    const cell = this.buildingGrid.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (cell) {
      for (const b of cell) {
        if (x > b.minX - margin && x < b.maxX + margin && z > b.minZ - margin && z < b.maxZ + margin && y < roofY(b, x, z) + margin) return true;
      }
    }
    return false;
  }

  /** (x, z) noktasının `margin` metre yakınında bir ağaç gövdesi var mı. */
  treeNear(x: number, z: number, margin: number) {
    const reach = margin + 8;
    for (let cx = Math.floor((x - reach) / CELL); cx <= Math.floor((x + reach) / CELL); cx++) {
      for (let cz = Math.floor((z - reach) / CELL); cz <= Math.floor((z + reach) / CELL); cz++) {
        const cell = this.treeGrid.get(key(cx, cz));
        if (cell?.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + margin)) return true;
      }
    }
    return false;
  }

  /** Yatay çarpışma çözümü: surlar, ağaç gövdeleri, binalar. pos.x/z değişir. */
  resolve(pos: THREE.Vector3, radius: number, opts: CollideOpts) {
    let hit = wallPush(pos, radius, pos.y);
    // Dev ağaçların gövdesi 7 m'ye varır: komşu hücredeki gövdeler de aranır.
    const cx0 = Math.floor((pos.x - radius - 9) / CELL);
    const cx1 = Math.floor((pos.x + radius + 9) / CELL);
    const cz0 = Math.floor((pos.z - radius - 9) / CELL);
    const cz1 = Math.floor((pos.z + radius + 9) / CELL);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cz = cz0; cz <= cz1; cz++) {
        const k = key(cx, cz);
        if (opts.trees) {
          const cell = this.treeGrid.get(k);
          if (cell) {
            for (const t of cell) {
              if (pos.y > t.y + t.h * (t.kind === 2 ? 0.9 : 0.55)) continue;
              const dx = pos.x - t.x;
              const dz = pos.z - t.z;
              const min = trunkR(t, pos.y) + radius;
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
              if (pos.y >= roofY(b, pos.x, pos.z) - 0.6) continue;
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
