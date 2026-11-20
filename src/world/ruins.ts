import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CFG } from '../data/config';
import type { Rng } from '../core/rng';
import { facadeTexture, roofTexture } from '../core/textures';
import { heightAt } from './terrain';
import { DISTRICTS, districtLots, placeVillages, type Village } from './layout';

export type { Village };

export interface Building {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  base: number;
  /** Duvarın bittiği, çatının başladığı yükseklik. */
  eave: number;
  /** Beşik çatının yüksekliği; 0 ise çatısız harabe. */
  roofH: number;
  /** Mahya (çatı sırtı) X ekseni boyunca mı? */
  ridgeX: boolean;
  /** En yüksek nokta (mahya). */
  top: number;
  town: boolean;
  /** Havadaki yapılarda (su kemeri köprüsü) alt yüzün yüksekliği: altından geçilir. */
  under?: number;
}

/** Çatının duvardan dışarı taşma payı. */
const OVER = 0.7;

/** (x, z) noktasında çatı yüzeyinin yüksekliği. Çarpışma ve görsel aynı formülü kullanır. */
export function roofY(b: Building, x: number, z: number) {
  if (b.roofH <= 0) return b.eave;
  const half = (b.ridgeX ? b.maxZ - b.minZ : b.maxX - b.minX) / 2 + OVER;
  const d = b.ridgeX ? Math.abs(z - (b.minZ + b.maxZ) / 2) : Math.abs(x - (b.minX + b.maxX) / 2);
  return b.eave + b.roofH * Math.max(0, 1 - d / half);
}

export function generateBuildings(rng: Rng) {
  const list: Building[] = [];
  const villages: Village[] = [];
  const add = (cx: number, cz: number, w: number, d: number, h: number, town: boolean, ruin: boolean) => {
    const base = heightAt(cx, cz) - 1.5;
    const eave = base + 1.5 + h;
    const ridgeX = w >= d;
    const roofH = ruin ? 0 : (Math.min(w, d) / 2 + OVER) * (0.5 + rng() * 0.25);
    list.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, base, eave, roofH, ridgeX, top: eave + roofH, town });
  };

  // Şehir: Taç Suru'nun içinde; doğuş alanı ve dört kapıya giden caddeler boş.
  for (let i = 0; i < 52; i++) {
    const a = rng() * Math.PI * 2;
    const rr = 40 + rng() * 215;
    const x = Math.sin(a) * rr;
    const z = Math.cos(a) * rr;
    if (Math.abs(x) < 20 && z > -30) continue;
    if (Math.min(Math.abs(x), Math.abs(z)) < 16) continue;
    add(x, z, 8 + rng() * 7, 8 + rng() * 7, 6.4 + Math.floor(rng() * 3) * 3.2, true, false);
  }

  // Kapı kasabaları: surun dışına taşan yarım dairede sık, iki üç katlı evler.
  for (const d of DISTRICTS) {
    for (const lot of districtLots(d, rng)) add(lot.x, lot.z, lot.w, lot.d, 6.4 + Math.floor(rng() * 2.4) * 3.2, true, false);
  }

  // Köyler: sur ötesindekiler çoğunlukla terk edilmiş, yıkık.
  for (const v of placeVillages(rng)) {
    villages.push(v);
    const n = 6 + Math.floor(rng() * 6);
    const ruinChance = v.zone === 3 ? 0.6 : 0.3;
    for (let i = 0; i < n; i++) {
      const x = v.x + (rng() - 0.5) * 90;
      const z = v.z + (rng() - 0.5) * 90;
      const ruin = rng() < ruinChance;
      add(x, z, 7 + rng() * 6, 7 + rng() * 6, ruin ? 2.5 + rng() * 4 : 3.2 + Math.floor(rng() * 2) * 3.2, false, ruin);
    }
  }
  return { buildings: list, villages };
}

function tint(geo: THREE.BufferGeometry, r: number, g: number, b: number) {
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = r;
    col[i * 3 + 1] = g;
    col[i * 3 + 2] = b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

/** Köşe listesinden (üçgenler) düz gölgeli, dokulu geometri kurar. */
function tris(pos: number[], uv: number[]) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

/** Yarı ahşap evler ve kiremit beşik çatılar; iki birleştirilmiş ağ (duvarlar, çatılar). */
export function buildRuins(buildings: Building[], rng: Rng) {
  // Evler bölgelere ayrılır: görüş ve gölge alanı dışındaki bölgeler hiç çizilmez.
  const CHUNK = 420;
  const wallBuckets = new Map<string, THREE.BufferGeometry[]>();
  const roofBuckets = new Map<string, THREE.BufferGeometry[]>();
  const bucket = (map: Map<string, THREE.BufferGeometry[]>, x: number, z: number) => {
    const k = `${Math.floor(x / CHUNK)}:${Math.floor(z / CHUNK)}`;
    let list = map.get(k);
    if (!list) map.set(k, (list = []));
    return list;
  };
  const FW = 4; // cephe karosu genişliği (m)
  const FH = 3.2; // kat yüksekliği (m)
  const RT = 3; // çatı karosu (m)

  for (const b of buildings) {
    const w = b.maxX - b.minX;
    const d = b.maxZ - b.minZ;
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    const h = b.eave - b.base + 0.12;
    const ruin = b.roofH <= 0;
    const wallParts = bucket(wallBuckets, cx, cz);
    const roofParts = bucket(roofBuckets, cx, cz);

    // Duvarlar
    const box = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    const uv = box.attributes.uv as THREE.BufferAttribute;
    // toNonIndexed sonrası yüz başına 6 köşe: +x, -x, +y, -y, +z, -z
    const span = [d, d, w, w, w, w];
    for (let f = 0; f < 6; f++) {
      const flat = f === 2 || f === 3;
      for (let i = f * 6; i < f * 6 + 6; i++) {
        if (flat) uv.setXY(i, 0.02, 0.02);
        else uv.setXY(i, (uv.getX(i) * span[f]) / FW, (uv.getY(i) * h) / FH);
      }
    }
    box.translate(cx, b.base + h / 2, cz);
    const shade = ruin ? 0.45 + rng() * 0.15 : b.town ? 0.9 + rng() * 0.14 : 0.7 + rng() * 0.16;
    const warm = b.town ? 1 - rng() * 0.08 : 0.92;
    wallParts.push(tint(box, shade, shade * (0.97 + (1 - warm) * 0.3), shade * warm));
    if (ruin) continue;

    // Beşik çatı: yerel eksende mahya X boyunca kurulur, gerekirse 90° döndürülür.
    const along = b.ridgeX ? w : d;
    const across = b.ridgeX ? d : w;
    const hx = along / 2 + OVER;
    const hz = across / 2 + OVER;
    const e = b.eave;
    const r = b.eave + b.roofH;
    const slope = Math.hypot(hz, b.roofH);
    const ua = (hx * 2) / RT;
    const va = slope / RT;
    const pos = [
      // +z eğimi
      -hx, e, hz, hx, e, hz, hx, r, 0, -hx, e, hz, hx, r, 0, -hx, r, 0,
      // -z eğimi
      hx, e, -hz, -hx, e, -hz, -hx, r, 0, hx, e, -hz, -hx, r, 0, hx, r, 0,
    ];
    const uvs = [0, 0, ua, 0, ua, va, 0, 0, ua, va, 0, va, 0, 0, ua, 0, ua, va, 0, 0, ua, va, 0, va];
    const roof = tris(pos, uvs);
    // Kalkan duvarları (üçgen alınlık): sıva dokusuyla.
    const ax = along / 2;
    const az = across / 2;
    const yw = e + b.roofH * (OVER / hz);
    const gable = tris(
      [ax, yw, az, ax, yw, -az, ax, r, 0, -ax, yw, -az, -ax, yw, az, -ax, r, 0],
      [0, 0, across / FW, 0, across / FW / 2, (r - yw) / FH, 0, 0, across / FW, 0, across / FW / 2, (r - yw) / FH],
    );
    if (!b.ridgeX) {
      roof.rotateY(Math.PI / 2);
      gable.rotateY(Math.PI / 2);
    }
    roof.translate(cx, 0, cz);
    gable.translate(cx, 0, cz);
    const rs = b.town ? 0.85 + rng() * 0.25 : 0.55 + rng() * 0.2;
    roofParts.push(tint(roof, rs, rs * (b.town ? 1 : 0.95), rs * (b.town ? 1 : 0.9)));
    wallParts.push(tint(gable, shade, shade * 0.97, shade * warm));
  }

  const group = (buckets: Map<string, THREE.BufferGeometry[]>, mat: THREE.Material) => {
    const g = new THREE.Group();
    for (const list of buckets.values()) {
      if (list.length === 0) continue;
      const m = new THREE.Mesh(mergeGeometries(list, false)!, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
    return g;
  };
  const walls = group(wallBuckets, new THREE.MeshLambertMaterial({ map: facadeTexture(), vertexColors: true }));
  const roofs = group(roofBuckets, new THREE.MeshLambertMaterial({ map: roofTexture(), vertexColors: true, side: THREE.DoubleSide }));
  return { walls, roofs };
}

export const TOWN_R = CFG.world.townR;
