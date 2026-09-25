let audioCtx: AudioContext | null = null;

export function unlockNotificationAudio() {
  try {
    audioCtx ??= new AudioContext();
    void audioCtx.resume().catch(() => undefined);
  } catch {
    // Web Audio is optional; custom file playback can still work.
  }
}

export function playNotificationSound(options?: { enabled?: boolean; url?: string | null }) {
  if (options?.enabled === false) return;

  if (options?.url) {
    try {
      const audio = new Audio(options.url);
      audio.volume = 0.6;
      void audio.play().catch(() => undefined);
    } catch {
      // ignore
    }
    return;
  }

  try {
    audioCtx ??= new AudioContext();
    const ctx = audioCtx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  } catch {
    // ignore
  }
}
