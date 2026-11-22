import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CFG } from '../data/config';
import { mulberry32, type Rng } from '../core/rng';
import { roofTexture, stoneTexture } from '../core/textures';
import { heightAt } from './terrain';
import type { Building } from './ruins';
import { DIRS, EDGE, HALF_T, ROAD_HALF, districtGap, inGiantForest, inSafe, onRoad, ringOf, wallDist, type Village } from './layout';

const W = CFG.world;

export type LandmarkKind = 'tower' | 'windmill' | 'chapel' | 'fort' | 'castle' | 'aqueduct' | 'lift' | 'yard';

/** Haritada gösterilen yapı: türü, yeri ve (varsa) adı; su kemerinde iki uç. */
export interface Landmark {
  kind: LandmarkKind;
  x: number;
  z: number;
  name?: string;
  x2?: number;
  z2?: number;
  /** Yapının yanındaki doğuş noktası (yerde, açıkta). */
  sx: number;
  sz: number;
}

/** Yerleşim denetimi için dünyanın sorguları (yapılar birbirine, ağaçlara ve evlere girmesin). */
export interface Site {
  /** Dikdörtgen alanda (pay dahil) ağaç ya da bina var mı. */
  blocked(minX: number, maxX: number, minZ: number, maxZ: number, margin: number): boolean;
  /** Katı kutuyu dünyaya ekler (çarpışma ve üstünde durma). */
  addSolid(b: Building): void;
}

type MatKey = 'stone' | 'wood' | 'roof' | 'cloth' | 'water';
const CHUNK = 420;

/** Kutu: doku her yüzde gerçek ölçüsüne göre döşenir (bir karo = tile metre). */
function tbox(w: number, h: number, d: number, tile = 4) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const span: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let i = f * 4; i < f * 4 + 4; i++) uv.setXY(i, (uv.getX(i) * span[f][0]) / tile, (uv.getY(i) * span[f][1]) / tile);
  }
  return geo;
}

function tcyl(rt: number, rb: number, h: number, seg: number, tile = 4, open = false) {
  const geo = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const around = (2 * Math.PI * Math.max(rt, rb)) / tile;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * around, (uv.getY(i) * h) / tile);
  return geo;
}

/** Beşik çatı prizması: X ekseni boyunca `len`, genişlik `w`, tabandan mahyaya `h`. Taban y=0. */
function prism(len: number, w: number, h: number) {
  const x = len / 2;
  const z = w / 2;
  // prettier-ignore
  const p = [
    -x, 0, z, x, 0, z, x, h, 0, -x, 0, z, x, h, 0, -x, h, 0,
    x, 0, -z, -x, 0, -z, -x, h, 0, x, 0, -z, -x, h, 0, x, h, 0,
    x, 0, z, x, 0, -z, x, h, 0,
    -x, 0, -z, -x, 0, z, -x, h, 0,
  ];
  const s = Math.hypot(z, h) / 3;
  const u = len / 3;
  // prettier-ignore
  const uv = [0, 0, u, 0, u, s, 0, 0, u, s, 0, s, 0, 0, u, 0, u, s, 0, 0, u, s, 0, s, 0, 0, w / 3, 0, w / 6, h / 3, 0, 0, w / 3, 0, w / 6, h / 3];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpP = new THREE.Vector3();
const ONE = new THREE.Vector3(1, 1, 1);
const tmpC = new THREE.Color();

/**
 * Yapının birleşik ağdaki bir parçası: hangi ağda, hangi köşelerde ve nerede. Yıkılınca bu köşeler
 * kırık bir yığına indirilir.
 */
export interface LandmarkPiece {
  mesh: THREE.Mesh | null;
  start: number;
  count: number;
  x: number;
  z: number;
  wrecked: boolean;
  /** Birleştirmeden önce: ağın anahtarı. */
  key: string;
}

/** Parçaları malzemeye ve bölgeye göre toplayıp birleştirir; her köşeye renk yazar. */
class Kit {
  private readonly buckets = new Map<string, Map<MatKey, THREE.BufferGeometry[]>>();
  private readonly used = new Map<string, number>();
  readonly pieces: LandmarkPiece[] = [];

  /** `geo`yu (x, y, z)'ye yerleştirip `color` ile boyar. Dönüş: ry (Y), rx, rz. */
  put(mat: MatKey, geo: THREE.BufferGeometry, x: number, y: number, z: number, color: number, ry = 0, rx = 0, rz = 0) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    tmpM.compose(tmpP.set(x, y, z), tmpQ.setFromEuler(tmpE.set(rx, ry, rz, 'YXZ')), ONE);
    g.applyMatrix4(tmpM);
    tmpC.setHex(color);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      col[i * 3] = tmpC.r;
      col[i * 3 + 1] = tmpC.g;
      col[i * 3 + 2] = tmpC.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const k = `${Math.floor(x / CHUNK)}:${Math.floor(z / CHUNK)}`;
    let byMat = this.buckets.get(k);
    if (!byMat) this.buckets.set(k, (byMat = new Map()));
    let list = byMat.get(mat);
    if (!list) byMat.set(mat, (list = []));
    list.push(g);
    const mk = `${k}|${mat}`;
    const start = this.used.get(mk) ?? 0;
    this.used.set(mk, start + n);
    this.pieces.push({ mesh: null, start, count: n, x, z, wrecked: false, key: mk });
    geo.dispose();
  }

  build(mats: Record<MatKey, THREE.Material>) {
    const group = new THREE.Group();
    const byKey = new Map<string, THREE.Mesh>();
    for (const [k, byMat] of this.buckets) {
      for (const [mat, list] of byMat) {
        const merged = mergeGeometries(list, false);
        for (const g of list) g.dispose();
        if (!merged) continue;
        const m = new THREE.Mesh(merged, mats[mat]);
        m.castShadow = mat !== 'water';
        m.receiveShadow = true;
        group.add(m);
        byKey.set(`${k}|${mat}`, m);
      }
    }
    for (const p of this.pieces) p.mesh = byKey.get(p.key) ?? null;
    return group;
  }
}

// Renkler: üç surun sancakları ve yapı malzemeleri.
const BANNER = [0xa8322a, 0x3a5f8a, 0x4f7a3a];
const STONE = 0xc9c2b4;
const STONE_DARK = 0x8f897c;
const MOSS = 0x8e9479;
const WOOD = 0x7a5a3c;
const WOOD_DARK = 0x4e3826;
const SLATE = 0x5a6470;
const TILE = 0xb0634a;
const HOLE = 0x1c1a18;

/** Taş kulenin mazgal dişleri: kare tepenin dört kenarı boyunca. */
function merlons(kit: Kit, x: number, y: number, z: number, half: number, color: number, rng: Rng, broken = 0) {
  const step = 2.3;
  const n = Math.max(2, Math.round((half * 2) / step));
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i <= n; i++) {
      if (i % 2 === 1) continue;
      if (broken > 0 && rng() < broken) continue;
      const t = -half + (i * half * 2) / n;
      const ox = side < 2 ? t : (side === 2 ? -1 : 1) * (half - 0.5);
      const oz = side < 2 ? (side === 0 ? -1 : 1) * (half - 0.5) : t;
      kit.put('stone', tbox(1.4, 1.7, 1.4), x + ox, y + 0.85, z + oz, color);
    }
  }
}

/**
 * Sur içinin ve ötesinin anıtsal yapıları: gözcü kuleleri, yel değirmenleri, çan kuleli şapeller,
 * ahşap kazıklı karakollar, eski bir kale harabesi, su kemeri, sur asansörleri ve talim alanları.
 * Katı kısımlar çarpışma kutusu olarak dünyaya eklenir; üstlerinde durulur, kanca atılır.
 */
export function buildLandmarks(site: Site, villages: Village[]) {
  const rng = mulberry32(90731);
  const kit = new Kit();
  const marks: Landmark[] = [];
  const rotors: THREE.Mesh[] = [];
  const rotorMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const placed: { x: number; z: number; r: number }[] = [];

  const solid = (cx: number, cz: number, w: number, d: number, base: number, top: number, roofH = 0, under?: number) => {
    const b: Building = { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, base, eave: top, roofH, ridgeX: w >= d, top: top + roofH, town: true };
    if (under !== undefined) b.under = under;
    site.addSolid(b);
  };
  /** Yer uygun mu: yollardan, surlardan, kasabalardan, öbür yapılardan, ağaçlardan ve evlerden uzak. */
  const fits = (x: number, z: number, half: number, opts: { safe?: boolean; village?: number; forest?: boolean; trees?: number } = {}) => {
    if (Math.hypot(x, z) > EDGE - 120) return false;
    if (!opts.safe && inSafe(x, z, 30)) return false;
    if (onRoad(x, z, ROAD_HALF + half + 8)) return false;
    if (wallDist(x, z) < HALF_T + half + 30 || districtGap(x, z) < half + 20) return false;
    if (!opts.forest && inGiantForest(x, z, half + 80)) return false;
    if (opts.village !== undefined && villages.some((v) => Math.hypot(v.x - x, v.z - z) < opts.village! + half)) return false;
    if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + half + 12)) return false;
    return !site.blocked(x - half, x + half, z - half, z + half, opts.trees ?? 4);
  };
  const claim = (x: number, z: number, r: number) => placed.push({ x, z, r });
  /** Halkadaki rastgele bir nokta: `zone` 1 Taç–Demir, 2 Demir–Kalkan, 3 Kalkan ötesi. */
  const inZone = (zone: number) => {
    const lo = zone === 1 ? W.walls[0].r + 150 : zone === 2 ? W.walls[1].r + 120 : W.walls[2].r + 150;
    const hi = zone === 1 ? W.walls[1].r - 110 : zone === 2 ? W.walls[2].r - 110 : EDGE - 200;
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(lo * lo + rng() * (hi * hi - lo * lo));
    return [Math.sin(a) * r, Math.cos(a) * r] as const;
  };

  // ---------------------------------------------------------------- gözcü kulesi
  const tower = (x: number, z: number, ruined: boolean) => {
    const g = heightAt(x, z) - 1.5;
    const h = ruined ? 14 + rng() * 12 : 26 + rng() * 8;
    const c = ruined ? MOSS : STONE;
    kit.put('stone', tbox(10.6, 3, 10.6), x, g + 1.5, z, STONE_DARK);
    kit.put('stone', tbox(9, h, 9), x, g + h / 2, z, c);
    // Mazgal pencereleri ve kapı.
    for (let y = 8; y < h - 4; y += 7.5) {
      for (const [ox, oz, w, d] of [[0, 4.55, 0.7, 0.1], [0, -4.55, 0.7, 0.1], [4.55, 0, 0.1, 0.7], [-4.55, 0, 0.1, 0.7]] as const) kit.put('stone', tbox(w, 2.2, d), x + ox, g + y, z + oz, HOLE);
    }
    kit.put('wood', tbox(2.2, 3.4, 0.3), x, g + 3.2, z + 4.6, WOOD_DARK);
    if (ruined) {
      // Yıkık tepe: kırık dişler ve dibinde moloz.
      merlons(kit, x, g + h, z, 4.5, c, rng, 0.55);
      for (let i = 0; i < 6; i++) {
        const a = rng() * 6.28;
        const s = 1 + rng() * 2;
        kit.put('stone', new THREE.DodecahedronGeometry(s, 0), x + Math.sin(a) * (6 + rng() * 4), g + 1 + s * 0.3, z + Math.cos(a) * (6 + rng() * 4), STONE_DARK, rng() * 3, rng() * 3);
      }
    } else {
      kit.put('stone', tbox(10, 1, 10), x, g + h + 0.5 - 1, z, STONE_DARK);
      merlons(kit, x, g + h, z, 5, c, rng);
      // Sancak direği: bulunduğu surun rengi.
      const ring = Math.max(0, Math.min(2, ringOf(x, z) - 1));
      kit.put('wood', tbox(0.25, 9, 0.25), x + 3.6, g + h + 4.5, z + 3.6, WOOD_DARK);
      kit.put('cloth', tbox(0.08, 2.4, 3.6), x + 3.6, g + h + 7.6, z + 1.7, BANNER[ring]);
    }
    solid(x, z, 9, 9, g, g + h);
    marks.push({ kind: 'tower', x, z, sx: x, sz: z + 8 });
  };

  // ---------------------------------------------------------------- yel değirmeni
  const windmill = (x: number, z: number, ruined: boolean) => {
    const g = heightAt(x, z) - 1;
    const h = ruined ? 8 + rng() * 3 : 14;
    const yaw = rng() * Math.PI * 2;
    kit.put('stone', tcyl(3.1, 4.3, h, 10, 4), x, g + h / 2, z, ruined ? MOSS : 0xe2dccd);
    kit.put('wood', tbox(1.8, 3, 0.4), x + Math.sin(yaw) * 4.05, g + 1.6, z + Math.cos(yaw) * 4.05, WOOD_DARK, yaw);
    for (const yy of [6, 10]) if (yy < h - 1) kit.put('stone', tbox(0.9, 1.3, 0.3), x + Math.sin(yaw + 1.2) * 3.75, g + yy, z + Math.cos(yaw + 1.2) * 3.75, HOLE, yaw + 1.2);
    if (ruined) {
      solid(x, z, 7, 7, g, g + h);
      return;
    }
    kit.put('roof', new THREE.ConeGeometry(3.9, 5, 10), x, g + h + 2.5, z, 0x7a5040);
    // Kanatlar: göbek, dört kol ve kafes yelken; tek parça döner.
    const parts: THREE.BufferGeometry[] = [];
    const paint = (geo: THREE.BufferGeometry, color: number) => {
      const gg = geo.index ? geo.toNonIndexed() : geo;
      tmpC.setHex(color);
      const n = gg.attributes.position.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) col.set([tmpC.r, tmpC.g, tmpC.b], i * 3);
      gg.setAttribute('color', new THREE.BufferAttribute(col, 3));
      parts.push(gg);
    };
    paint(new THREE.CylinderGeometry(0.6, 0.6, 1.4, 8).rotateX(Math.PI / 2), WOOD_DARK);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      paint(new THREE.BoxGeometry(0.32, 11, 0.32).translate(0, 5.8, 0).rotateZ(a), WOOD);
      paint(new THREE.BoxGeometry(2.3, 8.2, 0.08).translate(1.3, 6.7, 0.05).rotateZ(a), 0xe8e0cc);
      for (let k = 0; k < 4; k++) paint(new THREE.BoxGeometry(2.4, 0.12, 0.14).translate(1.3, 3.2 + k * 2.3, 0.12).rotateZ(a), WOOD_DARK);
    }
    const rotor = new THREE.Mesh(mergeGeometries(parts, false)!, rotorMat);
    for (const p of parts) p.dispose();
    rotor.castShadow = true;
    // Göbek kulenin önünde, tepeye yakın; rüzgâra dönük.
    rotor.position.set(x + Math.sin(yaw) * 4.3, g + h - 0.8, z + Math.cos(yaw) * 4.3);
    rotor.rotation.order = 'YXZ';
    rotor.rotation.y = yaw;
    rotor.userData.spin = 0.5 + rng() * 0.4;
    rotors.push(rotor);
    solid(x, z, 7, 7, g, g + h, 4.5);
    marks.push({ kind: 'windmill', x, z, sx: x + Math.sin(yaw) * 8, sz: z + Math.cos(yaw) * 8 });
  };

  // ---------------------------------------------------------------- çan kuleli şapel
  const chapel = (x: number, z: number, alongX: boolean) => {
    const g = heightAt(x, z) - 1.5;
    const L = 22;
    const Wd = 11;
    const H = 10;
    const ry = alongX ? 0 : Math.PI / 2;
    const fx = alongX ? 1 : 0;
    const fz = alongX ? 0 : 1;
    kit.put('stone', tbox(L, H, Wd), x, g + H / 2, z, 0xd8d0bf, ry);
    kit.put('roof', prism(L + 1.2, Wd + 1.4, 6), x, g + H, z, SLATE, ry);
    // Sivri kemerli uzun pencereler.
    for (let i = -2; i <= 2; i++) {
      for (const s of [-1, 1]) kit.put('stone', tbox(1.1, 4.2, 0.12), x + fx * i * 4 + fz * s * (Wd / 2 + 0.05), g + 5.5, z + fz * i * 4 + fx * s * (Wd / 2 + 0.05), 0x2a3440, ry);
    }
    // Ön yüzde kapı ve gül pencere.
    const fxp = x - fx * (L / 2 + 0.06);
    const fzp = z - fz * (L / 2 + 0.06);
    kit.put('wood', tbox(3, 5, 0.2), fxp, g + 2.5, fzp, WOOD_DARK, ry + Math.PI / 2);
    kit.put('stone', new THREE.CylinderGeometry(1.5, 1.5, 0.2, 12).rotateX(Math.PI / 2), fxp, g + 11.5, fzp, 0x2a3440, ry + Math.PI / 2);
    // Arka uçta çan kulesi: taş gövde, çan penceresi, sivri külah ve tepede rüzgârgülü.
    const tx = x + fx * (L / 2 + 3);
    const tz = z + fz * (L / 2 + 3);
    const T = 26;
    kit.put('stone', tbox(7, T, 7), tx, g + T / 2, tz, 0xcfc7b5);
    for (const [ox, oz] of [[0, 3.55], [0, -3.55], [3.55, 0], [-3.55, 0]] as const) kit.put('stone', tbox(oz === 0 ? 0.1 : 2.4, 4, ox === 0 ? 0.1 : 2.4), tx + ox, g + T - 3.5, tz + oz, HOLE);
    kit.put('roof', new THREE.ConeGeometry(5.3, 13, 4), tx, g + T + 6.5, tz, SLATE, Math.PI / 4);
    kit.put('wood', tbox(0.15, 2.5, 0.15), tx, g + T + 14, tz, 0x3a3a3a);
    kit.put('cloth', tbox(1.4, 0.5, 0.06), tx + 0.6, g + T + 14.6, tz, 0x3a3a3a);
    solid(x, z, alongX ? L : Wd, alongX ? Wd : L, g, g + H, 6);
    solid(tx, tz, 7, 7, g, g + T);
    marks.push({ kind: 'chapel', x, z, sx: fxp - fx * 5, sz: fzp - fz * 5 });
  };

  // ---------------------------------------------------------------- ahşap karakol
  const fort = (x: number, z: number, name: string) => {
    const g = heightAt(x, z) - 0.6;
    const S = 30;
    const PH = 7.5;
    // Kapı merkeze bakan kenarda: en yakın yöne göre.
    const toC = Math.atan2(-x, -z);
    const gateSide = Math.round(toC / (Math.PI / 2));
    const gate = ((gateSide % 4) + 4) % 4; // 0: +z, 1: +x, 2: -z, 3: -x
    const logGeo = () => tcyl(0.42, 0.46, PH, 5, 2, true);
    const tipGeo = () => new THREE.ConeGeometry(0.46, 1.2, 5, 1, true);
    // Kenarlar: yönü, sabit eksendeki yeri ve X boyunca uzanıp uzanmadığı.
    const sides = [
      { dir: 0, fixed: z + S, alongX: true },
      { dir: 1, fixed: x + S, alongX: false },
      { dir: 2, fixed: z - S, alongX: true },
      { dir: 3, fixed: x - S, alongX: false },
    ];
    for (const { dir, fixed, alongX } of sides) {
      for (let t = -S; t <= S; t += 0.88) {
        if (dir === gate && Math.abs(t) < 4.5) continue;
        const lx = alongX ? x + t : fixed;
        const lz = alongX ? fixed : z + t;
        const y = heightAt(lx, lz) - 0.6;
        const hh = PH * (0.92 + rng() * 0.16);
        kit.put('wood', logGeo(), lx, y + hh / 2, lz, rng() < 0.5 ? WOOD : 0x6e5034);
        kit.put('wood', tipGeo(), lx, y + PH + 0.55, lz, WOOD_DARK);
      }
      // Çarpışma: kapı açıklığı olan kenar iki parçadır.
      const T = 1.2;
      if (dir === gate) {
        const seg = S - 4.5;
        for (const s of [-1, 1]) {
          const c = s * (4.5 + seg / 2);
          if (alongX) solid(x + c, fixed, seg, T, g, g + PH);
          else solid(fixed, z + c, T, seg, g, g + PH);
        }
      } else if (alongX) solid(x, fixed, S * 2 + T, T, g, g + PH);
      else solid(fixed, z, T, S * 2 + T, g, g + PH);
    }
    // Köşelerde direkli gözetleme kuleleri.
    for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
      const cx = x + sx * (S - 2.5);
      const cz = z + sz * (S - 2.5);
      const PL = 10.5;
      for (const [px, pz] of [[-2, -2], [-2, 2], [2, -2], [2, 2]] as const) kit.put('wood', tbox(0.5, PL + 4, 0.5), cx + px, g + (PL + 4) / 2, cz + pz, WOOD_DARK);
      kit.put('wood', tbox(5.6, 0.5, 5.6), cx, g + PL, cz, WOOD);
      for (const [px, pz, w, d] of [[0, 2.7, 5.6, 0.2], [0, -2.7, 5.6, 0.2], [2.7, 0, 0.2, 5.6], [-2.7, 0, 0.2, 5.6]] as const) kit.put('wood', tbox(w, 1.1, d), cx + px, g + PL + 0.8, cz + pz, WOOD);
      kit.put('roof', new THREE.ConeGeometry(4.4, 3, 4), cx, g + PL + 5.4, cz, 0x6a4a32, Math.PI / 4);
      solid(cx, cz, 4.6, 4.6, g, g + PL + 0.25);
    }
    // Kapının iki yanında yüksek direkler ve üstünde geçit.
    const gx = gate === 1 ? x + S : gate === 3 ? x - S : x;
    const gz = gate === 0 ? z + S : gate === 2 ? z - S : z;
    const gAlongX = gate === 0 || gate === 2;
    for (const s of [-1, 1]) kit.put('wood', tbox(0.9, PH + 4, 0.9), gx + (gAlongX ? s * 4.8 : 0), g + (PH + 4) / 2, gz + (gAlongX ? 0 : s * 4.8), WOOD_DARK);
    kit.put('wood', tbox(gAlongX ? 11 : 1.2, 1, gAlongX ? 1.2 : 11), gx, g + PH + 3, gz, WOOD);
    kit.put('cloth', tbox(gAlongX ? 2.6 : 0.08, 3.4, gAlongX ? 0.08 : 2.6), gx, g + PH + 0.9, gz, BANNER[2]);
    // İçeride, kapının karşı yanında kışla; çadırlar, erzak sandıkları ve sancak.
    const bx = gAlongX ? x : x - Math.sign(gx - x) * 18;
    const bz = gAlongX ? z - Math.sign(gz - z) * 18 : z;
    kit.put('wood', tbox(gAlongX ? 18 : 8, 5, gAlongX ? 8 : 18), bx, g + 2.5, bz, 0x8a6a48);
    kit.put('roof', prism(18.8, 9.4, 3.4), bx, g + 5, bz, TILE, gAlongX ? 0 : Math.PI / 2);
    solid(bx, bz, gAlongX ? 18 : 8, gAlongX ? 8 : 18, g, g + 5, 3.4);
    for (let i = 0; i < 3; i++) {
      const tx = x + (rng() - 0.5) * 30;
      const tz = z + (rng() - 0.5) * 30;
      if (Math.abs(tx - bx) < 12 && Math.abs(tz - bz) < 12) continue;
      kit.put('cloth', prism(5, 4.4, 2.8), tx, heightAt(tx, tz) - 0.1, tz, 0xd8ccae, rng() * Math.PI);
    }
    for (let i = 0; i < 6; i++) {
      const s = 0.9 + rng() * 0.5;
      kit.put('wood', tbox(s, s, s), x + 12 + (i % 3) * 1.3, g + 0.6 + s / 2 + Math.floor(i / 3) * s, z + 2 + (i % 2) * 1.2, 0x9a7a52, rng());
    }
    kit.put('wood', tbox(0.25, 14, 0.25), x, g + 7, z, WOOD_DARK);
    kit.put('cloth', tbox(0.08, 2.6, 4), x, g + 12.6, z + 2.1, BANNER[2]);
    claim(x, z, S + 10);
    marks.push({ kind: 'fort', x, z, name, sx: x + (gx - x) * 0.45, sz: z + (gz - z) * 0.45 });
  };

  // ---------------------------------------------------------------- eski kale harabesi
  const castle = (x: number, z: number) => {
    const g = heightAt(x, z) - 2;
    const S = 46;
    const c = (v: number) => (rng() < 0.4 ? MOSS : v);
    // Ana burç: çatısı çökmüş, tepesi dişli.
    const KH = 34;
    kit.put('stone', tbox(24, KH, 24, 5), x, g + KH / 2, z, STONE_DARK);
    merlons(kit, x, g + KH, z, 12, STONE_DARK, rng, 0.35);
    for (let y = 9; y < KH - 3; y += 8) for (const s of [-1, 1]) kit.put('stone', tbox(1, 3, 0.1), x + s * 5, g + y, z + 12.05, HOLE);
    solid(x, z, 24, 24, g, g + KH);
    // Köşe kuleleri: biri yarısına kadar yıkık.
    const heights = [30, 17, 28, 22];
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz], i) => {
      const cx = x + sx * S;
      const cz = z + sz * S;
      const h = heights[i];
      kit.put('stone', tbox(12, h, 12, 5), cx, g + h / 2, cz, c(STONE));
      merlons(kit, cx, g + h, cz, 6, STONE, rng, i === 1 ? 0.8 : 0.3);
      solid(cx, cz, 12, 12, g, g + h);
    });
    // Perde surları: yer yer gedikli.
    const WH = 14;
    const T = 4;
    const segs: [number, number, number, number][] = [];
    for (const [ax, az, bx, bz] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]] as const) {
      const x0 = x + ax * (S - 6);
      const z0 = z + az * (S - 6);
      const x1 = x + bx * (S - 6);
      const z1 = z + bz * (S - 6);
      const n = 5;
      for (let i = 0; i < n; i++) {
        // Ortadaki parça bazı kenarlarda yıkık (gedik).
        if (i === 2 && rng() < 0.6) continue;
        const t0 = i / n;
        const t1 = (i + 1) / n;
        segs.push([x0 + (x1 - x0) * t0, z0 + (z1 - z0) * t0, x0 + (x1 - x0) * t1, z0 + (z1 - z0) * t1]);
      }
    }
    for (const [x0, z0, x1, z1] of segs) {
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      const len = Math.hypot(x1 - x0, z1 - z0);
      const h = WH * (0.65 + rng() * 0.35);
      kit.put('stone', tbox(alongX ? len : T, h, alongX ? T : len, 5), cx, g + h / 2, cz, c(STONE));
      solid(cx, cz, alongX ? len : T, alongX ? T : len, g, g + h);
    }
    // Moloz yığınları.
    for (let i = 0; i < 26; i++) {
      const a = rng() * 6.28;
      const r = 20 + rng() * 40;
      const s = 1.2 + rng() * 3;
      const px = x + Math.sin(a) * r;
      const pz = z + Math.cos(a) * r;
      kit.put('stone', new THREE.DodecahedronGeometry(s, 0), px, heightAt(px, pz) - 0.3 + s * 0.3, pz, rng() < 0.5 ? MOSS : STONE_DARK, rng() * 3, rng() * 3);
    }
    claim(x, z, S + 20);
    marks.push({ kind: 'castle', x, z, name: 'Eski Kale', sx: x + 26, sz: z + 26 });
  };

  // ---------------------------------------------------------------- su kemeri
  const aqueduct = (x0: number, z0: number, len: number, alongX: boolean) => {
    const SP = 18;
    const n = Math.floor(len / SP);
    const top = Math.max(...Array.from({ length: n + 1 }, (_, i) => heightAt(x0 + (alongX ? i * SP : 0), z0 + (alongX ? 0 : i * SP)))) + 22;
    const at = (t: number) => [x0 + (alongX ? t : 0), z0 + (alongX ? 0 : t)] as const;
    for (let i = 0; i <= n; i++) {
      const [px, pz] = at(i * SP);
      const g = heightAt(px, pz) - 1;
      const h = top - 3 - g;
      kit.put('stone', tbox(3.4, h, 3.4), px, g + h / 2, pz, STONE);
      solid(px, pz, 3.4, 3.4, g, top - 3);
      // Kemerler: iki ayak arasında yarım çember taş dizisi.
      if (i < n) {
        const R = (SP - 3.4) / 2 + 0.4;
        const [mx, mz] = at(i * SP + SP / 2);
        const spring = top - 3.6 - R;
        const seg = (Math.PI * R) / 9 + 0.35;
        for (let k = 0; k < 9; k++) {
          const a = (Math.PI * (k + 0.5)) / 9;
          const off = -Math.cos(a) * R;
          const yy = spring + Math.sin(a) * R;
          kit.put('stone', tbox(alongX ? seg : 3.2, 1.4, alongX ? 3.2 : seg), mx + (alongX ? off : 0), yy, mz + (alongX ? 0 : off), STONE_DARK, 0, alongX ? 0 : a - Math.PI / 2, alongX ? Math.PI / 2 - a : 0);
        }
        // Kemerin üstü ile köprü tabanı arasındaki dolgu (kemer köşelikleri).
        kit.put('stone', tbox(alongX ? SP - 3.4 : 3, 1.2, alongX ? 3 : SP - 3.4), mx, top - 3.6, mz, STONE);
      }
    }
    const L = n * SP + 3.4;
    const [cx, cz] = at((n * SP) / 2);
    kit.put('stone', tbox(alongX ? L : 4.6, 3, alongX ? 4.6 : L), cx, top - 1.5, cz, 0xd2cbbb);
    for (const s of [-1, 1]) kit.put('stone', tbox(alongX ? L : 0.6, 1.1, alongX ? 0.6 : L), cx + (alongX ? 0 : s * 2), top + 0.55, cz + (alongX ? s * 2 : 0), STONE_DARK);
    kit.put('water', tbox(alongX ? L : 3.2, 0.2, alongX ? 3.2 : L), cx, top + 0.25, cz, 0xffffff);
    solid(cx, cz, alongX ? L : 4.6, alongX ? 4.6 : L, top - 3, top, 0, top - 3);
    const [ex, ez] = at(n * SP);
    marks.push({ kind: 'aqueduct', x: x0, z: z0, x2: ex, z2: ez, name: 'Su Kemeri', sx: cx + (alongX ? 0 : 10), sz: cz + (alongX ? 10 : 0) });
  };

  // ---------------------------------------------------------------- sur asansörü
  const lift = (ring: number, dir: number) => {
    const R = W.walls[ring].r;
    const off = (W.gateHalfW + 26) / R;
    for (const s of [1, -1]) {
      const a = dir + s * off;
      const rr = R - HALF_T - 3.6;
      const x = Math.sin(a) * rr;
      const z = Math.cos(a) * rr;
      if (site.blocked(x - 3.5, x + 3.5, z - 3.5, z + 3.5, 0.5)) continue;
      const g = heightAt(x, z) - 0.5;
      const top = W.wallH + 0.3;
      // Dört direk, çapraz kuşaklar, sur hizasında iniş sahanlığı, tepede vinç ve makara.
      for (const [px, pz] of [[-3, -3], [-3, 3], [3, -3], [3, 3]] as const) kit.put('wood', tbox(0.6, top + 7 - g, 0.6), x + px, (top + 7 + g) / 2, z + pz, WOOD_DARK);
      for (let y = g + 8; y < top; y += 9) {
        for (const [px, pz, w, d] of [[0, 3, 6.6, 0.35], [0, -3, 6.6, 0.35], [3, 0, 0.35, 6.6], [-3, 0, 0.35, 6.6]] as const) kit.put('wood', tbox(w, 0.45, d), x + px, y, z + pz, WOOD);
      }
      kit.put('wood', tbox(7, 0.5, 7), x, top - 0.25, z, WOOD);
      kit.put('wood', tbox(7.6, 0.7, 0.7), x, top + 6.8, z, WOOD);
      kit.put('wood', new THREE.CylinderGeometry(1.3, 1.3, 0.5, 12).rotateZ(Math.PI / 2), x, top + 5.6, z, 0x5a5048);
      // Yarı yolda asılı yük kafesi ve halatları.
      const cy = g + (top - g) * 0.45;
      kit.put('wood', tbox(4.6, 0.4, 4.6), x, cy, z, WOOD);
      for (const [px, pz] of [[-2.1, -2.1], [-2.1, 2.1], [2.1, -2.1], [2.1, 2.1]] as const) kit.put('wood', tbox(0.15, 2.2, 0.15), x + px, cy + 1.1, z + pz, WOOD_DARK);
      kit.put('wood', tbox(0.12, top + 5.6 - cy - 2.2, 0.12), x, (top + 5.6 + cy + 2.2) / 2, z, 0x2a241e);
      solid(x, z, 6.4, 6.4, g, top);
      marks.push({ kind: 'lift', x, z, sx: Math.sin(a) * (rr - 7), sz: Math.cos(a) * (rr - 7) });
      return;
    }
  };

  // ---------------------------------------------------------------- talim alanı
  const yard = (x: number, z: number) => {
    const g = heightAt(x, z);
    const HX = 22;
    const HZ = 15;
    // Çit: direkler ve iki sıra kuşak.
    for (const [alongX, fixed] of [[true, z - HZ], [true, z + HZ], [false, x - HX], [false, x + HX]] as const) {
      const L = alongX ? HX : HZ;
      for (let t = -L; t <= L; t += 3) {
        if (!alongX && Math.abs(t) < 3) continue; // giriş
        kit.put('wood', tbox(0.25, 1.6, 0.25), alongX ? x + t : fixed, heightAt(alongX ? x + t : fixed, alongX ? fixed : z + t) + 0.6, alongX ? fixed : z + t, WOOD_DARK);
      }
      for (const yy of [0.6, 1.2]) kit.put('wood', tbox(alongX ? L * 2 : 0.12, 0.14, alongX ? 0.12 : L * 2), alongX ? x : fixed, g + yy, alongX ? fixed : z, WOOD);
    }
    // Ahşap dev kuklaları: gövde tahtası, baş, sırtta kırmızı ense hedefi ve destek payandaları.
    for (let i = 0; i < 5; i++) {
      const px = x - HX + 6 + i * 8;
      const pz = z + (i % 2 ? 4 : -4);
      const gy = heightAt(px, pz);
      const h = 7 + (i % 3) * 2;
      kit.put('wood', tbox(3, h, 0.35), px, gy + h / 2, pz, 0xa07a50);
      kit.put('wood', tbox(2.4, 2.4, 0.35), px, gy + h + 1.2, pz, 0xa07a50);
      kit.put('cloth', tbox(1.4, 0.7, 0.08), px, gy + h + 0.1, pz - 0.22, 0xb02a24);
      kit.put('cloth', tbox(0.5, 0.25, 0.06), px - 0.5, gy + h + 1.5, pz + 0.2, HOLE);
      kit.put('cloth', tbox(0.5, 0.25, 0.06), px + 0.5, gy + h + 1.5, pz + 0.2, HOLE);
      for (const s of [-1, 1]) kit.put('wood', tbox(0.2, h * 0.7, 0.2), px + s * 1.2, gy + h * 0.3, pz - 1.4, WOOD_DARK, 0, -0.5);
    }
    // Kanca alıştırması için iki direk ve aralarında gerili halat.
    for (const s of [-1, 1]) kit.put('wood', tbox(0.5, 12, 0.5), x + s * 16, g + 6, z + 11, WOOD_DARK);
    kit.put('wood', tbox(32, 0.1, 0.1), x, g + 11.5, z + 11, 0x2a241e);
    claim(x, z, HX + 6);
    marks.push({ kind: 'yard', x, z, name: 'Talim Alanı', sx: x, sz: z + 8 });
  };

  // ================================================================ yerleşim
  // Eski kale: dev ağaçlar ormanına giden yolun kenarında.
  {
    const R2 = W.walls[2].r;
    for (let tries = 0; tries < 80; tries++) {
      const side = tries % 2 ? 1 : -1;
      const x = side * (150 + rng() * 160);
      const z = -(R2 + 700 + rng() * 600);
      if (inGiantForest(x, z, 160) || !fits(x, z, 60, { village: 120, trees: 6, forest: true })) continue;
      castle(x, z);
      break;
    }
  }
  // Ahşap karakollar: Kalkan Suru'nun ötesinde beşi, Demir–Kalkan arasında ikisi.
  const FORTS = ['Kartal Karakolu', 'Yel Karakolu', 'Çakıl Karakolu', 'Doğan Karakolu', 'Son Karakol', 'Ova Karakolu', 'Değirmen Karakolu'];
  let fi = 0;
  for (const [zone, count] of [[3, 5], [2, 2]] as const) {
    let made = 0;
    for (let tries = 0; tries < 400 && made < count; tries++) {
      const [x, z] = inZone(zone);
      if (!fits(x, z, 36, { village: 150 })) continue;
      fort(x, z, FORTS[fi++]);
      made++;
    }
  }
  // Su kemeri: Taç ile Demir Sur arasındaki ovada, eksene paralel uzun bir dizi kemer.
  for (let tries = 0; tries < 300; tries++) {
    const alongX = rng() < 0.5;
    const len = 380 + rng() * 260;
    const across = (rng() < 0.5 ? -1 : 1) * (520 + rng() * 520);
    const start = (rng() < 0.5 ? -1 : 1) * (60 + rng() * 300) - (rng() < 0.5 ? len : 0);
    const x0 = alongX ? start : across;
    const z0 = alongX ? across : start;
    const x1 = alongX ? x0 + len : x0;
    const z1 = alongX ? z0 : z0 + len;
    // Bütün hat surlardan, yoldan, köylerden, ağaçlardan ve evlerden uzak olmalı.
    const minX = Math.min(x0, x1) - 3;
    const maxX = Math.max(x0, x1) + 3;
    const minZ = Math.min(z0, z1) - 3;
    const maxZ = Math.max(z0, z1) + 3;
    if (maxX > -ROAD_HALF - 12 && minX < ROAD_HALF + 12) continue;
    if (maxZ > -ROAD_HALF - 12 && minZ < ROAD_HALF + 12) continue;
    let ok = true;
    for (let t = 0; t <= len && ok; t += 30) {
      const px = alongX ? x0 + t : x0;
      const pz = alongX ? z0 : z0 + t;
      const r = Math.hypot(px, pz);
      if (r < W.walls[0].r + 120 || r > W.walls[1].r - 90 || districtGap(px, pz) < 40) ok = false;
      if (villages.some((v) => Math.hypot(v.x - px, v.z - pz) < 90)) ok = false;
    }
    if (!ok || site.blocked(minX, maxX, minZ, maxZ, 6)) continue;
    aqueduct(x0, z0, len, alongX);
    for (let t = 0; t <= len; t += 40) claim(alongX ? x0 + t : x0, alongX ? z0 : z0 + t, 20);
    break;
  }
  // Talim alanları: Taç Suru kasabalarının hemen dışında, yolun iki yanında.
  {
    let made = 0;
    for (let tries = 0; tries < 200 && made < 3; tries++) {
      const d = DIRS[Math.floor(rng() * 4)];
      const along = W.walls[0].r + W.walls[0].district + 60 + rng() * 140;
      const side = (rng() < 0.5 ? -1 : 1) * (45 + rng() * 40);
      const x = Math.sin(d) * along + Math.cos(d) * side;
      const z = Math.cos(d) * along - Math.sin(d) * side;
      if (!fits(x, z, 26, { village: 60 })) continue;
      yard(x, z);
      made++;
    }
  }
  // Köylerin yanında yel değirmenleri ve çan kuleli şapeller; sur ötesindekiler çoğu kez yıkık.
  for (const v of villages) {
    const outer = v.zone === 3;
    if (rng() < (outer ? 0.35 : 0.6)) {
      for (let tries = 0; tries < 10; tries++) {
        const a = rng() * 6.28;
        const r = 62 + rng() * 22;
        const x = v.x + Math.sin(a) * r;
        const z = v.z + Math.cos(a) * r;
        if (!fits(x, z, 5, {})) continue;
        windmill(x, z, outer && rng() < 0.6);
        claim(x, z, 8);
        break;
      }
    }
    if (!outer && rng() < 0.4) {
      for (let tries = 0; tries < 10; tries++) {
        const a = rng() * 6.28;
        const r = 58 + rng() * 20;
        const x = v.x + Math.sin(a) * r;
        const z = v.z + Math.cos(a) * r;
        if (!fits(x, z, 16, {})) continue;
        chapel(x, z, rng() < 0.5);
        claim(x, z, 18);
        break;
      }
    }
  }
  // Şehrin içinde iki büyük şapel.
  {
    let made = 0;
    for (let tries = 0; tries < 300 && made < 2; tries++) {
      const a = rng() * 6.28;
      const r = 70 + rng() * 160;
      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r;
      if (Math.abs(x) < 26 || Math.abs(z) < 26 || Math.hypot(x - CFG.player.spawn.x, z - CFG.player.spawn.z) < 40) continue;
      if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + 30)) continue;
      if (site.blocked(x - 17, x + 17, z - 17, z + 17, 1)) continue;
      chapel(x, z, rng() < 0.5);
      claim(x, z, 18);
      made++;
    }
  }
  // Gözcü kuleleri: her bölgenin ovalarında; sur ötesindekilerin çoğu yıkık.
  for (const [zone, count] of [[1, 7], [2, 10], [3, 12]] as const) {
    let made = 0;
    for (let tries = 0; tries < 400 && made < count; tries++) {
      const [x, z] = inZone(zone);
      if (!fits(x, z, 6, { village: 70 })) continue;
      tower(x, z, zone === 3 && rng() < 0.55);
      claim(x, z, 40);
      made++;
    }
  }
  // Sur asansörleri: her surun her kapısının iç yanında.
  for (let ring = 0; ring < 3; ring++) for (const d of DIRS) lift(ring, d);

  const stone = stoneTexture();
  const roof = roofTexture();
  const group = kit.build({
    stone: new THREE.MeshLambertMaterial({ map: stone, vertexColors: true }),
    wood: new THREE.MeshLambertMaterial({ vertexColors: true }),
    roof: new THREE.MeshLambertMaterial({ map: roof, vertexColors: true, side: THREE.DoubleSide }),
    cloth: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    water: new THREE.MeshLambertMaterial({ color: 0x4f8a9a, emissive: 0x0e2228 }),
  });
  return { group, rotors, marks, pieces: kit.pieces };
}
