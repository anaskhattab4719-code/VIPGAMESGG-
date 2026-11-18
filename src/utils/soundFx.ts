// Web Audio API sound effects & procedural WAV SFX synthesizer

let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedCtx) {
    sharedCtx = new AudioCtx();
  }
  if (sharedCtx.state === 'suspended') {
    sharedCtx.resume().catch(() => {});
  }
  return sharedCtx;
}

export function playUiSound(
  type: 'click' | 'move' | 'capture' | 'check' | 'win' | 'jump' | 'pop',
  enabled = true,
  volume = 0.5
) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  const vol = Math.max(0.02, Math.min(1, volume)) * 0.22;

  const osc = ctx.createOscillator();
  osc.connect(gain);

  if (type === 'click' || type === 'pop') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(type === 'pop' ? 580 : 440, now);
    osc.frequency.exponentialRampToValueAtTime(type === 'pop' ? 880 : 280, now + 0.06);
    gain.gain.setValueAtTime(vol * 0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    osc.start(now);
    osc.stop(now + 0.07);
  } else if (type === 'move') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.08);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.start(now);
    osc.stop(now + 0.095);
  } else if (type === 'capture') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.14);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.start(now);
    osc.stop(now + 0.155);
  } else if (type === 'check') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.setValueAtTime(880, now + 0.08);
    gain.gain.setValueAtTime(vol * 0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.start(now);
    osc.stop(now + 0.23);
  } else if (type === 'jump') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.14);
    gain.gain.setValueAtTime(vol * 0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.start(now);
    osc.stop(now + 0.16);
  } else if (type === 'win') {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(freq, now + idx * 0.09);
      g.gain.setValueAtTime(vol * 0.8, now + idx * 0.09);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.22);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(now + idx * 0.09);
      o.stop(now + idx * 0.09 + 0.24);
    });
  }
}

export type SfxPreset =
  | 'laser'
  | 'explosion'
  | 'chime'
  | 'coin'
  | 'footstep'
  | 'sword'
  | 'engine'
  | 'rain';

function encodeWavFromFloat32(samples: Float32Array, sampleRate: number): string {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

export function synthesizeSfxWav(
  preset: SfxPreset,
  pitchMultiplier = 1,
  durationSec = 1.0
): string {
  const sampleRate = 24000;
  const totalSamples = Math.floor(sampleRate * Math.max(0.25, Math.min(4, durationSec)));
  const out = new Float32Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const norm = i / totalSamples;
    let val = 0;

    if (preset === 'laser') {
      const freq = (1100 * Math.pow(0.15, norm)) * pitchMultiplier;
      const env = Math.exp(-t * 5.5);
      val = Math.sin(2 * Math.PI * freq * t) * env * 0.7;
    } else if (preset === 'explosion') {
      const noise = Math.random() * 2 - 1;
      const rumble = Math.sin(2 * Math.PI * (55 * pitchMultiplier) * t);
      const env = Math.exp(-t * 3.2);
      val = (noise * 0.65 + rumble * 0.5) * env * 0.75;
    } else if (preset === 'chime') {
      const f1 = 587.33 * pitchMultiplier;
      const f2 = 880 * pitchMultiplier;
      const env = Math.exp(-t * 4.0);
      val = (Math.sin(2 * Math.PI * f1 * t) * 0.5 + Math.sin(2 * Math.PI * f2 * t) * 0.4) * env;
    } else if (preset === 'coin') {
      const f = t < 0.08 ? 987.77 * pitchMultiplier : 1318.51 * pitchMultiplier;
      const env = Math.exp(-t * 6.0);
      val = Math.sin(2 * Math.PI * f * t) * env * 0.6;
    } else if (preset === 'footstep') {
      const thud = Math.sin(2 * Math.PI * (90 * pitchMultiplier) * t) * Math.exp(-t * 28);
      const grit = (Math.random() * 2 - 1) * Math.exp(-t * 35) * 0.4;
      val = thud * 0.8 + grit;
    } else if (preset === 'sword') {
      const sweep = Math.sin(2 * Math.PI * (1400 * pitchMultiplier * (1 - norm * 0.6)) * t);
      const metal = (Math.random() * 2 - 1) * 0.35;
      const env = Math.exp(-t * 7.5);
      val = (sweep * 0.5 + metal) * env;
    } else if (preset === 'engine') {
      const freq = (75 + norm * 145) * pitchMultiplier;
      const saw = ((t * freq) % 1) * 2 - 1;
      const env = Math.sin(Math.PI * norm);
      val = saw * env * 0.45;
    } else if (preset === 'rain') {
      const white = Math.random() * 2 - 1;
      const env = Math.min(1, t * 4) * Math.min(1, (durationSec - t) * 4);
      val = white * 0.25 * env;
    }

    out[i] = val;
  }

  return encodeWavFromFloat32(out, sampleRate);
}
