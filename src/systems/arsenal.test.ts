import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CFG } from '../data/config';
import { TITAN_IDS, TITANS } from '../data/titans';
import { GIANT_TYPES } from '../enemies/giantTypes';
import { streakMult } from './progression';

// Sandık ve mızrak modülleri sahne nesnesi kurmadan da içe aktarılabilen saf yardımcılar sunar.
import { crateColor, crateLabel, rollContent, type CrateContent } from '../world/crates';
import { segmentDistance } from '../player/spears';

describe('sandıklar', () => {
  const kinds: CrateContent[] = ['needle', 'gas', 'blade', 'spear', 'medic', 'coin'];

  it('her içerik türü zardan çıkabilir; köylerde en çok mızrak çıkar', () => {
    const count = (village: boolean) => {
      const c: Record<string, number> = {};
      for (let i = 0; i < 1000; i++) {
        const k = rollContent((i + 0.5) / 1000, village);
        c[k] = (c[k] ?? 0) + 1;
      }
      return c;
    };
    const wild = count(false);
    const village = count(true);
    for (const k of kinds) {
      expect(wild[k]).toBeGreaterThan(0);
      expect(village[k]).toBeGreaterThan(0);
    }
    expect(wild.needle).toBeGreaterThan(wild.spear);
    expect(village.spear).toBeGreaterThan(village.needle);
    expect(village.spear).toBeGreaterThan(wild.spear * 2);
    expect(rollContent(0.9999)).toBe('coin');
  });

  it('her sandık türünün ve her iğnenin ayrı bir ışık rengi ve adı vardır', () => {
    const colors = [
      ...TITAN_IDS.map((form) => crateColor({ content: 'needle', form })),
      ...kinds.filter((k) => k !== 'needle').map((content) => crateColor({ content, form: 'ofke' })),
    ];
    expect(colors).toHaveLength(TITAN_IDS.length + 5);
    expect(new Set(colors).size).toBe(colors.length);
    const labels = kinds.map((content) => crateLabel({ content, form: 'buz' }));
    expect(new Set(labels).size).toBe(labels.length);
    expect(crateLabel({ content: 'needle', form: 'isin' })).toContain(TITANS.isin.needle);
  });
});

describe('patlar mızrak', () => {
  it('ayarlar tutarlı: patlama oyuncuya da zarar verebilir, başlangıçta mızrak vardır', () => {
    const S = CFG.spear;
    expect(S.start).toBeGreaterThan(0);
    expect(S.start).toBeLessThanOrEqual(S.max);
    expect(S.perCrate).toBeLessThanOrEqual(S.max);
    expect(S.selfRadius).toBeLessThan(S.radius);
    expect(S.range).toBeGreaterThan(CFG.grapple.range);
  });

  it('noktanın gövde eksenine uzaklığı doğru hesaplanır', () => {
    const a = new THREE.Vector3(0, 0, 0);
    const b = new THREE.Vector3(0, 10, 0);
    expect(segmentDistance(new THREE.Vector3(3, 5, 0), a, b)).toBeCloseTo(3);
    expect(segmentDistance(new THREE.Vector3(0, 14, 3), a, b)).toBeCloseTo(5); // ucun ötesi
    expect(segmentDistance(new THREE.Vector3(0, -2, 0), a, b)).toBeCloseTo(2);
    expect(segmentDistance(new THREE.Vector3(1, 1, 1), a, a)).toBeCloseTo(Math.sqrt(3)); // sıfır boylu eksen
  });
});

describe('yeni dev türleri ve seri', () => {
  it('sürünen, taşçı ve çığırtkan seçkin devlerdir ve kendi davranış işaretini taşır', () => {
    expect(GIANT_TYPES.crawler.crawl).toBe(true);
    expect(GIANT_TYPES.thrower.thrower).toBe(true);
    expect(GIANT_TYPES.screamer.screamer).toBe(true);
    for (const k of ['crawler', 'thrower', 'screamer'] as const) {
      expect(GIANT_TYPES[k].meter).toBe('elite');
      expect(GIANT_TYPES[k].kind).toBe(k);
    }
    expect(GIANT_TYPES.crawler.speed).toBeGreaterThan(GIANT_TYPES.normal.speed);
    expect(GIANT_TYPES.thrower.aggro).toBeGreaterThan(GIANT_TYPES.normal.aggro);
  });

  it('iğne ağırlıkları yüze tamamlanır ve ışın gücü tanımlıdır', () => {
    expect(TITAN_IDS.reduce((n, id) => n + TITANS[id].weight, 0)).toBe(100);
    expect(TITANS.isin.q.kind).toBe('beam');
  });

  it('öldürme serisi av puanını kademeli artırır ve üst sınırda durur', () => {
    expect(streakMult(0)).toBe(1);
    expect(streakMult(1)).toBe(1);
    expect(streakMult(2)).toBe(1.25);
    expect(streakMult(5)).toBe(2);
    expect(streakMult(9)).toBe(3);
    expect(streakMult(50)).toBe(3);
    expect(streakMult(3, CFG.streak.step, CFG.streak.maxMult)).toBeGreaterThan(1);
  });
});
