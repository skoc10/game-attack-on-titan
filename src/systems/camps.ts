/**
 * Doğuş noktaları: oyuncunun uğradığı yapılar (kule, değirmen, şapel, karakol, kale...) doğuş noktası olur.
 * Öldüğünde en son uğradığı yapının yanında doğar. Saf mantık, sahneye dokunmaz.
 */
export interface CampSite {
  kind: string;
  x: number;
  z: number;
  name?: string;
  x2?: number;
  z2?: number;
}

/** Yapının adı (adı yoksa türünden). */
export function campName(s: CampSite) {
  if (s.name) return s.name;
  switch (s.kind) {
    case 'tower':
      return 'Gözcü Kulesi';
    case 'windmill':
      return 'Yel Değirmeni';
    case 'chapel':
      return 'Çan Kulesi';
    case 'lift':
      return 'Sur Asansörü';
    case 'yard':
      return 'Talim Alanı';
    default:
      return 'Yapı';
  }
}

/** Yapıya bu kadar yaklaşınca doğuş noktası alınır (m, yapının ortasından). */
export function campReach(kind: string) {
  return kind === 'castle' ? 70 : kind === 'fort' ? 45 : kind === 'yard' ? 32 : 26;
}

/** Noktanın bir doğru parçasına yatay uzaklığı. */
function segDist(x: number, z: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}

/** (x, z) hangi yapının erişimi içinde: en yakınının sırası, yoksa -1. */
export function campAt(sites: readonly CampSite[], x: number, z: number) {
  let best = -1;
  let bd = Infinity;
  for (let i = 0; i < sites.length; i++) {
    const s = sites[i];
    const d = s.x2 !== undefined && s.z2 !== undefined ? segDist(x, z, s.x, s.z, s.x2, s.z2) : Math.hypot(x - s.x, z - s.z);
    if (d < campReach(s.kind) && d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

/** Kayıttaki doğuş noktalarını yapı sayısına göre temizler. */
export function sanitizeCamps(raw: unknown, active: unknown, count: number) {
  const list = Array.isArray(raw) ? raw.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < count) : [];
  const camps = [...new Set(list)];
  const camp = Number.isInteger(active) && camps.includes(active as number) ? (active as number) : -1;
  return { camps, camp };
}
