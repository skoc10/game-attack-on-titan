import { describe, expect, it } from 'vitest';
import { RAIDS, RAID_BY_ID, waveSize } from '../data/raids';
import { RaidState, smashDamage } from './raidState';

describe('baskın akışı', () => {
  it('üç baskın var: ikisi köy, biri sur', () => {
    expect(RAIDS).toHaveLength(3);
    expect(RAIDS.filter((r) => r.kind === 'village')).toHaveLength(2);
    expect(RAIDS.filter((r) => r.kind === 'wall')).toHaveLength(1);
    for (const r of RAIDS.filter((x) => x.kind === 'village')) {
      expect(r.waves).toHaveLength(3);
      for (const w of r.waves) expect(waveSize(w)).toBeGreaterThan(0);
    }
  });

  it('hazırlık bitince ilk dalga gelir; dalga temizlenince nefes, sonra sıradaki dalga', () => {
    const s = new RaidState(RAID_BY_ID.degirmen);
    expect(s.tick(5, 0)).toEqual([]);
    expect(s.tick(20, 0)).toEqual([{ type: 'wave', index: 0 }]);
    expect(s.tick(1, 3)).toEqual([]);
    expect(s.tick(1, 0)).toEqual([]);
    expect(s.phase).toBe('rest');
    expect(s.tick(s.def.rest + 0.1, 0)).toEqual([{ type: 'wave', index: 1 }]);
  });

  it('son dalga temizlenince baskın kazanılır', () => {
    const s = new RaidState(RAID_BY_ID.degirmen);
    s.tick(99, 0);
    s.tick(1, 0);
    s.tick(99, 0);
    s.tick(1, 0);
    expect(s.tick(99, 0)).toEqual([{ type: 'wave', index: 2 }]);
    expect(s.tick(1, 0)).toEqual([{ type: 'won' }]);
    expect(s.over).toBe(true);
    expect(s.tick(1, 0)).toEqual([]);
  });

  it('sağlamlık biterse kaybedilir; bittikten sonra hasar işlemez', () => {
    const s = new RaidState(RAID_BY_ID.yikici);
    expect(s.damage(60)).toEqual([]);
    expect(s.integrity).toBe(40);
    expect(s.damage(45)).toEqual([{ type: 'lost' }]);
    expect(s.integrity).toBe(0);
    expect(s.damage(10)).toEqual([]);
    expect(s.fail()).toEqual([]);
  });

  it('iri devler köye daha çok zarar verir; yıkıcının vuruşu sabittir', () => {
    expect(smashDamage(20, false)).toBeGreaterThan(smashDamage(8, false));
    expect(smashDamage(64, true)).toBe(smashDamage(10, true));
  });
});
