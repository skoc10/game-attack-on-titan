import { CFG } from './config';
import type { Contract } from '../systems/contracts';
import type { HairStyle } from '../enemies/humanoid';

export type NpcId = 'nuran' | 'kagan' | 'behram';
export const NPC_IDS: NpcId[] = ['nuran', 'kagan', 'behram'];

export interface ShopItem {
  id: 'spear' | 'medic' | 'blade' | 'gas' | 'needle' | 'lucky';
  name: string;
  desc: string;
  price: number;
}

/** Levazımcının tezgâhı: av puanıyla alınır. */
export const SHOP: ShopItem[] = [
  { id: 'spear', name: 'Patlar mızrak ×2', desc: 'Zırhı deler, devi yere serer', price: 45 },
  { id: 'medic', name: 'Sargı', desc: 'Canı tamamen doldurur', price: 25 },
  { id: 'blade', name: 'Kılıç takımı', desc: 'Kılıçları yeniler', price: 15 },
  { id: 'gas', name: 'Gaz tüpü', desc: 'Gazı tamamen doldurur', price: 10 },
  { id: 'needle', name: 'Kor İğnesi', desc: 'Öfke Devi’ne dönüştürür', price: 120 },
  { id: 'lucky', name: 'Mühürlü iğne', desc: 'Rastgele bir dev iğnesi', price: 160 },
];

export interface NpcDef {
  id: NpcId;
  name: string;
  role: string;
  x: number;
  z: number;
  /** Baktığı yön. */
  yaw: number;
  greet: string;
  look: { skin: number; hair: number; hairStyle: HairStyle; top: number; legs: number; eye: number };
  shop?: boolean;
  contracts: Contract[];
}

const sz = CFG.player.spawn.z;

/** Sur içindeki kişiler: biri satıcı, ikisi sözleşme verir. Hepsi kapıya giden yolun kenarında durur. */
export const NPCS: Record<NpcId, NpcDef> = {
  nuran: {
    id: 'nuran',
    name: 'Levazımcı Nuran',
    role: 'Satıcı',
    x: 11,
    z: sz + 16,
    yaw: -Math.PI / 2,
    greet: 'Av puanın varsa tezgâh açık. Yoksa önce dışarı.',
    look: { skin: 0xe6bd98, hair: 0x8a2f1c, hairStyle: 'long', top: 0x5a6a3a, legs: 0x3a3028, eye: 0x4a6a3a },
    shop: true,
    contracts: [],
  },
  kagan: {
    id: 'kagan',
    name: 'Avcıbaşı Kağan',
    role: 'Av sözleşmeleri',
    x: -11,
    z: sz + 30,
    yaw: Math.PI / 2,
    greet: 'Sözle değil, kelleyle konuşuruz. Ne getirirsen karşılığını alırsın.',
    look: { skin: 0xc9976e, hair: 0x2a2420, hairStyle: 'short', top: 0x5a2a22, legs: 0x2e2a28, eye: 0x3a2a1a },
    contracts: [
      { id: 'k1', title: 'Sıcak Kılıç', text: 'Surların dışında 4 dev öldür.', goal: 4, need: { kind: 'kill' }, reward: { coins: 60 } },
      { id: 'k2', title: 'Seçkin Avı', text: '3 seçkin dev öldür (koşucu, sıçrayan, zırhlı, sürüngen, taşçı ya da çığırtkan).', goal: 3, need: { kind: 'kill', elite: true }, reward: { coins: 110, spears: 1 } },
      { id: 'k3', title: 'Yukarıdan', text: 'Devin üstünden alçalarak 2 dalış kesiği yap.', goal: 2, need: { kind: 'kill', style: 'dive' }, reward: { coins: 120 } },
      { id: 'k4', title: 'Taşçıyı Sustur', text: 'Kaya fırlatan bir Taşçı öldür.', goal: 1, need: { kind: 'kill', giant: 'thrower' }, reward: { coins: 90, spears: 1 } },
      { id: 'k5', title: 'Çığlığı Kes', text: 'Sürüyü çağıran bir Çığırtkan öldür.', goal: 1, need: { kind: 'kill', giant: 'screamer' }, reward: { coins: 90 } },
      { id: 'k6', title: 'Seri Avcı', text: 'Ara vermeden ×4 öldürme serisi yap.', goal: 1, need: { kind: 'streak', n: 4 }, reward: { coins: 150, needle: 'random' } },
      { id: 'k7', title: 'Kesip Geç', text: 'Hızla içinden geçerek 3 dev öldür.', goal: 3, need: { kind: 'kill', style: 'pass' }, reward: { coins: 130 } },
    ],
  },
  behram: {
    id: 'behram',
    name: 'Usta Behram',
    role: 'Teçhizat denemeleri',
    x: 12,
    z: sz + 34,
    yaw: -Math.PI / 2,
    greet: 'Yaptığım her şeyin sahada denenmesi gerek. Sen dene, ben yenisini yapayım.',
    look: { skin: 0xd8aa84, hair: 0xc8c8c8, hairStyle: 'short', top: 0x3a4a5a, legs: 0x3a342c, eye: 0x6a8aa0 },
    contracts: [
      { id: 'b1', title: 'Saha Denemesi', text: 'Patlar mızrakla 2 dev öldür (enseye yakın patlat).', goal: 2, need: { kind: 'kill', by: 'spear' }, reward: { coins: 80, spears: 2 } },
      { id: 'b2', title: 'İkmal Hattı', text: 'Surların dışında 3 sandık aç.', goal: 3, need: { kind: 'crate' }, reward: { coins: 50 } },
      { id: 'b3', title: 'Zırh Delici', text: 'Bir Zırhlı devi patlar mızrakla öldür.', goal: 1, need: { kind: 'kill', giant: 'armored', by: 'spear' }, reward: { coins: 130, spears: 2 } },
      { id: 'b4', title: 'Dev Gözüyle', text: 'Dev formundayken 4 dev öldür.', goal: 4, need: { kind: 'kill', by: 'titan' }, reward: { coins: 120, needle: 'ofke' } },
      { id: 'b5', title: 'Sürüngen Örneği', text: 'Dört ayak üstünde koşan 2 Sürüngen öldür.', goal: 2, need: { kind: 'kill', giant: 'crawler' }, reward: { coins: 100, spears: 1 } },
      { id: 'b6', title: 'Sarı Işık', text: '2 mızrak sandığı aç.', goal: 2, need: { kind: 'crate', content: 'spear' }, reward: { coins: 70 } },
    ],
  },
};
