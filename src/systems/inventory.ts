import { CFG } from '../data/config';

/**
 * Oyuncunun çantası. Kayda yazılır.
 * - `hood`: Orman Kapşonu bulundu mu; `wear`: şu an giyiliyor mu.
 * - `sargi`: taşınan sargı sayısı (H ile kullanılır).
 */
export interface InvState {
  hood: boolean;
  wear: boolean;
  sargi: number;
}

export function newInv(): InvState {
  return { hood: false, wear: false, sargi: 0 };
}

/** Sargı ekler; çanta doluysa sığmayanı geri verir. Eklenen sayıyı döner. */
export function addSargi(inv: InvState, n = 1, max: number = CFG.inv.sargiMax) {
  const room = Math.max(0, max - inv.sargi);
  const got = Math.min(room, Math.max(0, Math.floor(n)));
  inv.sargi += got;
  return got;
}

/** Bir sargı harcar; yoksa false döner. */
export function takeSargi(inv: InvState) {
  if (inv.sargi <= 0) return false;
  inv.sargi -= 1;
  return true;
}

/**
 * Sandıktan kapşon çıktı. İlkiyse çantaya girer ve hemen giyilir ('new');
 * zaten varsa yedektir ('spare') ve av puanına çevrilir.
 */
export function gainHood(inv: InvState): 'new' | 'spare' {
  if (inv.hood) return 'spare';
  inv.hood = true;
  inv.wear = true;
  return 'new';
}

/** Kapşonu giyer ya da çıkarır; kapşon yoksa false döner. */
export function toggleHood(inv: InvState) {
  if (!inv.hood) return false;
  inv.wear = !inv.wear;
  return true;
}

/**
 * Devlerin oyuncuyu fark etme mesafesinin çarpanı. Kapşon yalnızca insan formunda işe yarar;
 * saldırdıktan sonra kısa bir süre (açığa çıkma) etkisini yitirir.
 */
export function sightMult(o: { wearing: boolean; titan: boolean; revealed: boolean }, mult: number = CFG.hood.sight) {
  return o.wearing && !o.titan && !o.revealed ? mult : 1;
}

export function sanitizeInv(raw: unknown): InvState {
  const d = newInv();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  d.hood = r.hood === true;
  d.wear = d.hood && r.wear === true;
  d.sargi = typeof r.sargi === 'number' && Number.isFinite(r.sargi) ? Math.max(0, Math.min(CFG.inv.sargiMax, Math.floor(r.sargi))) : 0;
  return d;
}
