import { describe, expect, it } from 'vitest';
import { CFG } from '../data/config';
import { rollContent } from '../world/crates';
import { addSargi, gainHood, newInv, sanitizeInv, sightMult, takeSargi, toggleHood } from './inventory';
import { newSave, sanitizeSave } from './progression';

describe('çanta', () => {
  it('sargılar üst sınıra kadar birikir, sığmayan geri döner', () => {
    const inv = newInv();
    expect(addSargi(inv, 2)).toBe(2);
    expect(addSargi(inv, 5)).toBe(CFG.inv.sargiMax - 2);
    expect(inv.sargi).toBe(CFG.inv.sargiMax);
    expect(takeSargi(inv)).toBe(true);
    expect(inv.sargi).toBe(CFG.inv.sargiMax - 1);
    inv.sargi = 0;
    expect(takeSargi(inv)).toBe(false);
  });

  it('ilk kapşon çantaya girer ve giyilir; ikincisi yedektir', () => {
    const inv = newInv();
    expect(toggleHood(inv)).toBe(false);
    expect(gainHood(inv)).toBe('new');
    expect(inv.wear).toBe(true);
    expect(gainHood(inv)).toBe('spare');
    expect(toggleHood(inv)).toBe(true);
    expect(inv.wear).toBe(false);
    expect(toggleHood(inv)).toBe(true);
    expect(inv.wear).toBe(true);
  });

  it('kapşon devlerin fark etme mesafesini kısaltır; dev formunda ve saldırıdan sonra işe yaramaz', () => {
    expect(sightMult({ wearing: true, titan: false, revealed: false })).toBe(CFG.hood.sight);
    expect(CFG.hood.sight).toBeLessThan(1);
    expect(CFG.hood.sight).toBeGreaterThan(0);
    expect(sightMult({ wearing: false, titan: false, revealed: false })).toBe(1);
    expect(sightMult({ wearing: true, titan: true, revealed: false })).toBe(1);
    expect(sightMult({ wearing: true, titan: false, revealed: true })).toBe(1);
  });

  it('kapşon sandığı nadirdir ama hem kırda hem köyde çıkar', () => {
    for (const village of [false, true]) {
      let n = 0;
      for (let i = 0; i < 1000; i++) if (rollContent((i + 0.5) / 1000, village) === 'hood') n++;
      expect(n).toBeGreaterThan(0);
      expect(n).toBeLessThan(80);
    }
  });

  it('kayda yazılır; bozuk değerler düzeltilir, eski kayıtta boş çanta olur', () => {
    const s = newSave();
    gainHood(s.inv);
    addSargi(s.inv, 2);
    const back = sanitizeSave(JSON.parse(JSON.stringify(s)));
    expect(back.inv).toEqual({ hood: true, wear: true, sargi: 2 });
    expect(sanitizeSave({ level: 3 }).inv).toEqual(newInv());
    expect(sanitizeInv({ hood: false, wear: true, sargi: 99 })).toEqual({ hood: false, wear: false, sargi: CFG.inv.sargiMax });
  });
});
