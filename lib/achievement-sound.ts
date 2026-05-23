"use client";

// PlayStation-style trophy chime via Web Audio API — no external file needed
export function playAchievementSound() {
  if (typeof window === "undefined") return;
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const notes = [
      { freq: 784, time: 0 },      // G5
      { freq: 988, time: 0.18 },   // B5
      { freq: 1175, time: 0.36 },  // D6
      { freq: 1568, time: 0.54 },  // G6 — final high note
    ];
    notes.forEach(({ freq, time }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + time);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + time + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + 0.55);
      osc.start(ctx.currentTime + time);
      osc.stop(ctx.currentTime + time + 0.6);
    });
  } catch { /* autoplay policy blocked */ }
}
