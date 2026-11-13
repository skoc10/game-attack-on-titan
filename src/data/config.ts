// Tüm denge sayıları tek yerde.
export const CFG = {
  world: {
    size: 5200,
    walls: [
      { name: 'Taç Suru', r: 300 },
      { name: 'Demir Sur', r: 1100 },
      { name: 'Kalkan Suru', r: 2000 },
    ],
    wallH: 50,
    wallT: 12,
    gateHalfW: 11,
    gateH: 24,
    townR: 292,
  },
  player: {
    walk: 7,
    sprint: 10.5,
    jump: 9,
    gravity: 26,
    radius: 0.45,
    accelGround: 70,
    friction: 22,
    airAccel: 16,
    maxAirWish: 9,
    spawn: { x: 0, z: 225 },
  },
  // Serbest imleçte: ortadaki ölü bölge (yarı genişlik oranı) ve kenardaki dönüş hızı (rad/sn).
  camera: { deadZone: 0.28, edgeTurn: 2.6 },
  grapple: {
    range: 130,
    reelAccel: 44,
    gasPerSec: 2.5,
    boostAccel: 32,
    boostGasPerSec: 10,
    maxSpeed: 50,
    holdDist: 2.2,
  },
  // Gaz kendiliğinden dolmaz; yalnızca ikmal noktalarında ve gaz kutularında dolar.
  gas: { max: 100, stationRate: 55, stationReach: 5, lowRatio: 0.2 },
  blade: { max: 20 },
  horse: { speed: 28, trot: 12, accel: 16, turn: 3.4, teleportDist: 170 },
  sword: { base: 40, reach: 2.7, duration: 0.38, activeFrom: 0.05, activeTo: 0.3, cooldown: 0.42 },
  // minRatio: dönüşmek için gereken en az doluluk oranı.
  meter: { max: 100, normal: 10, elite: 25, boss: 100, minRatio: 0.5 },
  // Dev formlarının sayıları data/titans.ts içindedir; burada yalnızca ortak olanlar var.
  titan: { hitDrain: 3 },
  // Yakalama: devler oyuncuyu eliyle tutup ağzına götürür; oyuncu kurtulma barını doldurarak sıyrılır.
  grab: {
    minHeight: 7,
    eatBase: 2.9,
    eatPerM: 0.05,
    squeeze: 5,
    biteBase: 45,
    bitePerM: 3,
    slashGain: 18,
    burstGain: 45,
    burstGas: 12,
    decay: 12,
  },
  spawn: { maxAlive: 14, minDist: 140, maxDist: 270, despawn: 440, interval: 1.2 },
  crate: { count: 46, respawn: 240, reach: 3.6 },
} as const;

export type MeterKind = 'normal' | 'elite' | 'boss';
