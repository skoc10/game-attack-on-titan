import { describe, expect, it } from 'vitest';
import { CFG } from '../data/config';
import { mulberry32 } from '../core/rng';
import {
  DISTRICTS,
  EDGE,
  HALF_T,
  districtAt,
  districtLots,
  inSafe,
  onRoad,
  placeVillages,
  ringOf,
  spawnable,
  wallDist,
  wallPush,
  wallSolid,
  wallTopAt,
  zoneName,
} from './layout';

const W = CFG.world;
const [w0, w1, w2] = W.walls;

describe('kapı kasabaları', () => {
  it('her surun dört yönünde birer kasaba var, adları benzersiz', () => {
    expect(DISTRICTS).toHaveLength(12);
    expect(new Set(DISTRICTS.map((d) => d.name)).size).toBe(12);
    const east = DISTRICTS.find((d) => d.ring === 1 && d.dir === 1)!;
    expect(east.x).toBeCloseTo(w1.r);
    expect(east.z).toBeCloseTo(0);
  });
  it('kasaba, surun dışında kalan yarım dairedir', () => {
    expect(districtAt(0, w1.r + 60)?.name).toBe(w1.towns[0]);
    expect(districtAt(-(w2.r + 100), 0)?.name).toBe(w2.towns[3]);
    expect(districtAt(0, w1.r - 60)).toBeNull(); // surun iç tarafı kasaba değil
    expect(districtAt(w1.r * 0.7, w1.r * 0.7)).toBeNull(); // iki kapı arası
  });
});

describe('bölgeler', () => {
  it('kasabalar kendi surunun içinden sayılır', () => {
    expect(ringOf(0, 0)).toBe(0);
    expect(ringOf(0, w0.r + 40)).toBe(0);
    expect(ringOf(0, w0.r + w0.district + 30)).toBe(1);
    expect(ringOf(0, w1.r + 100)).toBe(1);
    expect(ringOf(w1.r * 0.75, w1.r * 0.75)).toBe(2);
    expect(ringOf(0, -(w2.r + 150))).toBe(2);
    expect(ringOf(0, w2.r + w2.district + 40)).toBe(3);
  });
  it('Taç Suru kasabaları güvenli bölgedir, devler oraya doğmaz', () => {
    expect(inSafe(w0.r + 50, 0)).toBe(true);
    expect(inSafe(w0.r * 0.8, w0.r * 0.8)).toBe(false);
    expect(spawnable(0, w0.r + 60)).toBe(false);
    expect(spawnable(0, w0.r + w0.district + 120)).toBe(true);
    expect(zoneName(0, w0.r + 40)).toContain('Güvenli');
    expect(zoneName(0, w1.r + 50)).toBe(`${w1.towns[0]} Kasabası — ${w1.name}`);
    expect(zoneName(w1.r * 0.75, w1.r * 0.75)).toBe('Kalkan Ormanları');
  });
});

describe('sur gövdesi', () => {
  it('halka surda gövdeye giren dışarı itilir', () => {
    const a = Math.PI / 4;
    const p = { x: Math.sin(a) * (w1.r + 2), z: Math.cos(a) * (w1.r + 2) };
    expect(wallPush(p, 0.5, 0)).toBe(true);
    expect(Math.hypot(p.x, p.z)).toBeCloseTo(w1.r + HALF_T + 0.5);
  });
  it('dört yöndeki kapılardan ve kasabanın dış kapısından geçilir', () => {
    for (const [x, z] of [
      [0, w1.r],
      [w1.r, 0],
      [0, -w1.r],
      [-w1.r, 0],
      [0, w1.r + w1.district],
      [w2.r + w2.district, 0],
    ]) {
      const p = { x: x + 1, z };
      expect(wallPush(p, 0.5, 0), `${x},${z}`).toBe(false);
      expect(wallSolid(x, 2, z, 0.3)).toBe(false);
      expect(wallSolid(x, W.gateH + 4, z, 0.3)).toBe(true); // kapı kemeri
    }
  });
  it('kasabanın yarım daire suru da gövdedir; üstünde yürünür', () => {
    const d = DISTRICTS.find((q) => q.ring === 2 && q.dir === 2)!;
    const a = d.ang + 0.6;
    const x = d.x + Math.sin(a) * d.r;
    const z = d.z + Math.cos(a) * d.r;
    expect(wallDist(x, z)).toBeLessThan(0.01);
    expect(wallSolid(x, 5, z, 0.3)).toBe(true);
    expect(wallTopAt(x, z)).toBe(W.wallH);
    const p = { x: d.x + Math.sin(a) * (d.r - 1), z: d.z + Math.cos(a) * (d.r - 1) };
    expect(wallPush(p, 0.5, 0)).toBe(true);
    expect(Math.hypot(p.x - d.x, p.z - d.z)).toBeCloseTo(d.r - HALF_T - 0.5);
  });
  it('dünyanın kenarından dışarı çıkılmaz', () => {
    const p = { x: EDGE + 50, z: 0 };
    expect(wallPush(p, 0.5, 0)).toBe(true);
    expect(p.x).toBeCloseTo(EDGE);
  });
});

describe('köyler ve evler', () => {
  it('köyler her bölgede istenen sayıda, birbirinden, surlardan ve yollardan uzak', () => {
    const v = placeVillages(mulberry32(20261113));
    W.villages.perZone.forEach((n, i) => expect(v.filter((q) => q.zone === i + 1)).toHaveLength(n));
    for (const a of v) {
      expect(ringOf(a.x, a.z)).toBe(a.zone);
      expect(wallDist(a.x, a.z)).toBeGreaterThan(90);
      expect(onRoad(a.x, a.z, 70)).toBe(false);
      expect(districtAt(a.x, a.z)).toBeNull();
      for (const b of v) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(W.villages.spacing);
    }
  });
  it('kasaba evleri yarım dairenin içinde, surlardan ve caddeden uzak', () => {
    const rng = mulberry32(5);
    for (const d of DISTRICTS) {
      const lots = districtLots(d, rng);
      expect(lots.length, d.name).toBeGreaterThan(d.ring === 0 ? 3 : 25);
      for (const l of lots) {
        for (const [cx, cz] of [
          [l.x - l.w / 2, l.z - l.d / 2],
          [l.x + l.w / 2, l.z - l.d / 2],
          [l.x - l.w / 2, l.z + l.d / 2],
          [l.x + l.w / 2, l.z + l.d / 2],
        ]) {
          expect(districtAt(cx, cz)).toBe(d);
          expect(wallDist(cx, cz)).toBeGreaterThan(HALF_T + 4);
          expect(onRoad(cx, cz, 12)).toBe(false);
        }
      }
    }
  });
});
