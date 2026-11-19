/** Tiny Web-Audio synth for game sound effects — no files, works offline. */
let ctx: AudioContext | null = null;
const ac = () => {
  if (typeof window === "undefined") return null;
  try { ctx ??= new AudioContext(); if (ctx.state === "suspended") void ctx.resume(); return ctx; } catch { return null; }
};
function tone(f1: number, f2: number, dur: number, type: OscillatorType = "square", vol = 0.1, delay = 0) {
  const a = ac(); if (!a) return;
  const t = a.currentTime + delay, o = a.createOscillator(), v = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  v.gain.setValueAtTime(vol, t); v.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(v).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur: number, vol = 0.2, freq = 1200, delay = 0) {
  const a = ac(); if (!a) return;
  const t = a.currentTime + delay, buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource(), f = a.createBiquadFilter(), v = a.createGain();
  src.buffer = buf; f.type = "lowpass"; f.frequency.value = freq; v.gain.value = vol;
  src.connect(f).connect(v).connect(a.destination); src.start(t);
}
let last: Record<string, number> = {};
const once = (k: string, ms: number, fn: () => void) => { const n = Date.now(); if ((last[k] ?? 0) + ms > n) return; last[k] = n; fn(); };

export const sfx = {
  jump: () => tone(320, 880, 0.16, "square", 0.1),
  shoot: () => once("shoot", 60, () => { tone(900, 200, 0.1, "sawtooth", 0.08); noise(0.06, 0.1, 3000); }),
  hit: () => { tone(200, 60, 0.2, "triangle", 0.2); noise(0.1, 0.15, 800); },
  coin: () => { tone(988, 988, 0.08, "square", 0.08); tone(1319, 1319, 0.2, "square", 0.08, 0.08); },
  glass: () => { for (let i = 0; i < 5; i++) tone(2000 + Math.random() * 2500, 1500, 0.15, "triangle", 0.06, i * 0.03); noise(0.3, 0.12, 6000); },
  whistle: () => { tone(1800, 1700, 0.35, "sine", 0.12); tone(1500, 1400, 0.25, "sine", 0.1, 0.36); },
  boom: () => once("boom", 120, () => { noise(0.7, 0.45, 500); tone(120, 30, 0.6, "sine", 0.35); }),
  crack: () => once("crack", 90, () => noise(0.12, 0.15, 2500)),
  zap: () => once("zap", 150, () => tone(1400, 300, 0.25, "sawtooth", 0.06)),
  hiss: () => noise(0.6, 0.18, 4000),
  thud: () => once("thud", 200, () => { tone(90, 40, 0.25, "sine", 0.3); noise(0.15, 0.15, 400); }),
  rumble: () => once("rumble", 400, () => noise(0.35, 0.12, 250)),
  tap: () => tone(500, 700, 0.05, "square", 0.06),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, i === 3 ? 0.4 : 0.14, "square", 0.09, i * 0.13)),
  lose: () => { tone(400, 380, 0.25, "triangle", 0.15); tone(300, 140, 0.6, "triangle", 0.15, 0.28); },
  chat: () => tone(600, 1200, 0.08, "sine", 0.12),
  emote: (id: string) => {
    if (id === "dark" || id === "shadow") { tone(70, 50, 1.2, "sine", 0.35); tone(140, 100, 1.2, "triangle", 0.12); }
    else if (id === "kiss" || id === "bucin" || id === "couple" || id === "love") { tone(700, 1400, 0.12, "sine", 0.12); tone(1400, 900, 0.15, "sine", 0.1, 0.13); }
    else if (id === "laugh") for (let i = 0; i < 4; i++) tone(700, 500, 0.07, "square", 0.06, i * 0.09);
    else if (id === "party") [523, 659, 784, 659, 1047].forEach((f, i) => tone(f, f, 0.1, "sawtooth", 0.06, i * 0.09));
    else if (id === "cry") tone(600, 300, 0.6, "triangle", 0.1);
    else if (id === "angry") tone(150, 120, 0.3, "sawtooth", 0.12);
    else tone(500, 1000, 0.15, "square", 0.07);
  },
};
