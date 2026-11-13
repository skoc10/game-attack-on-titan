import type { MeterKind } from '../data/config';

export type GiantKind = 'normal' | 'runner' | 'leaper' | 'armored' | 'boss';

export interface GiantType {
  kind: GiantKind;
  name: string;
  minH: number;
  maxH: number;
  speed: number;
  turn: number;
  hpBase: number;
  hpPerM: number;
  legHp: number;
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
    legHp: 45,
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
    legHp: 40,
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
    legHp: 55,
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
    legHp: 90,
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
  boss: {
    kind: 'boss',
    name: 'Kapı Kıran',
    minH: 30,
    maxH: 30,
    speed: 4.5,
    turn: 1.1,
    hpBase: 900,
    hpPerM: 0,
    legHp: 260,
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
