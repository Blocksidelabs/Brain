/**
 * Procedural synthwave audio engine — original WebAudio composition,
 * no external assets, starts only after a user gesture.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private noiseBuf: AudioBuffer | null = null;
  private volume = 0.8;
  private musicOn = true;

  private static readonly CHORDS: number[][] = [
    [146.83, 174.61, 220.0, 293.66], // Dm
    [116.54, 146.83, 174.61, 233.08], // Bb
    [174.61, 220.0, 261.63, 349.23], // F
    [130.81, 164.81, 196.0, 261.63], // C
  ];
  private static readonly BASS = [73.42, 58.27, 87.31, 65.41];

  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.value = v * v;
  }

  setMusicOn(on: boolean): void {
    this.musicOn = on;
    if (!on) this.stopMusic();
  }

  /** Call when gameplay becomes active (user gesture context). */
  resume(): void {
    this.ensure();
    if (!this.ctx) return;
    void this.ctx.resume();
    if (this.musicOn && this.timer === null) this.startMusic();
  }

  /** Call when pausing / leaving gameplay. */
  suspend(): void {
    this.stopMusic();
    if (this.ctx) void this.ctx.suspend();
  }

  private ensure(): void {
    if (this.ctx) return;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume * this.volume;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.5;
    this.musicGain.connect(this.master);
    const len = Math.floor(this.ctx.sampleRate * 0.08);
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  private startMusic(): void {
    if (!this.ctx) return;
    this.nextTime = this.ctx.currentTime + 0.06;
    this.step = 0;
    this.timer = window.setInterval(() => this.schedule(), 90);
  }

  private stopMusic(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private schedule(): void {
    if (!this.ctx) return;
    const s8 = 60 / 84 / 2;
    while (this.nextTime < this.ctx.currentTime + 0.3) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += s8;
      this.step = (this.step + 1) % 64;
    }
  }

  private playStep(step: number, t: number): void {
    const ctx = this.ctx;
    const g = this.musicGain;
    if (!ctx || !g) return;
    const chordIdx = Math.floor(step / 16) % 4;

    // detuned saw pad on every chord change (2 bars)
    if (step % 16 === 0) {
      const dur = 16 * (60 / 84 / 2) * 0.98;
      for (const f of AudioManager.CHORDS[chordIdx]) {
        for (const det of [-6, 5]) {
          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.value = f;
          osc.detune.value = det;
          const flt = ctx.createBiquadFilter();
          flt.type = 'lowpass';
          flt.frequency.value = 780;
          flt.Q.value = 0.6;
          const env = ctx.createGain();
          env.gain.setValueAtTime(0.0001, t);
          env.gain.exponentialRampToValueAtTime(0.05, t + 0.4);
          env.gain.exponentialRampToValueAtTime(0.03, t + dur * 0.7);
          env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          osc.connect(flt).connect(env).connect(g);
          osc.start(t);
          osc.stop(t + dur + 0.05);
        }
      }
    }

    // square bass on a syncopated pattern
    const bassPattern = [1, 0, 0, 1, 0, 0, 1, 0];
    if (bassPattern[step % 8]) {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = AudioManager.BASS[chordIdx];
      const flt = ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.value = 620;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.16, t);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(flt).connect(env).connect(g);
      osc.start(t);
      osc.stop(t + 0.25);
    }

    // four-on-the-floor kick
    if (step % 2 === 0) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(44, t + 0.1);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.4, t);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(env).connect(g);
      osc.start(t);
      osc.stop(t + 0.16);
    }

    // offbeat hats
    if (step % 2 === 1 && this.noiseBuf) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 6500;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.05, t);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      src.connect(hp).connect(env).connect(g);
      src.start(t);
    }
  }

  /** Short UI blip. */
  blip(freq = 660): void {
    this.ensure();
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.06, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(env).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  dispose(): void {
    this.stopMusic();
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.noiseBuf = null;
  }
}
