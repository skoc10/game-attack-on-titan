import { describe, expect, it } from 'vitest';
import { CFG } from '../data/config';
import { TITAN_IDS, TITANS, rollTitan } from '../data/titans';
import { GIANT_TYPES } from '../enemies/giantTypes';
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
    m.addNeedle('ofke');
    expect(m.canTransform()).toBe(false); // bar boş
    m.value = m.max * 0.5 - 1;
    expect(m.canTransform()).toBe(false); // yarının altında
    m.value = m.max * 0.5;
    m.needles.ofke = 0;
    expect(m.canTransform()).toBe(false); // iğne yok
    expect(m.transform()).toBe(false);
    m.addNeedle('ofke', 2);
    expect(m.transform()).toBe(true);
    expect(m.needles.ofke).toBe(1);
    expect(m.active).toBe(true);
    expect(m.value).toBe(m.max * 0.5); // biriken bar güç havuzu olur
  });

  it('her iğne türü ayrı sayılır; dönüşüm yalnızca seçili türü harcar', () => {
    const m = new TitanMeter();
    m.value = m.max;
    m.addNeedle('kaya');
    expect(m.selected).toBe('kaya'); // elde başka iğne yokken yeni gelen seçilir
    m.addNeedle('firtina', 2);
    expect(m.selected).toBe('kaya'); // seçim kendiliğinden değişmez
    expect(m.totalNeedles).toBe(3);
    expect(m.transform()).toBe(true);
    expect(m.needles).toEqual({ ofke: 0, firtina: 2, kaya: 0, zirve: 0 });
    m.end();
    expect(m.selected).toBe('firtina'); // seçili tür bitince elde olana geçilir
  });

  it('Tab yalnızca eldeki iğne türleri arasında dolaşır', () => {
    const m = new TitanMeter();
    expect(m.cycle()).toBe('ofke'); // hiç iğne yok: değişmez
    m.addNeedle('ofke');
    m.addNeedle('zirve');
    expect(m.cycle()).toBe('zirve'); // firtina ve kaya atlanır
    expect(m.cycle()).toBe('ofke');
    m.needles.zirve = 0;
    expect(m.cycle()).toBe('ofke'); // tek tür kaldı
    m.clearNeedles();
    expect(m.totalNeedles).toBe(0);
  });

  it('güçler bar harcar; yetmeyen güç kullanılamaz', () => {
    const m = new TitanMeter();
    const { q, e, punch } = TITANS.ofke;
    expect(m.spend(3)).toBe(false); // dev formunda değil
    m.value = 60;
    m.addNeedle('ofke');
    m.transform();
    expect(m.spend(e.cost)).toBe(true);
    expect(m.value).toBe(60 - e.cost);
    expect(m.spend(q.cost)).toBe(true);
    expect(m.spend(e.cost)).toBe(false); // 20 kaldı, 25 gerek
    expect(m.value).toBe(20);
    expect(m.spend(punch.cost)).toBe(true);
  });

  it('dev formunda bar dolmaz, zamanla azalır ve bitince form sona erer', () => {
    const m = new TitanMeter();
    m.value = m.max;
    m.addNeedle('ofke');
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
    m.addNeedle('ofke');
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

describe('dev formları', () => {
  it('kutu zarı her türü ağırlığına göre verir', () => {
    expect(rollTitan(0)).toBe('ofke');
    expect(rollTitan(0.999)).toBe('zirve');
    const counts: Record<string, number> = {};
    for (let i = 0; i < 1000; i++) {
      const id = rollTitan((i + 0.5) / 1000);
      counts[id] = (counts[id] ?? 0) + 1;
    }
    for (const id of TITAN_IDS) expect(counts[id]).toBe(Math.round(TITANS[id].weight * 10));
  });

  it('her formun güçleri en az yarım barla kullanılabilir', () => {
    for (const id of TITAN_IDS) {
      const d = TITANS[id];
      const half = CFG.meter.max * CFG.meter.minRatio;
      for (const cost of [d.punch.cost, d.q.cost, d.e.cost, d.slam.cost]) {
        expect(cost).toBeGreaterThan(0);
        expect(cost).toBeLessThanOrEqual(half);
      }
      expect(d.drain).toBeGreaterThan(0);
    }
  });
});

describe('dev türleri', () => {
  it('sıradan ve elit devler tek ense kesiğiyle ölür; yalnızca bölüm sonu devi fazlasını ister', () => {
    for (const t of Object.values(GIANT_TYPES)) {
      expect(t.napeCuts).toBe(t.kind === 'boss' ? 3 : 1);
      expect(t.legCuts).toBeGreaterThanOrEqual(1);
    }
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
