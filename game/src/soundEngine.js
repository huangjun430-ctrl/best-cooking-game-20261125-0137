// Pure procedural WebAudio sound synthesizer (zero external audio assets).
// Gracefully handles headless or suspended audio contexts without throwing.

export function createSoundEngine() {
  let audioCtx = null;
  let muted = false;

  function ensureContext() {
    if (muted) return null;
    if (typeof window === 'undefined') return null;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    if (!audioCtx) {
      try {
        audioCtx = new Ctor();
      } catch {
        return null;
      }
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function unlock() {
    ensureContext();
  }

  function setMuted(value) {
    muted = Boolean(value);
  }

  function isMuted() {
    return muted;
  }

  function toggleMute() {
    muted = !muted;
    if (!muted) unlock();
    return muted;
  }

  function playTone(freq, duration, type = 'triangle', volume = 0.14, delay = 0, endFreq = null) {
    const ctx = ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function playNoiseBurst(duration, filterFreq, q, volume = 0.09, delay = 0) {
    const ctx = ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Deterministic pseudo-noise waveform for foley texture
    let s = 1337;
    for (let i = 0; i < sampleCount; i++) {
      s = (s * 16807) % 2147483647;
      data[i] = (s / 1073741823.5) - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.Q.setValueAtTime(q, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + duration + 0.02);
  }

  function playChop(stepIndex = 0) {
    // Crisp knife tap on oak board + ascending pentatonic chime
    playNoiseBurst(0.045, 1650, 2.2, 0.11);
    playTone(170, 0.055, 'sine', 0.12, 0, 95);
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const pitch = scale[stepIndex % scale.length];
    playTone(pitch, 0.15, 'triangle', 0.11, 0.015);
  }

  function playSizzle(stepIndex = 0) {
    // Hot pan crackle + warm rising bell note
    playNoiseBurst(0.16, 3600, 1.3, 0.09);
    const scale = [587.33, 659.25, 783.99, 880.0, 987.77];
    const pitch = scale[stepIndex % scale.length];
    playTone(pitch, 0.17, 'triangle', 0.12, 0.02);
  }

  function playPlateComplete() {
    // Porcelain clink + warm triad
    playTone(659.25, 0.14, 'triangle', 0.13, 0);
    playTone(783.99, 0.16, 'triangle', 0.13, 0.055);
    playTone(1046.5, 0.24, 'sine', 0.15, 0.11);
  }

  function playServiceBell(streak = 1) {
    // Brass bistro service bell DING! with harmonic shimmer
    const lift = Math.min(streak - 1, 5) * 45;
    playTone(1318.5 + lift, 0.55, 'sine', 0.16, 0);
    playTone(2637.0 + lift * 2, 0.38, 'sine', 0.07, 0);
    playTone(1975.5 + lift * 1.5, 0.28, 'triangle', 0.05, 0.01);
  }

  function playErrorBuzz() {
    playTone(165, 0.18, 'sawtooth', 0.09, 0, 125);
    playTone(140, 0.2, 'square', 0.06, 0.04, 105);
  }

  function playScrap() {
    playNoiseBurst(0.08, 900, 1.4, 0.07);
    playTone(240, 0.09, 'triangle', 0.07, 0, 140);
  }

  function playUrgentTick() {
    playTone(880, 0.045, 'sine', 0.06, 0);
  }

  function playGameOver() {
    playTone(783.99, 0.2, 'triangle', 0.13, 0);
    playTone(659.25, 0.2, 'triangle', 0.13, 0.16);
    playTone(523.25, 0.42, 'triangle', 0.15, 0.32);
  }

  return {
    unlock,
    setMuted,
    isMuted,
    toggleMute,
    playChop,
    playSizzle,
    playPlateComplete,
    playServiceBell,
    playErrorBuzz,
    playScrap,
    playUrgentTick,
    playGameOver,
  };
}
