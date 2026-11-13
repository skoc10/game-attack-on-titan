import { describe, expect, it } from 'vitest';
import { CFG } from '../data/config';
import { CHARACTERS, CHAR_IDS } from '../data/characters';
import { FORMS, INNATE, INNATE_IDS, rollTitan, TITAN_IDS } from '../data/titans';
import { GIANT_TYPES } from '../enemies/giantTypes';
import { buyChar, coinsFor, newSave, ownsChar, sanitizeSave, selectChar } from './progression';
import { TitanMeter } from './titanMeter';

describe('av puanı ve karakterler', () => {
  it('her dev XP’sinin yarısı kadar av puanı verir', () => {
    expect(coinsFor(GIANT_TYPES.normal.xp)).toBe(10);
    expect(coinsFor(GIANT_TYPES.boss.xp)).toBe(250);
    expect(coinsFor(45)).toBe(23);
    expect(coinsFor(-5)).toBe(0);
  });

  it('karakter av puanıyla alınır, alınan seçilir; puan yetmezse alınmaz', () => {
    const s = newSave();
    expect(s.char).toBe('aras');
    expect(ownsChar(s, 'aras')).toBe(true);
    expect(buyChar(s, 'defne')).toBe(false); // puan yok
    expect(selectChar(s, 'defne')).toBe(false); // sahip değil
    s.coins = CHARACTERS.defne.price + 40;
    expect(buyChar(s, 'defne')).toBe(true);
    expect(s.coins).toBe(40);
    expect(s.char).toBe('defne');
    expect(buyChar(s, 'defne')).toBe(false); // ikinci kez alınmaz
    expect(s.coins).toBe(40);
    expect(selectChar(s, 'aras')).toBe(true);
    expect(s.char).toBe('aras');
    expect(s.chars).toEqual(['aras', 'defne']);
  });

  it('kayıttaki karakter listesi temizlenir', () => {
    const s = sanitizeSave({ coins: 320.7, chars: ['zeren', 'yok', 'zeren', 7], char: 'zeren' });
    expect(s.coins).toBe(320);
    expect(s.chars).toEqual(['aras', 'zeren']);
    expect(s.char).toBe('zeren');
    expect(sanitizeSave({ chars: ['defne'], char: 'aybuke' }).char).toBe('aras'); // sahip olunmayan seçilemez
    const old = sanitizeSave({ level: 4 }); // eski kayıt
    expect(old.coins).toBe(0);
    expect(old.chars).toEqual(['aras']);
  });

  it('kadro tutarlı: ilk karakter bedava, fiyatlar artar, her özgün formun tek sahibi var', () => {
    expect(CHARACTERS.aras.price).toBe(0);
    const prices = CHAR_IDS.map((id) => CHARACTERS[id].price);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
    expect(new Set(prices).size).toBe(prices.length);
    const forms = CHAR_IDS.flatMap((id) => (CHARACTERS[id].titan ? [CHARACTERS[id].titan] : []));
    expect([...forms].sort()).toEqual([...INNATE_IDS].sort());
    for (const id of CHAR_IDS) {
      const c = CHARACTERS[id];
      expect(c.id).toBe(id);
      for (const v of [c.hp, c.speed, c.reel, c.reach, c.gas, c.blades, c.meter, c.drain]) {
        expect(v).toBeGreaterThan(0.5);
        expect(v).toBeLessThan(2);
      }
    }
  });

  it('özgün formlar kutulardan çıkmaz ve güçleri tam barla kullanılabilir', () => {
    for (const id of INNATE_IDS) {
      const d = INNATE[id];
      expect(d.id).toBe(id);
      expect(d.weight).toBe(0);
      expect(FORMS[id]).toBe(d);
      for (const cost of [d.punch.cost, d.q.cost, d.e.cost, d.slam.cost]) {
        expect(cost).toBeGreaterThan(0);
        expect(cost).toBeLessThanOrEqual(CFG.meter.max / 2);
      }
    }
    for (let i = 0; i < 200; i++) expect(TITAN_IDS).toContain(rollTitan((i + 0.5) / 200));
  });
});

describe('karakterin kendi dev formu', () => {
  it('iğne istemez ama bar tamamen dolmalıdır', () => {
    const m = new TitanMeter();
    m.setInnate('golge');
    expect(m.selected).toBe('golge'); // iğne yokken kendi formu seçilir
    expect(m.usesInnate).toBe(true);
    m.value = m.max - 1;
    expect(m.canTransform()).toBe(false); // yarıyı geçmek yetmez
    expect(m.transform()).toBe(false);
    m.value = m.max;
    expect(m.transform()).toBe(true);
    expect(m.totalNeedles).toBe(0); // iğne harcanmadı
    m.spend(30);
    m.end();
    expect(m.selected).toBe('golge'); // form elde kalır
    expect(m.value).toBe(70);
    expect(m.canTransform()).toBe(false); // yeniden dolmalı
  });

  it('Tab iğneler ile kendi formu arasında dolaşır; iğneyle yarım barda dönüşülür', () => {
    const m = new TitanMeter();
    m.setInnate('safak');
    m.addNeedle('kaya');
    expect(m.selected).toBe('safak'); // yeni iğne seçimi çalmaz
    expect(m.cycle()).toBe('kaya');
    m.value = m.max / 2;
    expect(m.canTransform()).toBe(true);
    expect(m.cycle()).toBe('safak');
    expect(m.canTransform()).toBe(false);
    expect(m.cycle()).toBe('kaya');
    expect(m.transform()).toBe(true);
    expect(m.needles.kaya).toBe(0);
    m.end();
    expect(m.selected).toBe('safak'); // iğne bitince kendi formuna dönülür
  });

  it('karakter değişince seçim geçerli bir forma düşer', () => {
    const m = new TitanMeter();
    m.setInnate('ors');
    m.setInnate(null); // dev formu olmayan karaktere geçildi
    expect(m.selected).toBe('ofke');
    expect(m.has('ors')).toBe(false);
    m.addNeedle('firtina');
    m.setInnate('simsek');
    expect(m.selected).toBe('firtina'); // eldeki iğne seçili kalır
    m.clearNeedles();
    expect(m.selected).toBe('simsek');
  });
});
