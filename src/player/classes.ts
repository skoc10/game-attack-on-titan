import type { ClassId } from '../systems/progression';

export interface ClassDef {
  id: ClassId;
  name: string;
  role: string;
  desc: string;
  hp: number;
  speed: number;
  reel: number;
  dmg: number;
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
    dmg: 1,
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
    dmg: 0.9,
    gas: 1,
    ability: 'Girdap',
    abilityDesc: 'Dönerek çevresindeki her şeyi biçer.',
    abilityCd: 7,
  },
  muhafiz: {
    id: 'muhafiz',
    name: 'Muhafız',
    role: 'Güç',
    desc: 'Tek vuruşta bitirir. Ağır teçhizat gazı çabuk tüketir.',
    hp: 130,
    speed: 0.95,
    reel: 0.95,
    dmg: 1.35,
    gas: 0.8,
    ability: 'Ağır Darbe',
    abilityDesc: 'Sonraki vuruş 3 kat hasar verir ve daha uzağa erişir.',
    abilityCd: 9,
  },
  taktisyen: {
    id: 'taktisyen',
    name: 'Taktisyen',
    role: 'Destek',
    desc: 'Kılıcı zayıf, aklı keskin. Kutuları haritada görür.',
    hp: 90,
    speed: 1,
    reel: 1.05,
    dmg: 0.85,
    gas: 1.15,
    ability: 'İşaret Fişeği',
    abilityDesc: 'Yakındaki devleri işaretler ve yavaşlatır.',
    abilityCd: 14,
  },
};
