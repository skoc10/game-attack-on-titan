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

/** WebAudio ile sentezlenen efektler, dev sesleri ve savaş müziği; harici ses dosyası yok. */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private master: GainNode | null = null;
  /** Efektlerin bağlandığı ana hat: doğrudan çıkışa ve yankıya gider. */
  private bus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
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
      const verb = ctx.createConvolver();
      const len = Math.floor(sr * 1.8);
      const ir = ctx.createBuffer(2, len, sr);
      for (let c = 0; c < 2; c++) {
        const ch = ir.getChannelData(c);
        for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
      verb.buffer = ir;
      const wet = ctx.createGain();
      wet.gain.value = 0.22;
      this.bus.connect(verb).connect(wet).connect(this.master);
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = 0;
      this.musicBus.connect(this.master);
      this.musicBus.connect(verb);

      // Rüzgâr: sürekli çalan süzülmüş gürültü; hızlandıkça yükselir ve incelir.
      const wind = ctx.createBufferSource();
      wind.buffer = this.noiseBuf;
      wind.loop = true;
      this.windFilter = ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 320;
      this.windFilter.Q.value = 0.6;
      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0.03;
      wind.connect(this.windFilter).connect(this.windGain).connect(this.master);
      wind.start();
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
  /** Kesmeyen ya da öldürmeyen kılıç darbesi. */
  hit() {
    this.noise(0.16, 0.7, 1400, 250, 1.4);
    this.tone('sawtooth', 170, 55, 0.22, 0.3);
    this.tone('triangle', 2400, 1700, 0.12, 0.12);
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
  /** Dönüşüm: yıldırım çatırtısı, ardından uzun gök gürültüsü. */
  transform() {
    this.noise(0.12, 1, 9000, 1500, 0.7, 0, this.bus, 'highpass');
    this.noise(1.6, 1, 5000, 120, 0.5, 0.05);
    this.tone('sawtooth', 58, 22, 1.8, 0.9);
    this.tone('square', 2000, 80, 0.5, 0.3);
    this.noise(2.6, 0.6, 180, 40, 0.6, 0.3, this.bus, 'lowpass');
    this.tone('sine', 44, 30, 2.4, 0.8, 0.2);
  }
  /** Oyuncunun dev formundaki kükremesi. */
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
  frame(listener: Listener, speed: number, intensity: number, playing: boolean) {
    this.listener = listener;
    const ctx = this.ctx;
    if (!ctx || !this.musicBus || !this.windGain || !this.windFilter) return;
    const now = ctx.currentTime;
    const rush = Math.min(1, speed / 45);
    this.windGain.gain.setTargetAtTime(playing ? 0.03 + rush * rush * 0.3 : 0.015, now, 0.25);
    this.windFilter.frequency.setTargetAtTime(300 + rush * 1500, now, 0.25);
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
  }
}
