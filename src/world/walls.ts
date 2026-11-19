import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CFG } from '../data/config';
import { mulberry32 } from '../core/rng';
import { stoneTexture } from '../core/textures';
import { ARCS, HALF_T, breachAtAngle } from './layout';

const W = CFG.world;

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

/**
 * Üç halka sur ve her birinin dört kapı kasabasını çevreleyen yarım daire surlar.
 * Her yay kapılarda kesilir; kapıların üstünde kemer, iki yanında kule durur. Tek birleştirilmiş geometri.
 */
export function buildWalls() {
  const rng = mulberry32(77);
  // Parçalar bulunduğu bölgeye göre gruplanır: görüş ve gölge alanı dışındaki sur parçaları hiç çizilmez.
  const CHUNK = 420;
  const buckets = new Map<string, THREE.BufferGeometry[]>();
  const m = new THREE.Matrix4();
  const base = 14;
  const TILE = 8;
  for (const a of ARCS) {
    // Yayın üzerinde, teğete hizalı bir kutu yerleştirir (kutunun yerel x'i teğet, z'si dışa doğru).
    const place = (g: THREE.BufferGeometry, th: number, radius: number, y: number) => {
      m.makeRotationY(th);
      m.setPosition(a.cx + radius * Math.sin(th), y, a.cz + radius * Math.cos(th));
      g.applyMatrix4(m);
      const k = `${Math.floor(m.elements[12] / CHUNK)}:${Math.floor(m.elements[14] / CHUNK)}`;
      let list = buckets.get(k);
      if (!list) buckets.set(k, (list = []));
      list.push(g);
    };
    const R = a.r;
    const gateAng = Math.asin((W.gateHalfW + 7) / R);
    // Kapı boşlukları arasında kalan sur parçaları (başlangıç, uzunluk).
    const spans: [number, number][] = [];
    if (a.half >= Math.PI) {
      const gs = [...a.gates].sort((p, q) => p - q);
      gs.forEach((g, i) => {
        const next = i + 1 < gs.length ? gs[i + 1] : gs[0] + Math.PI * 2;
        spans.push([g + gateAng, next - g - gateAng * 2]);
      });
    } else {
      const g = a.gates[0];
      spans.push([a.mid - a.half, g - gateAng - (a.mid - a.half)], [g + gateAng, a.mid + a.half - g - gateAng]);
    }
    const ring = a.half >= Math.PI ? W.walls.findIndex((w) => w.r === a.r) : -1;
    for (const [start, span] of spans) {
      const n = Math.max(4, Math.round((R * span) / 24));
      const step = span / n;
      const chord = 2 * R * Math.sin(step / 2) + 0.6;
      const mid = R * Math.cos(step / 2);
      for (let i = 0; i < n; i++) {
        const th = start + step * (i + 0.5);
        // Gedik: yıkılan parçalar çizilmez.
        if (ring >= 0 && breachAtAngle(ring, th)) continue;
        // Komşu parçalar kenarda üst üste biner: üst yüzleri aynı düzlemde titreşmesin diye biri azıcık yüksektir.
        const lift = (i % 2) * 0.03;
        place(box(chord, W.wallH + base + lift, W.wallT, TILE, 0.88 + rng() * 0.12), th, mid, (W.wallH - base + lift) / 2);
        // Dışa taşan saçak: yürüme yolunun biraz altında biter, yolla çakışmaz.
        place(box(chord, 1.1 + lift, W.wallT + 1.8, TILE, 0.74), th, mid, W.wallH - 0.75 + lift / 2);
        // Dış korkuluk: kesintisiz alçak duvar ve üstünde düzenli mazgal dişleri.
        const outer = mid + HALF_T - 0.55;
        place(box(chord, 1.3 + lift, 1.1, TILE, 0.8), th, outer, W.wallH + 0.65 + lift / 2);
        place(box(chord * 0.46, 1.5, 1.24, TILE, 0.82), th, outer, W.wallH + 2.05);
        // İç korkuluk: daha alçak, dişsiz.
        place(box(chord, 0.9 + lift, 0.8, TILE, 0.78), th, mid - HALF_T + 0.4, W.wallH + 0.45 + lift / 2);
        // Payandalar: surun ölçeğini ve derinliğini hissettirir.
        if (i % 3 === 0) {
          const bh = W.wallH - 5 + base;
          place(box(5, bh, 2.6, TILE, 0.78), th, mid + HALF_T + 1.3, (W.wallH - 5 - base) / 2);
          place(box(5, bh, 2.6, TILE, 0.78), th, mid - HALF_T - 1.3, (W.wallH - 5 - base) / 2);
        }
      }
    }
    // Kapı üstü kemer + iki yanında kule
    for (const g of a.gates) {
      place(box(W.gateHalfW * 2 + 1, W.wallH - W.gateH, W.wallT, TILE, 0.78), g, R, (W.wallH + W.gateH) / 2);
      place(box(W.gateHalfW * 2 + 1, 1.6, W.wallT + 1.4, TILE, 0.62), g, R, W.gateH + 0.8);
      for (const sx of [-1, 1]) {
        const tower = box(7, W.wallH + base + 9, W.wallT + 6, TILE, 0.72);
        tower.translate(sx * (W.gateHalfW + 3.5), 0, 0);
        place(tower, g, R, (W.wallH + 9 - base) / 2);
        const crown = box(8.4, 1.4, W.wallT + 7.4, TILE, 0.62);
        crown.translate(sx * (W.gateHalfW + 3.5), 0, 0);
        place(crown, g, R, W.wallH + 9.2);
      }
    }
    // Kasaba surunun ana sura bağlandığı iki köşede kalın burç
    if (a.half < Math.PI) {
      for (const s of [-1, 1]) {
        place(box(14, W.wallH + base + 6, 14, TILE, 0.7), a.mid + s * a.half, R, (W.wallH + 6 - base) / 2);
        place(box(15.4, 1.4, 15.4, TILE, 0.6), a.mid + s * a.half, R, W.wallH + 6.7);
      }
    }
  }
  const mat = new THREE.MeshLambertMaterial({ map: stoneTexture(), vertexColors: true });
  const group = new THREE.Group();
  group.name = 'walls';
  for (const list of buckets.values()) {
    const mesh = new THREE.Mesh(mergeGeometries(list, false)!, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}
