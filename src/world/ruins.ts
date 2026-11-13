import * as THREE from 'three';
import { CFG } from '../data/config';
import type { Rng } from '../core/rng';
import { heightAt } from './terrain';

export interface Building {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  base: number;
  top: number;
  town: boolean;
}

export interface Village {
  x: number;
  z: number;
}

export function generateBuildings(rng: Rng) {
  const list: Building[] = [];
  const villages: Village[] = [];
  const add = (cx: number, cz: number, w: number, d: number, h: number, town: boolean) => {
    const base = heightAt(cx, cz) - 1.5;
    list.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, base, top: base + 1.5 + h, town });
  };

  // Şehir: Taç Suru'nun içinde, yol ve doğuş alanı boş.
  for (let i = 0; i < 46; i++) {
    const a = rng() * Math.PI * 2;
    const rr = 40 + rng() * 215;
    const x = Math.sin(a) * rr;
    const z = Math.cos(a) * rr;
    if (Math.abs(x) < 20 && z > -30) continue;
    add(x, z, 8 + rng() * 7, 8 + rng() * 7, 6 + rng() * 9, true);
  }

  const village = (minR: number, maxR: number, count: number) => {
    for (let v = 0; v < count; v++) {
      const a = rng() * Math.PI * 2;
      const rr = minR + rng() * (maxR - minR);
      const cx = Math.sin(a) * rr;
      const cz = Math.cos(a) * rr;
      if (cz > 0 && Math.abs(cx) < 70) continue;
      villages.push({ x: cx, z: cz });
      const n = 5 + Math.floor(rng() * 6);
      for (let i = 0; i < n; i++) {
        const x = cx + (rng() - 0.5) * 90;
        const z = cz + (rng() - 0.5) * 90;
        add(x, z, 7 + rng() * 6, 7 + rng() * 6, 4 + rng() * 9, false);
      }
    }
  };
  village(420, 1000, 11);
  village(1200, 1900, 16);
  return { buildings: list, villages };
}

export function buildRuins(buildings: Building[], rng: Rng) {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const walls = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial({ color: 0xffffff }), buildings.length);
  const roofs = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial({ color: 0xffffff }), buildings.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const c = new THREE.Color();
  buildings.forEach((b, i) => {
    const w = b.maxX - b.minX;
    const d = b.maxZ - b.minZ;
    const h = b.top - b.base;
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    m.compose(p.set(cx, b.base + (h - 0.6) / 2, cz), q, s.set(w, h - 0.6, d));
    walls.setMatrixAt(i, m);
    walls.setColorAt(i, b.town ? c.setHSL(0.09, 0.18, 0.42 + rng() * 0.1) : c.setHSL(0.08, 0.1, 0.24 + rng() * 0.1));
    m.compose(p.set(cx, b.top - 0.3, cz), q, s.set(w + 1.2, 0.6, d + 1.2));
    roofs.setMatrixAt(i, m);
    roofs.setColorAt(i, b.town ? c.setHSL(0.03, 0.4, 0.22 + rng() * 0.06) : c.setHSL(0.06, 0.15, 0.13 + rng() * 0.05));
  });
  for (const im of [walls, roofs]) {
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    im.frustumCulled = false;
  }
  return { walls, roofs };
}

export const TOWN_R = CFG.world.townR;
