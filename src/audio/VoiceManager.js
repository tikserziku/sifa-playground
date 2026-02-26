/**
 * Children's voices using Web Speech API (SpeechSynthesis).
 * Each agent gets a unique pitch/rate to sound like different kids.
 */
export class VoiceManager {
  constructor() {
    this.synth = window.speechSynthesis;
    this.enabled = true;
    this.speaking = false;
    this.queue = [];
    this.voiceReady = false;
    this.russianVoice = null;

    // Agent voice profiles (childlike = high pitch + faster rate)
    this.voiceProfiles = [
      { pitch: 1.6, rate: 1.1, volume: 0.8 },  // Ваня — confident boy
      { pitch: 1.9, rate: 1.2, volume: 0.7 },  // Маша — high-pitched girl
      { pitch: 1.4, rate: 1.0, volume: 0.9 },  // Коля — slightly deeper boy
      { pitch: 1.7, rate: 1.15, volume: 0.75 }, // Даша — cheerful girl
      { pitch: 1.8, rate: 1.3, volume: 0.85 },  // Петя — energetic boy
    ];

    // Sound effects using Web Audio API
    this.audioCtx = null;

    // Load voices
    this.loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => this.loadVoices();
    }
  }

  loadVoices() {
    const voices = this.synth.getVoices();
    // Prefer Russian voice
    this.russianVoice = voices.find(v => v.lang.startsWith('ru')) ||
                        voices.find(v => v.lang.startsWith('en')) ||
                        voices[0];
    this.voiceReady = !!this.russianVoice;
  }

  // Speak agent phrase
  speak(agentId, text) {
    if (!this.enabled || !this.voiceReady) return;
    if (!text || text.length === 0) return;

    // Don't stack too many
    if (this.queue.length > 3) return;

    const profile = this.voiceProfiles[agentId] || this.voiceProfiles[0];
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = this.russianVoice;
    utterance.pitch = profile.pitch;
    utterance.rate = profile.rate;
    utterance.volume = profile.volume;
    utterance.lang = 'ru-RU';

    utterance.onend = () => {
      this.speaking = false;
      this.processQueue();
    };
    utterance.onerror = () => {
      this.speaking = false;
      this.processQueue();
    };

    this.queue.push(utterance);
    if (!this.speaking) this.processQueue();
  }

  processQueue() {
    if (this.queue.length === 0) return;
    if (this.speaking) return;

    const utterance = this.queue.shift();
    this.speaking = true;
    this.synth.speak(utterance);
  }

  // Quick sound effects (no speech synthesis)
  playTagSound() {
    this.ensureAudioCtx();
    const t = this.audioCtx.currentTime;

    // "Ding!" ascending chime
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const gain = this.audioCtx.createGain();
      gain.gain.setValueAtTime(0.2, t + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.3);
      gain.connect(this.audioCtx.destination);

      const osc = this.audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(t + i * 0.08);
      osc.stop(t + i * 0.08 + 0.3);
    });
  }

  playSprintSound() {
    this.ensureAudioCtx();
    const t = this.audioCtx.currentTime;

    // Quick "whoosh"
    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    gain.connect(this.audioCtx.destination);

    const bufferSize = this.audioCtx.sampleRate * 0.2;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2000, t);
    filter.frequency.linearRampToValueAtTime(500, t + 0.2);
    filter.Q.value = 1;

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    source.start(t);
  }

  playLaughSound() {
    this.ensureAudioCtx();
    const t = this.audioCtx.currentTime;

    // "Ha-ha" — rapid pitch oscillation
    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    gain.connect(this.audioCtx.destination);

    const osc = this.audioCtx.createOscillator();
    osc.type = 'sawtooth';
    // Rapid frequency modulation for "ha-ha" effect
    const baseFreq = 300 + Math.random() * 100;
    osc.frequency.setValueAtTime(baseFreq, t);
    for (let i = 0; i < 4; i++) {
      osc.frequency.setValueAtTime(baseFreq * 1.3, t + i * 0.08);
      osc.frequency.setValueAtTime(baseFreq, t + i * 0.08 + 0.04);
    }

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1500;

    osc.connect(filter);
    filter.connect(gain);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  ensureAudioCtx() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.synth.cancel();
      this.queue = [];
      this.speaking = false;
    }
  }
}
