// Gestionnaire audio léger (Web Audio API, sans bibliothèque ni fichier) : sons synthétisés à la volée, ambiance et musique bouclées.
// Indépendant de la simulation : il LIT l'état (flèches, squads, murailles, portes) via `frame(sim)` et reçoit les événements via `onEvent(e)`.
// Le contexte audio n'est créé qu'au premier geste de l'utilisateur (règle des navigateurs) : appeler `unlock()` sur pointerdown.
const KEY = 'castle-audio', MAX_VOICES = 24;

export class AudioManager {
  constructor() {
    this.ctx = null; this.t = 0;
    this.vol = { master: 0.8, sfx: 0.8, music: 0.5, ...this.load() };
    this.lastShot = -1; this.lastFight = -1; this.lastWall = -1; this.lastHammer = -1; this.lastBird = 0; this.voices = 0;
    this.arrowSeen = new WeakSet(); this.gatePrev = [0, 0, 0]; this.hpPrev = null;
  }
  // ——— réglages (persistés) ———
  load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.vol)); } catch { /* stockage indisponible : réglages non conservés */ } }
  setVolume(k, v) {
    this.vol[k] = Math.max(0, Math.min(1, v)); this.save(); this.applyGains();
  }
  applyGains() {
    if (!this.ctx) return; const t = this.ctx.currentTime, c = this.ctx;
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.22, t, 0.1);   // la musique reste discrète
  }
  // ——— initialisation (premier geste utilisateur) ———
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain(); this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain(); this.musicBus.connect(this.master);
      this.noise = this.makeNoise(); this.applyGains();
      this.startAmbient(); this.startMusic();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  makeNoise() {
    const c = this.ctx, b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  // ——— primitives : ton et bruit avec enveloppe, voix limitées ———
  env(g, t, dur, vol, attack = 0.005) {
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  tone(type, f0, f1, dur, vol, attack) {
    const c = this.ctx; if (!c || this.voices >= MAX_VOICES) return; const t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    o.connect(g); g.connect(this.sfxBus); this.env(g, t, dur, vol, attack); o.start(t); o.stop(t + dur + 0.02); this.track(o);
  }
  noiseBurst(dur, vol, filter, f, q, f1 = f) {
    const c = this.ctx; if (!c || this.voices >= MAX_VOICES) return; const t = c.currentTime;
    const s = c.createBufferSource(), bi = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; s.playbackRate.value = 0.9 + Math.random() * 0.2;
    bi.type = filter; bi.Q.value = q; bi.frequency.setValueAtTime(f, t); bi.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    s.connect(bi); bi.connect(g); g.connect(this.sfxBus); this.env(g, t, dur, vol); s.start(t, Math.random(), dur + 0.05); s.stop(t + dur + 0.05); this.track(s);
  }
  track(node) { this.voices++; node.onended = () => { this.voices--; }; }
  // ——— sons du jeu ———
  shot(kind) {   // tir d'archer (sec, aigu) ou de tour (plus grave)
    const t = this.t; if (t - this.lastShot < 0.06) return; this.lastShot = t;
    this.tone('triangle', kind === 'tower' ? 620 : 880, 260, 0.12, 0.05); this.noiseBurst(0.05, 0.03, 'highpass', 3000, 0.7);
  }
  melee() { this.noiseBurst(0.12, 0.16, 'bandpass', 1200, 1.2, 700); this.tone('square', 180, 90, 0.1, 0.07); }
  wall(big = false) { this.tone('sine', big ? 110 : 140, 45, big ? 0.45 : 0.25, big ? 0.4 : 0.3); this.noiseBurst(big ? 0.5 : 0.2, big ? 0.35 : 0.22, 'lowpass', 800, 0.7, 300); }
  hammer() { this.noiseBurst(0.04, 0.16, 'bandpass', 2200, 4); this.tone('square', 900, 700, 0.03, 0.035); }
  repair() { this.noiseBurst(0.25, 0.1, 'bandpass', 500, 1); this.tone('triangle', 330, 390, 0.2, 0.05); }
  built() { this.tone('triangle', 660, 660, 0.14, 0.09); this.tone('triangle', 880, 880, 0.22, 0.09); }
  horn() {   // début de vague : deux cors graves, attaque lente
    const c = this.ctx; if (!c) return; const t = c.currentTime;
    for (const [f, v] of [[110, 0.1], [165, 0.07]]) {
      const o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 700;
      o.connect(lp); lp.connect(g); g.connect(this.sfxBus); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.35); g.gain.setValueAtTime(v, t + 1.0); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
      o.start(t); o.stop(t + 1.9); this.track(o);
    }
  }
  gate() { this.noiseBurst(0.9, 0.16, 'bandpass', 380, 3, 220); this.tone('sawtooth', 90, 60, 0.9, 0.035, 0.2); }   // grincement de battants
  // ——— ambiance village (vent bouclé + oiseaux épars) et musique de fond (nappe bouclée) ———
  startAmbient() {
    const c = this.ctx, src = c.createBufferSource(), lp = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    src.buffer = this.noise; src.loop = true; lp.type = 'lowpass'; lp.frequency.value = 520; g.gain.value = 0.05;
    lfo.frequency.value = 0.09; lg.gain.value = 0.03; lfo.connect(lg); lg.connect(g.gain);   // le vent gonfle et retombe
    src.connect(lp); lp.connect(g); g.connect(this.sfxBus); src.start(); lfo.start();
  }
  startMusic() {   // nappe : trois notes graves (la, mi, la), filtre qui respire lentement ; boucle sans fin
    const c = this.ctx, lp = c.createBiquadFilter(), lfo = c.createOscillator(), lg = c.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 0.7;
    lfo.frequency.value = 0.04; lg.gain.value = 180; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    for (const [f, v] of [[55, 0.5], [82.4, 0.35], [110, 0.25]]) { const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = f; g.gain.value = v * 0.18; o.connect(g); g.connect(lp); o.start(); }
    lp.connect(this.musicBus);
  }
  // ——— entrée : événements de simulation (lus depuis main.js, sans les modifier) ———
  onEvent(e) {
    if (!this.ctx) return;
    switch (e.type) {
      case 'waveStart': this.horn(); break;
      case 'built': this.built(); break;
      case 'repair': if (this.t - this.lastHammer > 0.3) { this.lastHammer = this.t; this.repair(); } break;
      case 'breach': this.wall(true); break;
    }
  }
  // ——— lecture de l'état de la simulation (une fois par image) ———
  frame(sim, dt) {
    if (!this.ctx) return; this.t += dt;
    if (this.ctx.state !== 'running') return;
    // tirs : flèches d'archers et de tours, à leur apparition
    let n = 0; for (const a of sim.arrows) if (!this.arrowSeen.has(a)) { this.arrowSeen.add(a); if (n++ < 2) this.shot(a.h ? 'tower' : 'archer'); }
    // mêlée : au moins une escouade au contact
    if (sim.army.squads.some(q => q.fight > 0) && this.t - this.lastFight > 0.35) { this.lastFight = this.t; this.melee(); }
    // muraille : un tronçon qui perd des points de vie
    const hp = sim.wall.hp;
    if (!this.hpPrev) this.hpPrev = Float32Array.from(hp);
    for (let i = 0; i < hp.length; i++) { if (hp[i] < this.hpPrev[i] - 0.5 && this.t - this.lastWall > 0.25) { this.lastWall = this.t; this.wall(false); } this.hpPrev[i] = hp[i]; }
    // portes : ouverture (le battant commence à bouger)
    sim.army.gate.forEach((g, i) => { if (this.gatePrev[i] < 0.05 && g >= 0.05) this.gate(); this.gatePrev[i] = g; });
    // construction en cours : coups de marteau
    if (this.t - this.lastHammer > 0.45 && sim.build.items.some(s => (s.state === 'site' || s.state === 'upgrading') && s.crew > 0)) { this.lastHammer = this.t; this.hammer(); }
    // oiseaux épars au village
    if (this.t > this.lastBird) { this.lastBird = this.t + 6 + Math.random() * 10; if (Math.random() < 0.7) { this.tone('sine', 2000 + Math.random() * 600, 2600, 0.12, 0.02); this.tone('sine', 2300, 1900, 0.09, 0.015); } }
  }
}
