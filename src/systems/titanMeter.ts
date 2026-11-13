import { CFG, type MeterKind } from '../data/config';
import { TITAN_IDS, type TitanId } from '../data/titans';

/**
 * Dev barı + iğneler. Saf mantık, sahneye dokunmaz.
 * Her iğne türü ayrı bir dev formuna dönüştürür; oyuncu elindekilerden birini seçer.
 * Bar en az yarıya kadar doluysa dönüşülebilir; dev formunda bar bir güç
 * kaynağıdır: zamanla azalır ve her güç kendi bedeli kadar bar harcar.
 */
export class TitanMeter {
  value = 0;
  active = false;
  readonly needles: Record<TitanId, number> = { ofke: 0, firtina: 0, kaya: 0, zirve: 0 };
  /** T'ye basınca dönüşülecek form. */
  selected: TitanId = 'ofke';

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
  get totalNeedles() {
    return TITAN_IDS.reduce((n, id) => n + this.needles[id], 0);
  }

  /** İğne ekler; seçili türden yoksa yeni gelen tür seçilir. */
  addNeedle(id: TitanId, count = 1) {
    this.needles[id] += count;
    if (this.needles[this.selected] <= 0) this.selected = id;
  }

  /** Elde iğnesi olan bir sonraki forma geçer; seçili formu döner. */
  cycle() {
    const start = TITAN_IDS.indexOf(this.selected);
    for (let i = 1; i <= TITAN_IDS.length; i++) {
      const id = TITAN_IDS[(start + i) % TITAN_IDS.length];
      if (this.needles[id] > 0) {
        this.selected = id;
        break;
      }
    }
    return this.selected;
  }

  clearNeedles() {
    for (const id of TITAN_IDS) this.needles[id] = 0;
    this.selected = 'ofke';
  }

  /** Dev öldürünce barı doldurur. Dev formundayken bar dolmaz. */
  addKill(kind: MeterKind, gainMult = 1) {
    if (this.active) return;
    this.value = Math.min(this.max, this.value + CFG.meter[kind] * gainMult);
  }

  canTransform() {
    return !this.active && this.charged && this.needles[this.selected] > 0;
  }

  /** Seçili türden bir iğne harcar; mevcut bar dev formunun güç havuzu olur. */
  transform() {
    if (!this.canTransform()) return false;
    this.needles[this.selected] -= 1;
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

  /** Formu bitirir; artan bar insan formuna taşınır. Seçili türden iğne kalmadıysa elde olana geçer. */
  end() {
    this.active = false;
    this.value = Math.max(0, this.value);
    if (this.needles[this.selected] <= 0) this.cycle();
  }

  /** HUD için 0..1 doluluk. */
  get ratio() {
    return Math.max(0, Math.min(1, this.value / this.max));
  }
}
