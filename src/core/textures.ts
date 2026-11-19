import * as THREE from 'three';
import { mulberry32, type Rng } from './rng';

/** Kodla çizilen dokular: harici görsel dosyası yok. */

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, g: c.getContext('2d')! };
}

function finish(c: HTMLCanvasElement, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function speckle(g: CanvasRenderingContext2D, rng: Rng, w: number, h: number, n: number, colors: string[], min: number, max: number) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[Math.floor(rng() * colors.length)];
    const s = min + rng() * (max - min);
    g.globalAlpha = 0.25 + rng() * 0.5;
    g.fillRect(rng() * w, rng() * h, s, s * (0.6 + rng() * 0.8));
  }
  g.globalAlpha = 1;
}

/** Çizgi film gölgelendirmesi için basamaklı ışık rampası. */
let toonRamp: THREE.DataTexture | null = null;
export function toonGradient() {
  if (toonRamp) return toonRamp;
  // Altı basamak: gövdelerin hacmi okunur, ama çizgi film görünümü korunur.
  const steps = [78, 118, 158, 196, 228, 255];
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  toonRamp = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  toonRamp.minFilter = toonRamp.magFilter = THREE.NearestFilter;
  toonRamp.needsUpdate = true;
  return toonRamp;
}

export function grassTexture() {
  const { c, g } = canvas(256, 256);
  const rng = mulberry32(11);
  g.fillStyle = '#c9d6a4';
  g.fillRect(0, 0, 256, 256);
  speckle(g, rng, 256, 256, 900, ['#b4c78c', '#d6e0b4', '#a9bd82', '#c2cf96'], 3, 14);
  // Ot sapları
  for (let i = 0; i < 1400; i++) {
    const x = rng() * 256;
    const y = rng() * 256;
    g.strokeStyle = rng() < 0.5 ? 'rgba(120,150,80,0.55)' : 'rgba(225,235,190,0.5)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rng() - 0.5) * 4, y - 3 - rng() * 6);
    g.stroke();
  }
  return finish(c);
}

export function dirtTexture() {
  const { c, g } = canvas(256, 256);
  const rng = mulberry32(12);
  g.fillStyle = '#8f7a5e';
  g.fillRect(0, 0, 256, 256);
  speckle(g, rng, 256, 256, 2600, ['#7d6a50', '#a08a6c', '#6f5d46', '#b09a7c'], 1, 5);
  // Tekerlek izleri
  g.strokeStyle = 'rgba(70,56,40,0.35)';
  g.lineWidth = 9;
  for (const x of [84, 172]) {
    g.beginPath();
    g.moveTo(x, 0);
    g.bezierCurveTo(x + 6, 80, x - 6, 170, x, 256);
    g.stroke();
  }
  return finish(c);
}

export function cobbleTexture() {
  const { c, g } = canvas(256, 256);
  const rng = mulberry32(13);
  g.fillStyle = '#4c4842';
  g.fillRect(0, 0, 256, 256);
  const cell = 32;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const ox = (y % 2) * 16;
      const v = 120 + Math.floor(rng() * 50);
      g.fillStyle = `rgb(${v + 8},${v + 2},${v - 8})`;
      const px = x * cell + ox + 2 + rng() * 2;
      const py = y * cell + 2 + rng() * 2;
      g.beginPath();
      g.roundRect(px, py, cell - 5 - rng() * 3, cell - 5 - rng() * 3, 7);
      g.fill();
      if (px + cell > 256) {
        g.beginPath();
        g.roundRect(px - 256, py, cell - 6, cell - 6, 7);
        g.fill();
      }
    }
  }
  speckle(g, rng, 256, 256, 300, ['#3d3a35', '#8f897c'], 1, 3);
  return finish(c);
}

/** Sur taşı: kaba yontulmuş bloklar, harç çizgileri, yer yer yosun. Bir karo ~8 m. */
export function stoneTexture() {
  const { c, g } = canvas(512, 512);
  const rng = mulberry32(14);
  g.fillStyle = '#5d5a55';
  g.fillRect(0, 0, 512, 512);
  const rows = 8;
  const rh = 512 / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rng() * 60;
    while (x < 512) {
      const w = 70 + rng() * 80;
      const v = 150 + Math.floor(rng() * 55);
      g.fillStyle = `rgb(${v},${v - 4},${v - 12})`;
      g.fillRect(x + 2, r * rh + 2, w - 4, rh - 4);
      // Blok içi ton farkı
      g.fillStyle = `rgba(0,0,0,${0.03 + rng() * 0.08})`;
      g.fillRect(x + 2, r * rh + rh * 0.55, w - 4, rh * 0.45 - 2);
      g.fillStyle = 'rgba(255,255,255,0.10)';
      g.fillRect(x + 2, r * rh + 2, w - 4, 3);
      x += w;
    }
  }
  speckle(g, rng, 512, 512, 1200, ['#6d6a63', '#b9b5aa', '#4a4843'], 1, 5);
  speckle(g, rng, 512, 512, 160, ['#6f7f55', '#5d6e4a'], 6, 26);
  return finish(c);
}

/** Yarı ahşap ev cephesi: sıva, kirişler, pencere. Bir karo 4 m × 3,2 m (bir kat). */
export function facadeTexture() {
  const { c, g } = canvas(256, 256);
  const rng = mulberry32(15);
  g.fillStyle = '#e4dccb';
  g.fillRect(0, 0, 256, 256);
  speckle(g, rng, 256, 256, 500, ['#d6cdb9', '#efe8d8', '#cfc5b0'], 2, 12);
  const beam = '#4a3324';
  g.fillStyle = beam;
  g.fillRect(0, 0, 256, 16); // kat kirişi
  g.fillRect(0, 0, 12, 256);
  g.fillRect(122, 0, 12, 256);
  g.strokeStyle = beam;
  g.lineWidth = 10;
  g.beginPath(); // çapraz destek
  g.moveTo(12, 250);
  g.lineTo(122, 150);
  g.stroke();
  // Pencere
  g.fillStyle = beam;
  g.fillRect(156, 70, 78, 104);
  g.fillStyle = '#2b3a4a';
  g.fillRect(163, 77, 64, 90);
  g.fillStyle = 'rgba(190,215,235,0.35)';
  g.fillRect(163, 77, 30, 42);
  g.fillStyle = beam;
  g.fillRect(193, 77, 4, 90);
  g.fillRect(163, 120, 64, 4);
  return finish(c);
}

/** Kiremit çatı. Bir karo ~3 m. */
export function roofTexture() {
  const { c, g } = canvas(256, 256);
  const rng = mulberry32(16);
  g.fillStyle = '#7a3b2c';
  g.fillRect(0, 0, 256, 256);
  const rows = 8;
  const rh = 32;
  for (let r = 0; r < rows; r++) {
    for (let x = -1; x < 9; x++) {
      const px = x * 32 + (r % 2) * 16;
      const v = rng();
      g.fillStyle = `rgb(${150 + v * 40},${78 + v * 22},${56 + v * 16})`;
      g.beginPath();
      g.roundRect(px + 1, r * rh + 1, 30, rh + 6, [0, 0, 12, 12]);
      g.fill();
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.fillRect(px + 1, r * rh + rh - 3, 30, 4);
    }
  }
  return finish(c);
}

export function barkTexture() {
  const { c, g } = canvas(128, 256);
  const rng = mulberry32(17);
  g.fillStyle = '#b79a80';
  g.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 260; i++) {
    g.strokeStyle = rng() < 0.6 ? 'rgba(70,50,36,0.5)' : 'rgba(230,205,180,0.35)';
    g.lineWidth = 1 + rng() * 3;
    const x = rng() * 128;
    const y = rng() * 256;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rng() - 0.5) * 6, y + 20 + rng() * 50);
    g.stroke();
  }
  return finish(c);
}

/** Saydam zeminli ot öbeği. */
export function grassTuftTexture() {
  const { c, g } = canvas(128, 128);
  const rng = mulberry32(18);
  // Saydam zemin hafif yeşil tutulur; yoksa uzaktan bakınca (mipmap) öbekler siyaha döner.
  g.fillStyle = 'rgba(150,190,90,0.04)';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 26; i++) {
    const x = 12 + rng() * 104;
    const h = 50 + rng() * 70;
    const lean = (rng() - 0.5) * 34;
    const shade = 185 + Math.floor(rng() * 70);
    g.fillStyle = `rgb(${shade - 35},${shade},${shade - 95})`;
    g.beginPath();
    g.moveTo(x - 4, 128);
    g.quadraticCurveTo(x + lean * 0.3, 128 - h * 0.6, x + lean, 128 - h);
    g.quadraticCurveTo(x + lean * 0.5, 128 - h * 0.5, x + 4, 128);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Deri dokusu (tek, paylaşılan): hafif lekeler, kılcal damar izleri ve gözenekler.
 * Renk haritası beyaza yakındır, malzeme rengiyle çarpılır; aynı doku kabartma haritası olarak da kullanılır.
 */
let skinTex: THREE.CanvasTexture | null = null;
export function skinTexture() {
  if (skinTex) return skinTex;
  const S = 256;
  const { c, g } = canvas(S, S);
  const rng = mulberry32(4242);
  g.fillStyle = '#f2ece8';
  g.fillRect(0, 0, S, S);
  // Geniş, yumuşak renk lekeleri (kızarıklık ve solgunluk)
  for (let i = 0; i < 70; i++) {
    const x = rng() * S;
    const y = rng() * S;
    const r = 14 + rng() * 40;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const warm = rng() < 0.55;
    grad.addColorStop(0, warm ? 'rgba(205,165,150,0.13)' : 'rgba(255,250,240,0.16)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    // Kenarlarda kesilmesin diye dört köşeye de çizilir (döşenebilir doku).
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) g.fillRect(x - r + ox, y - r + oy, r * 2, r * 2);
  }
  // İnce damar izleri
  g.lineWidth = 0.8;
  for (let i = 0; i < 26; i++) {
    g.strokeStyle = `rgba(150,115,125,${0.05 + rng() * 0.06})`;
    g.beginPath();
    let x = rng() * S;
    let y = rng() * S;
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (rng() - 0.5) * 30;
      y += (rng() - 0.5) * 30;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // Gözenekler ve küçük benekler
  speckle(g, rng, S, S, 1500, ['#d2bfb6', '#c4aca2', '#ffffff'], 0.6, 1.6);
  skinTex = finish(c, 2, 2);
  return skinTex;
}

let muscleTex: THREE.CanvasTexture | null = null;
/**
 * Çıplak kas dokusu: boyuna uzanan ince lifler (koyu oluklar, açık sırtlar) ve aralarda beyazımsı kiriş şeritleri.
 * Malzemenin rengiyle çarpılır; tümsek haritası olarak da kullanılır.
 */
export function muscleTexture() {
  if (muscleTex) return muscleTex;
  const S = 256;
  const { c, g } = canvas(S, S);
  const rng = mulberry32(7171);
  g.fillStyle = '#efe2de';
  g.fillRect(0, 0, S, S);
  const fiber = (color: string, width: number, n: number) => {
    g.strokeStyle = color;
    g.lineWidth = width;
    for (let i = 0; i < n; i++) {
      const x0 = rng() * S;
      const bend = (rng() - 0.5) * 18;
      // Döşenebilir: çizgi yatayda üç kopya, dikeyde tüm yüksekliği kaplar.
      for (const ox of [-S, 0, S]) {
        g.beginPath();
        g.moveTo(x0 + ox, -4);
        g.bezierCurveTo(x0 + ox + bend, S * 0.33, x0 + ox - bend, S * 0.66, x0 + ox, S + 4);
        g.stroke();
      }
    }
  };
  fiber('rgba(110,30,30,0.32)', 1.6, 120); // lif arası oluklar
  fiber('rgba(255,236,230,0.28)', 0.9, 160); // lif sırtları
  fiber('rgba(80,18,20,0.22)', 3.2, 18); // kas demetlerini ayıran derin çizgiler
  // Kiriş şeritleri: kasın uçlarında parlak, beyazımsı bantlar.
  for (const y of [S * 0.08, S * 0.58]) {
    const grad = g.createLinearGradient(0, y - 10, 0, y + 10);
    grad.addColorStop(0, 'rgba(255,246,236,0)');
    grad.addColorStop(0.5, 'rgba(255,246,236,0.55)');
    grad.addColorStop(1, 'rgba(255,246,236,0)');
    g.fillStyle = grad;
    g.fillRect(0, y - 10, S, 20);
  }
  speckle(g, rng, S, S, 500, ['#c98a80', '#f6e6e0'], 0.5, 1.2);
  muscleTex = finish(c, 2, 2);
  return muscleTex;
}
