import { CFG } from './config';
import type { FormId, TitanDef } from './titans';
import { shifterType, type GiantType } from '../enemies/giantTypes';

/**
 * Avcı Dev: dev ağaçlar ormanında dolaşan, atlıları kovalayan dişi dev.
 * Gövdesi derisiz, kasları dışarıda; koyu at kuyruklu, gözleri yeşil yanar.
 * Atılıp çarpar, yeri dövüp ağaçları sarsar; ensesine üç temiz kesik gerekir.
 */
export const HUNTRESS: TitanDef = {
  // Oyuncunun girebildiği bir form değildir; yalnızca düşman olarak doğar.
  id: 'avci' as FormId,
  name: 'Avcı Dev',
  needle: '',
  tagline: 'Ormanın avcısı.',
  color: 0x7dff9a,
  height: 22,
  radius: 3,
  // Kovalarken atın tırısından hızlı, dörtnalına yakın koşar.
  speed: 31,
  sprint: 40,
  jump: 0,
  gravity: 44,
  drain: 0,
  armor: 1,
  camDist: 40,
  punch: { name: 'Pençe', dmg: 120, range: 8, reach: 6, time: 0.4, cost: 0, armorBreak: false },
  q: { kind: 'rush', name: 'Av Atılımı', cost: 0, cd: 7, speed: 58, time: 1.1, dmg: 0, hitRadius: 7, armorBreak: false },
  e: { kind: 'burst', name: 'Kök Sarsıntısı', cost: 0, cd: 11, radius: 34, dmg: 0, stun: 2.5, armorBreak: false },
  slam: { name: 'Ezme', cost: 0, radius: 14, dmg: 80 },
  weight: 0,
  // Gövde derisiz: kaslar dışarıda (koyu kızıl lifler, beyaz kirişler); yüz ve eller ten rengi. Saçı sıkı topuz değil, kısa at kuyruğu.
  palette: { skin: 0xc0907a, top: 0xb4544a, legs: 0xa24a42, sleeve: 0xaa4e44, hair: 0x24140e, hairStyle: 'ponytail', eye: 0x7dff9a, glow: 0x7dff9a },
  opts: { style: 'titan', outline: 0.0022, bulk: 0.88, head: 0.92, arm: 1.08, female: true, muscle: true },
};

/** Avcı Dev'in türü: hızlı döner, ormanın her yerinden fark eder, üç ense kesiği ister. */
export function huntressType(): GiantType {
  return {
    ...shifterType(HUNTRESS),
    name: HUNTRESS.name,
    turn: 2.6,
    hpBase: CFG.huntress.hp,
    legCuts: 3,
    napeCuts: 3,
    aggro: 950,
    dmg: 24,
    xp: 1500,
    sprinter: true,
  };
}
