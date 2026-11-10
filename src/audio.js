let context;

const PING_NOTES = Object.freeze({
  caution: [784, 1047],
  retreat: [784, 1047],
  bait: [698, 880],
  push: [587, 880],
  omw: [698, 988],
  allin: [523, 784],
  assist: [659, 988],
  hold: [988, 1319],
  missing: [880, 659],
});

export async function unlockAudio() {
  const AudioContextClass = typeof window === 'undefined' ? null : window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    context ??= new AudioContextClass();
    if (context.state === 'suspended') await context.resume();
  } catch {
    // Playback may remain blocked until the player interacts with the room.
  }
}

export function playPing(signalId = 'omw', audioUrl = null, volume = 1) {
  const level = Number.isFinite(volume) ? Math.min(1.2, Math.max(0, volume)) : 1;
  if (level === 0) return null;
  if (audioUrl && typeof Audio !== 'undefined') {
    try {
      const audio = new Audio(audioUrl);
      audio.preload = 'auto';
      audio.volume = 0.72 * 0.8 * level;
      const playback = audio.play();
      if (playback && typeof playback.catch === 'function') {
        playback.catch(() => playSynthPing(signalId, level));
      }
      return audio;
    } catch {
      // Fall through to the local synthesized cue.
    }
  }
  return playSynthPing(signalId, level);
}

function playSynthPing(signalId = 'omw', volume = 1) {
  if (!context || context.state !== 'running') return null;
  const now = context.currentTime;
  const notes = PING_NOTES[signalId] ?? PING_NOTES.omw;
  notes.forEach((frequency, index) => {
    const offset = index * 0.045;
    const start = now + offset;
    const duration = index === 0 ? 0.115 : 0.15;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = index === 0 ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(frequency * 1.04, start);
    oscillator.frequency.exponentialRampToValueAtTime(frequency, start + 0.025);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime((index === 0 ? 0.085 : 0.052) * 0.8 * volume, start + 0.009);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  });
  return context;
}
