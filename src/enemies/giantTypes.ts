import type { MeterKind } from '../data/config';

export type GiantKind = 'normal' | 'runner' | 'leaper' | 'armored' | 'crawler' | 'thrower' | 'screamer' | 'boss';

export interface GiantType {
  kind: GiantKind;
  name: string;
  minH: number;
  maxH: number;
  speed: number;
  turn: number;
  hpBase: number;
  hpPerM: number;
  /** Yere düşürmek için gereken bacak kesiği sayısı. */
  legCuts: number;
  /** Öldürmek için gereken temiz ense kesiği sayısı. */
  napeCuts: number;
  aggro: number;
  dmg: number;
  armored: boolean;
  meter: MeterKind;
  xp: number;
  bulk: [number, number];
  head: [number, number];
  arm: number;
  skins: number[];
  downTime: number;
  /** Dört ayak üstünde sürünür: ensesi alçaktadır ama çok hızlıdır. */
  crawl?: boolean;
  /** Uzaktan kaya fırlatır. */
  thrower?: boolean;
  /** Avını görünce çığlık atıp başka devleri çağırır. */
  screamer?: boolean;
}

export const GIANT_TYPES: Record<GiantKind, GiantType> = {
  normal: {
    kind: 'normal',
    name: 'Dev',
    minH: 4,
    maxH: 15,
    speed: 4.2,
    turn: 1.8,
    hpBase: 60,
    hpPerM: 4,
    legCuts: 1,
    napeCuts: 1,
    aggro: 130,
    dmg: 14,
    armored: false,
    meter: 'normal',
    xp: 20,
    bulk: [0.9, 1.45],
    head: [1, 1.5],
    arm: 1,
    skins: [0xc9a58c, 0xbf9a86, 0xd4b49e, 0xb08f7c],
    downTime: 6,
  },
  runner: {
    kind: 'runner',
    name: 'Koşucu',
    minH: 6,
    maxH: 9,
    speed: 13,
    turn: 3.6,
    hpBase: 95,
    hpPerM: 0,
    legCuts: 1,
    napeCuts: 1,
    aggro: 170,
    dmg: 16,
    armored: false,
    meter: 'elite',
    xp: 40,
    bulk: [0.75, 0.9],
    head: [0.9, 1.1],
    arm: 1.3,
    skins: [0xd9cfc4, 0xcfc2b4],
    downTime: 5,
  },
  leaper: {
    kind: 'leaper',
    name: 'Sıçrayan',
    minH: 7,
    maxH: 10,
    speed: 6.5,
    turn: 2.6,
    hpBase: 110,
    hpPerM: 0,
    legCuts: 1,
    napeCuts: 1,
    aggro: 160,
    dmg: 20,
    armored: false,
    meter: 'elite',
    xp: 45,
    bulk: [0.95, 1.1],
    head: [0.85, 1],
    arm: 1.15,
    skins: [0x9c8f86, 0x8f8478],
    downTime: 5,
  },
  armored: {
    kind: 'armored',
    name: 'Zırhlı',
    minH: 10,
    maxH: 14,
    speed: 4.6,
    turn: 1.6,
    hpBase: 150,
    hpPerM: 0,
    legCuts: 2,
    napeCuts: 1,
    aggro: 140,
    dmg: 24,
    armored: true,
    meter: 'elite',
    xp: 60,
    bulk: [1.2, 1.35],
    head: [1, 1.1],
    arm: 1,
    skins: [0xa98f7e, 0x9d8474],
    downTime: 7,
  },
  crawler: {
    kind: 'crawler',
    name: 'Sürüngen',
    minH: 8,
    maxH: 12,
    speed: 11,
    turn: 3.2,
    hpBase: 100,
    hpPerM: 0,
    legCuts: 1,
    napeCuts: 1,
    aggro: 160,
    dmg: 18,
    armored: false,
    meter: 'elite',
    xp: 45,
    bulk: [0.85, 1],
    head: [1.05, 1.25],
    arm: 0.95,
    skins: [0x8d9482, 0x7f8a78],
    downTime: 5,
    crawl: true,
  },
  thrower: {
    kind: 'thrower',
    name: 'Taşçı',
    minH: 12,
    maxH: 16,
    speed: 3.4,
    turn: 1.7,
    hpBase: 140,
    hpPerM: 0,
    legCuts: 1,
    napeCuts: 1,
    aggro: 200,
    dmg: 22,
    armored: false,
    meter: 'elite',
    xp: 55,
    bulk: [1.05, 1.2],
    head: [0.85, 0.95],
    arm: 1.35,
    skins: [0xa8876a, 0x9a7a5e],
    downTime: 6,
    thrower: true,
  },
  screamer: {
    kind: 'screamer',
    name: 'Çığırtkan',
    minH: 8,
    maxH: 11,
    speed: 5.2,
    turn: 2.4,
    hpBase: 100,
    hpPerM: 0,
    legCuts: 1,
    napeCuts: 1,
    aggro: 190,
    dmg: 16,
    armored: false,
    meter: 'elite',
    xp: 50,
    bulk: [0.8, 0.92],
    head: [1.25, 1.4],
    arm: 1.1,
    skins: [0xe6d6cf, 0xdccac4],
    downTime: 5,
    screamer: true,
  },
  boss: {
    kind: 'boss',
    name: 'Kapı Kıran',
    minH: 30,
    maxH: 30,
    speed: 4.5,
    turn: 1.1,
    hpBase: 900,
    hpPerM: 0,
    legCuts: 4,
    napeCuts: 3,
    aggro: 260,
    dmg: 34,
    armored: true,
    meter: 'boss',
    xp: 500,
    bulk: [1.3, 1.3],
    head: [1, 1],
    arm: 1.05,
    skins: [0x8c6a5c],
    downTime: 9,
  },
};

export type BossId = 'gate' | 'bekci' | 'kadim';

/** Bölüm sonu devleri: aynı gövde ve davranış, farklı boy ve dayanıklılık. */
export const BOSSES: Record<BossId, GiantType> = {
  gate: GIANT_TYPES.boss,
  bekci: {
    ...GIANT_TYPES.boss,
    name: 'Sur Bekçisi',
    minH: 36,
    maxH: 36,
    speed: 5,
    hpBase: 1300,
    legCuts: 5,
    dmg: 40,
    xp: 800,
    skins: [0x6f6a66],
  },
  kadim: {
    ...GIANT_TYPES.boss,
    name: 'Kadim Dev',
    minH: 44,
    maxH: 44,
    speed: 5.4,
    hpBase: 1900,
    legCuts: 6,
    napeCuts: 4,
    aggro: 320,
    dmg: 46,
    xp: 1500,
    skins: [0x5a4a52],
  },
};
