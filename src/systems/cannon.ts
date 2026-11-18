import { CFG } from '../data/config';
import { angDiff } from '../core/rng';
import { ARCS, HALF_T, districtGap } from '../world/layout';

/**
 * Sur topları (saf kurallar): surların üstündeki yerleri, güllenin atış açısı ve patlamanın deve etkisi.
 * Görseller ve oyun akışı world/cannons.ts içindedir.
 */

const C = CFG.cannon;
const W = CFG.world;

export interface CannonSlot {
  x: number;
  z: number;
  /** Topun dışa baktığı yön (atan2(x, z) açısı). */
  face: number;
}

/**
 * Topların yerleri: her surun yürüme yolunun dış yarısında, dışa bakar.
 * Kapıların ve kasaba köşelerinin yanı boş kalır; halka surun kasabaya bakan kısmına top konmaz.
 */
export function cannonSlots(): CannonSlot[] {
  const out: CannonSlot[] = [];
  const add = (cx: number, cz: number, r: number, th: number) => {
    const rr = r + HALF_T * 0.4;
    out.push({ x: cx + Math.sin(th) * rr, z: cz + Math.cos(th) * rr, face: th });
  };
  for (const a of ARCS) {
    const full = a.half >= Math.PI;
    const step = (full ? C.spacing : C.districtSpacing) / a.r;
    const gateGap = (W.gateHalfW + 25) / a.r;
    const start = full ? step / 2 : a.mid - a.half + 25 / a.r;
    const end = full ? Math.PI * 2 : a.mid + a.half - 25 / a.r;
    for (let th = start; th <= end; th += step) {
      if (a.gates.some((g) => Math.abs(angDiff(th, g)) < gateGap)) continue;
      // Halka surun kasabanın içine ya da kasaba suruna bakan kısmı: oradan atılan gülle kasabaya düşer.
      if (full && districtGap(Math.sin(th) * (a.r + 40), Math.cos(th) * (a.r + 40)) < 25) continue;
      add(a.cx, a.cz, a.r, th);
    }
  }
  return out;
}

/**
 * Yatayda `d` metre ötedeki, `dy` metre yukarıdaki (aşağıdaysa eksi) noktayı vurmak için
 * alçak yörüngenin atış açısı (radyan). Menzil dışındaysa null.
 */
export function launchAngle(d: number, dy: number, v = C.speed, g = C.gravity): number | null {
  if (d < 1e-6) return dy >= 0 ? Math.PI / 2 : -Math.PI / 2;
  const v2 = v * v;
  const disc = v2 * v2 - g * (g * d * d + 2 * dy * v2);
  if (disc < 0) return null;
  return Math.atan((v2 - Math.sqrt(disc)) / (g * d));
}

/** Atış açısıyla yatay `d` metreyi geçme süresi. */
export const flightTime = (d: number, angle: number, v = C.speed) => d / Math.max(1e-6, v * Math.cos(angle));

export type BlastEffect = 'kill' | 'nape' | 'stagger' | 'none';

/**
 * Güllenin bir deve etkisi. Sıradan devler patlamanın içinde kalırsa ölür (zırhlılar dahil).
 * Bölüm sonu devi ölmez: ensesine yakın patlama ense kesiği sayılır (zırhı deler), gövdeye isabet onu sendeletir.
 * napeDist: patlamanın enseye uzaklığı, bodyDist: gövde eksenine uzaklığı.
 */
export function blastEffect(boss: boolean, napeDist: number, napeRadius: number, bodyDist: number, bodyRadius: number, radius = C.radius): BlastEffect {
  const nape = napeDist < radius * 0.6 + napeRadius;
  const body = bodyDist < radius + bodyRadius;
  if (!nape && !body) return 'none';
  if (!boss) return 'kill';
  return nape ? 'nape' : 'stagger';
}
