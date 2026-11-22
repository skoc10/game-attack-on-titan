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

/** Baskın zorluğu: C en kolay, B olağan, A zor, S en zor. */
export type RaidTier = 'C' | 'B' | 'A' | 'S';
export const RAID_TIERS: RaidTier[] = ['C', 'B', 'A', 'S'];

/**
 * Zorluğun baskına etkisi: dev sayısı (`count`), iri dev sayısı (`big`), devlerin canı (`hp`) ve vuruşu (`dmg`),
 * köyü ya da suru yıkma hızı (`smash`), hazırlık süresi (`prep`), eşlik eden dev sayısı (`escort`) ve ödül (`reward`).
 * S zorlukta son dalgaya, yoksa, bir dönüşümcü katılır.
 */
export const TIERS: Record<RaidTier, { name: string; desc: string; count: number; big: number; hp: number; dmg: number; smash: number; prep: number; escort: number; reward: number; shifter: boolean }> = {
  C: { name: 'Kolay', desc: 'Az dev, köy dayanıklı', count: 0.7, big: 0.5, hp: 0.8, dmg: 0.75, smash: 0.7, prep: 1.25, escort: 0.6, reward: 0.6, shifter: false },
  B: { name: 'Orta', desc: 'Olağan baskın', count: 1, big: 1, hp: 1, dmg: 1, smash: 1, prep: 1, escort: 1, reward: 1, shifter: false },
  A: { name: 'Zor', desc: 'Daha çok ve iri dev, sert vurur', count: 1.35, big: 1.7, hp: 1.35, dmg: 1.25, smash: 1.3, prep: 0.8, escort: 1.4, reward: 1.7, shifter: false },
  S: { name: 'En zor', desc: 'Kalabalık, iri, çok sert; dönüşümcü katılır', count: 1.75, big: 2.6, hp: 1.8, dmg: 1.5, smash: 1.6, prep: 0.65, escort: 1.9, reward: 2.8, shifter: true },
};

/** Zorluğa göre ayarlanmış baskın: dalgalar, hazırlık, eşlik eden devler ve ödül. */
export function tierRaid(def: RaidDef, tier: RaidTier): RaidDef {
  const T = TIERS[tier];
  const waves = def.waves.map((w, i): RaidWave => {
    const giants = w.giants.map(([k, n]): [CommonKind, number] => [k, Math.max(1, Math.round(n * T.count))]);
    const last = i === def.waves.length - 1;
    return {
      giants,
      big: w.big !== undefined || T.big > 1 ? Math.round((w.big ?? (i > 0 ? 1 : 0)) * T.big) : undefined,
      shifter: w.shifter ?? (T.shifter && last && giants.length > 0 ? 'ofke' : undefined),
    };
  });
  return {
    ...def,
    prep: Math.round(def.prep * T.prep),
    waves,
    escortCount: def.escortCount !== undefined ? Math.max(1, Math.round(def.escortCount * T.escort)) : undefined,
    reward: { coins: Math.round((def.reward.coins * T.reward) / 10) * 10, xp: Math.round((def.reward.xp * T.reward) / 10) * 10 },
  };
}

/** İki zorluktan daha zor olanı. */
export function harderTier(a: RaidTier | undefined, b: RaidTier) {
  if (!a) return b;
  return RAID_TIERS.indexOf(a) >= RAID_TIERS.indexOf(b) ? a : b;
}
