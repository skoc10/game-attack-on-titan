import { CFG } from '../data/config';

export type MeleeKind = 'grab' | 'bite' | 'kick' | 'swipe';

/**
 * Menzile giren devin (bölüm sonu devleri dışında) hangi yakın saldırıyı yapacağı.
 * Sürünenler hep ısırır. Diğerleri önce yakalamayı dener; yakalamıyorsa yerdeki ava
 * ya da dev formundaki oyuncuya belli bir olasılıkla dişlerini geçirir.
 * Isırmıyorsa yerdeki ava ya da dev formundaki oyuncuya belli bir olasılıkla tekme atar, yoksa savurur.
 * `low`: av devin beline göre aşağıda mı (eğilip ısırabileceği, tekmeyle yetişebileceği yerde).
 */
export function pickMelee(o: { crawl: boolean; titan: boolean; low: boolean; grabChance: number; grabRoll: number; biteRoll: number; kickRoll?: number }): MeleeKind {
  if (o.crawl) return 'bite';
  if (!o.titan && o.grabRoll < o.grabChance) return 'grab';
  const chance = o.titan ? CFG.bite.titanChance : o.low ? CFG.bite.chance : 0;
  if (o.biteRoll < chance) return 'bite';
  const kick = o.titan ? CFG.giantKick.titanChance : o.low ? CFG.giantKick.chance : 0;
  return (o.kickRoll ?? 1) < kick ? 'kick' : 'swipe';
}
