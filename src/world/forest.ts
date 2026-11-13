import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CFG } from '../data/config';
import type { Rng } from '../core/rng';
import { heightAt } from './terrain';

export interface Tree {
  x: number;
  z: number;
  y: number;
  r: number;
  h: number;
  /** 0: çam, 1: geniş yapraklı. */
  kind: 0 | 1;
}

function validSpot(x: number, z: number) {
  const r = Math.hypot(x, z);
  if (r < 350 || r > 2450) return false;
  for (const w of CFG.world.walls) if (Math.abs(r - w.r) < 34) return false;
  if (z > 0 && Math.abs(x) < 26) return false; // ana yol açık kalsın
  return true;
}

export function generateTrees(rng: Rng): Tree[] {
  const trees: Tree[] = [];
  const cluster = (minR: number, maxR: number, count: number) => {
    for (let c = 0; c < count; c++) {
      const a = rng() * Math.PI * 2;
      const rr = minR + rng() * (maxR - minR);
      const cx = Math.sin(a) * rr;
      const cz = Math.cos(a) * rr;
      const spread = 50 + rng() * 110;
      const n = 22 + Math.floor(rng() * 50);
      // Her koru ağırlıklı olarak tek türdendir.
      const leafy = rng() < 0.35;
      for (let i = 0; i < n; i++) {
        const ta = rng() * Math.PI * 2;
        const td = Math.sqrt(rng()) * spread;
        const x = cx + Math.sin(ta) * td;
        const z = cz + Math.cos(ta) * td;
        if (!validSpot(x, z)) continue;
        const kind = (rng() < 0.85 ? leafy : !leafy) ? 1 : 0;
        const h = kind === 1 ? 24 + rng() * 14 : 28 + rng() * 22;
        trees.push({ x, z, y: heightAt(x, z) - 1, r: 1.1 + rng() * 1.0, h, kind });
      }
    }
  };
  cluster(380, 1040, 26);
  cluster(1160, 1950, 44);
  cluster(2060, 2400, 14);
  // Yol kenarı ağaçları: kapılar arası rotada kanca noktası sağlar.
  for (let z = 370; z < 1960; z += 46) {
    for (const sx of [-1, 1]) {
      const x = sx * (30 + rng() * 14);
      const zz = z + rng() * 20;
      if (!validSpot(x, zz)) continue;
      trees.push({ x, z: zz, y: heightAt(x, zz) - 1, r: 1.2 + rng() * 0.6, h: 30 + rng() * 14, kind: rng() < 0.3 ? 1 : 0 });
    }
  }
  return trees;
}

/** Ağaç ve süs bölgelerinin kenar uzunluğu (m). */
const CHUNK = 260;

/** Geometrinin tüm köşelerini, yüksekliğe göre koyudan açığa giden bir renge boyar. */
function paint(geo: THREE.BufferGeometry, low: THREE.Color, high: THREE.Color, y0: number, y1: number) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, (pos.getY(i) - y0) / (y1 - y0)));
    c.copy(low).lerp(high, t);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  return g;
}

/** Birim ağaç: gövde yarıçapı 1, boy 1. Örnek başına (r, h, r) ile ölçeklenir. */
function trunkGeo(top: number) {
  const bark0 = new THREE.Color(0x3a2a1e);
  const bark1 = new THREE.Color(0x6b5240);
  // Gövde tacın içinde biter; tepeden dışarı taşmaz.
  const trunk = new THREE.CylinderGeometry(0.3, 1, top, 8, 4);
  trunk.translate(0, top / 2, 0);
  const flare = new THREE.CylinderGeometry(1, 1.5, 0.05, 8);
  flare.translate(0, 0.025, 0);
  return mergeGeometries([paint(trunk, bark0, bark1, 0, 1), paint(flare, bark0, bark0, 0, 1)])!;
}

function pineGeo() {
  const dark = new THREE.Color(0x2a4d32);
  const light = new THREE.Color(0x5a8a4a);
  const parts = [trunkGeo(0.9)];
  // Üç katlı konik taç: alt kat geniş ve koyu, tepe dar ve açık.
  const tiers: [number, number, number][] = [
    [0.4, 5.4, 0.3],
    [0.56, 4.2, 0.27],
    [0.71, 3.0, 0.3],
  ];
  tiers.forEach(([y, rad, h], i) => {
    const cone = new THREE.ConeGeometry(rad, h, 9, 1);
    cone.rotateY(i * 0.4);
    cone.translate(0, y + h / 2, 0);
    parts.push(paint(cone, dark.clone().lerp(light, i * 0.18), light.clone().lerp(new THREE.Color(0x86a85a), i * 0.25), y, y + h));
  });
  return mergeGeometries(parts)!;
}

function leafyGeo() {
  const dark = new THREE.Color(0x3f6a30);
  const light = new THREE.Color(0x8fb455);
  const parts = [trunkGeo(0.8)];
  // Üst üste binen yuvarlak yaprak kümeleri.
  const blobs: [number, number, number, number, number][] = [
    [0, 0.74, 0, 4.6, 0.21],
    [2.6, 0.64, 1.0, 3.2, 0.15],
    [-2.4, 0.66, -1.2, 3.4, 0.16],
    [0.6, 0.62, -2.6, 3.0, 0.14],
    [-0.8, 0.86, 1.4, 3.0, 0.14],
  ];
  for (const [x, y, z, rad, ry] of blobs) {
    const b = new THREE.IcosahedronGeometry(1, 1);
    b.scale(rad, ry, rad);
    b.translate(x, y, z);
    parts.push(paint(b, dark, light, y - ry, y + ry));
  }
  return mergeGeometries(parts)!;
}

export function buildForest(trees: Tree[], rng: Rng) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const kinds = [pineGeo(), leafyGeo()];
  const meshes: THREE.InstancedMesh[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const c = new THREE.Color();
  // Ağaçlar bölgelere ayrılır: görüş ve gölge alanı dışındaki bölgeler hiç çizilmez.
  const chunks = new Map<string, Tree[]>();
  for (const t of trees) {
    const k = `${t.kind}:${Math.floor(t.x / CHUNK)}:${Math.floor(t.z / CHUNK)}`;
    let list = chunks.get(k);
    if (!list) chunks.set(k, (list = []));
    list.push(t);
  }
  for (const list of chunks.values()) {
    const im = new THREE.InstancedMesh(kinds[list[0].kind], mat, list.length);
    list.forEach((t, i) => {
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rng() * 6.28);
      m.compose(p.set(t.x, t.y, t.z), q, s.set(t.r, t.h, t.r));
      im.setMatrixAt(i, m);
      im.setColorAt(i, c.setHSL(0.1 + rng() * 0.08, 0.12, 0.78 + rng() * 0.22));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    im.castShadow = true;
    im.receiveShadow = true;
    meshes.push(im);
  }
  return meshes;
}

/** Çalılar ve kayalar: çarpışması olmayan ufak süsler, ağaçların ve yolun çevresinde. */
export function buildProps(trees: Tree[], rng: Rng) {
  const spots: { x: number; z: number; rock: boolean }[] = [];
  for (const t of trees) {
    const n = rng() < 0.55 ? 1 : 0;
    for (let i = 0; i < n; i++) {
      const a = rng() * 6.28;
      const d = t.r + 2 + rng() * 9;
      spots.push({ x: t.x + Math.sin(a) * d, z: t.z + Math.cos(a) * d, rock: rng() < 0.3 });
    }
  }
  for (let z = 330; z < 2300; z += 9) {
    if (rng() < 0.5) continue;
    const side = rng() < 0.5 ? -1 : 1;
    spots.push({ x: side * (8 + rng() * 14), z: z + rng() * 8, rock: rng() < 0.45 });
  }
  const valid = spots.filter((sp) => {
    const r = Math.hypot(sp.x, sp.z);
    return r > 345 && !CFG.world.walls.some((w) => Math.abs(r - w.r) < 12) && !(sp.z > 0 && Math.abs(sp.x) < 7.5);
  });
  const bushGeo = paint(new THREE.IcosahedronGeometry(1, 1), new THREE.Color(0x2f4f26), new THREE.Color(0x7a9a48), -1, 1);
  const rockGeo = paint(new THREE.DodecahedronGeometry(1, 0), new THREE.Color(0x55524c), new THREE.Color(0x9c978c), -1, 1);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const bushes = valid.filter((v) => !v.rock);
  const rocks = valid.filter((v) => v.rock);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const c = new THREE.Color();
  const out: THREE.InstancedMesh[] = [];
  const make = (geo: THREE.BufferGeometry, all: typeof valid, rock: boolean) => {
    const chunks = new Map<string, typeof valid>();
    for (const sp of all) {
      const k = `${Math.floor(sp.x / CHUNK)}:${Math.floor(sp.z / CHUNK)}`;
      let l = chunks.get(k);
      if (!l) chunks.set(k, (l = []));
      l.push(sp);
    }
    for (const list of chunks.values()) out.push(makeChunk(geo, list, rock));
  };
  const makeChunk = (geo: THREE.BufferGeometry, list: typeof valid, rock: boolean) => {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((sp, i) => {
      const k = rock ? 0.5 + rng() * 1.4 : 0.8 + rng() * 1.3;
      q.setFromEuler(e.set(rock ? rng() * 3 : 0, rng() * 6.28, rock ? rng() * 3 : 0));
      m.compose(p.set(sp.x, heightAt(sp.x, sp.z) + k * (rock ? 0.25 : 0.45), sp.z), q, s.set(k * (1 + rng() * 0.5), k * (rock ? 0.7 : 0.75), k * (1 + rng() * 0.5)));
      im.setMatrixAt(i, m);
      im.setColorAt(i, c.setHSL(0.1, 0.08, 0.78 + rng() * 0.22));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    im.castShadow = !rock;
    im.receiveShadow = true;
    return im;
  };
  make(bushGeo, bushes, false);
  make(rockGeo, rocks, true);
  return out;
}
