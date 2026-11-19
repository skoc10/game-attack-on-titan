import { CFG } from '../data/config';
import { angDiff, type Rng } from '../core/rng';

/**
 * Dünyanın yerleşimi (saf hesap, Three.js yok):
 * - ortada şehri çevreleyen Taç Suru, dışında Demir Sur ve Kalkan Suru,
 * - her surun dört yönünde dışa taşan, yarım daire biçimli bir kapı kasabası,
 * - kapılardan geçen dört ana yol (iki eksen boyunca),
 * - surların arasındaki ovalara dağılmış köyler.
 * Çarpışma, arazi, görseller ve doğurma noktaları buradaki sorguları kullanır.
 */

const W = CFG.world;
export const HALF_T = W.wallT / 2;
/** Oyuncu ve devler bu yarıçapın dışına çıkamaz. */
export const EDGE = W.size / 2 - 80;
/** Kapı ve kasaba yönleri, atan2(x, z) açısı olarak: +Z, +X, -Z, -X. */
export const DIRS = [0, Math.PI / 2, Math.PI, -Math.PI / 2] as const;
/** Ana yollar en dıştaki kasabanın kapısından bu kadar ileri uzanır. */
export const ROAD_END = W.walls[2].r + W.walls[2].district + 600;
/** Yolun ve kasaba sokağının yarı genişliği. */
export const ROAD_HALF = 6.5;

export interface District {
  /** Hangi surun kasabası (0: Taç, 1: Demir, 2: Kalkan). */
  ring: number;
  /** DIRS içindeki yön. */
  dir: number;
  ang: number;
  /** Yarım dairenin merkezi: surun üstünde, kapının olduğu yer. */
  x: number;
  z: number;
  r: number;
  name: string;
}

/** Sur gövdesi olarak bir çember yayı. */
export interface Arc {
  cx: number;
  cz: number;
  r: number;
  /** Yayın orta açısı ve yarı açıklığı (π ise tam çember). */
  mid: number;
  half: number;
  /** Kapıların yay üzerindeki açıları (yayın merkezine göre). */
  gates: number[];
}

export interface Village {
  x: number;
  z: number;
  /** 1: Demir Ova, 2: Kalkan Ormanları, 3: Sur Ötesi. */
  zone: number;
}

export const DISTRICTS: District[] = W.walls.flatMap((w, ring) =>
  DIRS.map((ang, dir) => ({
    ring,
    dir,
    ang,
    x: Math.sin(ang) * w.r,
    z: Math.cos(ang) * w.r,
    r: w.district,
    name: w.towns[dir],
  })),
);

/** Kasaba yayının sura değdiği yerin, kasaba merkezine göre açı farkı. */
export const districtHalf = (d: District) => Math.acos(-d.r / (2 * W.walls[d.ring].r));

export const ARCS: Arc[] = [
  ...W.walls.map((w) => ({ cx: 0, cz: 0, r: w.r, mid: 0, half: Math.PI, gates: [...DIRS] })),
  ...DISTRICTS.map((d) => ({ cx: d.x, cz: d.z, r: d.r, mid: d.ang, half: districtHalf(d), gates: [d.ang] })),
];

const onArc = (a: Arc, dx: number, dz: number) => a.half >= Math.PI || Math.abs(angDiff(Math.atan2(dx, dz), a.mid)) <= a.half;

/** Nokta bir kapı açıklığının hizasındaysa kapıya göre yanal kayması ve kapının açısı. */
function gateAt(a: Arc, dx: number, dz: number, dist: number) {
  const phi = Math.atan2(dx, dz);
  for (const g of a.gates) {
    const d = angDiff(phi, g);
    if (Math.cos(d) <= 0) continue;
    const t = dist * Math.sin(d);
    if (Math.abs(t) < W.gateHalfW) return { t, g };
  }
  return null;
}

/** En yakın sur gövdesinin (çember ya da kasaba yayı) orta çizgisine yatay uzaklık. */
export function wallDist(x: number, z: number) {
  let best = Infinity;
  for (const a of ARCS) {
    const dx = x - a.cx;
    const dz = z - a.cz;
    const d = Math.abs(Math.hypot(dx, dz) - a.r);
    if (d < best && onArc(a, dx, dz)) best = d;
  }
  return best;
}

/** Noktanın baktığı yöndeki (en yakın eksendeki) kasabalar: başka bir kasabanın içinde olamaz. */
function dirOf(x: number, z: number) {
  const k = Math.round(Math.atan2(x, z) / (Math.PI / 2));
  return ((k % 4) + 4) % 4;
}

/** Nokta bir kapı kasabasının içindeyse o kasaba (surun dışında kalan yarım daire). */
export function districtAt(x: number, z: number): District | null {
  const r = Math.hypot(x, z);
  const dir = dirOf(x, z);
  for (let ring = 0; ring < W.walls.length; ring++) {
    const d = DISTRICTS[ring * 4 + dir];
    if (r >= W.walls[ring].r && Math.hypot(x - d.x, z - d.z) < d.r) return d;
  }
  return null;
}

/** En yakın kasaba yarım dairesinin kenarına uzaklık (içindeyse 0). */
export function districtGap(x: number, z: number) {
  const dir = dirOf(x, z);
  let best = Infinity;
  for (let ring = 0; ring < W.walls.length; ring++) {
    const d = DISTRICTS[ring * 4 + dir];
    best = Math.min(best, Math.max(0, Math.hypot(x - d.x, z - d.z) - d.r));
  }
  return best;
}

/** Noktayı çevreleyen en içteki sur: 0 Taç (şehir ve kasabaları), 1 Demir, 2 Kalkan, 3 sur ötesi. */
export function ringOf(x: number, z: number) {
  const r = Math.hypot(x, z);
  const district = districtAt(x, z);
  for (let i = 0; i < W.walls.length; i++) {
    if (r < W.walls[i].r || district?.ring === i) return i;
  }
  return W.walls.length;
}

/** Güvenli bölge (şehir ve Taç Suru kasabaları), `margin` metre payla. Devler buraya giremez. */
export function inSafe(x: number, z: number, margin = 0) {
  if (Math.hypot(x, z) < W.walls[0].r + margin) return true;
  const d = DISTRICTS[dirOf(x, z)];
  return Math.hypot(x - d.x, z - d.z) < d.r + margin;
}

/** Devin durabileceği yer mi: güvenli bölgeden ve sur gövdelerinden uzak, dünyanın içinde. */
export function spawnable(x: number, z: number, safeMargin = 50, wallMargin = 24) {
  return !inSafe(x, z, safeMargin) && wallDist(x, z) >= wallMargin && Math.hypot(x, z) < EDGE - 40;
}

/** Ana yolların üstünde mi (yolun ekseninden `half` metre içinde). */
export function onRoad(x: number, z: number, half = ROAD_HALF) {
  if (Math.hypot(x, z) > ROAD_END) return false;
  return Math.abs(x) < half || Math.abs(z) < half;
}

/** Sur üstündeki yürüme yolu: iç korkuluğun ve dış korkuluğun arasında kalan şerit (sur ortasına göre). */
export const WALK_IN = -HALF_T + 0.8;
export const WALK_OUT = HALF_T - 1.1;
/** Korkulukların üst yüksekliği (sur üstüne göre): bunun üstünde zıplayan aşabilir. */
const RAIL_IN = 0.9;
const RAIL_OUT = 1.3;

/**
 * Sur gövdesinden ve dünyanın kenarından dışarı iter (kapı geçitleri hariç). Değişiklik olduysa true.
 * Sur üstündeyken korkuluklardan geçilmez. `tall` verilirse (devin boyu) kapı kemerine sığmayan kapıdan geçemez.
 */
export function wallPush(pos: { x: number; z: number }, radius: number, feetY: number, tall = 0) {
  let hit = false;
  const r = Math.hypot(pos.x, pos.z);
  if (r > EDGE) {
    pos.x *= EDGE / r;
    pos.z *= EDGE / r;
    hit = true;
  }
  if (feetY >= W.wallH - 0.6) {
    // Sur üstü: gövde korkulukların içine girmesin.
    const up = feetY - W.wallH;
    if (up >= RAIL_OUT) return hit;
    for (const a of ARCS) {
      const dx = pos.x - a.cx;
      const dz = pos.z - a.cz;
      const dist = Math.hypot(dx, dz);
      const d = dist - a.r;
      if (Math.abs(d) > HALF_T + 0.15 || !onArc(a, dx, dz) || dist < 1e-6) continue;
      const lo = up < RAIL_IN ? WALK_IN + radius : -Infinity;
      const hi = WALK_OUT - radius;
      const c = Math.min(hi, Math.max(lo, d));
      if (c === d) return hit;
      const k = (a.r + c) / dist;
      pos.x = a.cx + dx * k;
      pos.z = a.cz + dz * k;
      return true;
    }
    return hit;
  }
  for (const a of ARCS) {
    const dx = pos.x - a.cx;
    const dz = pos.z - a.cz;
    const dist = Math.hypot(dx, dz);
    const d = dist - a.r;
    if (Math.abs(d) >= HALF_T + radius || !onArc(a, dx, dz)) continue;
    const fits = tall > 0 ? feetY + tall < W.gateH - 0.5 : feetY < W.gateH - 2.5;
    const gate = fits ? gateAt(a, dx, dz, dist) : null;
    if (gate) {
      // Kapı geçidinde: yalnızca kapının yan duvarlarına çarpılır.
      const lim = Math.max(0, W.gateHalfW - radius);
      if (Math.abs(gate.t) > lim) {
        const shift = Math.sign(gate.t) * lim - gate.t;
        pos.x += Math.cos(gate.g) * shift;
        pos.z -= Math.sin(gate.g) * shift;
        hit = true;
      }
      continue;
    }
    const target = d >= 0 ? a.r + HALF_T + radius : a.r - HALF_T - radius;
    const k = dist > 1e-6 ? target / dist : 1;
    pos.x = a.cx + dx * k;
    pos.z = a.cz + dz * k;
    return true;
  }
  return hit;
}

/** Nokta bir surun üstündeyse üst yüzey yüksekliği, değilse -Infinity. */
export function wallTopAt(x: number, z: number) {
  for (const a of ARCS) {
    const dx = x - a.cx;
    const dz = z - a.cz;
    if (Math.abs(Math.hypot(dx, dz) - a.r) <= HALF_T + 0.15 && onArc(a, dx, dz)) return W.wallH;
  }
  return -Infinity;
}

/** Nokta bir sur gövdesinin içinde mi (kapı boşlukları hariç)? Kamera ve mermi engeli için. */
export function wallSolid(x: number, y: number, z: number, margin: number) {
  if (y >= W.wallH + margin) return false;
  for (const a of ARCS) {
    const dx = x - a.cx;
    const dz = z - a.cz;
    const dist = Math.hypot(dx, dz);
    if (Math.abs(dist - a.r) >= HALF_T + margin || !onArc(a, dx, dz)) continue;
    const gate = y < W.gateH - margin ? gateAt(a, dx, dz, dist) : null;
    if (!gate || Math.abs(gate.t) > W.gateHalfW - margin) return true;
  }
  return false;
}

/**
 * İki nokta arasında (y yüksekliğinde) sur gövdesi var mı: surun ardındaki oyuncuya devin eli yetişmez.
 * Kapı boşluklarından ve surun üstünden geçen hat engellenmez.
 */
export function wallBetween(ax: number, az: number, bx: number, bz: number, y: number) {
  if (y >= W.wallH) return false;
  const len = Math.hypot(bx - ax, bz - az);
  const n = Math.min(80, Math.ceil(len / 1.5));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (wallSolid(ax + (bx - ax) * t, y, az + (bz - az) * t, 0)) return true;
  }
  return false;
}

export function zoneName(x: number, z: number) {
  const d = districtAt(x, z);
  if (d) return d.ring === 0 ? `${d.name} Kasabası — Güvenli Bölge` : `${d.name} Kasabası — ${W.walls[d.ring].name}`;
  return ['Taç Suru İçi — Güvenli Bölge', 'Demir Ova', 'Kalkan Ormanları', 'Sur Ötesi'][ringOf(x, z)];
}

/** Köylerin yerleri: her bölgede belirli sayıda, surlardan, kasabalardan, yollardan ve birbirinden uzak. */
export function placeVillages(rng: Rng): Village[] {
  const out: Village[] = [];
  const V = W.villages;
  const [w0, w1, w2] = W.walls;
  const zones: [number, number][] = [
    [w0.r + w0.district + 140, w1.r - 100],
    [w1.r + w1.district + 100, w2.r - 100],
    [w2.r + w2.district + 120, EDGE - 250],
  ];
  zones.forEach(([a, b], i) => {
    let placed = 0;
    for (let tries = 0; tries < 600 && placed < V.perZone[i]; tries++) {
      const ang = rng() * Math.PI * 2;
      // Alana göre düzgün dağılım: dış halkalar daha geniştir.
      const rr = Math.sqrt(a * a + (b * b - a * a) * rng());
      const x = Math.sin(ang) * rr;
      const z = Math.cos(ang) * rr;
      if (wallDist(x, z) < 90 || districtGap(x, z) < 70 || onRoad(x, z, 70)) continue;
      if (out.some((v) => Math.hypot(v.x - x, v.z - z) < V.spacing)) continue;
      out.push({ x, z, zone: i + 1 });
      placed++;
    }
  });
  return out;
}

export interface Lot {
  x: number;
  z: number;
  w: number;
  d: number;
}

/** Kasabanın ev arsaları: yarım dairenin içinde, sur gövdelerinden ve ortadaki caddeden uzak. */
export function districtLots(dist: District, rng: Rng): Lot[] {
  const R = W.walls[dist.ring].r;
  const out: Lot[] = [];
  const step = 17;
  const n = Math.ceil(dist.r / step);
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      if (rng() < 0.28) continue;
      const w = 8 + rng() * 5;
      const d = 8 + rng() * 5;
      const x = dist.x + i * step + (rng() - 0.5) * 3;
      const z = dist.z + j * step + (rng() - 0.5) * 3;
      const ext = Math.hypot(w, d) / 2;
      if (Math.hypot(x - dist.x, z - dist.z) + ext > dist.r - HALF_T - 5) continue;
      if (Math.hypot(x, z) - ext < R + HALF_T + 6) continue;
      // Kapıdan kapıya uzanan cadde ve iki yanındaki kaldırım boş kalır.
      const lateral = dist.dir % 2 === 0 ? Math.abs(x) : Math.abs(z);
      if (lateral - ext < 13) continue;
      out.push({ x, z, w, d });
    }
  }
  return out;
}
