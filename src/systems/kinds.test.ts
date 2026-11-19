import { describe, expect, it } from 'vitest';
import { BOSSES, GIANT_TYPES } from '../enemies/giantTypes';
import { CFG } from '../data/config';
import { SPAWN_TABLES } from '../world/spawner';
import { giantPerches, GIANT_TRUNK, type Tree } from '../world/forest';

describe('yeni dev türleri', () => {
  it('tırmanıcı küçüktür ve ağaca tırmanır; toslayan toslar; sürü bir arada doğar; uzunkolun eli uzaktan yetişir', () => {
    const c = GIANT_TYPES.climber;
    expect(c.climber).toBe(true);
    expect(c.maxH).toBeLessThanOrEqual(6);
    expect(c.maxH).toBeLessThan(GIANT_TYPES.normal.maxH);
    expect(GIANT_TYPES.brute.charger).toBe(true);
    expect(GIANT_TYPES.pack.pack).toBeGreaterThanOrEqual(3);
    expect(GIANT_TYPES.longarm.reach).toBeGreaterThan(1.3);
    for (const k of ['climber', 'brute', 'pack', 'longarm'] as const) {
      expect(GIANT_TYPES[k].kind).toBe(k);
      expect(GIANT_TYPES[k].napeCuts).toBe(1);
    }
  });

  it('her bölgenin doğuş tablosu toplamda 1 eder; yeni türler tablolarda yer alır', () => {
    const seen = new Set<string>();
    for (const table of Object.values(SPAWN_TABLES)) {
      expect(table.reduce((a, [, w]) => a + w, 0)).toBeCloseTo(1, 5);
      for (const [k] of table) seen.add(k);
    }
    for (const k of ['climber', 'brute', 'pack', 'longarm']) expect(seen.has(k)).toBe(true);
  });

  it('dev ağaçlar ormanında en sık doğan tür tırmanıcıdır', () => {
    const top = [...SPAWN_TABLES.forest].sort((a, b) => b[1] - a[1])[0][0];
    expect(top).toBe('climber');
  });
});

describe('dev ağacın üstü', () => {
  const t: Tree = { x: 100, z: -200, y: 0, r: 120 * GIANT_TRUNK, h: 120, kind: 2 };
  it('her dalın ucunda bir yaprak kümesi ve tepede taç vardır; hepsi gövdenin üst yarısında', () => {
    const { canopies, boughs } = giantPerches(t);
    expect(boughs).toHaveLength(8);
    expect(canopies).toHaveLength(11);
    for (const b of boughs) {
      expect(b.ax).toBeCloseTo(t.x);
      expect(b.by).toBeGreaterThan(b.ay); // dallar yukarı açılır
    }
    for (const c of canopies) {
      expect(c.y).toBeGreaterThan(t.h * 0.45);
      expect(c.y).toBeLessThan(t.h);
      expect(c.rx).toBeGreaterThan(5);
    }
  });
});

describe('Çoban Dev', () => {
  it('kürklü ve boynuzludur, kaya atar ve devleri yönetir; ensesi açıktır', () => {
    const c = BOSSES.coban;
    expect(c.shepherd).toBe(true);
    expect(c.fur).toBeDefined();
    expect(c.horns).toBeDefined();
    expect(c.armored).toBe(false);
    expect(c.arm).toBeGreaterThan(1.4);
    expect(c.aggro).toBeGreaterThan(300); // uzaktan görür ve atar
    expect(CFG.shepherd.radius).toBeGreaterThan(200);
    expect(CFG.shepherd.dur).toBeGreaterThan(10);
  });
});
