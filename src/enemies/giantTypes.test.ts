import { describe, expect, it } from 'vitest';
import { CFG } from '../data/config';
import { TITAN_IDS, TITANS } from '../data/titans';
import { shifterType } from './giantTypes';

describe('dönüşümcüler', () => {
  it('her dev formundan, o formun boyu ve adıyla bir dönüşümcü kurulur', () => {
    for (const id of TITAN_IDS) {
      const f = TITANS[id];
      const t = shifterType(f);
      expect(t.kind).toBe('shifter');
      expect(t.name).toBe(f.name);
      expect(t.minH).toBe(f.height);
      expect(t.maxH).toBe(f.height);
      expect(t.meter).toBe('boss');
      expect(t.napeCuts).toBeGreaterThan(1);
      expect(t.speed).toBeGreaterThan(0);
    }
  });

  it('zırhlı formlar daha dayanıklıdır', () => {
    expect(shifterType(TITANS.kaya).hpBase).toBe(CFG.shifter.armoredHp);
    expect(shifterType(TITANS.ofke).hpBase).toBe(CFG.shifter.hp);
    expect(shifterType(TITANS.kaya).armored).toBe(true);
  });
});
