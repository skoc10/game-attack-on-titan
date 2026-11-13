/** Ses sentezinin saf hesapları (sahneye ve WebAudio'ya dokunmaz). */

export interface Listener {
  x: number;
  z: number;
  /** Kameranın baktığı yön (camYaw). */
  yaw: number;
}

/** Devin sesi: boyu büyüdükçe kalınlaşır (Hz). */
export function voicePitch(h: number) {
  return Math.max(55, Math.min(300, 250 * Math.pow(5 / Math.max(1, h), 0.55)));
}

/**
 * Dünyadaki bir ses kaynağının dinleyiciye göre şiddeti (0..1) ve sağ/sol konumu (-1..1).
 * `ref`: sesin yarı şiddete düştüğü uzaklık.
 */
export function spatial(l: Listener, x: number, z: number, ref: number) {
  const dx = x - l.x;
  const dz = z - l.z;
  const d = Math.hypot(dx, dz);
  const gain = 1 / (1 + (d / ref) ** 2);
  // İleri = (sin yaw, cos yaw); sağ = (-cos yaw, sin yaw).
  const pan = d < 0.5 ? 0 : Math.max(-1, Math.min(1, (dx * -Math.cos(l.yaw) + dz * Math.sin(l.yaw)) / d)) * 0.85;
  return { gain, pan, dist: d };
}

/** Savaş müziğinin yoğunluğu (0..1): kovalayan dev sayısı, bölüm sonu devi, yakalanma ve dev formu. */
export function combatIntensity(s: { chasing: number; boss: boolean; grabbed: boolean; titan: boolean }) {
  let v = Math.min(0.75, s.chasing * 0.22);
  if (s.titan) v += 0.25;
  if (s.boss) v = Math.max(v, 0.85);
  if (s.grabbed) v = 1;
  return Math.max(0, Math.min(1, v));
}

/** Arka arkaya öldürmelerde zafer notası yarım ses yükselir (en çok bir oktav). */
export function comboPitch(combo: number) {
  return Math.pow(2, Math.min(12, Math.max(0, combo - 1)) / 12);
}

/** Dev sesi türleri. İlk ikisi sıradan, son üçü "tuhaf" seslerdir. */
export const NORMAL_VOICES = ['moan', 'growl'] as const;
export const WEIRD_VOICES = ['giggle', 'gurgle', 'hum'] as const;
export type IdleVoice = (typeof NORMAL_VOICES)[number] | (typeof WEIRD_VOICES)[number];

/** 0..1 arası iki zarla bir devin sesini seçer: yaklaşık üçte biri tuhaf ses çıkarır. */
export function rollVoice(a: number, b: number): IdleVoice {
  const list = a < 0.36 ? WEIRD_VOICES : NORMAL_VOICES;
  return list[Math.min(list.length - 1, Math.floor(b * list.length))];
}
