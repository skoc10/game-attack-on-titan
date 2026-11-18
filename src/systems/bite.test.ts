import { describe, expect, it } from 'vitest';
import { CFG } from '../data/config';
import { FORMS, INNATE_IDS, TITAN_IDS } from '../data/titans';
import { pickMelee } from '../enemies/attacks';
import { TitanMeter } from './titanMeter';

function activeMeter(value: number) {
  const m = new TitanMeter();
  m.value = value;
  m.addNeedle('ofke');
  m.transform();
  return m;
}

describe('dev formunda bar tüketimi', () => {
  it('yerinde dururken bar azalmaz, hareket edince azalmaya devam eder', () => {
    const m = activeMeter(80);
    expect(m.tick(30, 2, false)).toBe(false);
    expect(m.value).toBe(80);
    expect(m.tick(10, 2, true)).toBe(false);
    expect(m.value).toBe(60);
    // Hareket bilgisi verilmezse eskisi gibi azalır.
    m.tick(5, 2);
    expect(m.value).toBe(50);
  });

  it('dururken bar bitmişse form yine de sona erer (darbe almak barı azaltır)', () => {
    const m = activeMeter(60);
    m.hit(70);
    expect(m.tick(0.016, 2, false)).toBe(true);
  });

  it('yumruk, formun barı bir saniyede yaktığından az harcar', () => {
    for (const id of [...TITAN_IDS, ...INNATE_IDS]) {
      const d = FORMS[id];
      expect(d.punch.cost).toBeLessThanOrEqual(3);
      // Yarım barla en az 16 yumruk atılabilmeli.
      expect((CFG.meter.max * CFG.meter.minRatio) / d.punch.cost).toBeGreaterThanOrEqual(16);
    }
  });
});

describe('ısırık', () => {
  it('dev formunun ısırığı öldürürse bar geri kazanılır, üst sınırı aşmaz', () => {
    const B = CFG.titan.bite;
    const m = activeMeter(60);
    expect(m.spend(B.cost)).toBe(true);
    m.refund(B.refund);
    expect(m.value).toBe(60 - B.cost + B.refund);
    m.refund(1000);
    expect(m.value).toBe(m.max);
    // Form bittikten sonra geri kazanım olmaz.
    m.end();
    m.value = 10;
    m.refund(B.refund);
    expect(m.value).toBe(10);
  });

  it('ısırık yumruktan sert vurur ve bedelinden fazlasını geri verir', () => {
    expect(CFG.titan.bite.dmgMult).toBeGreaterThan(1);
    expect(CFG.titan.bite.refund).toBeGreaterThan(CFG.titan.bite.cost);
    expect(CFG.bite.dmgMult).toBeGreaterThan(1);
    expect(CFG.bite.lunge).toBeLessThan(CFG.bite.windup);
  });

  it('sürünen dev hep ısırır', () => {
    const o = { titan: false, low: true, grabChance: 0, grabRoll: 0.99, biteRoll: 0.99 };
    expect(pickMelee({ ...o, crawl: true })).toBe('bite');
  });

  it('yakalama önceliklidir; yakalamayan dev yerdeki avı zarına göre ısırır ya da vurur', () => {
    const o = { crawl: false, titan: false, low: true, grabChance: 0.5 };
    expect(pickMelee({ ...o, grabRoll: 0.2, biteRoll: 0 })).toBe('grab');
    expect(pickMelee({ ...o, grabRoll: 0.8, biteRoll: CFG.bite.chance - 0.01 })).toBe('bite');
    expect(pickMelee({ ...o, grabRoll: 0.8, biteRoll: CFG.bite.chance + 0.01 })).toBe('swipe');
  });

  it('beline göre yukarıdaki avı ısıramaz', () => {
    expect(pickMelee({ crawl: false, titan: false, low: false, grabChance: 0, grabRoll: 0.5, biteRoll: 0 })).toBe('swipe');
  });

  it('dev formundaki oyuncu yakalanmaz ama ısırılabilir', () => {
    const o = { crawl: false, titan: true, low: false, grabChance: 0.85, grabRoll: 0 };
    expect(pickMelee({ ...o, biteRoll: CFG.bite.titanChance - 0.01 })).toBe('bite');
    expect(pickMelee({ ...o, biteRoll: CFG.bite.titanChance + 0.01 })).toBe('swipe');
  });

  it('ısırmayan dev zarına göre tekme atar; yukarıdaki insana tekme yetişmez, sürünen tekme atmaz', () => {
    const o = { crawl: false, grabChance: 0, grabRoll: 1, biteRoll: 1 };
    expect(pickMelee({ ...o, titan: true, low: false, kickRoll: CFG.giantKick.titanChance - 0.01 })).toBe('kick');
    expect(pickMelee({ ...o, titan: true, low: false, kickRoll: CFG.giantKick.titanChance + 0.01 })).toBe('swipe');
    expect(pickMelee({ ...o, titan: false, low: true, kickRoll: CFG.giantKick.chance - 0.01 })).toBe('kick');
    expect(pickMelee({ ...o, titan: false, low: false, kickRoll: 0 })).toBe('swipe');
    expect(pickMelee({ ...o, crawl: true, titan: true, low: true, kickRoll: 0 })).toBe('bite');
  });
});
