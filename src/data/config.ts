// Tüm denge sayıları tek yerde.
export const CFG = {
  world: {
    size: 12400,
    // Her surun dört yönünde (+Z, +X, -Z, -X) dışa taşan yarım daire biçimli bir kapı kasabası vardır.
    // district: kasabanın yarıçapı, towns: o yönlerdeki kasabaların adları.
    walls: [
      { name: 'Taç Suru', r: 300, district: 95, towns: ['Mühürhane', 'Çanlıkapı', 'Kandilli', 'Sancaktepe'] },
      { name: 'Demir Sur', r: 1600, district: 150, towns: ['Örsköy', 'Karakule', 'Değirmenli', 'Taşhan'] },
      { name: 'Kalkan Suru', r: 3000, district: 200, towns: ['Sınırboyu', 'Kuzgunkapı', 'Yelkovan', 'Sonkale'] },
    ],
    // Surlar arasındaki ovalara dağılmış köyler: her bölgede kaç tane ve birbirine en az uzaklıkları.
    villages: { perZone: [12, 18, 22], spacing: 260 },
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
  // Dokunmatik: parmak kaydırmasının piksel başına dönüşü (radyan), çubuğun yarıçapı ve ölü bölgesi (piksel).
  touch: { lookYaw: 0.0052, lookPitch: 0.0042, stickRadius: 62, stickDead: 8 },
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
  // Patlar Mızrak: teçhizattan fırlatılır, çarptığı yerde patlar. Zırhı deler; yakınında durana da zarar verir.
  spear: { max: 6, start: 2, perCrate: 2, speed: 100, gravity: 5, range: 190, radius: 7.5, cooldown: 0.8, selfRadius: 6.5, selfDmg: 22 },
  // Sur topları: surların üstünde aralıklarla durur. spacing/districtSpacing: halka surda ve kasaba surunda aralık (m),
  // speed/gravity: güllenin hızı ve düşüşü (menzil ≈ speed²/gravity), radius: patlama yarıçapı,
  // homing: güllenin kilitlendiği deve doğru yön düzeltmesi (m/sn²), arc: namlunun dışa bakan yönden en çok dönüşü (rad).
  cannon: { spacing: 110, districtSpacing: 70, speed: 110, gravity: 22, cooldown: 1.6, radius: 10, reach: 3.6, homing: 40, arc: 1.45, pivot: 2.5, lockAngle: 0.09 },
  // Billur koza: içindeyken hasar alınmaz, devler oyuncuyu göremez; süre dolunca kırılır ve çevreyi sersemletir.
  cocoon: { dur: 6, cooldown: 25, heal: 0.06, stunRadius: 16, stun: 2.5 },
  // Öldürme serisi: süre dolmadan gelen her yeni öldürme av puanı çarpanını artırır.
  streak: { window: 9, step: 0.25, maxMult: 3 },
  horse: { speed: 28, trot: 12, accel: 16, turn: 3.4, teleportDist: 170 },
  sword: { base: 40, reach: 2.7, duration: 0.38, activeFrom: 0.05, activeTo: 0.3, cooldown: 0.42 },
  // minRatio: dönüşmek için gereken en az doluluk oranı.
  meter: { max: 100, normal: 10, elite: 25, boss: 100, minRatio: 0.5 },
  // Dev formlarının sayıları data/titans.ts içindedir; burada yalnızca ortak olanlar var.
  // steam: R ile çevreye kaynar buhar salar; radius dev boyunun katıdır (+8 m), devlere saniyede dps hasar verir ve iter.
  // drainMult: dev formunda hareket ederken barın azalma hızının ortak çarpanı (tüm formlara uygulanır).
  // bite: dev formunun ısırığı (F). Tek hedefe ağır, zırh delen hasar; öldürürse bar geri kazanılır.
  titan: { hitDrain: 3, drainMult: 0.5, steam: { name: 'Buhar', cost: 12, cd: 9, dur: 3.5, radius: 1.5, dps: 180, tick: 0.25 }, bite: { cost: 4, cd: 2.5, dmgMult: 2.6, time: 0.55, refund: 8 } },
  // Gard ve dövüş (dev formu ve devler): block önden gelen hasarın engellenen oranı, arc kalkanın kapsadığı açının
  // yarısı (rad), slow gardda yürüme hızı. Gardda yumruk seriye bağlanır: punchTime yumruğun süre çarpanı, window seriyi
  // sürdürmek için süre, step her seri vuruşun ek hasarı, finisher her `finishEvery`. vuruşa (aparkat) eklenen çarpan (gard kırar, sersemletir),
  // counter engelden sonraki `counterT` sn içinde yumrukların çarpanı.
  guard: { block: 0.75, arc: 1.75, slow: 0.4, punchTime: 0.6, window: 0.9, step: 0.15, finishEvery: 4, finisher: 1.4, finisherStun: 1.6, counter: 1.5, counterT: 1.5 },
  // Tekme: yumruktan uzağa uzanır, iter ve sersemletir, gardı kırar. dmg/reach/range yumruğun katları.
  kick: { dmg: 1.5, reach: 1.25, range: 1.1, cost: 2, cd: 1.3, stun: 1.4, push: 9, minTime: 0.55, maxTime: 1 },
  // Devlerin gardı ve tekmesi: gard olasılığı türe göre (`guardChance`), süresi ve tekrar için bekleme;
  // gardlı dev önden gelen dev yumruğunun `block` oranını engeller. Tekme olasılığı, hasar çarpanı, itme ve hazırlık süresi;
  // tekme gardı `pierce` oranında deler.
  giantGuard: { normal: 0.22, armored: 0.35, heavy: 0.5, fast: 0.12, dur: [0.9, 1.7] as [number, number], cd: [2.5, 4.5] as [number, number], block: 0.75 },
  giantKick: { chance: 0.24, titanChance: 0.3, dmg: 1.25, knock: 24, windup: 0.8, pierce: 0.5 },
  // Devlerin temposu (tür hızlarının çarpanları): walk her yürüyüşe, chase kovalarken ek olarak, turn dönüşe uygulanır.
  giantPace: { walk: 1.2, chase: 1.15, turn: 1.3 },
  // Devlerin gücü: can ve vuruş çarpanları; bazı devler (bigChance) türünün boyunun big katı kadar iri doğar.
  giantPower: { hp: 1.4, dmg: 1.3, bigChance: 0.16, big: [1.35, 1.8] as [number, number] },
  // Düşman dönüşümcüler: oyuncunun dönüşebildiği dev formlarına giren düşmanlar. İlki `first` sn sonra,
  // sonrakiler `every` aralığında, oyuncudan `dist` uzaklıkta, kendi güçleriyle saldırır.
  // Avcı Dev: dev ağaçlar ormanına giren oyuncuyu kovalar. hp dev gücüne karşı can, respawn öldükten sonra yeniden doğma
  // süresi (sn), bonus öldürünce ek av puanı, mountedChase oyuncu attayken koşusuna eklenen çarpan (dörtnala yetişmeye yakın).
  // Demir Koç: sur ötesinde dolaşır, oyuncu `notice` m yakınındayken `firstCharge` sn sonra surdan `runup` m geri çekilip
  // `speed` m/sn ile toslar; Kalkan Suru'nda 2×`halfWidth` m'lik gedik açar (kapılardan `gateClear` radyan uzakta).
  // Öldürülünce gedik `repair` sn sonra onarılır, kendisi `respawn` sn sonra yeniden doğar.
  breaker: { first: 20, firstCharge: 25, notice: 700, runup: 260, speed: 44, halfWidth: 17, gateClear: 0.16, repair: 45, respawn: 480, again: 1e9 },
  huntress: { hp: 2600, respawn: 300, bonus: 800, mountedChase: 1.12, first: 4 },
  shifter: { first: 75, every: [130, 220] as [number, number], dist: [220, 370] as [number, number], hp: 900, armoredHp: 1300 },
  // Devlerin ısırığı: yerdeki ava eğilip dişler. Yumruktan sert vurur, öncesinde başını geri çeker.
  bite: { chance: 0.3, titanChance: 0.4, dmgMult: 1.4, windup: 0.75, lunge: 0.45, knock: 8 },
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
  crate: { count: 170, respawn: 240, reach: 3.6, medicHeal: 0.6, coins: 60 },
  // Çanta: en çok kaç sargı taşınır.
  inv: { sargiMax: 3 },
  // Orman Kapşonu: giyiliyken devler oyuncuyu ancak bu oranda yakından fark eder; saldırınca `reveal` saniye görünür olur.
  hood: { sight: 0.45, reveal: 4 },
} as const;

export type MeterKind = 'normal' | 'elite' | 'boss';
