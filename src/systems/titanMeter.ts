import { CFG, type MeterKind } from '../data/config';
import { TITAN_IDS, type FormId, type InnateId, type TitanId } from '../data/titans';

/**
 * Dev barı + iğneler. Saf mantık, sahneye dokunmaz.
 * Her iğne türü ayrı bir dev formuna dönüştürür; oyuncu elindekilerden birini seçer.
 * Bazı karakterlerin iğne istemeyen kendi formu vardır; o forma yalnızca bar tamamen dolunca dönüşülür.
 * Bar en az yarıya kadar doluysa iğneyle dönüşülebilir; dev formunda bar bir güç
 * kaynağıdır: zamanla azalır ve her güç kendi bedeli kadar bar harcar.
 */
export class TitanMeter {
  value = 0;
  active = false;
  readonly needles: Record<TitanId, number> = { ofke: 0, firtina: 0, kaya: 0, zirve: 0, isin: 0, buz: 0 };
  /** T'ye basınca dönüşülecek form. */
  selected: FormId = 'ofke';
  /** Seçili karakterin kendi formu (yoksa null). */
  innate: InnateId | null = null;

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

  /** Seçili form karakterin kendi formu mu (iğne harcamaz, dolu bar ister). */
  get usesInnate() {
    return this.innate !== null && this.selected === this.innate;
  }

  /** Bu forma dönüşmenin bir yolu var mı: kendi formu ya da elde iğnesi. */
  has(id: FormId) {
    return id === this.innate || ((this.needles as Record<string, number>)[id] ?? 0) > 0;
  }

  /** Karakter değişince kendi formunu ayarlar; seçim geçersiz kaldıysa düzeltir. */
  setInnate(id: InnateId | null) {
    this.innate = id;
    if (id !== null && this.totalNeedles === 0) this.selected = id;
    else if (!this.has(this.selected)) this.selected = id ?? TITAN_IDS.find((t) => this.needles[t] > 0) ?? 'ofke';
  }

  /** İğne ekler; seçili forma dönüşme yolu yoksa yeni gelen tür seçilir. */
  addNeedle(id: TitanId, count = 1) {
    this.needles[id] += count;
    if (!this.has(this.selected)) this.selected = id;
  }

  /** Dönüşülebilecek bir sonraki forma (eldeki iğneler, sonra kendi formu) geçer; seçili formu döner. */
  cycle() {
    const order: FormId[] = this.innate ? [...TITAN_IDS, this.innate] : TITAN_IDS;
    const start = order.indexOf(this.selected);
    for (let i = 1; i <= order.length; i++) {
      const id = order[(start + i) % order.length];
      if (this.has(id)) {
        this.selected = id;
        break;
      }
    }
    return this.selected;
  }

  clearNeedles() {
    for (const id of TITAN_IDS) this.needles[id] = 0;
    this.selected = this.innate ?? 'ofke';
  }

  /** Dev öldürünce barı doldurur. Dev formundayken bar dolmaz. */
  addKill(kind: MeterKind, gainMult = 1) {
    if (this.active) return;
    this.value = Math.min(this.max, this.value + CFG.meter[kind] * gainMult);
  }

  canTransform() {
    if (this.active) return false;
    return this.usesInnate ? this.full : this.charged && this.has(this.selected);
  }

  /** İğneyle dönüşüyorsa seçili türden bir iğne harcar; mevcut bar dev formunun güç havuzu olur. */
  transform() {
    if (!this.canTransform()) return false;
    if (!this.usesInnate) this.needles[this.selected as TitanId] -= 1;
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
    if (!this.has(this.selected)) this.cycle();
  }

  /** HUD için 0..1 doluluk. */
  get ratio() {
    return Math.max(0, Math.min(1, this.value / this.max));
  }
}
