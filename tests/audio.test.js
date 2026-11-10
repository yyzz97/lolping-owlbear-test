import test from 'node:test';
import assert from 'node:assert/strict';
import { playPing, unlockAudio } from '../src/audio.js';

test('audio unlock resumes a context and plays a short signal-specific ping locally', async t => {
  const previousWindow = globalThis.window;
  const oscillators = [];
  const peaks = [];

  class AudioContextMock {
    state = 'suspended';
    currentTime = 5;
    destination = {};

    async resume() {
      this.state = 'running';
    }

    createOscillator() {
      const oscillator = {
        frequency: {
          setValueAtTime(value) { this.initialValue = value; },
          exponentialRampToValueAtTime(value) { this.finalValue = value; },
        },
        connect(target) { return target; },
        start(time) { this.startedAt = time; },
        stop(time) { this.stoppedAt = time; },
      };
      oscillators.push(oscillator);
      return oscillator;
    }

    createGain() {
      return {
        gain: {
          setValueAtTime() {},
          exponentialRampToValueAtTime(value) { if (value !== 0.0001) peaks.push(value); },
        },
        connect(target) { return target; },
      };
    }
  }

  globalThis.window = { AudioContext: AudioContextMock };
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });

  await unlockAudio();
  playPing('retreat');

  assert.equal(oscillators.length, 2);
  assert.equal(oscillators[0].startedAt, 5);
  assert.equal(oscillators[1].startedAt, 5.045);
  assert.equal(oscillators[0].frequency.initialValue, 784 * 1.04);
  assert.equal(oscillators[0].frequency.finalValue, 784);
  assert.equal(oscillators[0].type, 'triangle');
  assert.ok(Math.abs(oscillators[0].stoppedAt - 5.125) < 1e-9);
  assert.ok(Math.abs(oscillators[1].stoppedAt - 5.205) < 1e-9);
  assert.deepEqual(peaks, [0.085 * 0.8, 0.052 * 0.8]);
  playPing('retreat', null, 1.2);
  assert.deepEqual(peaks.slice(2), [0.085 * 0.8 * 1.2, 0.052 * 0.8 * 1.2]);
  assert.equal(playPing('retreat', null, 0), null);
  assert.equal(oscillators.length, 4, 'mute does not start synthesized sound');
});

test('plays a supplied OGG cue when the browser Audio API is available', async t => {
  const previousAudio = globalThis.Audio;
  const played = [];
  globalThis.Audio = class AudioMock {
    constructor(url) { this.url = url; played.push(this); }
    play() { this.started = true; return Promise.resolve(); }
  };
  t.after(() => {
    if (previousAudio === undefined) delete globalThis.Audio;
    else globalThis.Audio = previousAudio;
  });

  const { playPing } = await import('../src/audio.js');
  const audio = playPing('bait', '/assets/Bait_ping_SFX.ogg');
  assert.equal(audio.url, '/assets/Bait_ping_SFX.ogg');
  assert.equal(audio.started, true);
  assert.equal(played.length, 1);
  assert.equal(audio.volume, 0.72 * 0.8, 'the new 100 percent is 80 percent of the original volume');
  const louder = playPing('bait', '/assets/Bait_ping_SFX.ogg', 1.2);
  assert.equal(louder.volume, 0.72 * 0.8 * 1.2);
  assert.equal(playPing('bait', '/assets/Bait_ping_SFX.ogg', 0), null);
  assert.equal(played.length, 2, 'mute does not create an Audio element');
});

test('a failed OGG cue preserves the selected volume in the synth fallback', async t => {
  const previousAudio = globalThis.Audio;
  const previousWindow = globalThis.window;
  const peaks = [];
  globalThis.Audio = class {
    play() { return Promise.reject(new Error('cue unavailable')); }
  };
  globalThis.window = { AudioContext: class {
    state = 'running';
    currentTime = 0;
    destination = {};
    createOscillator() {
      return {
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect(target) { return target; }, start() {}, stop() {},
      };
    }
    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime(value) { if (value !== 0.0001) peaks.push(value); } },
        connect(target) { return target; },
      };
    }
  } };
  t.after(() => {
    if (previousAudio === undefined) delete globalThis.Audio;
    else globalThis.Audio = previousAudio;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });
  const freshAudio = await import('../src/audio.js?fallback-test');
  await freshAudio.unlockAudio();
  freshAudio.playPing('bait', '/missing.ogg', 0.5);
  await Promise.resolve();
  assert.deepEqual(peaks, [0.085 * 0.8 * 0.5, 0.052 * 0.8 * 0.5]);
});
