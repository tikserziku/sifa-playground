/**
 * Procedural music with unique themes per agent.
 * Each child has their own scale, melody, tempo, and instrument sound.
 * Crossfades smoothly when switching agents.
 *
 * Themes:
 *   0 Ваня  (red)    — fast aggressive march, minor key, sawtooth bass
 *   1 Маша  (pink)   — gentle music box, high register, soft waltz
 *   2 Коля  (blue)   — cool synth, steady beat, pentatonic funk
 *   3 Даша  (yellow) — warm bouncy, major key, cheerful xylophone
 *   4 Петя  (green)  — silly circus, chromatic runs, kazoo-like lead
 */
export class MusicPlayer {
  constructor() {
    this.ctx = null;
    this.playing = false;
    this.masterGain = null;
    this.compressor = null;
    this.loopTimer = null;

    this.currentAgentId = -1;  // who we're playing for
    this.targetAgentId = -1;
    this.crossfade = 0;       // 0 = old theme, 1 = new theme

    this.currentBeat = 0;
    this.currentPhrase = 0;

    // === 5 AGENT THEMES ===
    this.themes = [
      // 0: Ваня — aggressive march (A minor)
      {
        name: 'Ваня',
        tempo: 160,
        scale: [220, 261.63, 293.66, 329.63, 349.23, 392, 440, 523.25, 587.33, 659.25],
        // A3 C4 D4 E4 F4 G4 A4 C5 D5 E5
        melodies: [
          [0, 3, 5, 6, 5, 3, 0, -1],   // aggressive ascending
          [6, 5, 3, 6, 5, 3, 0, 0],     // hammering
          [0, 0, 3, 3, 5, 5, 6, -1],    // marching steps
          [6, 8, 9, 8, 6, 5, 3, 0],     // battle cry descent
        ],
        bass: [0, 0, 3, 3, 5, 5, 0, 0],
        rhythms: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
        leadWave: 'sawtooth',
        leadVolume: 0.2,
        bassWave: 'sawtooth',
        bassVolume: 0.15,
        percStyle: 'heavy',
        harmonics: [2, 3],
      },

      // 1: Маша — gentle music box (C major, high register)
      {
        name: 'Маша',
        tempo: 108,
        scale: [523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77, 1046.5, 1174.66, 1318.51],
        // C5 D5 E5 F5 G5 A5 B5 C6 D6 E6
        melodies: [
          [0, 2, 4, 7, 4, 2, 0, -1],     // twinkling ascend
          [7, 4, 2, 0, -1, 0, 2, 4],     // gentle fall
          [0, 4, 2, 6, 4, 2, 0, -1],     // music box dance
          [4, 7, 9, 7, 4, 2, 0, 0],      // lullaby end
        ],
        bass: [0, 0, 4, 4, 2, 2, 0, 0],
        rhythms: [1, 1, 1, 1, 1, 1, 1, 1],  // waltz-like, even
        leadWave: 'sine',
        leadVolume: 0.25,
        bassWave: 'sine',
        bassVolume: 0.08,
        percStyle: 'soft',
        harmonics: [2, 4],  // octave + double octave = pure bell
      },

      // 2: Коля — cool synth funk (G mixolydian)
      {
        name: 'Коля',
        tempo: 130,
        scale: [196, 220, 246.94, 261.63, 293.66, 329.63, 349.23, 392, 440, 493.88],
        // G3 A3 B3 C4 D4 E4 F4 G4 A4 B4
        melodies: [
          [0, -1, 3, -1, 4, -1, 7, -1],  // sparse, cool
          [7, 4, 3, 0, 7, 4, 3, -1],     // calculated descent
          [0, 3, 4, 7, -1, 4, 3, 0],     // strategic build
          [4, 7, 9, 7, 4, -1, 0, 3],     // synth groove
        ],
        bass: [0, 0, -1, 3, 4, 4, -1, 0],
        rhythms: [1, 0.5, 0.5, 1, 1, 0.5, 0.5, 1],
        leadWave: 'triangle',
        leadVolume: 0.22,
        bassWave: 'square',
        bassVolume: 0.1,
        percStyle: 'funk',
        harmonics: [1.5, 2],  // fifth + octave = synth character
      },

      // 3: Даша — warm bouncy (F major, cheerful)
      {
        name: 'Даша',
        tempo: 145,
        scale: [349.23, 392, 440, 466.16, 523.25, 587.33, 659.25, 698.46, 783.99, 880],
        // F4 G4 A4 Bb4 C5 D5 E5 F5 G5 A5
        melodies: [
          [0, 2, 4, 5, 4, 2, 0, 2],      // bouncy jump
          [4, 5, 7, 5, 4, 2, 4, -1],     // playground swing
          [0, 4, 2, 5, 4, 0, 2, 4],      // social dance
          [7, 5, 4, 2, 0, 2, 4, 5],      // warm round
        ],
        bass: [0, 0, 2, 2, 4, 4, 0, 0],
        rhythms: [0.75, 0.75, 0.5, 1, 0.75, 0.75, 0.5, 1],
        leadWave: 'sine',
        leadVolume: 0.25,
        bassWave: 'sine',
        bassVolume: 0.12,
        percStyle: 'bouncy',
        harmonics: [2, 3],
      },

      // 4: Петя — silly circus (chromatic, playful)
      {
        name: 'Петя',
        tempo: 170,
        scale: [261.63, 277.18, 293.66, 311.13, 329.63, 349.23, 369.99, 392, 415.30, 440,
                466.16, 493.88, 523.25],
        // Chromatic from C4 to C5
        melodies: [
          [0, 4, 8, 12, 8, 4, 0, -1],     // chromatic swoops
          [12, 10, 8, 6, 4, 2, 0, -1],    // slide down
          [0, 1, 2, 3, 4, -1, 8, 12],     // creeping up + jump
          [12, 8, 11, 7, 10, 6, 0, -1],   // zigzag chaos
        ],
        bass: [0, 0, 4, 4, 8, 8, 0, 0],
        rhythms: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 0.5],
        leadWave: 'square',
        leadVolume: 0.15,
        bassWave: 'triangle',
        bassVolume: 0.1,
        percStyle: 'circus',
        harmonics: [2, 2.5],  // octave + weird = kazoo effect
      },
    ];
  }

  async start() {
    if (this.playing) return;

    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.15;
    this.masterGain.connect(this.ctx.destination);

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -20;
    this.compressor.ratio.value = 4;
    this.compressor.connect(this.masterGain);

    this.playing = true;
    this.currentBeat = 0;
    this.currentPhrase = 0;
    if (this.currentAgentId < 0) this.currentAgentId = 0;
    this.targetAgentId = this.currentAgentId;
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

  /** Call from game loop to set which agent's theme to play */
  setAgent(agentId) {
    if (agentId < 0 || agentId >= this.themes.length) return;
    if (agentId !== this.targetAgentId) {
      this.targetAgentId = agentId;
      this.crossfade = 0;
    }
  }

  getTheme() {
    const id = this.currentAgentId >= 0 ? this.currentAgentId : 0;
    return this.themes[id % this.themes.length];
  }

  scheduleBeat() {
    if (!this.playing) return;

    // Crossfade to target agent
    if (this.targetAgentId !== this.currentAgentId) {
      this.crossfade += 0.15;
      if (this.crossfade >= 1) {
        this.currentAgentId = this.targetAgentId;
        this.crossfade = 0;
        // Reset phrase on agent switch for fresh start
        this.currentPhrase = 0;
      }
    }

    const theme = this.getTheme();
    const beatDuration = 60 / theme.tempo;
    const pattern = theme.melodies[this.currentPhrase % theme.melodies.length];
    const noteIndex = pattern[this.currentBeat % pattern.length];
    const rhythm = theme.rhythms[this.currentBeat % theme.rhythms.length];
    const duration = beatDuration * rhythm;

    // Volume fades during crossfade
    const vol = this.crossfade > 0 ? (1 - this.crossfade) : 1;

    // === Lead melody ===
    if (noteIndex >= 0 && noteIndex < theme.scale.length) {
      this.playLead(
        theme.scale[noteIndex],
        duration * 0.8,
        theme.leadVolume * vol,
        theme.leadWave,
        theme.harmonics
      );
    }

    // === Bass (every 2 beats) ===
    if (this.currentBeat % 2 === 0) {
      const bassIdx = theme.bass[this.currentBeat % theme.bass.length];
      if (bassIdx >= 0 && bassIdx < theme.scale.length) {
        const bassFreq = theme.scale[bassIdx] / 2;
        this.playBass(bassFreq, beatDuration * 1.8, theme.bassVolume * vol, theme.bassWave);
      }
    }

    // === Percussion ===
    this.playPercForStyle(theme.percStyle, this.currentBeat, vol);

    // Advance
    this.currentBeat++;
    if (this.currentBeat >= 8) {
      this.currentBeat = 0;
      this.currentPhrase = (this.currentPhrase + 1) % theme.melodies.length;
    }

    this.loopTimer = setTimeout(() => this.scheduleBeat(), duration * 1000);
  }

  // Lead instrument — configurable wave + harmonics
  playLead(freq, duration, volume, waveType, harmonics) {
    const t = this.ctx.currentTime;

    // Fundamental
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    gain.connect(this.compressor);

    const osc = this.ctx.createOscillator();
    osc.type = waveType;
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + duration);

    // Harmonics (give each instrument its unique timbre)
    if (harmonics) {
      harmonics.forEach((mult, i) => {
        const hGain = this.ctx.createGain();
        const hVol = volume * (0.25 / (i + 1));
        hGain.gain.setValueAtTime(hVol, t);
        hGain.gain.exponentialRampToValueAtTime(0.001, t + duration * (0.6 / (i + 1)));
        hGain.connect(this.compressor);

        const hOsc = this.ctx.createOscillator();
        hOsc.type = 'sine';
        hOsc.frequency.value = freq * mult;
        hOsc.connect(hGain);
        hOsc.start(t);
        hOsc.stop(t + duration);
      });
    }
  }

  // Bass note
  playBass(freq, duration, volume, waveType) {
    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    gain.connect(this.compressor);

    const osc = this.ctx.createOscillator();
    osc.type = waveType || 'sine';
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + duration);
  }

  // Per-style percussion
  playPercForStyle(style, beat, vol) {
    switch (style) {
      case 'heavy':
        // Ваня: aggressive kicks + snare
        if (beat % 4 === 0) this.playPerc('kick', 0.12 * vol);
        if (beat % 4 === 2) this.playPerc('snare', 0.1 * vol);
        if (beat % 2 === 1) this.playPerc('hat', 0.06 * vol);
        this.playPerc('hat', 0.03 * vol);
        break;

      case 'soft':
        // Маша: light ticks, no kick, triangle
        if (beat % 4 === 0) this.playPerc('triangle', 0.06 * vol);
        if (beat % 2 === 1) this.playPerc('tick', 0.03 * vol);
        break;

      case 'funk':
        // Коля: syncopated
        if (beat % 4 === 0) this.playPerc('kick', 0.1 * vol);
        if (beat % 4 === 3) this.playPerc('snare', 0.08 * vol);
        this.playPerc('hat', 0.04 * vol);
        if (beat % 3 === 0) this.playPerc('hat', 0.05 * vol);
        break;

      case 'bouncy':
        // Даша: on-beat kicks, shaker off-beats
        if (beat % 2 === 0) this.playPerc('kick', 0.08 * vol);
        if (beat % 2 === 1) this.playPerc('shaker', 0.06 * vol);
        if (beat % 4 === 0) this.playPerc('tick', 0.04 * vol);
        break;

      case 'circus':
        // Петя: chaotic, cymbal crashes, rimshots
        if (beat % 4 === 0) this.playPerc('kick', 0.1 * vol);
        if (beat % 4 === 2) this.playPerc('rim', 0.08 * vol);
        this.playPerc('hat', 0.04 * vol);
        if (beat % 8 === 7) this.playPerc('crash', 0.07 * vol);
        break;
    }
  }

  playPerc(type, volume) {
    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.connect(this.compressor);

    switch (type) {
      case 'kick': {
        gain.gain.setValueAtTime(volume * 1.5, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.15);
        break;
      }
      case 'snare': {
        // Noise burst + tone
        gain.gain.setValueAtTime(volume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        const bufSize = this.ctx.sampleRate * 0.1;
        const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1);
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 3000;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.connect(bp);
        bp.connect(gain);
        src.start(t);
        break;
      }
      case 'hat': {
        gain.gain.setValueAtTime(volume * 0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
        const bufSize = this.ctx.sampleRate * 0.03;
        const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 8000;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.connect(hp);
        hp.connect(gain);
        src.start(t);
        break;
      }
      case 'tick': {
        gain.gain.setValueAtTime(volume * 0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 900;
        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.04);
        break;
      }
      case 'triangle': {
        gain.gain.setValueAtTime(volume * 0.6, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 1200;
        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.4);
        break;
      }
      case 'shaker': {
        gain.gain.setValueAtTime(volume * 0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        const bufSize = this.ctx.sampleRate * 0.06;
        const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * 0.3;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 6000;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.connect(hp);
        hp.connect(gain);
        src.start(t);
        break;
      }
      case 'rim': {
        gain.gain.setValueAtTime(volume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = 1800;
        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.03);
        break;
      }
      case 'crash': {
        gain.gain.setValueAtTime(volume * 0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        const bufSize = this.ctx.sampleRate * 0.4;
        const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1);
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 5000;
        bp.Q.value = 0.5;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.connect(bp);
        bp.connect(gain);
        src.start(t);
        break;
      }
    }
  }
}
