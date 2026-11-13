import type { HumanoidOpts, Palette } from '../enemies/humanoid';

export type TitanId = 'ofke' | 'firtina' | 'kaya' | 'zirve';
export const TITAN_IDS: TitanId[] = ['ofke', 'firtina', 'kaya', 'zirve'];

/** Bir dev formu gücü. Her tür, aynı kodla farklı sayılarla çalışır. */
export type Ability =
  /** Çevredeki devleri sersemletir. */
  | { kind: 'stun'; name: string; cost: number; cd: number; radius: number; stun: number }
  /** Bir süre yumrukları güçlendirir ve zırh kırdırır. */
  | { kind: 'buff'; name: string; cost: number; cd: number; dur: number; mult: number }
  /** Baktığı yöne atılır; yolundaki her şeye çarpar. */
  | { kind: 'rush'; name: string; cost: number; cd: number; speed: number; time: number; dmg: number; hitRadius: number; armorBreak: boolean }
  /** Çevresine anlık hasar verir, ayakta kalanı sersemletir. */
  | { kind: 'burst'; name: string; cost: number; cd: number; radius: number; dmg: number; stun: number; armorBreak: boolean }
  /** Nişan alınan yere kaya fırlatır. */
  | { kind: 'throw'; name: string; cost: number; cd: number; dmg: number; radius: number; speed: number };

export interface TitanDef {
  id: TitanId;
  name: string;
  /** Bu forma dönüştüren iğnenin adı. */
  needle: string;
  tagline: string;
  /** İğne, ışık sütunu ve parıltı rengi. */
  color: number;
  height: number;
  radius: number;
  speed: number;
  sprint: number;
  /** 0 ise zıplayamaz; Space olduğu yerde tepinir. */
  jump: number;
  gravity: number;
  /** Dev formunda barın saniyede azalma miktarı. */
  drain: number;
  /** Alınan hasarın bara etkisi (küçük = dayanıklı). */
  armor: number;
  camDist: number;
  punch: { name: string; dmg: number; range: number; reach: number; time: number; cost: number; armorBreak: boolean };
  q: Ability;
  e: Ability;
  slam: { name: string; cost: number; radius: number; dmg: number };
  /** Kutudan çıkma ağırlığı. */
  weight: number;
  palette: Palette;
  opts: HumanoidOpts;
}

export const TITANS: Record<TitanId, TitanDef> = {
  // Dengeli dövüşçü: ilk form.
  ofke: {
    id: 'ofke',
    name: 'Öfke Devi',
    needle: 'Kor İğnesi',
    tagline: 'Yumrukla, kükre, ez.',
    color: 0xff7a1a,
    height: 15,
    radius: 2.6,
    speed: 15,
    sprint: 22,
    jump: 24,
    gravity: 42,
    drain: 1.6,
    armor: 1,
    camDist: 30,
    punch: { name: 'Yumruk', dmg: 130, range: 8, reach: 6, time: 0.5, cost: 3, armorBreak: false },
    q: { kind: 'stun', name: 'Kükreme', cost: 15, cd: 12, radius: 70, stun: 5 },
    e: { kind: 'buff', name: 'Taş Yumruk', cost: 25, cd: 20, dur: 8, mult: 2.5 },
    slam: { name: 'Ezme', cost: 10, radius: 14, dmg: 80 },
    weight: 46,
    palette: { skin: 0x9a7362, top: 0x8a6557, legs: 0x7a584c, hair: 0x1a1412, hairStyle: 'spiky', eye: 0xff7a1a, glow: 0xff7a1a },
    opts: { style: 'titan', outline: 0.0028, bulk: 1.15, head: 0.95, arm: 1.1, cracks: true },
  },
  // Küçük ve çevik: hızlı vurur, uzağa atılır, barı çabuk yakar, darbeye dayanıksız.
  firtina: {
    id: 'firtina',
    name: 'Fırtına Devi',
    needle: 'Rüzgâr İğnesi',
    tagline: 'Hızlı vur, durma.',
    color: 0x58c8ff,
    height: 11,
    radius: 2,
    speed: 22,
    sprint: 32,
    jump: 34,
    gravity: 46,
    drain: 2,
    armor: 1.4,
    camDist: 24,
    punch: { name: 'Pençe', dmg: 85, range: 6, reach: 4.5, time: 0.28, cost: 2, armorBreak: false },
    q: { kind: 'rush', name: 'Atılım', cost: 10, cd: 3, speed: 80, time: 0.38, dmg: 150, hitRadius: 5, armorBreak: false },
    e: { kind: 'burst', name: 'Girdap', cost: 16, cd: 6, radius: 13, dmg: 170, stun: 1.5, armorBreak: false },
    slam: { name: 'Dalış', cost: 8, radius: 12, dmg: 110 },
    weight: 22,
    palette: { skin: 0xb4c0cc, top: 0x9fb0c0, legs: 0x8a9cae, hair: 0xe8eef4, hairStyle: 'long', eye: 0x58c8ff, glow: 0x58c8ff },
    opts: { style: 'titan', outline: 0.0034, bulk: 0.84, head: 1, arm: 1.2, cracks: true },
  },
  // Taş zırhlı ağır form: yavaş ama darbelere çok dayanıklı; her vuruşu zırh kırar.
  kaya: {
    id: 'kaya',
    name: 'Kaya Devi',
    needle: 'Taş İğnesi',
    tagline: 'Hiçbir şey seni durduramaz.',
    color: 0x8fdc6a,
    height: 17,
    radius: 3.2,
    speed: 10,
    sprint: 15,
    jump: 16,
    gravity: 44,
    drain: 1.2,
    armor: 0.3,
    camDist: 34,
    punch: { name: 'Ağır Yumruk', dmg: 190, range: 8.5, reach: 6.5, time: 0.7, cost: 5, armorBreak: true },
    q: { kind: 'rush', name: 'Koç Hücumu', cost: 18, cd: 8, speed: 36, time: 1.4, dmg: 260, hitRadius: 6.5, armorBreak: true },
    e: { kind: 'burst', name: 'Deprem', cost: 22, cd: 12, radius: 28, dmg: 120, stun: 4, armorBreak: true },
    slam: { name: 'Ezme', cost: 10, radius: 16, dmg: 110 },
    weight: 20,
    palette: { skin: 0x86837a, top: 0x767469, legs: 0x6a685e, eye: 0x8fdc6a, glow: 0x8fdc6a },
    opts: { style: 'titan', outline: 0.0026, bulk: 1.42, head: 0.85, arm: 1.05, armor: true, plateColor: 0x5d6156, cracks: true },
  },
  // En büyük form: çok yavaş, zıplayamaz; uzaktan kaya fırlatır, geniş alanı sarsar.
  zirve: {
    id: 'zirve',
    name: 'Zirve Devi',
    needle: 'Doruk İğnesi',
    tagline: 'Uzaktan ez, yeri sars.',
    color: 0xb07cff,
    height: 26,
    radius: 4.6,
    speed: 7.5,
    sprint: 10.5,
    jump: 0,
    gravity: 44,
    drain: 2.4,
    armor: 0.6,
    camDist: 48,
    punch: { name: 'Süpürme', dmg: 170, range: 15, reach: 11, time: 0.9, cost: 6, armorBreak: false },
    q: { kind: 'throw', name: 'Kaya Fırlat', cost: 14, cd: 4, dmg: 260, radius: 13, speed: 75 },
    e: { kind: 'burst', name: 'Sarsıntı', cost: 25, cd: 16, radius: 46, dmg: 60, stun: 6, armorBreak: false },
    slam: { name: 'Tepinme', cost: 10, radius: 20, dmg: 100 },
    weight: 12,
    palette: { skin: 0x8f8497, top: 0x7f7488, legs: 0x6f6578, hair: 0x221a2a, hairStyle: 'long', eye: 0xb07cff, glow: 0xb07cff },
    opts: { style: 'titan', outline: 0.002, bulk: 1.25, head: 0.8, arm: 1.15, cracks: true },
  },
};

/** 0..1 arası bir zarla, ağırlıklara göre bir form seçer (kutulardaki iğne türü). */
export function rollTitan(roll: number): TitanId {
  const total = TITAN_IDS.reduce((sum, id) => sum + TITANS[id].weight, 0);
  let acc = 0;
  for (const id of TITAN_IDS) {
    acc += TITANS[id].weight / total;
    if (roll < acc) return id;
  }
  return 'ofke';
}

export const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
