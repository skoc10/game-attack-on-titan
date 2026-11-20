import { describe, expect, it } from 'vitest';
import { campAt, campName, campReach, sanitizeCamps } from './camps';
import { newSave, sanitizeSave } from './progression';
import { EDGE_FOREST, edgeForest } from '../world/forest';
import { EDGE } from '../world/layout';

describe('doğuş noktaları', () => {
  const sites = [
    { kind: 'tower', x: 0, z: 0 },
    { kind: 'fort', x: 500, z: 0, name: 'Yel Karakolu' },
    { kind: 'aqueduct', x: 1000, z: 0, x2: 1000, z2: 400, name: 'Su Kemeri' },
  ];

  it('yapının erişimine girince o yapı seçilir; uzaktaysa hiçbiri', () => {
    expect(campAt(sites, 10, 5)).toBe(0);
    expect(campAt(sites, 500 + campReach('fort') - 1, 0)).toBe(1);
    expect(campAt(sites, 250, 0)).toBe(-1);
    // Su kemeri boyunca her yerden alınır.
    expect(campAt(sites, 1015, 300)).toBe(2);
  });

  it('adı yoksa türünden ad verilir', () => {
    expect(campName(sites[0])).toBe('Gözcü Kulesi');
    expect(campName(sites[1])).toBe('Yel Karakolu');
  });

  it('kayıttaki noktalar temizlenir; seçili nokta uğranmışlardan değilse şehir sayılır', () => {
    expect(sanitizeCamps([1, 1, 5, -2, 'x', 2.5], 1, 3)).toEqual({ camps: [1], camp: 1 });
    expect(sanitizeCamps([0], 2, 3)).toEqual({ camps: [0], camp: -1 });
    expect(sanitizeCamps(undefined, undefined, 3)).toEqual({ camps: [], camp: -1 });
    const s = sanitizeSave({ ...newSave(), camps: [4, 7], camp: 7 });
    expect(s.camps).toEqual([4, 7]);
    expect(s.camp).toBe(7);
    expect(newSave().camp).toBe(-1);
  });
});

describe('sınır ormanı', () => {
  it('haritanın kenarını her yönden sarar ve sınıra doğru sıklaşır', () => {
    const trees = edgeForest(() => false);
    expect(trees.length).toBeGreaterThan(20000);
    for (const t of trees) expect(Math.hypot(t.x, t.z)).toBeGreaterThanOrEqual(EDGE_FOREST.inner);
    // 36 dilimin her birinde, sınırın hemen içinde sık ağaç vardır.
    const slices = new Array(36).fill(0);
    let inner = 0;
    let dense = 0;
    for (const t of trees) {
      const r = Math.hypot(t.x, t.z);
      if (r > EDGE - 160 && r < EDGE) slices[Math.floor(((Math.atan2(t.x, t.z) + Math.PI) / (2 * Math.PI)) * 36) % 36]++;
      if (r < EDGE_FOREST.inner + 100) inner++;
      else if (r > EDGE_FOREST.dense && r < EDGE_FOREST.dense + 100) dense++;
    }
    // Dev Ağaçlar Ormanı'nın değdiği dilim dışında hepsi sık.
    expect(slices.filter((n) => n > 150).length).toBeGreaterThanOrEqual(34);
    expect(dense).toBeGreaterThan(inner * 2);
  });
});
