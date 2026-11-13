import type { ClassId } from '../systems/progression';

export interface ClassDef {
  id: ClassId;
  name: string;
  role: string;
  desc: string;
  hp: number;
  speed: number;
  reel: number;
  /** Kılıç erişim çarpanı. */
  reach: number;
  gas: number;
  ability: string;
  abilityDesc: string;
  abilityCd: number;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  nefer: {
    id: 'nefer',
    name: 'Nefer',
    role: 'Dengeli',
    desc: 'Her işe yatkın sıradan asker. Öfkesi çabuk kabarır.',
    hp: 100,
    speed: 1,
    reel: 1,
    reach: 1,
    gas: 1,
    ability: 'İkinci Nefes',
    abilityDesc: 'Anında can tazeler, kısa süre hasar almaz.',
    abilityCd: 25,
  },
  as: {
    id: 'as',
    name: 'As',
    role: 'Hız',
    desc: 'Birliğin en hızlısı. Kırılgan ama durdurulamaz.',
    hp: 75,
    speed: 1.12,
    reel: 1.3,
    reach: 0.95,
    gas: 1,
    ability: 'Girdap',
    abilityDesc: 'Dönerek çevresindeki her şeyi biçer.',
    abilityCd: 7,
  },
  muhafiz: {
    id: 'muhafiz',
    name: 'Muhafız',
    role: 'Güç',
    desc: 'Uzun kılıçlar, geniş erişim. Ağır teçhizat az gaz taşır.',
    hp: 130,
    speed: 0.95,
    reel: 0.95,
    reach: 1.2,
    gas: 0.8,
    ability: 'Ağır Darbe',
    abilityDesc: 'Sonraki vuruş zırhı deler: zırhlı devi ayaktayken de keser.',
    abilityCd: 9,
  },
  taktisyen: {
    id: 'taktisyen',
    name: 'Taktisyen',
    role: 'Destek',
    desc: 'Kılıcı kısa, aklı keskin. Kutuları haritada görür.',
    hp: 90,
    speed: 1,
    reel: 1.05,
    reach: 0.9,
    gas: 1.15,
    ability: 'İşaret Fişeği',
    abilityDesc: 'Yakındaki devleri işaretler ve yavaşlatır.',
    abilityCd: 14,
  },
};
