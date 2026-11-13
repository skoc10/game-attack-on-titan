/**
 * Kılıç hasarı: hız arttıkça artar. ~14 m/s'de taban hasarın 1.4 katı,
 * dururken 0.4 katı. Körelmiş kılıç hasarı dörtte bire düşürür.
 */
export function swordDamage(base: number, speed: number, classMult: number, bladeOk: boolean, bonus = 1) {
  const speedFactor = 0.4 + Math.min(Math.max(speed, 0), 50) / 14;
  return base * speedFactor * classMult * (bladeOk ? 1 : 0.25) * bonus;
}
