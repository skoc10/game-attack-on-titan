import { describe, expect, it } from 'vitest';
import { stickVector, touchLayout, touchText, type TouchCtx } from './touchLayout';

const base = (o: Partial<TouchCtx> = {}): TouchCtx => ({
  mode: 'foot',
  dead: false,
  talking: false,
  grabbed: false,
  cocoon: false,
  canTransform: false,
  formChoices: 0,
  interact: '',
  hooked: false,
  aimHook: false,
  spears: 2,
  ability: 'Fırtına',
  abilityCd: 0,
  cocoonCd: 0,
  sargi: 0,
  ...o,
});

const pw = (name: string, cost: number, cd = 0) => ({ name, cost, cd });

describe('stickVector', () => {
  it('ölü bölgede sıfırdır', () => {
    expect(stickVector(5, -3, 60, 8)).toEqual({ x: 0, y: 0, mag: 0 });
  });
  it('yukarı itmek ileri demektir ve yarıçapta tam güce ulaşır', () => {
    const v = stickVector(0, -60, 60, 8);
    expect(v.y).toBeCloseTo(1);
    expect(v.x).toBeCloseTo(0);
    expect(v.mag).toBe(1);
  });
  it('yarıçapın dışı da tam güçtür, yön korunur', () => {
    const v = stickVector(200, 0, 60, 8);
    expect(v).toEqual({ x: 1, y: -0, mag: 1 });
  });
  it('arada doğrusal büyür', () => {
    expect(stickVector(0, 34, 60, 8).mag).toBeCloseTo(0.5);
  });
});

describe('touchLayout', () => {
  it('yürürken temel tuşlar görünür, bağlama bağlı olanlar gizlidir', () => {
    const l = touchLayout(base());
    expect(Object.keys(l).sort()).toEqual(['atk', 'jump', 'o2', 'o3', 'r1', 'r2']);
    expect(l.atk?.label).toBe('KILIÇ');
    expect(l.r1?.label).toBe('FIRTINA');
  });
  it('nişanda tutunacak yer varsa saldırı tuşu kanca olur, takılıyken zıplama fırlatır', () => {
    expect(touchLayout(base({ aimHook: true })).atk?.label).toBe('KANCA');
    expect(touchLayout(base({ hooked: true })).jump?.label).toBe('FIRLA');
  });
  it('etkileşim, dönüşüm, iğne ve sargı yalnızca işe yarayınca çıkar', () => {
    const l = touchLayout(base({ interact: 'open', canTransform: true, formChoices: 2, sargi: 3 }));
    expect(l.r3?.label).toBe('AÇ');
    expect(l.o1?.label).toBe('DÖNÜŞ');
    expect(l.o4?.label).toBe('İĞNE');
    expect(l.o5?.sub).toBe('×3');
  });
  it('atlıyken atı çağırma tuşu yok, zıplama attan indirir', () => {
    const l = touchLayout(base({ mode: 'mounted', interact: 'dismount' }));
    expect(l.o2).toBeUndefined();
    expect(l.jump?.label).toBe('İN');
    expect(l.r3?.label).toBe('İN');
  });
  it('bekleme süresi ve biten mızrak tuşu soluklaştırır', () => {
    const l = touchLayout(base({ abilityCd: 3.2, spears: 0 }));
    expect(l.r1).toMatchObject({ off: true, sub: '4 sn' });
    expect(l.r2?.off).toBe(true);
  });
  it('yakalanınca yalnızca kurtulma tuşları kalır', () => {
    const l = touchLayout(base({ grabbed: true, canTransform: true }));
    expect(Object.keys(l).sort()).toEqual(['atk', 'jump', 'o1']);
    expect(l.atk?.label).toBe('KES');
  });
  it('dev formunda güç adları, bedelleri ve yetmeyen bar gösterilir', () => {
    const l = touchLayout(
      base({
        mode: 'titan',
        titan: { meter: 2, punch: pw('Yumruk', 1.5), q: pw('Kaya', 6), e: pw('Kalkan', 1, 4), slam: pw('Tepin', 2), bite: pw('Isırık', 4) },
      }),
    );
    expect(l.atk).toEqual({ label: 'YUMRUK', sub: '−1,5', off: false });
    expect(l.r2?.off).toBe(true); // bar yetmiyor
    expect(l.r3).toMatchObject({ off: true, sub: '4 sn' }); // bekliyor
    expect(l.o1?.label).toBe('ÇIK');
    expect(l.r1).toBeUndefined();
    expect(l.o3).toBeUndefined();
  });
  it('dev formunda gard ve tekme tuşları kendi tuşlarını taklit eder', () => {
    const l = touchLayout(
      base({
        mode: 'titan',
        titan: { meter: 50, punch: pw('Yumruk', 1.5), q: pw('Kaya', 6), e: pw('Kalkan', 1), slam: pw('Tepin', 2), bite: pw('Isırık', 4), kick: pw('Tekme', 2, 1), guarding: true },
      }),
    );
    expect(l.o3).toMatchObject({ label: 'GARD', sub: 'açık', code: 'KeyG' });
    expect(l.o4).toMatchObject({ label: 'TEKME', off: true, code: 'KeyV' });
  });
  it('konuşurken ve ölüyken tuş yok; kozadayken yalnızca kırma tuşu', () => {
    expect(touchLayout(base({ talking: true }))).toEqual({});
    expect(touchLayout(base({ dead: true }))).toEqual({});
    expect(Object.keys(touchLayout(base({ cocoon: true })))).toEqual(['o3']);
  });
});

describe('sur topu', () => {
  it('top başında yalnızca ATEŞ ve İN tuşları kalır; dolarken ATEŞ soluk', () => {
    const l = touchLayout(base({ cannon: { cd: 0, ready: true } }));
    expect(Object.keys(l).sort()).toEqual(['atk', 'jump']);
    expect(l.atk).toMatchObject({ label: 'ATEŞ', off: false });
    expect(touchLayout(base({ cannon: { cd: 1, ready: true } })).atk?.off).toBe(true);
    expect(touchLayout(base({ interact: 'cannon' })).r3?.label).toBe('TOP');
  });
});

describe('touchText', () => {
  it('klavye tuşlarını ekran tuşlarının adlarıyla değiştirir', () => {
    expect(touchText('Atına bin (F ile çağır, E ile bin)')).toBe('Atına bin (AT tuşuyla çağır, BİN tuşuyla bin)');
    expect(touchText('Tab ile Kaya’yı seç ve dönüş (T)')).toBe('İĞNE tuşuyla Kaya’yı seç ve dönüş (DÖNÜŞ)');
    expect(touchText('Patlar mızrak +1 — Q ile fırlat')).toBe('Patlar mızrak +1 — MIZRAK tuşuyla fırlat');
    expect(touchText('Gaz yok — kılıçla kes (sol tık)')).toBe('Gaz yok — kılıçla kes (KES tuşu)');
  });
  it('tuş anmayan metne dokunmaz', () => {
    expect(touchText('Taç Suru kapısından dışarı çık')).toBe('Taç Suru kapısından dışarı çık');
  });
});
