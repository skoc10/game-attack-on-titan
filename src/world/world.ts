import * as THREE from 'three';
import { mulberry32 } from '../core/rng';
import { buildMountains, buildSky, buildTerrain, heightAt } from './terrain';
import { buildWalls } from './walls';
import { wallPush, wallSolid, wallTopAt } from './layout';
import { EDGE_FOREST, buildForest, buildProps, edgeForest, generateTrees, giantPerches, type Bough, type Canopy, type Tree } from './forest';
import { buildRuins, generateBuildings, roofY, type Building, type Village } from './ruins';
import { buildLandmarks, type Landmark } from './landmarks';

const CELL = 32;

/** Gövdenin `y` yüksekliğindeki yarıçapı: dev ağaçlar yukarı doğru incelir. */
export function trunkR(t: Tree, y: number) {
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
  /** Surların tek birleşik ağı; gedik açılınca ya da onarılınca yeniden kurulur. */
  private walls: THREE.Group;
  private readonly scene: THREE.Scene;
  /** Kamerayı izleyen gökyüzü kubbesi. */
  readonly sky: THREE.Mesh;
  /** Ufuktaki dağ halkaları; kamerayla birlikte kayar. */
  readonly mountains: THREE.Group;
  private readonly treeGrid = new Map<number, Tree[]>();
  /** Dev ağaçların üstünde durulabilen dalları ve yaprak kümeleri (merkezlerinin hücresine göre). */
  private readonly canopyGrid = new Map<number, Canopy[]>();
  private readonly boughGrid = new Map<number, Bough[]>();
  private readonly buildingGrid = new Map<number, Building[]>();
  /** Anıtsal yapılar (kuleler, değirmenler, karakollar, kale...) ve dönen değirmen kanatları. */
  readonly landmarks: Landmark[];
  private readonly rotors: THREE.Mesh[];
  /** Kenar ormanının parçaları (uzaktakiler gizlenir). */
  private readonly edgeMeshes: THREE.InstancedMesh[];

  constructor(scene: THREE.Scene, fogColor: THREE.Color) {
    this.scene = scene;
    const rng = mulberry32(20261113);
    this.sky = buildSky(fogColor);
    this.mountains = buildMountains(fogColor);
    scene.add(this.sky, this.mountains);
    scene.add(buildTerrain());

    const walls = buildWalls();
    this.walls = walls;
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

    // Haritayı saran orman kuşağı: köylerin içine girmez; yalnızca yakındaki parçaları çizilir.
    const outerVillages = this.villages.filter((v) => Math.hypot(v.x, v.z) > EDGE_FOREST.inner - 150);
    const edge = edgeForest((x, z) => outerVillages.some((v) => Math.hypot(v.x - x, v.z - z) < 95));
    this.edgeMeshes = buildForest(edge, mulberry32(4243));
    scene.add(...this.edgeMeshes);
    this.grappleTargets.push(...this.edgeMeshes);
    for (const t of edge) this.trees.push(t);

    const put = <T>(grid: Map<number, T[]>, x: number, z: number, item: T) => {
      const k = key(Math.floor(x / CELL), Math.floor(z / CELL));
      let cell = grid.get(k);
      if (!cell) grid.set(k, (cell = []));
      cell.push(item);
    };
    for (const t of this.trees) {
      if (t.kind !== 2) continue;
      const { canopies, boughs } = giantPerches(t);
      for (const c of canopies) put(this.canopyGrid, c.x, c.z, c);
      for (const b of boughs) put(this.boughGrid, (b.ax + b.bx) / 2, (b.az + b.bz) / 2, b);
    }
    for (const t of this.trees) {
      const k = key(Math.floor(t.x / CELL), Math.floor(t.z / CELL));
      let cell = this.treeGrid.get(k);
      if (!cell) this.treeGrid.set(k, (cell = []));
      cell.push(t);
    }
    for (const b of this.buildings) this.gridBuilding(b);

    const lm = buildLandmarks(
      {
        blocked: (minX, maxX, minZ, maxZ, margin) => this.areaBlocked(minX, maxX, minZ, maxZ, margin),
        addSolid: (b) => {
          this.buildings.push(b);
          this.gridBuilding(b);
        },
      },
      this.villages,
    );
    this.landmarks = lm.marks;
    this.rotors = lm.rotors;
    scene.add(lm.group, ...lm.rotors);
    this.grappleTargets.push(lm.group);
  }

  private gridBuilding(b: Building) {
    for (let cx = Math.floor((b.minX - 1) / CELL); cx <= Math.floor((b.maxX + 1) / CELL); cx++) {
      for (let cz = Math.floor((b.minZ - 1) / CELL); cz <= Math.floor((b.maxZ + 1) / CELL); cz++) {
        const k = key(cx, cz);
        let cell = this.buildingGrid.get(k);
        if (!cell) this.buildingGrid.set(k, (cell = []));
        cell.push(b);
      }
    }
  }

  /** Dikdörtgen alanda (`margin` payıyla) bir ağaç gövdesi, ağaç tacı ya da bina var mı. */
  private areaBlocked(minX: number, maxX: number, minZ: number, maxZ: number, margin: number) {
    const reach = margin + 10;
    for (let cx = Math.floor((minX - reach) / CELL); cx <= Math.floor((maxX + reach) / CELL); cx++) {
      for (let cz = Math.floor((minZ - reach) / CELL); cz <= Math.floor((maxZ + reach) / CELL); cz++) {
        const k = key(cx, cz);
        const tc = this.treeGrid.get(k);
        if (tc) {
          for (const t of tc) {
            // Tacın yarıçapı boyuyla büyür; dev ağaçların dalları çok daha geniştir.
            const m = margin + t.r + (t.kind === 2 ? 40 : t.h * 0.12);
            if (t.x > minX - m && t.x < maxX + m && t.z > minZ - m && t.z < maxZ + m) return true;
          }
        }
        const bc = this.buildingGrid.get(k);
        if (bc) {
          for (const b of bc) {
            if (b.maxX > minX - margin && b.minX < maxX + margin && b.maxZ > minZ - margin && b.minZ < maxZ + margin) return true;
          }
        }
      }
    }
    return false;
  }

  /** Yel değirmenlerinin kanatları döner (yalnızca yakındakiler). */
  update(dt: number, x: number, z: number) {
    // Kenar ormanı yalnızca oyuncu yakınındayken çizilir (sis zaten 2,2 km'de kapanır).
    for (const m of this.edgeMeshes) {
      const c = m.boundingSphere!.center;
      m.visible = Math.hypot(c.x - x, c.z - z) < 2600 + m.boundingSphere!.radius;
    }
    for (const r of this.rotors) {
      if (Math.abs(r.position.x - x) > 900 || Math.abs(r.position.z - z) > 900) continue;
      r.rotation.z += dt * (r.userData.spin as number);
    }
  }

  /** Surları yeniden kurar (gedikler açıldı ya da kapandı); kanca hedefi de yenilenir. */
  rebuildWalls() {
    const old = this.walls;
    this.scene.remove(old);
    old.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    const walls = buildWalls();
    this.scene.add(walls);
    const i = this.grappleTargets.indexOf(old);
    if (i >= 0) this.grappleTargets[i] = walls;
    else this.grappleTargets.push(walls);
    this.walls = walls;
  }

  heightAt(x: number, z: number) {
    return heightAt(x, z);
  }

  /** y hizasındaki bir cismi taşıyabilecek en yüksek yüzey (arazi, sur üstü, çatı, dev ağaç dalı ve yaprak kümesi). */
  groundAt(x: number, z: number, y: number) {
    let g = heightAt(x, z);
    const wt = wallTopAt(x, z);
    if (wt > g && y >= wt - 1.2) g = wt;
    if (y > g + 20) g = Math.max(g, this.perchAt(x, z, y));
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
        if (x > b.minX - margin && x < b.maxX + margin && z > b.minZ - margin && z < b.maxZ + margin && y < roofY(b, x, z) + margin && y > (b.under ?? -Infinity) - margin) return true;
      }
    }
    return false;
  }

  /**
   * Dev ağaçların üstü: yaprak kümelerinin tepesi (yumuşak bir kubbe) ve dalların üst yüzü.
   * y'nin biraz altında kalan en yüksek yüzey; yoksa -Infinity.
   */
  perchAt(x: number, z: number, y: number) {
    let best = -Infinity;
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    for (let i = cx - 1; i <= cx + 1; i++) {
      for (let j = cz - 1; j <= cz + 1; j++) {
        const k = key(i, j);
        const cs = this.canopyGrid.get(k);
        if (cs) {
          for (const c of cs) {
            const q = ((x - c.x) ** 2 + (z - c.z) ** 2) / (c.rx * c.rx);
            if (q >= 1) continue;
            const top = c.y + c.ry * Math.sqrt(1 - q);
            if (top > best && y >= top - 1.2) best = top;
          }
        }
        const bs = this.boughGrid.get(k);
        if (bs) {
          for (const b of bs) {
            const dx = b.bx - b.ax;
            const dz = b.bz - b.az;
            const l2 = dx * dx + dz * dz;
            const t = l2 > 1e-6 ? Math.max(0, Math.min(1, ((x - b.ax) * dx + (z - b.az) * dz) / l2)) : 0;
            const r = b.ra + (b.rb - b.ra) * t;
            const d = Math.hypot(x - (b.ax + dx * t), z - (b.az + dz * t));
            if (d > r + 0.3) continue;
            const top = b.ay + (b.by - b.ay) * t + Math.sqrt(Math.max(0, r * r - d * d));
            if (top > best && y >= top - 1) best = top;
          }
        }
      }
    }
    return best;
  }

  /** (x, z)'ye en yakın dev ağaç (`maxD` metre içinde), yoksa null. */
  giantTreeNear(x: number, z: number, maxD: number) {
    let best: Tree | null = null;
    let bd = maxD;
    const reach = Math.ceil(maxD / CELL);
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    for (let i = cx - reach; i <= cx + reach; i++) {
      for (let j = cz - reach; j <= cz + reach; j++) {
        const cell = this.treeGrid.get(key(i, j));
        if (!cell) continue;
        for (const t of cell) {
          if (t.kind !== 2) continue;
          const d = Math.hypot(t.x - x, t.z - z);
          if (d < bd) {
            bd = d;
            best = t;
          }
        }
      }
    }
    return best;
  }

  /** (x, z) çevresindeki orman yoğunluğu (0: açık ova, 1: sık orman); rüzgâr ve yaprak sesi için. */
  forestDensity(x: number, z: number) {
    const R = 70;
    let n = 0;
    for (let cx = Math.floor((x - R) / CELL); cx <= Math.floor((x + R) / CELL); cx++) {
      for (let cz = Math.floor((z - R) / CELL); cz <= Math.floor((z + R) / CELL); cz++) {
        const cell = this.treeGrid.get(key(cx, cz));
        if (!cell) continue;
        for (const t of cell) if (Math.abs(t.x - x) < R && Math.abs(t.z - z) < R) n += t.kind === 2 ? 4 : 1;
      }
    }
    return Math.min(1, n / 36);
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
              // Köprü gibi havadaki yapının altından geçilir.
              if (b.under !== undefined && pos.y < b.under - 2) continue;
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
