import { WAVEFORM_BARS } from '@shared/types';

export interface AudioAnalysis {
  duration: number;
  peaks: number[];
}

/** Reads duration via a throwaway <audio> element (fast, no decoding). */
export function probeDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      audio.src = '';
      resolve(value);
    };
    audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) ? audio.duration : null);
    audio.onerror = () => done(null);
    audio.src = url;
  });
}

/**
 * Decodes the file with the Web Audio API and reduces it to WAVEFORM_BARS
 * RMS peaks (0..1). Returns null when the browser cannot decode the codec —
 * the server then falls back to a generated waveform.
 */
export async function analyzeAudio(file: File): Promise<AudioAnalysis | null> {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  const ctx = new Ctor();
  try {
    const buffer = await file.arrayBuffer();
    const decoded = await new Promise<AudioBuffer>((resolve, reject) => {
      // callback form for old Safari
      const result = ctx.decodeAudioData(buffer, resolve, reject);
      if (result && typeof (result as Promise<AudioBuffer>).then === 'function') {
        (result as Promise<AudioBuffer>).then(resolve, reject);
      }
    });
    const channel = decoded.getChannelData(0);
    const bucket = Math.max(1, Math.floor(channel.length / WAVEFORM_BARS));
    const peaks: number[] = [];
    for (let i = 0; i < WAVEFORM_BARS; i++) {
      const start = i * bucket;
      const end = Math.min(channel.length, start + bucket);
      let sum = 0;
      // stride through large buckets to keep this cheap on phones
      const step = Math.max(1, Math.floor((end - start) / 2000));
      let n = 0;
      for (let j = start; j < end; j += step) {
        const v = channel[j] ?? 0;
        sum += v * v;
        n++;
      }
      peaks.push(n ? Math.sqrt(sum / n) : 0);
    }
    const max = Math.max(...peaks, 0.0001);
    return {
      duration: decoded.duration,
      peaks: peaks.map((p) => Number(Math.pow(p / max, 0.75).toFixed(3))),
    };
  } catch {
    return null;
  } finally {
    void ctx.close().catch(() => undefined);
  }
}
