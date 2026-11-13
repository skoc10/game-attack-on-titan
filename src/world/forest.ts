import * as THREE from 'three';
import { CFG } from '../data/config';
import type { Rng } from '../core/rng';
import { heightAt } from './terrain';

export interface Tree {
  x: number;
  z: number;
  y: number;
  r: number;
  h: number;
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
      for (let i = 0; i < n; i++) {
        const ta = rng() * Math.PI * 2;
        const td = Math.sqrt(rng()) * spread;
        const x = cx + Math.sin(ta) * td;
        const z = cz + Math.cos(ta) * td;
        if (!validSpot(x, z)) continue;
        const h = 28 + rng() * 22;
        trees.push({ x, z, y: heightAt(x, z) - 1, r: 1.1 + rng() * 1.0, h });
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
      trees.push({ x, z: zz, y: heightAt(x, zz) - 1, r: 1.2 + rng() * 0.6, h: 30 + rng() * 14 });
    }
  }
  return trees;
}

export function buildForest(trees: Tree[], rng: Rng) {
  const trunkGeo = new THREE.CylinderGeometry(0.8, 1, 1, 7);
  trunkGeo.translate(0, 0.5, 0);
  const leafGeo = new THREE.ConeGeometry(1, 1, 7);
  leafGeo.translate(0, 0.5, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), trees.length);
  const leaves = new THREE.InstancedMesh(
    leafGeo,
    new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
    trees.length,
  );
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const c = new THREE.Color();
  trees.forEach((t, i) => {
    q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rng() * 6.28);
    m.compose(p.set(t.x, t.y, t.z), q, s.set(t.r, t.h, t.r));
    trunks.setMatrixAt(i, m);
    trunks.setColorAt(i, c.setHSL(0.07, 0.3, 0.14 + rng() * 0.06));
    const lw = t.h * (0.2 + rng() * 0.06);
    m.compose(p.set(t.x, t.y + t.h * 0.52, t.z), q, s.set(lw, t.h * 0.62, lw));
    leaves.setMatrixAt(i, m);
    leaves.setColorAt(i, c.setHSL(0.3 + rng() * 0.05, 0.35, 0.12 + rng() * 0.07));
  });
  for (const im of [trunks, leaves]) {
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    im.frustumCulled = false;
  }
  return { trunks, leaves };
}
