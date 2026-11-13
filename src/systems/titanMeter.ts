import { CFG, type MeterKind } from '../data/config';

/**
 * Dev barı + Öz İğnesi. Saf mantık, sahneye dokunmaz.
 * Bar en az yarıya kadar doluysa dönüşülebilir; dev formunda bar bir güç
 * kaynağıdır: zamanla azalır ve her güç kendi bedeli kadar bar harcar.
 */
export class TitanMeter {
  value = 0;
  needles = 0;
  active = false;

  constructor(
    readonly max: number = CFG.meter.max,
    readonly minToTransform: number = CFG.meter.max * CFG.meter.minRatio,
  ) {}

  get full() {
    return this.value >= this.max;
  }
  /** Dönüşüm eşiği aşıldı mı (iğneden bağımsız). */
  get charged() {
    return this.value >= this.minToTransform;
  }

  /** Dev öldürünce barı doldurur. Dev formundayken bar dolmaz. */
  addKill(kind: MeterKind, gainMult = 1) {
    if (this.active) return;
    this.value = Math.min(this.max, this.value + CFG.meter[kind] * gainMult);
  }

  canTransform() {
    return !this.active && this.charged && this.needles > 0;
  }

  /** Bir iğne harcar; mevcut bar dev formunun güç havuzu olur. */
  transform() {
    if (!this.canTransform()) return false;
    this.needles -= 1;
    this.active = true;
    return true;
  }

  /** Dev formunda barı zamanla azaltır; bar bittiyse true döner. */
  tick(dt: number, drainPerSec: number) {
    if (!this.active) return false;
    this.value -= drainPerSec * dt;
    return this.value <= 0;
  }

  canAfford(cost: number) {
    return this.active && this.value >= cost;
  }

  /** Bir güç için bar harcar; yetmiyorsa false döner ve bar değişmez. */
  spend(cost: number) {
    if (!this.canAfford(cost)) return false;
    this.value -= cost;
    return true;
  }

  /** Dev formunda hasar almak barı azaltır. */
  hit(amount: number) {
    if (this.active) this.value -= amount;
  }

  /** Formu bitirir; artan bar insan formuna taşınır. */
  end() {
    this.active = false;
    this.value = Math.max(0, this.value);
  }

  /** HUD için 0..1 doluluk. */
  get ratio() {
    return Math.max(0, Math.min(1, this.value / this.max));
  }
}
