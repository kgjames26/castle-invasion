// Petits effets sonores synthétisés (WebAudio) — aucun fichier audio à charger
export class AudioFX {
  constructor() {
    this.ctx = null;
    try { this.muted = localStorage.getItem('ci-muted') === '1'; } catch { this.muted = false; }
    this.lastPlay = {};
  }
  unlock() {
    if (this.ctx || this.muted) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.ctx = null; }
  }
  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('ci-muted', m ? '1' : '0'); } catch { /* ignore */ }
    if (!m) this.unlock();
  }
  throttle(name, ms) {
    const now = performance.now();
    if (now - (this.lastPlay[name] || 0) < ms) return true;
    this.lastPlay[name] = now;
    return false;
  }
  tone(freq, dur, type = 'sine', vol = 0.15, slide = 0) {
    const c = this.ctx;
    if (!c || this.muted) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), c.currentTime + dur);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(c.destination);
    o.start(); o.stop(c.currentTime + dur);
  }
  noise(dur, vol = 0.2, freq = 800) {
    const c = this.ctx;
    if (!c || this.muted) return;
    const b = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.frequency.value = freq;
    g.gain.value = vol;
    s.buffer = b;
    s.connect(f).connect(g).connect(c.destination);
    s.start();
  }
  click() { this.tone(660, 0.06, 'triangle', 0.06); }
  hit() { if (!this.throttle('hit', 70)) this.noise(0.08, 0.08, 2200); }
  thump() { if (!this.throttle('thump', 120)) { this.tone(90, 0.25, 'sine', 0.2, -50); this.noise(0.15, 0.08, 600); } }
  boom() { this.noise(0.9, 0.35, 400); this.tone(60, 0.8, 'sine', 0.25, -30); }
  horn() { this.tone(146, 1.4, 'sawtooth', 0.07, 4); setTimeout(() => this.tone(110, 1.2, 'sawtooth', 0.07, 2), 500); }
}
