import type { HairStyle } from '../enemies/humanoid';
import type { FormId } from './titans';

export type CharId = 'aras' | 'defne' | 'bora' | 'ilkim' | 'kuzey' | 'zeren' | 'tugrul' | 'ece' | 'mete' | 'aybuke' | 'nehir' | 'kaan' | 'sena' | 'alp' | 'yigit' | 'oguz';
export const CHAR_IDS: CharId[] = ['aras', 'defne', 'bora', 'ilkim', 'kuzey', 'zeren', 'tugrul', 'ece', 'mete', 'aybuke', 'nehir', 'kaan', 'sena', 'alp', 'yigit', 'oguz'];

/**
 * Av puanıyla alınan karakter. Sayılar sınıfın değerleriyle çarpılır (1 = değişmez).
 * `titan` verilmişse karakter, bar tamamen dolunca iğnesiz olarak kendi dev formuna dönüşebilir.
 */
export interface CharDef {
  id: CharId;
  name: string;
  title: string;
  bio: string;
  /** Menüde gösterilen özellik özeti. */
  perk: string;
  price: number;
  /** Almak için gereken en az seviye (XP ile kazanılır); av puanı da yetmelidir. */
  level: number;
  hp: number;
  speed: number;
  reel: number;
  reach: number;
  gas: number;
  blades: number;
  /** Dev barının dolma hızı. */
  meter: number;
  /** Dev formunda barın tükenme hızı (küçük = uzun süre). */
  drain: number;
  /** Kendi dev formu: karakterlere özgü bir form ya da iğnesi de bulunan bir form. */
  titan: FormId | null;
  look: { skin: number; hair: number; hairStyle: HairStyle; top: number; cloak: number; eye: number };
}

const base = { level: 1, hp: 1, speed: 1, reel: 1, reach: 1, gas: 1, blades: 1, meter: 1, drain: 1, titan: null };

export const CHARACTERS: Record<CharId, CharDef> = {
  aras: {
    ...base,
    id: 'aras',
    name: 'Aras',
    title: 'Çaylak',
    bio: 'Öncü Birliği’ne katıldığı gün kapıdan çıktı.',
    perk: 'Dev barı %10 hızlı dolar',
    price: 0,
    meter: 1.1,
    look: { skin: 0xf2cfae, hair: 0x2b1d14, hairStyle: 'spiky', top: 0x34506e, cloak: 0x7a2230, eye: 0x4f8fd0 },
  },
  defne: {
    ...base,
    id: 'defne',
    name: 'Defne',
    title: 'Hat Öncüsü',
    bio: 'Sürünün önünde koşar, kimse yetişemez.',
    perk: 'Hız +%8 · kanca çekişi +%12',
    price: 150,
    speed: 1.08,
    reel: 1.12,
    look: { skin: 0xe8c4a0, hair: 0x7a3b1c, hairStyle: 'ponytail', top: 0x2f5a4a, cloak: 0x1f6a4a, eye: 0x5a8a3a },
  },
  bora: {
    ...base,
    id: 'bora',
    name: 'Bora',
    title: 'Kalkan',
    bio: 'Arkadaşlarının önünde durmayı görev bilir.',
    perk: 'Can +%35',
    price: 300,
    hp: 1.35,
    look: { skin: 0xd9a982, hair: 0x1a1614, hairStyle: 'short', top: 0x4a4f5c, cloak: 0x3a4250, eye: 0x3a2a1a },
  },
  ilkim: {
    ...base,
    id: 'ilkim',
    name: 'İlkim',
    title: 'Tüpçü',
    bio: 'Usta Behram’ın çırağı; tüplerini kendi doldurur.',
    perk: 'Gaz kapasitesi +%40',
    price: 450,
    gas: 1.4,
    look: { skin: 0xf0d2b8, hair: 0xd8b860, hairStyle: 'bob', top: 0x3a6a8a, cloak: 0x2a7aa0, eye: 0x4a9ac0 },
  },
  kuzey: {
    ...base,
    id: 'kuzey',
    name: 'Kuzey',
    title: 'Kılıç Ustası',
    bio: 'Kılıcını her akşam biler, her sabah yeniden.',
    perk: 'Kılıç erişimi +%15 · dayanımı +%50',
    price: 650,
    reach: 1.15,
    blades: 1.5,
    look: { skin: 0xe2bc98, hair: 0x8a8f98, hairStyle: 'long', top: 0x2a2c34, cloak: 0x14161c, eye: 0x9aa4b0 },
  },
  zeren: {
    ...base,
    id: 'zeren',
    name: 'Zeren',
    title: 'Gölge',
    bio: 'Surların dışında doğdu; devlerin arasında büyüdü.',
    perk: 'Hız +%5 · kendi formu: Gölge Devi',
    price: 900,
    speed: 1.05,
    titan: 'golge',
    look: { skin: 0xc99a78, hair: 0x101418, hairStyle: 'short', top: 0x263238, cloak: 0x0f4a44, eye: 0x3fe0c5 },
  },
  tugrul: {
    ...base,
    id: 'tugrul',
    name: 'Tuğrul',
    title: 'Demirci',
    bio: 'Birliğin kılıçlarını o döver. Devleri de.',
    perk: 'Can +%20 · kendi formu: Örs Devi',
    price: 1300,
    hp: 1.2,
    titan: 'ors',
    look: { skin: 0xc48a62, hair: 0x3a1c10, hairStyle: 'short', top: 0x5a3626, cloak: 0x8a2a14, eye: 0xff4a2a },
  },
  ece: {
    ...base,
    id: 'ece',
    name: 'Ece',
    title: 'Gök Gözcüsü',
    bio: 'Fırtınayı herkesten önce duyar.',
    perk: 'Dev barı %20 hızlı dolar · kendi formu: Şimşek Devi',
    price: 1700,
    meter: 1.2,
    titan: 'simsek',
    look: { skin: 0xf4dcc0, hair: 0xf2e08a, hairStyle: 'ponytail', top: 0x5a5a8a, cloak: 0xb89a20, eye: 0xffe94a },
  },
  mete: {
    ...base,
    id: 'mete',
    name: 'Mete',
    title: 'Mancınıkçı',
    bio: 'Sur topçusuydu; surlar düşünce nişan almayı bırakmadı.',
    perk: 'Gaz +%15 · kendi formu: Mancınık Devi',
    price: 2200,
    gas: 1.15,
    titan: 'mancinik',
    look: { skin: 0xb88a64, hair: 0x5a3a20, hairStyle: 'spiky', top: 0x6a5a3a, cloak: 0x7a5a2a, eye: 0xc9a06a },
  },
  aybuke: {
    ...base,
    id: 'aybuke',
    name: 'Aybüke',
    title: 'Son Simyacı',
    bio: 'Eski defterleri okuyabilen son kişi.',
    perk: 'Bar %15 hızlı dolar, formda %15 yavaş biter · kendi formu: Şafak Devi',
    price: 3200,
    meter: 1.15,
    drain: 0.85,
    titan: 'safak',
    look: { skin: 0xf6e6d8, hair: 0xf4f4f8, hairStyle: 'long', top: 0x6a6258, cloak: 0xd8d0b8, eye: 0xfff0c0 },
  },
  // Yeni devlerin formlarına sahip karakterler: hem çok av puanı hem de yüksek seviye ister.
  nehir: {
    ...base,
    id: 'nehir',
    name: 'Nehir',
    title: 'Boğa Güreşçisi',
    bio: 'Köyünde azgın boğaları omzuyla durdururdu.',
    perk: 'Can +%15 · kanca çekişi +%10 · kendi formu: Toslayan Devi',
    price: 4000,
    level: 6,
    hp: 1.15,
    reel: 1.1,
    titan: 'toslayan',
    look: { skin: 0xd8a882, hair: 0x6a2a18, hairStyle: 'ponytail', top: 0x7a3a24, cloak: 0xa8501e, eye: 0xe0703a },
  },
  kaan: {
    ...base,
    id: 'kaan',
    name: 'Kaan',
    title: 'Uzak Nişancı',
    bio: 'Kancasını herkesten uzağa atar, hiç ıskalamaz.',
    perk: 'Kılıç erişimi +%20 · gaz +%10 · kendi formu: Uzunkol Devi',
    price: 5200,
    level: 8,
    reach: 1.2,
    gas: 1.1,
    titan: 'uzunkol',
    look: { skin: 0xe6c4a4, hair: 0x2a2420, hairStyle: 'long', top: 0x2e4a50, cloak: 0x3a8a84, eye: 0x8ad0c8 },
  },
  sena: {
    ...base,
    id: 'sena',
    name: 'Sena',
    title: 'İz Sürücü',
    bio: 'Dev ağaçlar ormanında büyüdü; avcıların izini rüzgârdan okur.',
    perk: 'Hız +%12 · gaz +%15 · kendi formu: Kız Dev',
    price: 6800,
    level: 10,
    speed: 1.12,
    gas: 1.15,
    titan: 'avci',
    look: { skin: 0xc8946e, hair: 0x24140e, hairStyle: 'ponytail', top: 0x3a4a2a, cloak: 0x2a6a3a, eye: 0x7dff9a },
  },
  alp: {
    ...base,
    id: 'alp',
    name: 'Alp',
    title: 'Sur Demircisi',
    bio: 'Yıkılan surları yeniden ören ustaların başı; zırhını kendi dövdü.',
    perk: 'Can +%40 · kılıç dayanımı +%30 · kendi formu: Zırhlı Dev',
    price: 8800,
    level: 12,
    hp: 1.4,
    blades: 1.3,
    titan: 'koc',
    look: { skin: 0xb98a66, hair: 0x1a1412, hairStyle: 'short', top: 0x3c444c, cloak: 0x8a6a34, eye: 0xff9a3a },
  },
  yigit: {
    ...base,
    id: 'yigit',
    name: 'Yiğit',
    title: 'Vadi Haykırığı',
    bio: 'Sur ötesinde, yıkık bir köyde büyüdü. Kükreyişi vadide yankılanınca devler bile durup dinler.',
    perk: 'Can +%10 · kılıcı keskin: dayanımı +%50 · dev barı %15 hızlı dolar · kendi formu: Hücum Devi',
    price: 10000,
    level: 13,
    hp: 1.1,
    blades: 1.5,
    meter: 1.15,
    drain: 0.95,
    titan: 'haykiran',
    look: { skin: 0xe6c2a0, hair: 0x2a1a10, hairStyle: 'neat', top: 0x3a4a3a, cloak: 0x2f6a52, eye: 0x3fa070 },
  },
  oguz: {
    ...base,
    id: 'oguz',
    name: 'Oğuz',
    title: 'Dağ Çobanı',
    bio: 'Sur ötesinin dağlarında sürü güttü; devlerin bile onu dinlediği söylenir.',
    perk: 'Dev barı %25 hızlı dolar, formda %10 yavaş biter · kendi formu: Canavar Dev',
    price: 11500,
    level: 14,
    meter: 1.25,
    drain: 0.9,
    titan: 'coban',
    look: { skin: 0xc49a76, hair: 0x5a4030, hairStyle: 'long', top: 0x5a4a38, cloak: 0x6e5844, eye: 0xc8a070 },
  },
};
