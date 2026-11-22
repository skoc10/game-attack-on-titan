import { comboPitch, spatial, voicePitch, type IdleVoice, type Listener } from './audioMath';

export type GiantSound = IdleVoice | 'shriek' | 'grunt' | 'pain' | 'death' | 'rattle';

/** Perde eğrisi: [sürenin oranı 0..1, temel perdenin katı]. */
type Contour = [number, number][];

interface Vocal {
  dur: number;
  f: Contour;
  vol: number;
  /** İki ağız boşluğu rezonansı (Hz): sesin "a/o/u" rengini verir. */
  formants: [number, number];
  vibHz?: number;
  vibDepth?: number;
  /** Titreme (gurultu/hırıltı) hızı. */
  tremHz?: number;
  /** Nefes/hırıltı gürültüsü oranı. */
  breath?: number;
}

// Savaş davulu: 16'lık adımlarla bir ölçü. Rakam vuruşun şiddetidir.
const DRUM = [1, 0, 0, 0.6, 0, 0, 0.8, 0, 1, 0, 0, 0.6, 0, 0.5, 0.8, 0];
const TOM = [0, 0, 0.5, 0, 0.4, 0, 0, 0.5, 0, 0, 0.5, 0, 0.6, 0, 0, 0.7];
// Bas yürüyüşü (re minör): her vuruşta bir nota, Hz.
const BASS = [73.4, 73.4, 87.3, 65.4, 73.4, 73.4, 98, 87.3];
const STEP = 60 / 132 / 4;
// Savaş müziğinin yaylı katmanı: her ölçüde bir akor (re minör: Dm, B♭, F, C), Hz.
const PAD: number[][] = [
  [146.8, 174.6, 220],
  [116.5, 146.8, 174.6],
  [174.6, 220, 261.6],
  [130.8, 164.8, 196],
];

/** Ortam: bulunulan yerin orman yoğunluğu (0..1) ve rüzgârın o anki şiddeti (0..1). */
export interface Ambience {
  forest: number;
  gust: number;
}

/** Ortam sesinin bir katmanı: süzülmüş, sürekli çalan gürültü. */
interface Layer {
  gain: GainNode;
  filter: BiquadFilterNode;
}

/** WebAudio ile sentezlenen efektler, dev sesleri ve savaş müziği; harici ses dosyası yok. */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private master: GainNode | null = null;
  /** Efektlerin bağlandığı ana hat: doğrudan çıkışa ve yankıya gider. */
  private bus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  /** Rüzgâr katmanları: alçak uğultu, ıslıklı esinti; ormanda yaprak hışırtısı (iki yanda ayrı). */
  private windLow: Layer | null = null;
  private windMid: Layer | null = null;
  private leaves: Layer[] = [];
  private birdT = 4;
  private creakT = 8;
  private listener: Listener = { x: 0, z: 0, yaw: 0 };
  private intensity = 0;
  private nextStep = 0;
  private stepNo = 0;
  private vocals = 0;
  private lastStepT = 0;
  private combo = 0;
  private comboT = 0;

  /** İlk kullanıcı etkileşiminde çağrılmalı. */
  unlock() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctor();
      this.ctx = ctx;
      const sr = ctx.sampleRate;
      this.noiseBuf = ctx.createBuffer(1, sr * 2, sr);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

      // Çıkış zinciri: sıkıştırıcı ani patlamaları dengeler, yankı sese açık hava derinliği katar.
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 5;
      comp.attack.value = 0.004;
      comp.release.value = 0.2;
      this.master = ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(comp).connect(ctx.destination);
      this.bus = ctx.createGain();
      this.bus.connect(this.master);
      // Yankı: iki kanalda ayrı, erken yansımalı ve tizleri sönümlenen bir açık hava kuyruğu.
      const verb = ctx.createConvolver();
      const len = Math.floor(sr * 2.2);
      const ir = ctx.createBuffer(2, len, sr);
      for (let c = 0; c < 2; c++) {
        const ch = ir.getChannelData(c);
        let lp = 0;
        for (let i = 0; i < len; i++) {
          const t = i / len;
          // Zamanla tizleri yutulan gürültü: yumuşak bir kuyruk.
          const k = 0.35 + t * 0.6;
          lp += (Math.random() * 2 - 1 - lp) * (1 - k);
          ch[i] = lp * Math.pow(1 - t, 2.4) * 1.6;
        }
        // Erken yansımalar: uzak tepelerden ve surlardan dönen birkaç belirgin yankı.
        for (const [ms, a] of [[23, 0.5], [41, 0.35], [67, 0.28], [97, 0.2], [151, 0.12]]) {
          const at = Math.floor(((ms + c * 7) / 1000) * sr);
          if (at < len) ch[at] += a * (c ? -1 : 1);
        }
      }
      verb.buffer = ir;
      const damp = ctx.createBiquadFilter();
      damp.type = 'lowpass';
      damp.frequency.value = 5200;
      const wet = ctx.createGain();
      wet.gain.value = 0.26;
      this.bus.connect(verb).connect(damp).connect(wet).connect(this.master);
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = 0;
      this.musicBus.connect(this.master);
      this.musicBus.connect(verb);

      // Ortam: sürekli çalan süzülmüş gürültü katmanları. Hızlandıkça, rüzgâr esince ve ormanda yükselir.
      const layer = (type: BiquadFilterType, freq: number, q: number, pan: number, offset: number): Layer => {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = freq;
        filter.Q.value = q;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        let node: AudioNode = src.connect(filter).connect(gain);
        if (pan !== 0 && ctx.createStereoPanner) {
          const p = ctx.createStereoPanner();
          p.pan.value = pan;
          node = node.connect(p);
        }
        node.connect(this.master!);
        src.start(0, offset);
        return { gain, filter };
      };
      this.windLow = layer('lowpass', 160, 0.7, 0, 0);
      this.windMid = layer('bandpass', 420, 0.8, 0, 0.6);
      this.leaves = [layer('highpass', 2600, 0.5, -0.65, 0.3), layer('highpass', 3200, 0.5, 0.65, 1.1)];
    } catch {
      this.ctx = null;
    }
  }

  // ---------------------------------------------------------------- yapı taşları
  private out(pan: number) {
    if (!this.ctx || !this.bus) return null;
    if (Math.abs(pan) < 0.02 || !this.ctx.createStereoPanner) return this.bus;
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    p.connect(this.bus);
    return p;
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0, dest: AudioNode | null = this.bus, attack = 0.004) {
    if (!this.ctx || !dest) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, f0), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  private noise(dur: number, vol: number, f0: number, f1: number, q = 1, delay = 0, dest: AudioNode | null = this.bus, type: BiquadFilterType = 'bandpass') {
    if (!this.ctx || !dest || !this.noiseBuf) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 1.5, dur + 0.05);
  }

  /** İnsansı ses: testere dişi dalga iki rezonans süzgecinden geçer; perde eğrisi sese karakter verir. */
  private vocal(base: number, v: Vocal, pan: number, delay = 0) {
    const ctx = this.ctx;
    const dest = this.out(pan);
    if (!ctx || !dest || v.vol < 0.004) return;
    const t = ctx.currentTime + delay;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(v.vol, t + Math.min(0.08, v.dur * 0.25));
    env.gain.setValueAtTime(v.vol, t + v.dur * 0.7);
    env.gain.exponentialRampToValueAtTime(0.0001, t + v.dur);
    env.connect(dest);
    const mix = ctx.createGain();
    for (const [freq, q, gain] of [
      [v.formants[0], 5, 1],
      [v.formants[1], 7, 0.6],
    ]) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = freq;
      bp.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = gain;
      mix.connect(bp).connect(g).connect(env);
    }
    const stop = t + v.dur + 0.05;
    for (const [type, mult, gain] of [
      ['sawtooth', 1, 1],
      ['square', 0.5, 0.45],
    ] as [OscillatorType, number, number][]) {
      const o = ctx.createOscillator();
      o.type = type;
      const f = o.frequency;
      f.setValueAtTime(Math.max(20, base * v.f[0][1] * mult), t);
      for (const [u, k] of v.f.slice(1)) f.exponentialRampToValueAtTime(Math.max(20, base * k * mult), t + v.dur * u);
      if (v.vibHz) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = v.vibHz;
        const depth = ctx.createGain();
        depth.gain.value = (v.vibDepth ?? 5) * mult;
        lfo.connect(depth).connect(f);
        lfo.start(t);
        lfo.stop(stop);
      }
      const g = ctx.createGain();
      g.gain.value = gain;
      o.connect(g).connect(mix);
      o.start(t);
      o.stop(stop);
    }
    if (v.tremHz) {
      // Hırıltı: ses şiddeti hızla açılıp kapanır.
      const lfo = ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = v.tremHz;
      const depth = ctx.createGain();
      depth.gain.value = 0.5;
      mix.gain.value = 0.5;
      lfo.connect(depth).connect(mix.gain);
      lfo.start(t);
      lfo.stop(stop);
    }
    if (v.breath) this.noise(v.dur, v.vol * v.breath, v.formants[1], v.formants[0], 1.2, delay, dest);
    this.vocals += 1;
    setTimeout(() => (this.vocals -= 1), (delay + v.dur) * 1000);
  }

  // ---------------------------------------------------------------- oyuncu
  swing() {
    this.noise(0.2, 0.45, 3200, 500, 1.6);
    this.noise(0.12, 0.25, 7000, 2500, 3, 0.03);
  }
  hook() {
    this.noise(0.09, 0.7, 2400, 900, 2); // basınçlı hava
    this.tone('square', 1100, 260, 0.07, 0.16);
    this.tone('triangle', 3200, 2400, 0.25, 0.1, 0.05); // tel sesi
    this.noise(0.3, 0.12, 5200, 3000, 6, 0.05);
  }
  gas() {
    this.noise(0.28, 0.24, 5200, 2200, 0.8);
  }
  /** Koza kurulurken: camsı, yükselen çınlamalar. */
  crystal() {
    [880, 1320, 1760, 2640].forEach((f, i) => this.tone('sine', f, f * 1.01, 0.7, 0.16, i * 0.05));
    this.noise(0.5, 0.3, 6000, 9000, 4);
    this.tone('triangle', 220, 440, 0.5, 0.2);
  }
  /** Koza kırılırken: cam şangırtısı ve tok bir patlama. */
  shatter() {
    this.noise(0.5, 0.9, 9000, 3000, 1.2, 0, this.bus, 'highpass');
    for (let i = 0; i < 6; i++) this.tone('triangle', 2400 + Math.random() * 3000, 1800, 0.25, 0.12, i * 0.03);
    this.tone('sine', 110, 40, 0.5, 0.7);
  }
  /** Mızrak fırlatma: basınçlı hava ve ıslık. */
  spearFire() {
    this.noise(0.14, 0.8, 1800, 500, 1.5);
    this.tone('sawtooth', 300, 1400, 0.3, 0.14);
    this.noise(0.5, 0.25, 4000, 7000, 3, 0.05);
  }
  /** Sur topu: derin bir gümbürtü ve uzun yankı. */
  cannonFire() {
    this.tone('sine', 95, 28, 0.8, 0.9);
    this.noise(0.22, 0.85, 2600, 300, 0.7);
    this.noise(1.6, 0.45, 600, 70, 0.5, 0.03, undefined, 'lowpass');
  }
  /** Patlama: çatırtı, derin vuruş ve yankılanan gürleme. Uzaklaştıkça kısılır. */
  explosion(x: number, z: number) {
    const sp = spatial(this.listener, x, z, 70);
    const v = Math.max(0.15, sp.gain);
    const dest = this.out(sp.pan);
    this.noise(0.1, v, 6000, 900, 0.6, 0, dest, 'highpass');
    this.tone('sine', 120, 26, 0.9, v, 0, dest);
    this.noise(1.1, v * 0.9, 700, 60, 0.6, 0.02, dest, 'lowpass');
    this.noise(1.8, v * 0.35, 2400, 300, 0.5, 0.08, dest);
  }
  /** Çelik Soyu uyanışı: iki derin kalp atışı, yükselen çelik çınlaması ve keskin bir soluk. */
  awaken() {
    for (const d of [0, 0.32]) {
      this.tone('sine', 62, 34, 0.3, 0.9, d);
      this.noise(0.12, 0.35, 220, 60, 0.9, d, this.bus, 'lowpass');
    }
    this.tone('triangle', 900, 2600, 0.6, 0.16, 0.5);
    this.tone('sine', 3200, 4100, 0.9, 0.08, 0.55);
    this.noise(0.35, 0.4, 6000, 2400, 1.4, 0.5, this.bus, 'highpass');
  }
  /** Ev çöküşü: kırılan kirişlerin çatırtısı, dökülen taş ve kiremit, derin bir gümbürtü. Uzaklaştıkça kısılır. */
  crumble(x: number, z: number, size = 1) {
    const sp = spatial(this.listener, x, z, 60);
    const v = Math.max(0.12, sp.gain) * size;
    const dest = this.out(sp.pan);
    this.tone('sine', 70, 28, 0.9, v * 0.8, 0, dest);
    this.noise(1.4, v * 0.7, 900, 90, 0.6, 0, dest, 'lowpass');
    // Kirişler çatırdar, taşlar ve kiremitler döküldükçe tıkırdar.
    for (let i = 0; i < 9; i++) this.noise(0.05 + Math.random() * 0.06, v * (0.25 + Math.random() * 0.35), 1400 + Math.random() * 2600, 400, 1.5, Math.random() * 0.25, dest);
    for (let i = 0; i < 12; i++) this.noise(0.04, v * (0.12 + Math.random() * 0.2), 3000 + Math.random() * 4000, 1500, 3, 0.25 + Math.random() * 1.1, dest);
    this.noise(1.8, v * 0.3, 2400, 600, 0.5, 0.1, dest);
  }
  /** Dev formunun ışını: yükselen vızıltı ve yakıcı hışırtı. */
  beam() {
    this.tone('sawtooth', 180, 900, 0.5, 0.35);
    this.tone('square', 1400, 2600, 0.6, 0.12);
    this.noise(0.8, 0.6, 3000, 8000, 1.5);
    this.tone('sine', 70, 40, 0.8, 0.6);
  }
  /** Kesmeyen ya da öldürmeyen kılıç darbesi. */
  hit() {
    this.noise(0.16, 0.7, 1400, 250, 1.4);
    this.tone('sawtooth', 170, 55, 0.22, 0.3);
    this.tone('triangle', 2400, 1700, 0.12, 0.12);
  }
  /** Gardda karşılanan darbe: tok bir et ve kemik vuruşu. */
  block() {
    this.tone('sine', 140, 55, 0.25, 0.7);
    this.noise(0.14, 0.6, 900, 200, 1.2, 0, this.bus, 'lowpass');
    this.tone('triangle', 420, 260, 0.1, 0.18);
  }
  /** Tekme savruluşu: ağır, alçak bir hışırtı. */
  kick() {
    this.noise(0.3, 0.5, 1400, 260, 1.2);
    this.tone('sine', 90, 50, 0.25, 0.25, 0.05);
  }
  clang() {
    this.tone('square', 1500, 950, 0.16, 0.22);
    this.tone('triangle', 2250, 1600, 0.3, 0.2);
    this.tone('sine', 3400, 3100, 0.5, 0.08);
    this.noise(0.06, 0.4, 5000, 3000, 2);
  }
  /** Enseyi kesen temiz darbe: çelik çınlaması ve et sesi. `power` 0..1 hızla artar. */
  slash(power: number) {
    const p = Math.max(0, Math.min(1, power));
    this.noise(0.24 + p * 0.1, 0.55 + p * 0.3, 7500, 1800, 2.5, 0, this.bus, 'highpass');
    this.tone('triangle', 3000 + p * 1200, 2100, 0.4, 0.2);
    this.tone('sine', 4700 + p * 900, 4300, 0.6, 0.09);
    this.noise(0.22, 0.8, 520, 110, 1, 0.02, this.bus, 'lowpass');
    this.tone('sine', 120, 42, 0.3, 0.5 + p * 0.3, 0.02);
  }
  /**
   * Dev öldü: buhar patlaması, derin vuruş ve kısa bir zafer akoru.
   * Art arda öldürmelerde akor her seferinde yarım ses yükselir.
   */
  kill(boss = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.combo = now - this.comboT < 7 ? this.combo + 1 : 1;
    this.comboT = now;
    const k = comboPitch(this.combo);
    this.noise(1.3, 0.4, 900, 5200, 0.6, 0.05); // buhar
    this.tone('sine', 95, 32, 0.7, 0.9);
    const root = (boss ? 98 : 146.8) * k;
    for (const [mult, vol, delay] of [
      [1, 0.2, 0],
      [1.5, 0.16, 0],
      [2, 0.14, 0.09],
      [3, 0.08, 0.09],
    ]) {
      this.tone('sawtooth', root * mult, root * mult, boss ? 1.4 : 0.6, vol, delay + 0.06, this.bus, 0.02);
    }
    if (boss) {
      this.tone('sine', 55, 24, 2.2, 1);
      this.noise(2.4, 0.5, 300, 60, 0.7, 0.1, this.bus, 'lowpass');
    }
  }
  /** Çene kapanışı: dişlerin çarpması, ezilme ve alçak bir vuruş. `size` 0.3..1.5: büyüdükçe kalınlaşır. */
  bite(size = 1) {
    const s = Math.max(0.3, Math.min(1.5, size));
    this.noise(0.05, 0.9, 2800, 900, 3);
    this.tone('square', 440 - s * 130, 90, 0.07, 0.3);
    this.noise(0.3, 0.75 * s, 720, 110, 1, 0.03, this.bus, 'lowpass');
    this.tone('sine', 115 - s * 30, 34, 0.38, 0.75, 0.02);
    this.noise(0.12, 0.25, 4200, 2400, 2, 0.05);
  }
  hurt() {
    this.tone('sawtooth', 170, 48, 0.32, 0.5);
    this.noise(0.22, 0.6, 500, 130, 1);
    this.tone('sine', 62, 30, 0.4, 0.6);
  }
  /** Ağır yere vuruş. `size` 0..1: büyüdükçe daha derin ve uzun. */
  stomp(size = 0.6) {
    const s = Math.max(0.15, Math.min(1.5, size));
    this.tone('sine', 78 - s * 22, 26, 0.45 + s * 0.4, 0.9);
    this.noise(0.35 + s * 0.3, 0.55, 240, 50, 0.8, 0, this.bus, 'lowpass');
    this.noise(0.5, 0.2 * s, 1800, 500, 0.7, 0.04); // savrulan toprak
  }
  pickup() {
    this.tone('triangle', 520, 780, 0.12, 0.3);
    this.tone('triangle', 780, 1040, 0.18, 0.3, 0.1);
    this.tone('sine', 1560, 1560, 0.3, 0.1, 0.2);
  }
  whistle() {
    this.tone('sine', 1500, 2300, 0.18, 0.25);
    this.tone('sine', 2300, 1700, 0.22, 0.25, 0.18);
  }
  levelUp() {
    [392, 494, 587, 784].forEach((f, i) => {
      this.tone('triangle', f, f, 0.3, 0.3, i * 0.11);
      this.tone('sawtooth', f / 2, f / 2, 0.3, 0.08, i * 0.11);
    });
  }
  /** Kabaran gürültü: yavaşça yükselip söner (buhar fışkırması, uzayan tıslama). */
  private swell(dur: number, vol: number, f0: number, f1: number, q = 1, delay = 0, peak = 0.6, type: BiquadFilterType = 'bandpass') {
    if (!this.ctx || !this.bus || !this.noiseBuf) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * peak);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.bus);
    src.start(t, Math.random() * 0.4, dur + 0.05);
  }

  /**
   * Dönüşüm: yıldırım çatırtısı ve gök gürültüsü; ardından kabaran buhar, kalp atışı gibi gümbürtüler,
   * çatırdayan et ve kemik, en sonda devin ilk kükreyişi. Toplam ~3 sn; kükreme `roarAt` saniyede gelir.
   */
  transform(roarAt = 1, k = 1) {
    // Çakma
    this.noise(0.12, 1 * k, 9000, 1500, 0.7, 0, this.bus, 'highpass');
    this.tone('square', 2000, 80, 0.5, 0.3 * k);
    this.noise(0.35, 0.8 * k, 3200, 400, 0.6, 0.02);
    // Gök gürültüsü
    this.noise(1.6, 1 * k, 5000, 120, 0.5, 0.05);
    this.tone('sawtooth', 58, 22, 1.8, 0.9 * k);
    this.noise(2.6, 0.6 * k, 180, 40, 0.6, 0.3, this.bus, 'lowpass');
    this.tone('sine', 44, 30, 2.4, 0.8 * k, 0.2);
    // Dev gövdesi buharın içinde kabarır.
    this.swell(roarAt + 0.6, 0.55 * k, 700, 4200, 0.7, 0.08, 0.7);
    this.swell(roarAt + 1.2, 0.35 * k, 260, 90, 0.8, 0.1, 0.55, 'lowpass');
    for (const d of [0.22, 0.5, 0.74]) {
      this.tone('sine', 78, 34, 0.32, 0.85 * k, d);
      this.noise(0.18, 0.4 * k, 260, 60, 0.9, d, this.bus, 'lowpass');
    }
    // Çatırdayan et ve kemik
    for (let i = 0; i < 14; i++) {
      const d = 0.12 + Math.random() * (roarAt - 0.2);
      this.noise(0.04 + Math.random() * 0.05, (0.35 + Math.random() * 0.3) * k, 1800 + Math.random() * 1600, 300, 1.4, d);
    }
    // İlk kükreyiş: iki katmanlı ses ve yere inen gümbürtü
    this.vocal(70, { dur: 2.1, f: [[0, 0.9], [0.12, 1.45], [0.55, 1.25], [1, 0.55]], vol: k, formants: [480, 1050], tremHz: 27, breath: 0.6 }, 0, roarAt);
    this.vocal(142, { dur: 1.8, f: [[0, 1], [0.15, 1.35], [1, 0.7]], vol: 0.35 * k, formants: [700, 1600], tremHz: 40, breath: 0.8 }, 0, roarAt + 0.05);
    this.tone('sawtooth', 55, 28, 2, 0.7 * k, roarAt);
    this.noise(1.9, 0.55 * k, 900, 200, 0.6, roarAt);
    this.tone('sine', 50, 26, 1.2, 0.9 * k, roarAt);
    this.swell(1.4, 0.4 * k, 2600, 900, 0.6, roarAt + 0.3, 0.3);
  }

  /** Buhar gücü: güçlü bir fışkırma, ardından süre boyunca kaynayan tıslama ve kaynama gürültüsü. */
  steam(dur = 3) {
    this.noise(0.5, 0.7, 6000, 1800, 0.6, 0, this.bus, 'highpass');
    this.swell(dur + 0.4, 0.5, 3800, 1600, 0.5, 0.05, 0.2);
    this.swell(dur + 0.2, 0.35, 900, 300, 0.7, 0.1, 0.3);
    this.swell(dur, 0.25, 220, 80, 0.8, 0.1, 0.4, 'lowpass');
    for (let i = 0; i < 10; i++) this.noise(0.06, 0.2 + Math.random() * 0.2, 1200 + Math.random() * 1800, 400, 1.6, 0.2 + Math.random() * dur);
  }

  /** Dev formunun ağzından çıkan buharlı soluk: hafif bir tıslama ve hırıltı. */
  exhale(size = 1) {
    this.swell(1.1, 0.12 * size, 2400, 900, 0.7, 0, 0.25);
    this.swell(0.9, 0.08 * size, 300, 120, 0.8, 0.05, 0.3, 'lowpass');
  }

  /**
   * Haykırış: derin, uzun ve katmanlı bir savaş kükreyişi; uzak tepelerden gecikmeli yankısı döner.
   */
  warcry() {
    this.vocal(78, { dur: 2.8, f: [[0, 0.95], [0.1, 1.55], [0.6, 1.4], [1, 0.62]], vol: 1, formants: [500, 1120], tremHz: 29, breath: 0.55 }, 0);
    this.vocal(156, { dur: 2.5, f: [[0, 1.05], [0.12, 1.5], [1, 0.8]], vol: 0.4, formants: [760, 1700], vibHz: 6, vibDepth: 10, breath: 0.7 }, 0, 0.04);
    this.vocal(52, { dur: 2.6, f: [[0, 1], [0.2, 1.3], [1, 0.7]], vol: 0.45, formants: [300, 700], tremHz: 21, breath: 0.4 }, 0, 0.02);
    this.tone('sawtooth', 62, 30, 2.6, 0.7);
    this.noise(2.4, 0.55, 900, 180, 0.6);
    this.tone('sine', 46, 24, 1.8, 0.9);
    // Uzaktan dönen yankılar: sağdan ve soldan, kısılarak.
    for (const [d, pan, k] of [[0.55, -0.7, 0.3], [0.9, 0.7, 0.2], [1.4, -0.4, 0.12]]) {
      this.vocal(78, { dur: 2.2, f: [[0, 1.5], [0.5, 1.35], [1, 0.62]], vol: k, formants: [480, 1000], tremHz: 29, breath: 0.6 }, pan, d);
    }
  }

  roar() {
    this.vocal(92, { dur: 1.7, f: [[0, 1.2], [0.15, 1.5], [1, 0.6]], vol: 0.9, formants: [520, 1150], tremHz: 31, breath: 0.5 }, 0);
    this.tone('sawtooth', 68, 38, 1.6, 0.6);
    this.noise(1.5, 0.5, 800, 220, 0.6);
  }

  // ---------------------------------------------------------------- devler
  /**
   * Bir devin sesi. Boy perdeyi, uzaklık şiddeti, yön sağ/sol dengeyi belirler.
   * Çok uzaktaki ya da aynı anda fazla sayıdaki ses çalınmaz.
   */
  giant(kind: GiantSound, h: number, x: number, z: number, loud = 1) {
    if (!this.ctx || this.vocals >= 7) return;
    const sp = spatial(this.listener, x, z, 22 + h * 2.2);
    const vol = Math.min(1, sp.gain * loud * (0.5 + h * 0.035));
    if (vol < 0.02) return;
    const b = voicePitch(h) * (0.94 + Math.random() * 0.12);
    const pan = sp.pan;
    switch (kind) {
      case 'moan': // uzun, boş inilti
        this.vocal(b, { dur: 1.6 + Math.random() * 0.9, f: [[0, 0.9], [0.35, 1.12], [1, 0.74]], vol: vol * 0.5, formants: [430, 880], vibHz: 4.5, vibDepth: 4, breath: 0.25 }, pan);
        break;
      case 'growl': // gırtlaktan hırıltı
        this.vocal(b * 0.62, { dur: 1 + Math.random() * 0.5, f: [[0, 1], [1, 0.8]], vol: vol * 0.6, formants: [310, 720], tremHz: 24 + Math.random() * 10, breath: 0.4 }, pan);
        break;
      case 'giggle': {
        // tuhaf: kesik kesik, giderek alçalan kıkırtı
        const n = 4 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) {
          const k = 2.5 - i * 0.14;
          this.vocal(b, { dur: 0.1, f: [[0, k], [1, k * 0.72]], vol: vol * 0.42, formants: [820, 1900] }, pan, i * 0.135);
        }
        break;
      }
      case 'gurgle': // tuhaf: boğazda su varmış gibi
        this.vocal(b * 0.9, { dur: 1.3 + Math.random() * 0.6, f: [[0, 1], [0.5, 1.25], [1, 0.9]], vol: vol * 0.5, formants: [360, 1300], vibHz: 9, vibDepth: 28, tremHz: 11, breath: 0.3 }, pan);
        break;
      case 'hum': {
        // tuhaf: üç notalı, ürkütücü bir mırıltı
        const notes = [1.5, 1.26, 1.5, 1.12];
        notes.forEach((k, i) => this.vocal(b, { dur: 0.42, f: [[0, k], [1, k * 0.985]], vol: vol * 0.36, formants: [300, 2300], vibHz: 5.5, vibDepth: 3 }, pan, i * 0.4));
        break;
      }
      case 'shriek': // koşucu ve sıçrayanların saldırı çığlığı
        this.vocal(b, { dur: 0.75, f: [[0, 1.9], [0.3, 3.1], [1, 1.5]], vol: vol * 0.6, formants: [950, 2500], vibHz: 14, vibDepth: 20, breath: 0.5 }, pan);
        break;
      case 'grunt': // saldırı öncesi kısa homurtu
        this.vocal(b, { dur: 0.32, f: [[0, 1.15], [1, 0.78]], vol: vol * 0.6, formants: [520, 1020], breath: 0.3 }, pan);
        break;
      case 'pain': // bacağı kesilince acı haykırışı
        this.vocal(b, { dur: 0.8, f: [[0, 1.4], [0.2, 2.1], [1, 0.9]], vol: vol * 0.7, formants: [720, 1550], vibHz: 11, vibDepth: 12, breath: 0.4 }, pan);
        break;
      case 'death': // ayakta ölüm: uzun, sönerek alçalan böğürme
        this.vocal(b, { dur: 2.3, f: [[0, 1.5], [0.12, 1.75], [1, 0.42]], vol: vol * 0.8, formants: [600, 1250], vibHz: 6, vibDepth: 9, tremHz: 17, breath: 0.5 }, pan);
        break;
      case 'rattle': // yerde ölüm: kısa çığlık ve hırıltılı son nefes
        this.vocal(b, { dur: 0.45, f: [[0, 1.9], [1, 1.2]], vol: vol * 0.75, formants: [760, 1650], breath: 0.5 }, pan);
        this.vocal(b * 0.6, { dur: 1.9, f: [[0, 1], [1, 0.5]], vol: vol * 0.6, formants: [330, 800], tremHz: 13, breath: 0.7 }, pan, 0.4);
        break;
    }
  }

  /** Yürüyen devin adımı; yakındaki büyük devlerde duyulur. */
  footstep(h: number, x: number, z: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastStepT < 0.07) return;
    const sp = spatial(this.listener, x, z, 12 + h * 2);
    const vol = sp.gain * Math.min(1, h / 16);
    if (vol < 0.03) return;
    this.lastStepT = now;
    const dest = this.out(sp.pan);
    this.tone('sine', 74 - Math.min(30, h), 30, 0.28 + h * 0.012, vol * 0.8, 0, dest);
    this.noise(0.22, vol * 0.4, 260, 70, 0.8, 0, dest, 'lowpass');
  }

  // ---------------------------------------------------------------- müzik ve ortam
  /**
   * Her karede çağrılır: dinleyiciyi günceller, rüzgârı hıza göre ayarlar ve
   * savaş yoğunluğuna göre davul/bas vuruşlarını birkaç yüz milisaniye önceden planlar.
   */
  frame(listener: Listener, speed: number, intensity: number, playing: boolean, amb: Ambience = { forest: 0, gust: 0.5 }) {
    this.listener = listener;
    const ctx = this.ctx;
    if (!ctx || !this.musicBus || !this.windLow || !this.windMid) return;
    const now = ctx.currentTime;
    const rush = Math.min(1, speed / 45);
    const on = playing ? 1 : 0.4;
    const f = amb.forest;
    const gust = amb.gust;
    // Uğultu ve esinti: rüzgâr estikçe dalgalanır, ormanda ağaçların arasında daha gür çıkar.
    this.windLow.gain.gain.setTargetAtTime(on * (0.05 + gust * 0.07 + f * 0.06 + rush * 0.12), now, 0.4);
    this.windMid.gain.gain.setTargetAtTime(on * (0.012 + gust * gust * 0.05 + f * 0.035 + rush * rush * 0.28), now, 0.3);
    this.windMid.filter.frequency.setTargetAtTime(320 + gust * 260 + rush * 1500, now, 0.4);
    // Yaprak hışırtısı: yalnızca ağaçların arasında; kısa kıpırtılarla titrer.
    for (const [i, l] of this.leaves.entries()) {
      const flutter = 0.6 + Math.random() * 0.8;
      l.gain.gain.setTargetAtTime(on * f * (0.012 + gust * 0.05) * flutter, now, 0.08 + i * 0.03);
      l.filter.frequency.setTargetAtTime(2400 + gust * 1600 + i * 500, now, 0.5);
    }
    if (playing) this.wildlife(f, gust);
    this.intensity = playing ? intensity : 0;
    this.musicBus.gain.setTargetAtTime(this.intensity > 0.05 ? 0.35 + this.intensity * 0.45 : 0, now, this.intensity > 0.05 ? 0.4 : 1.2);
    if (this.intensity <= 0.05) {
      this.nextStep = 0;
      return;
    }
    if (this.nextStep < now) {
      this.nextStep = now + 0.05;
      this.stepNo = 0;
    }
    while (this.nextStep < now + 0.25) {
      this.beat(this.stepNo, this.nextStep - now);
      this.nextStep += STEP;
      this.stepNo += 1;
    }
  }

  /** Ormanın canlı sesleri: sakin anlarda kuş cıvıltıları, sert rüzgârda gıcırdayan gövdeler. */
  private wildlife(forest: number, gust: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const dt = 1 / 60;
    this.birdT -= dt * (0.25 + forest * 1.2);
    if (this.birdT <= 0 && this.intensity < 0.2) {
      this.birdT = 3 + Math.random() * 7;
      this.bird(Math.random() * 1.6 - 0.8, 0.5 + forest * 0.5);
    }
    this.creakT -= dt * forest * gust;
    if (this.creakT <= 0) {
      this.creakT = 4 + Math.random() * 6;
      this.creak(Math.random() * 1.6 - 0.8, forest);
    }
  }

  /** Kuş: birkaç kısa, perdesi kayan ıslık; her çağrı farklı bir ezgi. */
  bird(pan = 0, loud = 1) {
    const dest = this.out(pan);
    if (!this.ctx || !dest) return;
    const base = 2300 + Math.random() * 1800;
    const n = 2 + Math.floor(Math.random() * 4);
    const up = Math.random() < 0.5;
    for (let i = 0; i < n; i++) {
      const f0 = base * (1 + (Math.random() - 0.5) * 0.25);
      const f1 = f0 * (up ? 1.35 : 0.7);
      const d = i * (0.11 + Math.random() * 0.06);
      this.tone('sine', f0, f1, 0.07 + Math.random() * 0.05, 0.035 * loud, d, dest, 0.01);
      this.tone('sine', f0 * 2, f1 * 2, 0.05, 0.006 * loud, d, dest, 0.01);
    }
  }

  /** Rüzgârda eğilen ağacın gövdesinden gelen alçak, uzun gıcırtı. */
  private creak(pan: number, loud: number) {
    const ctx = this.ctx;
    const dest = this.out(pan);
    if (!ctx || !dest) return;
    const t = ctx.currentTime;
    const dur = 0.6 + Math.random() * 0.7;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const f0 = 70 + Math.random() * 60;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f0 * (1.15 + Math.random() * 0.3), t + dur * 0.6);
    o.frequency.linearRampToValueAtTime(f0 * 0.95, t + dur);
    // Gıcırtının tırtıklı dokusu: hızlı titreşim.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 18 + Math.random() * 14;
    const lg = ctx.createGain();
    lg.gain.value = 0.5;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 600 + Math.random() * 500;
    bp.Q.value = 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03 * loud, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const am = ctx.createGain();
    am.gain.value = 0.5;
    lfo.connect(lg).connect(am.gain);
    o.connect(bp).connect(am).connect(g).connect(dest);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
  }

  /** Yaylı katman: bir akorun hafif akortsuz testere dişleri, yumuşak süzgeçle; yavaş açılır, yavaş söner. */
  private pad(freqs: number[], dur: number, vol: number, delay: number) {
    const ctx = this.ctx;
    const m = this.musicBus;
    if (!ctx || !m) return;
    const t = ctx.currentTime + delay;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(700, t);
    lp.frequency.linearRampToValueAtTime(1500, t + dur * 0.5);
    lp.frequency.linearRampToValueAtTime(800, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.25);
    g.gain.setValueAtTime(vol, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lp.connect(g).connect(m);
    for (const f of freqs) {
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = det;
        o.connect(lp);
        o.start(t);
        o.stop(t + dur + 0.05);
      }
    }
  }

  private beat(step: number, delay: number) {
    const i = step % 16;
    const v = this.intensity;
    const m = this.musicBus;
    const drum = DRUM[i];
    if (drum > 0) {
      this.tone('sine', 110, 42, 0.32, drum * 0.9, delay, m);
      this.noise(0.08, drum * 0.25, 900, 200, 1, delay, m);
    }
    // Yoğunluk arttıkça üst davul ve bas yürüyüşü katılır.
    if (v > 0.45 && TOM[i] > 0) this.tone('sine', 205, 120, 0.16, TOM[i] * 0.5 * v, delay, m);
    if (v > 0.3 && i % 2 === 0) {
      const f = BASS[(Math.floor(step / 2) + Math.floor(step / 32) * 3) % BASS.length];
      this.tone('sawtooth', f, f, STEP * 1.7, 0.16 * v, delay, m, 0.01);
      if (v > 0.8) this.tone('square', f * 2, f * 2, STEP * 1.2, 0.05, delay, m, 0.01);
    }
    if (v > 0.7 && i % 4 === 2) this.noise(0.05, 0.12, 7000, 5000, 3, delay, m, 'highpass');
    // Her ölçünün başında yaylılar bir akor çalar.
    if (v > 0.3 && i === 0) this.pad(PAD[Math.floor(step / 16) % PAD.length], STEP * 16, 0.035 + v * 0.03, delay);
  }
}
