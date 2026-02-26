/**
 * Procedural cheerful playground music using Web Audio API.
 * No external files — generates a looping xylophone/music-box melody.
 */
export class MusicPlayer {
  constructor() {
    this.ctx = null;
    this.playing = false;
    this.masterGain = null;
    this.tempo = 140; // BPM
    this.beatDuration = 60 / this.tempo;
    this.currentBeat = 0;
    this.loopTimer = null;

    // C major pentatonic — cheerful playground feel
    // Notes as frequencies (C4-C6 range)
    this.scale = [
      261.63, 293.66, 329.63, 392.00, 440.00,  // C4 D4 E4 G4 A4
      523.25, 587.33, 659.25, 783.99, 880.00,   // C5 D5 E5 G5 A5
      1046.50, 1174.66, 1318.51,                 // C6 D6 E6
    ];

    // Melody patterns (index into scale array) — 4 phrases, 8 beats each
    this.melodyPatterns = [
      // Phrase 1: ascending playful
      [0, 2, 4, 5, 7, 5, 4, 2],
      // Phrase 2: bouncy
      [5, 7, 9, 7, 5, 4, 2, 4],
      // Phrase 3: call and response
      [0, 2, 4, -1, 5, 7, 9, -1],  // -1 = rest
      // Phrase 4: descending resolution
      [9, 7, 5, 4, 2, 0, 2, 4],
    ];

    // Bass pattern (lower octave)
    this.bassPattern = [0, 0, 3, 3, 4, 4, 0, 0]; // scale degrees simplified

    // Rhythm variations (note duration multiplier)
    this.rhythms = [1, 0.5, 0.5, 1, 1, 0.5, 0.5, 1];

    this.currentPhrase = 0;
  }

  async start() {
    if (this.playing) return;

    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.15; // quiet background
    this.masterGain.connect(this.ctx.destination);

    // Compressor for cleaner mix
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -20;
    this.compressor.ratio.value = 4;
    this.compressor.connect(this.masterGain);

    this.playing = true;
    this.currentBeat = 0;
    this.currentPhrase = 0;
    this.scheduleBeat();
  }

  stop() {
    this.playing = false;
    if (this.loopTimer) clearTimeout(this.loopTimer);
    if (this.masterGain) {
      this.masterGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);
    }
  }

  setVolume(vol) {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, vol));
    }
  }

  scheduleBeat() {
    if (!this.playing) return;

    const pattern = this.melodyPatterns[this.currentPhrase];
    const noteIndex = pattern[this.currentBeat];
    const rhythm = this.rhythms[this.currentBeat];
    const duration = this.beatDuration * rhythm;

    // Melody note (xylophone/bell sound)
    if (noteIndex >= 0) {
      this.playBell(this.scale[noteIndex], duration * 0.8, 0.3);
    }

    // Bass note every 2 beats (soft sine)
    if (this.currentBeat % 2 === 0) {
      const bassIdx = this.bassPattern[this.currentBeat];
      const bassFreq = this.scale[bassIdx] / 2; // one octave lower
      this.playBass(bassFreq, this.beatDuration * 1.8, 0.12);
    }

    // Percussion on every beat
    this.playPerc(this.currentBeat % 4 === 0 ? 'kick' : 'tick', 0.08);

    // Hi-hat on off-beats
    if (this.currentBeat % 2 === 1) {
      this.playPerc('hat', 0.04);
    }

    // Advance
    this.currentBeat++;
    if (this.currentBeat >= 8) {
      this.currentBeat = 0;
      this.currentPhrase = (this.currentPhrase + 1) % this.melodyPatterns.length;
    }

    this.loopTimer = setTimeout(() => this.scheduleBeat(), duration * 1000);
  }

  // Bell/xylophone tone — two harmonics with fast decay
  playBell(freq, duration, volume) {
    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    gain.connect(this.compressor);

    // Fundamental
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = freq;
    osc1.connect(gain);
    osc1.start(t);
    osc1.stop(t + duration);

    // Harmonic (octave up, quieter) — bell shimmer
    const gain2 = this.ctx.createGain();
    gain2.gain.setValueAtTime(volume * 0.3, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + duration * 0.5);
    gain2.connect(this.compressor);

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2;
    osc2.connect(gain2);
    osc2.start(t);
    osc2.stop(t + duration);

    // Third harmonic (adds brightness)
    const gain3 = this.ctx.createGain();
    gain3.gain.setValueAtTime(volume * 0.1, t);
    gain3.gain.exponentialRampToValueAtTime(0.001, t + duration * 0.3);
    gain3.connect(this.compressor);

    const osc3 = this.ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.value = freq * 3;
    osc3.connect(gain3);
    osc3.start(t);
    osc3.stop(t + duration);
  }

  // Soft bass — sine wave with gentle attack
  playBass(freq, duration, volume) {
    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    gain.connect(this.compressor);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + duration);
  }

  // Simple percussion using noise bursts
  playPerc(type, volume) {
    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.connect(this.compressor);

    if (type === 'kick') {
      gain.gain.setValueAtTime(volume * 1.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 0.15);
    } else if (type === 'tick') {
      gain.gain.setValueAtTime(volume * 0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 800;
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 0.05);
    } else if (type === 'hat') {
      // Noise burst for hi-hat
      gain.gain.setValueAtTime(volume * 0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      const bufferSize = this.ctx.sampleRate * 0.03;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.5;
      }
      // High-pass filter for metallic sound
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 8000;
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(filter);
      filter.connect(gain);
      source.start(t);
    }
  }
}
