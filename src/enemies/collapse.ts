import { lerp } from '../core/rng';
import { autoBend, type Humanoid } from './humanoid';

/** Ayaktaki bir gövdenin yıkılışı: yönü, yere inerken aldığı yan eğim ve olayların verilip verilmediği. */
export interface Collapse {
  /** 1: yüzüstü (önce dizlerinin üstüne çöker), -1: sırtüstü. */
  fd: 1 | -1;
  roll: number;
  knee: boolean;
  impact: boolean;
}

export function newCollapse(fd: 1 | -1, roll = (Math.random() - 0.5) * 0.7): Collapse {
  return { fd, roll, knee: false, impact: false };
}

/** Yıkılış evrelerinin süreleri (sn). Büyük gövde daha ağır devrilir. */
export function collapseTimes(h: number, fd: 1 | -1) {
  const stagger = 0.35;
  const kneel = fd > 0 ? 0.45 + h * 0.012 : 0.16;
  const fall = 0.55 + h * 0.035;
  return { stagger, kneel, fall, total: stagger + kneel + fall };
}

const ease = (u: number) => u * u * (3 - 2 * u);

/**
 * Yıkılışın `t` anındaki pozunu uygular: sendeleme → dizlerin çözülmesi → gövdenin devrilmesi → yerde sekme.
 * Dönen `since`, gövdenin yere çarpmasından beri geçen süredir (çarpmadan önce negatif);
 * `kneeHit` ve `impactHit` dizlerin ve gövdenin yere vurduğu karede bir kez true olur.
 */
export function animateCollapse(b: Humanoid, t: number, dt: number, h: number, c: Collapse) {
  const T = collapseTimes(h, c.fd);
  const fd = c.fd;
  const k = 1 - Math.exp(-dt * 13);
  let tilt = 0;
  let drop = 0; // gövdenin (birim boyda) ne kadar alçaldığı
  let roll = 0;
  let head = 0;
  let aL = 0;
  let aR = 0;
  let spreadL = 0;
  let spreadR = 0;
  let lL = 0;
  let lR = 0;
  let kL = 0.1;
  let kR = 0.1;
  let kneeHit = false;
  let impactHit = false;
  const since = t - T.total;

  if (t < T.stagger) {
    // Sendeleme: baş geriye savrulur, kollar düşer, dizler yumuşar.
    const u = t / T.stagger;
    tilt = -0.13 * fd * u;
    head = -0.65 * fd * Math.sin(u * Math.PI * 0.8);
    aL = 0.35 * u;
    aR = 0.2 * u;
    kL = kR = 0.1 + 0.35 * u;
    lL = lR = -0.12 * u;
  } else if (t < T.stagger + T.kneel) {
    const u = ease((t - T.stagger) / T.kneel);
    if (fd > 0) {
      // Dizler öne kırılır, gövde dizlerinin üstüne çöker; baş öne düşer.
      lL = lerp(-0.12, -0.95, u);
      lR = lerp(-0.12, -0.8, u);
      kL = lerp(0.45, 1.95, u);
      kR = lerp(0.45, 1.75, u);
      drop = 0.2 * u;
      tilt = lerp(-0.13, 0.22, u);
      head = lerp(-0.3, 0.55, u);
      aL = lerp(0.35, 0.05, u);
      aR = lerp(0.2, -0.1, u);
    } else {
      // Sırtüstü: dizler boşalır, kollar denge arar gibi açılır.
      lL = lR = -0.3 * u;
      kL = kR = 0.45 + 0.4 * u;
      drop = 0.05 * u;
      tilt = lerp(0.13, -0.35, u);
      head = 0.2 * u;
      aL = aR = -0.5 * u;
      spreadL = spreadR = 0.5 * u;
    }
  } else {
    const u = Math.min(1, (t - T.stagger - T.kneel) / T.fall);
    const f = Math.pow(u, 2.2); // yerçekimiyle hızlanır
    const bounce = since > 0 ? 0.06 * Math.exp(-5 * since) * Math.abs(Math.cos(13 * since)) : 0;
    roll = c.roll * ease(u);
    if (fd > 0) {
      tilt = lerp(0.22, Math.PI / 2, f) - bounce;
      drop = lerp(0.2, -0.045, ease(u));
      // Bacaklar geride açılır: biri düz, öbürü hafif kırık kalır.
      lL = lerp(-0.95, 0.12, ease(u));
      lR = lerp(-0.8, -0.35, ease(u));
      kL = lerp(1.95, 0.15, ease(u));
      kR = lerp(1.75, 0.85, ease(u));
      // Kollar önce düşüşü karşılar gibi uzanır, çarpınca başın üstüne savrulur.
      aL = since > 0 ? -2.75 : lerp(0.05, -1.5, u);
      aR = since > 0 ? -2.0 : lerp(-0.1, -1.2, u);
      spreadR = since > 0 ? 0.75 : 0.15 * u;
      spreadL = since > 0 ? 0.2 : 0;
      head = since > 0 ? 0.3 - bounce * 4 : lerp(0.55, -0.45, u);
    } else {
      tilt = -(lerp(0.35, Math.PI / 2, f) - bounce);
      drop = lerp(0.05, -0.05, ease(u));
      // Sırtüstü düşerken bacaklar havalanır, çarpınca yere iner.
      const kick = since > 0 ? 0.55 * Math.exp(-4 * since) : 0.55 * u;
      lL = -0.2 - kick;
      lR = -0.05 - kick * 0.7;
      kL = 0.3 + kick;
      kR = 0.2 + kick * 0.6;
      aL = lerp(-0.5, -1.0, u);
      aR = lerp(-0.5, -0.7, u);
      spreadL = lerp(0.5, 1.15, u);
      spreadR = lerp(0.5, 0.95, u);
      head = since > 0 ? -0.25 + bounce * 3 : 0.35 * u;
    }
    if (u >= 1 && !c.impact) {
      c.impact = true;
      impactHit = true;
    }
  }
  if (t >= T.stagger + T.kneel && !c.knee) {
    c.knee = true;
    kneeHit = fd > 0;
  }

  // İlk anda önceki duruştan yumuşak geçiş, sonra poz doğrudan uygulanır.
  b.tilt.rotation.x = t < 0.2 ? lerp(b.tilt.rotation.x, tilt, k) : tilt;
  b.tilt.rotation.z = roll;
  b.tilt.position.y = -drop;
  b.head.rotation.x = lerp(b.head.rotation.x, head, k);
  b.armL.rotation.x = lerp(b.armL.rotation.x, aL, k);
  b.armR.rotation.x = lerp(b.armR.rotation.x, aR, k);
  b.armL.rotation.z = lerp(b.armL.rotation.z, -spreadL, k);
  b.armR.rotation.z = lerp(b.armR.rotation.z, spreadR, k);
  b.legL.rotation.x = lerp(b.legL.rotation.x, lL, k);
  b.legR.rotation.x = lerp(b.legR.rotation.x, lR, k);
  b.jaw.rotation.x = lerp(b.jaw.rotation.x, 0.4, k);
  autoBend(b, k, { kneeL: kL, kneeR: kR, elbowL: since > 0 ? -0.5 : -0.25, elbowR: since > 0 ? -0.9 : -0.25 });
  return { since, kneeHit, impactHit };
}

/** Yıkılıştan sonra modeli yeniden kullanılabilir duruşa getirir. */
export function resetPose(b: Humanoid) {
  b.tilt.rotation.set(0, 0, 0);
  b.tilt.position.y = 0;
  for (const j of [b.head, b.armL, b.armR, b.legL, b.legR, b.shinL, b.shinR, b.foreL, b.foreR, b.jaw]) j.rotation.set(0, 0, 0);
}
