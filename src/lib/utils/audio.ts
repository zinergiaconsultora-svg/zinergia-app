let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
    if (!audioCtx) audioCtx = new AudioContext();
    return audioCtx;
}

function playTone(freq: number, duration: number, volume = 0.1) {
    try {
        const ctx = getCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        gain.gain.value = volume;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.stop(ctx.currentTime + duration);
    } catch { /* audio not available */ }
}

export const uiSound = {
    pop: () => playTone(880, 0.08, 0.05),
    success: () => playTone(523, 0.1, 0.08),
    error: () => playTone(200, 0.15, 0.08),
};
