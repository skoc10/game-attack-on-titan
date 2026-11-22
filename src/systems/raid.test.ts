import { describe, expect, it } from 'vitest';
import { RAIDS, RAID_BY_ID, RAID_TIERS, TIERS, harderTier, tierRaid, waveSize } from '../data/raids';
import { newSave, sanitizeSave } from './progression';
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

describe('baskın zorluğu', () => {
  it('C, B, A, S sırayla zorlaşır: daha çok dev, daha iri, daha sert; ödül de artar', () => {
    expect(RAID_TIERS).toEqual(['C', 'B', 'A', 'S']);
    for (const r of RAIDS) {
      const sizes = RAID_TIERS.map((t) => tierRaid(r, t).waves.reduce((n, w) => n + waveSize(w), 0));
      const coins = RAID_TIERS.map((t) => tierRaid(r, t).reward.coins);
      for (let i = 1; i < 4; i++) {
        expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i - 1]);
        expect(coins[i]).toBeGreaterThan(coins[i - 1]);
        const [a, b] = [TIERS[RAID_TIERS[i - 1]], TIERS[RAID_TIERS[i]]];
        for (const k of ['count', 'hp', 'dmg', 'smash', 'reward'] as const) expect(b[k]).toBeGreaterThan(a[k]);
        expect(b.prep).toBeLessThan(a.prep);
      }
    }
    // B olağan baskındır: dalgalar değişmez.
    expect(tierRaid(RAID_BY_ID.degirmen, 'B').waves.map(waveSize)).toEqual(RAID_BY_ID.degirmen.waves.map(waveSize));
  });

  it('S zorlukta son dalgaya dönüşümcü katılır; sur baskınında eşlikçi artar', () => {
    const s = tierRaid(RAID_BY_ID.degirmen, 'S');
    expect(s.waves[s.waves.length - 1].shifter).toBeDefined();
    expect(tierRaid(RAID_BY_ID.yikici, 'S').escortCount!).toBeGreaterThan(RAID_BY_ID.yikici.escortCount!);
    expect(tierRaid(RAID_BY_ID.yikici, 'C').escortCount!).toBeLessThan(RAID_BY_ID.yikici.escortCount!);
  });

  it('en iyi sonuç daha zor olanla güncellenir; kayıt zorluğu korur', () => {
    expect(harderTier(undefined, 'C')).toBe('C');
    expect(harderTier('A', 'B')).toBe('A');
    expect(harderTier('A', 'S')).toBe('S');
    const sv = sanitizeSave({ ...newSave(), raids: ['degirmen', 'kuzgun'], raidTier: 'S', raidBest: { degirmen: 'A', kuzgun: 'X' } });
    expect(sv.raidTier).toBe('S');
    expect(sv.raidBest).toEqual({ degirmen: 'A', kuzgun: 'B' });
    expect(newSave().raidTier).toBe('B');
  });
});
