import type { CommonKind } from '../enemies/giantTypes';
import type { TitanId } from './titans';

export type RaidId = 'degirmen' | 'kuzgun' | 'yikici';

/** Bir dalgada gelen devler: [tür, sayı]; `shifter` o dalgaya bir dönüşümcü ekler, `big` sayısı iri doğacakları belirtir. */
export interface RaidWave {
  giants: [CommonKind, number][];
  shifter?: TitanId;
  big?: number;
}

export interface RaidDef {
  id: RaidId;
  name: string;
  /** Savunulacak yerin adı ve kısa anlatım. */
  place: string;
  desc: string;
  /** village: devler köye girip evleri yıkar. wall: dev bir yıkıcı suru döver. */
  kind: 'village' | 'wall';
  /** Köy baskınlarında hangi sur bölgesindeki köy; sur baskınında hangi sur (0: Taç, 1: Demir, 2: Kalkan). */
  zone: number;
  /** Köyün ya da sur parçasının yaklaşık yönü (merkezden açı). */
  angle: number;
  /** Hazırlık süresi (sn): ilk dalga gelmeden önce. */
  prep: number;
  /** Dalgalar arası nefes (sn). */
  rest: number;
  waves: RaidWave[];
  /** Sur baskınında yıkıcıya eşlik eden devlerin aralığı (sn) ve her seferinde kaç tane geldiği. */
  escortEvery?: number;
  escortCount?: number;
  reward: { coins: number; xp: number };
}

export const RAIDS: RaidDef[] = [
  {
    id: 'degirmen',
    name: 'Değirmen Baskını',
    place: 'Demir Ova’da bir köy',
    desc: 'Üç dalga dev köye yürüyor. Evleri yıkmadan önce durdur; köyün sağlamlığı biterse köy düşer.',
    kind: 'village',
    zone: 1,
    angle: Math.PI * 0.25,
    prep: 14,
    rest: 9,
    waves: [
      { giants: [['normal', 6], ['runner', 1]] },
      { giants: [['normal', 6], ['runner', 3]], big: 1 },
      { giants: [['normal', 7], ['runner', 3], ['screamer', 2]], big: 3 },
    ],
    reward: { coins: 450, xp: 400 },
  },
  {
    id: 'kuzgun',
    name: 'Kuzgun Ormanı Baskını',
    place: 'Kalkan Ormanları’nda bir köy',
    desc: 'Zırhlılar, sıçrayanlar ve taşçılar orman köyüne iniyor. Son dalgada bir dönüşümcü onlara katılır.',
    kind: 'village',
    zone: 2,
    angle: Math.PI * 0.75,
    prep: 14,
    rest: 10,
    waves: [
      { giants: [['normal', 6], ['runner', 3]] },
      { giants: [['armored', 3], ['leaper', 3], ['thrower', 3], ['normal', 3]], big: 2 },
      { giants: [['armored', 3], ['runner', 4], ['normal', 4], ['leaper', 2]], shifter: 'ofke', big: 3 },
    ],
    reward: { coins: 800, xp: 700 },
  },
  {
    id: 'yikici',
    name: 'Sur Yıkan',
    place: 'Kalkan Suru',
    desc: 'Surdan da uzun bir dev, Kalkan Suru’nu yumruklarıyla yıkmaya geliyor. Topları kullan, bacaklarını kes, ensesine ulaş.',
    kind: 'wall',
    zone: 2,
    angle: Math.PI * 1.25,
    prep: 12,
    rest: 0,
    waves: [{ giants: [] }],
    escortEvery: 22,
    escortCount: 5,
    reward: { coins: 1400, xp: 1200 },
  },
];

export const RAID_BY_ID = Object.fromEntries(RAIDS.map((r) => [r.id, r])) as Record<RaidId, RaidDef>;

/** Bir dalgadaki dev sayısı (dönüşümcü dahil). */
export function waveSize(w: RaidWave) {
  return w.giants.reduce((n, [, c]) => n + c, 0) + (w.shifter ? 1 : 0);
}
