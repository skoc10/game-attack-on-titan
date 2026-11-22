import { CFG, type MeterKind } from '../data/config';
import type { TitanDef } from '../data/titans';

export type GiantKind = 'normal' | 'runner' | 'leaper' | 'armored' | 'crawler' | 'thrower' | 'screamer' | 'climber' | 'brute' | 'pack' | 'longarm' | 'boss' | 'shifter';
/** Kendiliğinden doğan sıradan türler (dönüşümcüler dev formlarından kurulur). */
export type CommonKind = Exclude<GiantKind, 'shifter'>;

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
  /** Koşucu gibi öne eğilip kolları geride koşar; attaki oyuncuya yetişmek için hızlanır (Kız Dev). */
  sprinter?: boolean;
  /** Dev ağaçlara tırmanır: dalda ya da yaprakların üstünde duran avına gövdeden çıkıp atılır. */
  climber?: boolean;
  /** Başını eğip avına doğru hızla toslar (yolundakini savurur). */
  charger?: boolean;
  /** Sürü hâlinde doğar: bir seferde kaç tane. */
  pack?: number;
  /** Kolunun yetiştiği mesafenin çarpanı (uzun kollu devler). */
  reach?: number;
  /** Baştan aşağı metal plaka zırh (Zırhlı Dev). */
  plating?: { color: number; trim: number; glow: number };
  /** Surlara toslayıp gedik açar (Zırhlı Dev). */
  breaker?: boolean;
  /** Canavar Dev: dev kayalar fırlatır, kaya ezip parça saçar, çevresindeki devleri yönetir. */
  shepherd?: boolean;
  /** Kürk ve boynuz (görünüş). */
  fur?: { color: number; tip: number };
  horns?: number;
}

export const GIANT_TYPES: Record<CommonKind, GiantType> = {
  normal: {
    kind: 'normal',
    name: 'Dev',
    minH: 4,
    maxH: 17,
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
  // Küçük ve çevik: dev ağaçların gövdesine sarılıp tırmanır, daldaki avına atılır.
  climber: {
    kind: 'climber',
    name: 'Tırmanıcı',
    minH: 3.5,
    maxH: 5.5,
    speed: 9,
    turn: 3.6,
    hpBase: 60,
    hpPerM: 0,
    legCuts: 1,
    napeCuts: 1,
    aggro: 170,
    dmg: 12,
    armored: false,
    meter: 'elite',
    xp: 35,
    bulk: [0.7, 0.82],
    head: [1.1, 1.3],
    arm: 1.5,
    skins: [0x9aa08a, 0x8c947e, 0xa6a896],
    downTime: 4,
    climber: true,
  },
  // Kalın, kısa boyunlu, iri omuzlu: başını eğip toslar.
  brute: {
    kind: 'brute',
    name: 'Toslayan',
    minH: 11,
    maxH: 16,
    speed: 4.8,
    turn: 1.6,
    hpBase: 170,
    hpPerM: 0,
    legCuts: 2,
    napeCuts: 1,
    aggro: 170,
    dmg: 26,
    armored: false,
    meter: 'elite',
    xp: 60,
    bulk: [1.4, 1.6],
    head: [0.78, 0.88],
    arm: 1,
    skins: [0xb07a62, 0xa46e58],
    downTime: 6,
    charger: true,
  },
  // Küçük, hızlı, sürüyle gezer: tek başına zayıf, üçü beşi bir arada tehlikeli.
  pack: {
    kind: 'pack',
    name: 'Sürü Devi',
    minH: 4,
    maxH: 6,
    speed: 10,
    turn: 3.4,
    hpBase: 55,
    hpPerM: 0,
    legCuts: 1,
    napeCuts: 1,
    aggro: 180,
    dmg: 10,
    armored: false,
    meter: 'normal',
    xp: 18,
    bulk: [0.8, 0.95],
    head: [1, 1.2],
    arm: 1.1,
    skins: [0xc8b8a8, 0xbca898, 0xd2c2b0],
    downTime: 4,
    pack: 4,
  },
  // Sırık gibi uzun, kolları dizlerini geçer: uzaktan yakalar, kancayla yaklaşanı havada kapar.
  longarm: {
    kind: 'longarm',
    name: 'Uzunkol',
    minH: 13,
    maxH: 18,
    speed: 3.8,
    turn: 1.5,
    hpBase: 130,
    hpPerM: 0,
    legCuts: 1,
    napeCuts: 1,
    aggro: 190,
    dmg: 20,
    armored: false,
    meter: 'elite',
    xp: 55,
    bulk: [0.72, 0.82],
    head: [0.78, 0.9],
    arm: 1.75,
    skins: [0xb8a89a, 0xae9c8e],
    downTime: 6,
    reach: 1.55,
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

export type BossId = 'gate' | 'bekci' | 'kadim' | 'yikici' | 'koc' | 'coban';

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
  // Canavar Dev: kürklü, kıvrık boynuzlu, sakallı, kolları uzun. Uzaktan dev kayalar atar, kaya ezip parça saçar,
  // kükreyişiyle çevresindeki devleri sürü gibi avına salar.
  coban: {
    ...GIANT_TYPES.boss,
    name: 'Canavar Dev',
    minH: 24,
    maxH: 24,
    speed: 3.6,
    turn: 1.4,
    hpBase: 3000,
    armored: false,
    legCuts: 4,
    napeCuts: 3,
    aggro: 420,
    dmg: 30,
    xp: 2000,
    bulk: [1.2, 1.2],
    head: [0.95, 0.95],
    arm: 1.55,
    skins: [0x5c483a],
    downTime: 8,
    shepherd: true,
    fur: { color: 0x4a3628, tip: 0x8a6c50 },
    horns: 0xb4a27e,
  },
  // Zırhlı Dev: baştan aşağı metal plakalı, sur ötesinde dolaşan zırhlı dev. Kollarıyla yüzünü kapatıp sura toslar, gedik açar.
  koc: {
    ...GIANT_TYPES.boss,
    name: 'Zırhlı Dev',
    minH: 19,
    maxH: 19,
    speed: 4.4,
    turn: 1.3,
    hpBase: 2600,
    armored: true,
    legCuts: 4,
    napeCuts: 3,
    aggro: 220,
    dmg: 36,
    xp: 1800,
    bulk: [1.3, 1.3],
    head: [0.9, 0.9],
    arm: 1.1,
    skins: [0x8a7a6c],
    downTime: 8,
    plating: { color: 0x5a636c, trim: 0xa8834a, glow: 0xff9a3a },
    breaker: true,
  },
  // Sur baskınının yıkıcısı: surdan uzun, ağır adımlı; suru yumruklarıyla döver. Ensesi açıktır ama beş temiz kesik ister.
  yikici: {
    ...GIANT_TYPES.boss,
    name: 'Sur Yıkan',
    minH: 64,
    maxH: 64,
    speed: 2.3,
    turn: 0.7,
    hpBase: 6500,
    armored: false,
    legCuts: 4,
    napeCuts: 5,
    aggro: 90,
    dmg: 60,
    xp: 2500,
    bulk: [1.4, 1.4],
    head: [0.85, 0.85],
    arm: 1.25,
    skins: [0x9a5a4c],
    downTime: 8,
  },
};

/**
 * Düşman dönüşümcü: oyuncunun girebildiği bir dev formuna dönüşmüş bir düşman.
 * Formun boyu ve rengiyle doğar, o formun Q/E güçlerini oyuncuya karşı kullanır.
 */
export function shifterType(form: TitanDef): GiantType {
  const armored = !!form.opts.armor;
  return {
    kind: 'shifter',
    name: form.name,
    minH: form.height,
    maxH: form.height,
    speed: form.speed * 0.42,
    turn: 2.4,
    hpBase: armored ? CFG.shifter.armoredHp : CFG.shifter.hp,
    hpPerM: 0,
    legCuts: 3,
    napeCuts: 2,
    aggro: 380,
    dmg: 26,
    armored,
    meter: 'boss',
    xp: 350,
    bulk: [form.opts.bulk ?? 1, form.opts.bulk ?? 1],
    head: [form.opts.head ?? 1, form.opts.head ?? 1],
    arm: form.opts.arm ?? 1,
    skins: [form.palette.skin],
    downTime: 6,
  };
}
