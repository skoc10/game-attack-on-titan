import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CFG } from '../data/config';
import { mulberry32 } from '../core/rng';

const W = CFG.world;
const HALF_T = W.wallT / 2;

function colored(geo: THREE.BufferGeometry, shade: number) {
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = 0.42 * shade;
    col[i * 3 + 1] = 0.4 * shade;
    col[i * 3 + 2] = 0.37 * shade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

/** Üç halka sur; kapılar +Z yönünde. Tek birleştirilmiş geometri. */
export function buildWalls() {
  const rng = mulberry32(77);
  const parts: THREE.BufferGeometry[] = [];
  const m = new THREE.Matrix4();
  const base = 14;
  for (const wall of W.walls) {
    const R = wall.r;
    const gateAng = Math.asin(W.gateHalfW / R);
    const span = Math.PI * 2 - gateAng * 2;
    const n = Math.max(24, Math.round((R * span) / 24));
    const step = span / n;
    const chord = 2 * R * Math.sin(step / 2) + 0.6;
    for (let i = 0; i < n; i++) {
      const th = gateAng + step * (i + 0.5);
      const g = new THREE.BoxGeometry(chord, W.wallH + base, W.wallT);
      m.makeRotationY(th);
      m.setPosition(R * Math.sin(th) * Math.cos(step / 2), (W.wallH - base) / 2, R * Math.cos(th) * Math.cos(step / 2));
      g.applyMatrix4(m);
      parts.push(colored(g, 0.88 + rng() * 0.24));
      // Mazgal dişleri
      if (i % 2 === 0) {
        const t = new THREE.BoxGeometry(chord * 0.5, 2.2, 1.6);
        m.makeRotationY(th);
        m.setPosition((R + HALF_T - 0.8) * Math.sin(th), W.wallH + 1.1, (R + HALF_T - 0.8) * Math.cos(th));
        t.applyMatrix4(m);
        parts.push(colored(t, 0.8));
      }
    }
    // Kapı üstü kemer + iki yanında kule
    const lintel = new THREE.BoxGeometry(W.gateHalfW * 2 + 1, W.wallH - W.gateH, W.wallT);
    lintel.translate(0, (W.wallH + W.gateH) / 2, R);
    parts.push(colored(lintel, 0.8));
    for (const sx of [-1, 1]) {
      const tower = new THREE.BoxGeometry(7, W.wallH + base + 8, W.wallT + 5);
      tower.translate(sx * (W.gateHalfW + 3.5), (W.wallH + 8 - base) / 2, R);
      parts.push(colored(tower, 0.72));
    }
  }
  const geo = mergeGeometries(parts, false)!;
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  mesh.name = 'walls';
  return mesh;
}

/** Sur gövdesinden dışarı iter (kapı geçidi hariç). Değişiklik olduysa true. */
export function wallPush(pos: { x: number; z: number }, radius: number, feetY: number) {
  if (feetY >= W.wallH - 0.6) return false;
  const r = Math.hypot(pos.x, pos.z);
  for (const wall of W.walls) {
    const d = r - wall.r;
    if (Math.abs(d) >= HALF_T + radius) continue;
    if (pos.z > 0 && Math.abs(pos.x) < W.gateHalfW && feetY < W.gateH - 2.5) {
      const lim = Math.max(0, W.gateHalfW - radius);
      if (Math.abs(pos.x) > lim) {
        pos.x = Math.sign(pos.x) * lim;
        return true;
      }
      return false;
    }
    const target = d >= 0 ? wall.r + HALF_T + radius : wall.r - HALF_T - radius;
    const k = r > 1e-6 ? target / r : 1;
    pos.x *= k;
    pos.z *= k;
    return true;
  }
  return false;
}

/** Nokta bir surun üstündeyse üst yüzey yüksekliği, değilse -Infinity. */
export function wallTopAt(x: number, z: number) {
  const r = Math.hypot(x, z);
  for (const wall of W.walls) if (Math.abs(r - wall.r) <= HALF_T + 0.15) return W.wallH;
  return -Infinity;
}

export function zoneName(r: number) {
  if (r < W.walls[0].r) return 'Taç Suru İçi — Güvenli Bölge';
  if (r < W.walls[1].r) return 'Demir Ova';
  if (r < W.walls[2].r) return 'Kalkan Ormanları';
  return 'Sur Ötesi';
}
