/** WebAudio ile sentezlenen efektler; harici ses dosyası yok. */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private master: GainNode | null = null;

  /** İlk kullanıcı etkileşiminde çağrılmalı. */
  unlock() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, len);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, f0: number, f1: number, q = 1, delay = 0) {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5, dur + 0.05);
  }

  swing() {
    this.noise(0.18, 0.5, 2400, 600, 2);
  }
  hook() {
    this.noise(0.12, 0.6, 3000, 1200, 4);
    this.tone('square', 900, 300, 0.08, 0.15);
  }
  gas() {
    this.noise(0.25, 0.25, 5000, 2500, 0.8);
  }
  hit() {
    this.noise(0.2, 0.8, 900, 200, 1.5);
    this.tone('sawtooth', 180, 60, 0.2, 0.3);
  }
  clang() {
    this.tone('square', 1400, 900, 0.15, 0.25);
    this.tone('triangle', 2100, 1500, 0.2, 0.2);
  }
  kill() {
    this.noise(0.9, 0.7, 500, 2500, 0.7);
    this.tone('sine', 220, 440, 0.35, 0.3);
    this.tone('sine', 330, 660, 0.4, 0.25, 0.1);
  }
  hurt() {
    this.tone('sawtooth', 160, 50, 0.3, 0.5);
    this.noise(0.2, 0.5, 400, 150, 1);
  }
  stomp() {
    this.tone('sine', 70, 28, 0.5, 0.9);
    this.noise(0.4, 0.5, 200, 60, 0.8);
  }
  pickup() {
    this.tone('triangle', 520, 780, 0.12, 0.3);
    this.tone('triangle', 780, 1040, 0.18, 0.3, 0.1);
  }
  whistle() {
    this.tone('sine', 1500, 2300, 0.18, 0.25);
    this.tone('sine', 2300, 1700, 0.22, 0.25, 0.18);
  }
  levelUp() {
    [392, 494, 587, 784].forEach((f, i) => this.tone('triangle', f, f, 0.25, 0.3, i * 0.11));
  }
  transform() {
    this.noise(1.2, 1.0, 6000, 200, 0.5);
    this.tone('sawtooth', 50, 25, 1.4, 0.9);
    this.tone('square', 1800, 90, 0.5, 0.3);
  }
  roar() {
    this.tone('sawtooth', 130, 55, 1.3, 0.9);
    this.tone('sawtooth', 197, 70, 1.3, 0.5);
    this.noise(1.2, 0.6, 700, 250, 0.6);
  }
}
