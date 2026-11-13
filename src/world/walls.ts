import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CFG } from '../data/config';
import { mulberry32 } from '../core/rng';
import { stoneTexture } from '../core/textures';

const W = CFG.world;
const HALF_T = W.wallT / 2;

/** Kutunun her yüzünde dokuyu gerçek ölçüsüne göre döşer (bir karo = tile metre). */
function box(w: number, h: number, d: number, tile: number, shade: number) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  // Yüz sırası: +x, -x, +y, -y, +z, -z (her biri 4 köşe).
  const span: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let i = f * 4; i < f * 4 + 4; i++) uv.setXY(i, (uv.getX(i) * span[f][0]) / tile, (uv.getY(i) * span[f][1]) / tile);
  }
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = shade;
    col[i * 3 + 1] = shade * 0.985;
    col[i * 3 + 2] = shade * 0.95;
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
  const TILE = 8;
  // Halka üzerinde, teğete hizalı bir kutu yerleştirir.
  const place = (g: THREE.BufferGeometry, th: number, radius: number, y: number) => {
    m.makeRotationY(th);
    m.setPosition(radius * Math.sin(th), y, radius * Math.cos(th));
    g.applyMatrix4(m);
    parts.push(g);
  };
  for (const wall of W.walls) {
    const R = wall.r;
    const gateAng = Math.asin((W.gateHalfW + 7) / R);
    const span = Math.PI * 2 - gateAng * 2;
    const n = Math.max(24, Math.round((R * span) / 24));
    const step = span / n;
    const chord = 2 * R * Math.sin(step / 2) + 0.6;
    const mid = R * Math.cos(step / 2);
    for (let i = 0; i < n; i++) {
      const th = gateAng + step * (i + 0.5);
      place(box(chord, W.wallH + base, W.wallT, TILE, 0.84 + rng() * 0.22), th, mid, (W.wallH - base) / 2);
      // Yürüme yolunun dışa taşan saçağı
      place(box(chord, 1.2, W.wallT + 1.8, TILE, 0.74), th, mid, W.wallH - 0.6);
      // Mazgal dişleri (iki kenarda, dönüşümlü)
      if (i % 2 === 0) place(box(chord * 0.5, 2.2, 1.4, TILE, 0.8), th, mid + HALF_T - 0.1, W.wallH + 1.1);
      else place(box(chord * 0.5, 1.4, 1.2, TILE, 0.8), th, mid - HALF_T + 0.1, W.wallH + 0.7);
      // Payandalar: surun ölçeğini ve derinliğini hissettirir.
      if (i % 3 === 0) {
        const bh = W.wallH - 5 + base;
        place(box(5, bh, 2.6, TILE, 0.78), th, mid + HALF_T + 1.3, (W.wallH - 5 - base) / 2);
        place(box(5, bh, 2.6, TILE, 0.78), th, mid - HALF_T - 1.3, (W.wallH - 5 - base) / 2);
      }
    }
    // Kapı üstü kemer + iki yanında kule
    const lintel = box(W.gateHalfW * 2 + 1, W.wallH - W.gateH, W.wallT, TILE, 0.78);
    lintel.translate(0, (W.wallH + W.gateH) / 2, R);
    parts.push(lintel);
    const arch = box(W.gateHalfW * 2 + 1, 1.6, W.wallT + 1.4, TILE, 0.62);
    arch.translate(0, W.gateH + 0.8, R);
    parts.push(arch);
    for (const sx of [-1, 1]) {
      const tower = box(7, W.wallH + base + 9, W.wallT + 6, TILE, 0.72);
      tower.translate(sx * (W.gateHalfW + 3.5), (W.wallH + 9 - base) / 2, R);
      parts.push(tower);
      const crown = box(8.4, 1.4, W.wallT + 7.4, TILE, 0.62);
      crown.translate(sx * (W.gateHalfW + 3.5), W.wallH + 9.2, R);
      parts.push(crown);
    }
  }
  const geo = mergeGeometries(parts, false)!;
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: stoneTexture(), vertexColors: true }));
  mesh.name = 'walls';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
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
