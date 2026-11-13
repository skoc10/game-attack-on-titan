import { describe, expect, it } from 'vitest';
import { CFG } from '../data/config';
import { swordDamage } from './combat';
import { TitanMeter } from './titanMeter';
import { addXp, buyUpgrade, classUnlocked, MAX_UPGRADE, newSave, sanitizeSave, xpToNext } from './progression';

describe('TitanMeter', () => {
  it('dev öldürdükçe dolar ve üst sınırı aşmaz', () => {
    const m = new TitanMeter();
    m.addKill('normal');
    expect(m.value).toBe(CFG.meter.normal);
    m.addKill('elite');
    expect(m.value).toBe(CFG.meter.normal + CFG.meter.elite);
    for (let i = 0; i < 30; i++) m.addKill('normal');
    expect(m.value).toBe(m.max);
    expect(m.full).toBe(true);
  });

  it('bar yarıya gelince iğneyle dönüşülür; dolu olması gerekmez', () => {
    const m = new TitanMeter();
    m.needles = 1;
    expect(m.canTransform()).toBe(false); // bar boş
    m.value = m.max * 0.5 - 1;
    expect(m.canTransform()).toBe(false); // yarının altında
    m.value = m.max * 0.5;
    m.needles = 0;
    expect(m.canTransform()).toBe(false); // iğne yok
    expect(m.transform()).toBe(false);
    m.needles = 2;
    expect(m.transform()).toBe(true);
    expect(m.needles).toBe(1);
    expect(m.active).toBe(true);
    expect(m.value).toBe(m.max * 0.5); // biriken bar güç havuzu olur
  });

  it('güçler bar harcar; yetmeyen güç kullanılamaz', () => {
    const m = new TitanMeter();
    expect(m.spend(3)).toBe(false); // dev formunda değil
    m.value = 60;
    m.needles = 1;
    m.transform();
    expect(m.spend(CFG.titan.cost.stone)).toBe(true);
    expect(m.value).toBe(60 - CFG.titan.cost.stone);
    expect(m.spend(CFG.titan.cost.roar)).toBe(true);
    expect(m.spend(CFG.titan.cost.stone)).toBe(false); // 20 kaldı, 25 gerek
    expect(m.value).toBe(20);
    expect(m.spend(CFG.titan.cost.punch)).toBe(true);
  });

  it('dev formunda bar dolmaz, zamanla azalır ve bitince form sona erer', () => {
    const m = new TitanMeter();
    m.value = m.max;
    m.needles = 1;
    m.transform();
    m.addKill('boss');
    expect(m.value).toBe(m.max);
    expect(m.tick(10, 2)).toBe(false);
    expect(m.ratio).toBeCloseTo(0.8);
    m.hit(70);
    expect(m.tick(6, 2)).toBe(true);
    m.end();
    expect(m.active).toBe(false);
    expect(m.value).toBe(0);
    expect(m.canTransform()).toBe(false);
  });

  it('formdan erken çıkınca artan bar korunur', () => {
    const m = new TitanMeter();
    m.value = 80;
    m.needles = 1;
    m.transform();
    m.spend(15);
    m.end();
    expect(m.value).toBe(65);
    expect(m.canTransform()).toBe(false); // iğne kalmadı
  });

  it('dolum çarpanı uygulanır', () => {
    const m = new TitanMeter();
    m.addKill('normal', 1.5);
    expect(m.value).toBe(CFG.meter.normal * 1.5);
  });
});

describe('swordDamage', () => {
  it('hızla artar', () => {
    const slow = swordDamage(40, 0, 1, true);
    const fast = swordDamage(40, 28, 1, true);
    expect(slow).toBeCloseTo(16);
    expect(fast).toBeCloseTo(96);
    expect(fast).toBeGreaterThan(slow);
  });
  it('körelmiş kılıç hasarı dörtte bire düşürür, hız 50 ile sınırlanır', () => {
    expect(swordDamage(40, 14, 1, false)).toBeCloseTo(swordDamage(40, 14, 1, true) / 4);
    expect(swordDamage(40, 500, 1, true)).toBe(swordDamage(40, 50, 1, true));
  });
  it('sınıf ve bonus çarpanları uygulanır', () => {
    expect(swordDamage(40, 14, 1.35, true, 3)).toBeCloseTo(40 * 1.4 * 1.35 * 3);
  });
});

describe('ilerleme', () => {
  it('XP seviye atlatır ve puan verir', () => {
    const s = newSave();
    expect(addXp(s, xpToNext(1) - 1)).toBe(0);
    expect(addXp(s, 1)).toBe(1);
    expect(s.level).toBe(2);
    expect(s.points).toBe(1);
    expect(s.xp).toBe(0);
    expect(addXp(s, xpToNext(2) + xpToNext(3) + 5)).toBe(2);
    expect(s.level).toBe(4);
    expect(s.xp).toBe(5);
  });

  it('yükseltme puan harcar ve üst sınırda durur', () => {
    const s = newSave();
    expect(buyUpgrade(s, 'gas')).toBe(false);
    s.points = MAX_UPGRADE + 2;
    for (let i = 0; i < MAX_UPGRADE; i++) expect(buyUpgrade(s, 'gas')).toBe(true);
    expect(buyUpgrade(s, 'gas')).toBe(false);
    expect(s.upgrades.gas).toBe(MAX_UPGRADE);
    expect(s.points).toBe(2);
  });

  it('sınıflar seviyeyle açılır', () => {
    const s = newSave();
    expect(classUnlocked(s, 'nefer')).toBe(true);
    expect(classUnlocked(s, 'as')).toBe(false);
    s.level = 6;
    expect(classUnlocked(s, 'taktisyen')).toBe(true);
  });

  it('bozuk kayıt güvenli hale getirilir', () => {
    expect(sanitizeSave(null)).toEqual(newSave());
    const s = sanitizeSave({ level: 'x', xp: -5, upgrades: { gas: 99, blade: 'a' }, cls: 'taktisyen', bossDefeated: 1 });
    expect(s.level).toBe(1);
    expect(s.xp).toBe(0);
    expect(s.upgrades.gas).toBe(MAX_UPGRADE);
    expect(s.upgrades.blade).toBe(0);
    expect(s.cls).toBe('nefer'); // seviye 1'de taktisyen kilitli
    expect(s.bossDefeated).toBe(false);
    expect(sanitizeSave({ level: 7, cls: 'taktisyen' }).cls).toBe('taktisyen');
  });
});
