import { describe, expect, it } from 'vitest';
import { CFG } from '../data/config';
import { NPC_IDS, NPCS, SHOP } from '../data/npcs';
import { collapseTimes } from '../enemies/collapse';
import { GIANT_TYPES } from '../enemies/giantTypes';
import { applyContractEvent, contractProgress, currentContract, killStyle, newContractState, type Contract, type ContractEvent } from './contracts';
import { newSave, sanitizeSave } from './progression';

const kill = (over: Partial<Extract<ContractEvent, { type: 'kill' }>> = {}): ContractEvent => ({
  type: 'kill',
  giant: 'normal',
  elite: false,
  by: 'blade',
  style: null,
  ...over,
});

describe('öldürme biçimi', () => {
  it('yerdeki dev son darbe, yukarıdan alçalma dalış, hızlı geçiş kesip geçmedir', () => {
    expect(killStyle({ lying: true, above: 3, vy: -20, speed: 30 })).toBe('ground');
    expect(killStyle({ lying: false, above: 1.5, vy: -12, speed: 14 })).toBe('dive');
    expect(killStyle({ lying: false, above: 1.5, vy: -2, speed: 25 })).toBe('pass'); // alçalmıyor
    expect(killStyle({ lying: false, above: -1, vy: -12, speed: 25 })).toBe('pass'); // ensenin altında
    expect(killStyle({ lying: false, above: 0, vy: 0, speed: 5 })).toBeNull();
  });
});

describe('sözleşmeler', () => {
  const list: Contract[] = [
    { id: 'a', title: 'A', text: '', goal: 2, need: { kind: 'kill', elite: true }, reward: { coins: 10 } },
    { id: 'b', title: 'B', text: '', goal: 1, need: { kind: 'streak', n: 4 }, reward: { coins: 20 } },
  ];

  it('olay yalnızca istenen koşulu sağlarsa sayılır', () => {
    const spear: Contract = { id: 's', title: '', text: '', goal: 1, need: { kind: 'kill', giant: 'armored', by: 'spear' }, reward: { coins: 1 } };
    const dive: Contract = { id: 'd', title: '', text: '', goal: 2, need: { kind: 'kill', style: 'dive' }, reward: { coins: 1 } };
    const crate: Contract = { id: 'c', title: '', text: '', goal: 2, need: { kind: 'crate', content: 'spear' }, reward: { coins: 1 } };
    expect(contractProgress(spear, kill({ giant: 'armored' }))).toBe(0);
    expect(contractProgress(spear, kill({ giant: 'armored', by: 'spear' }))).toBe(1);
    expect(contractProgress(dive, kill({ style: 'pass' }))).toBe(0);
    expect(contractProgress(dive, kill({ style: 'dive' }))).toBe(1);
    expect(contractProgress(crate, { type: 'crate', content: 'gas' })).toBe(0);
    expect(contractProgress(crate, { type: 'crate', content: 'spear' })).toBe(1);
    expect(contractProgress(list[1], { type: 'streak', n: 3 })).toBe(0);
    expect(contractProgress(list[1], { type: 'streak', n: 5 })).toBe(1);
    expect(contractProgress(list[0], { type: 'streak', n: 9 })).toBe(0);
  });

  it('alınmamış sözleşme ilerlemez; tamamlanınca sıradakine geçilir ve liste baştan döner', () => {
    const s = newContractState();
    expect(applyContractEvent(list, s, kill({ elite: true }))).toBeNull(); // kabul edilmedi
    expect(s.progress).toBe(0);
    s.active = true;
    expect(applyContractEvent(list, s, kill())).toBeNull(); // seçkin değil
    expect(applyContractEvent(list, s, kill({ elite: true }))).toBeNull();
    expect(s.progress).toBe(1);
    expect(applyContractEvent(list, s, kill({ elite: true }))?.id).toBe('a');
    expect(s).toEqual({ index: 1, active: false, progress: 0 });
    expect(currentContract(list, s).id).toBe('b');
    s.active = true;
    expect(applyContractEvent(list, s, { type: 'streak', n: 4 })?.id).toBe('b');
    expect(currentContract(list, s).id).toBe('a'); // baştan
    expect(applyContractEvent([], newContractState(), kill())).toBeNull();
  });

  it('görev verenlerin sözleşmeleri geçerlidir ve satıcının tezgâhı fiyatlıdır', () => {
    const ids = new Set<string>();
    for (const id of NPC_IDS) {
      const n = NPCS[id];
      expect(n.id).toBe(id);
      // Hepsi şehrin içinde durur.
      expect(Math.hypot(n.x, n.z)).toBeLessThan(CFG.world.townR - 10);
      for (const c of n.contracts) {
        expect(ids.has(c.id)).toBe(false);
        ids.add(c.id);
        expect(c.goal).toBeGreaterThan(0);
        expect(c.reward.coins).toBeGreaterThan(0);
        if (c.need.kind === 'kill' && c.need.giant) expect(GIANT_TYPES[c.need.giant]).toBeDefined();
        if (c.need.kind === 'streak') expect(c.goal).toBe(1);
      }
    }
    expect(NPCS.nuran.shop).toBe(true);
    expect(NPCS.kagan.contracts.length).toBeGreaterThan(3);
    expect(NPCS.behram.contracts.length).toBeGreaterThan(3);
    expect(SHOP.length).toBeLessThanOrEqual(6); // 1–6 tuşlarına sığar
    for (const it of SHOP) expect(it.price).toBeGreaterThan(0);
  });

  it('kayıttaki sözleşme durumu temizlenir', () => {
    expect(newSave().contracts.kagan).toEqual({ index: 0, active: false, progress: 0 });
    const s = sanitizeSave({ contracts: { kagan: { index: 2, active: true, progress: 99 }, nuran: { active: true }, yok: { index: 5 } } });
    expect(s.contracts.kagan.index).toBe(2);
    expect(s.contracts.kagan.active).toBe(true);
    expect(s.contracts.kagan.progress).toBe(NPCS.kagan.contracts[2].goal - 1); // hedefi aşamaz
    expect(s.contracts.nuran.active).toBe(false); // satıcının sözleşmesi yok
    expect(sanitizeSave({ level: 3 }).contracts.behram).toEqual({ index: 0, active: false, progress: 0 });
  });
});

describe('yıkılış ve koza', () => {
  it('büyük dev daha ağır devrilir; sırtüstü düşen dizlerinin üstüne çökmez', () => {
    const small = collapseTimes(5, 1);
    const big = collapseTimes(30, 1);
    expect(big.total).toBeGreaterThan(small.total);
    expect(collapseTimes(15, -1).kneel).toBeLessThan(collapseTimes(15, 1).kneel);
    expect(small.total).toBeCloseTo(small.stagger + small.kneel + small.fall);
  });

  it('koza ayarları tutarlı', () => {
    const C = CFG.cocoon;
    expect(C.dur).toBeGreaterThan(2);
    expect(C.cooldown).toBeGreaterThan(C.dur);
    expect(C.heal * C.dur).toBeLessThan(1); // tek kozada can tamamen dolmaz
  });
});
