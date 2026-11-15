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
    this.padBus = c.createGain(); this.padBus.gain.value = 1; lp.disconnect(); lp.connect(this.padBus); this.padBus.connect(this.musicBus);
    // (v4.0) musique dynamique : trois couches dont le volume suit le moment du jeu
    //  calme : luth (arpèges pentatoniques) · alerte : tambours lents · vague : tambours rapides + ostinato de cuivres graves
    this.layer = { calm: c.createGain(), alert: c.createGain(), war: c.createGain() };
    for (const k in this.layer) { this.layer[k].gain.value = 0; this.layer[k].connect(this.musicBus); }
    this.beat = 0; this.nextBeat = c.currentTime + 0.2; this.mood = 'calm';
  }
  // planificateur : une croche toutes les 0,25 s (tempo 120) environ, écrit 0,2 s à l'avance
  schedule() {
    const c = this.ctx; if (!this.layer) return;
    while (this.nextBeat < c.currentTime + 0.2) {
      const t = this.nextBeat, b = this.beat++, war = this.mood === 'war', step = war ? 0.2 : 0.25;
      // luth : notes de la gamme pentatonique de la, cordes pincées (triangle, attaque sèche, déclin)
      if (b % 2 === 0 && Math.random() < 0.8) { const sc = [220, 247, 277, 330, 370, 440, 494, 554], f = sc[(Math.random() * sc.length) | 0] * (Math.random() < 0.2 ? 0.5 : 1); this.pluck(f, t, this.layer.calm); }
      if (b % 16 === 0) for (const f of [110, 165, 220]) this.pluck(f, t, this.layer.calm, 1.6, 0.05);
      // tambours : grosse caisse sourde (alerte : 1 temps sur 4 ; vague : motif guerrier)
      const kick = war ? [1, 0, 0, 1, 1, 0, 1, 0][b % 8] : b % 4 === 0;
      if (kick) this.drum(t, war ? this.layer.war : this.layer.alert, war ? 1 : 0.8);
      if (war && b % 2 === 1) this.snare(t, this.layer.war);
      // cuivres : ostinato grave (la – do – ré – mi) pendant la vague
      if (war && b % 4 === 0) { const n = [110, 130.8, 146.8, 164.8][(b / 4 | 0) % 4]; this.brass(n, t, step * 3.6, this.layer.war); }
      this.nextBeat += step;
    }
  }
  pluck(f, t, bus, dur = 0.9, vol = 0.07) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, t + dur); o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05); }
  drum(t, bus, v = 1) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18); g.gain.setValueAtTime(0.5 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.4); }
  snare(t, bus) { const c = this.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); src.buffer = this.noise; f.type = 'bandpass'; f.frequency.value = 1800; g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12); src.connect(f); f.connect(g); g.connect(bus); src.start(t, Math.random()); src.stop(t + 0.14); }
  brass(f, t, dur, bus) { const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain(); o.type = 'sawtooth'; o2.type = 'sawtooth'; o.frequency.value = f; o2.frequency.value = f * 1.005; lp.type = 'lowpass'; lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(900, t + 0.12); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.06); g.gain.setValueAtTime(0.06, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur); o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(bus); o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05); }
  // ——— ambiance (v4.0) : cloche d'alarme, gémissements de la horde, cris des capitaines ———
  bell() { const c = this.ctx, t = c.currentTime; for (let k = 0; k < 3; k++) for (const [r, v] of [[1, 0.16], [2.76, 0.07], [5.4, 0.04]]) { const o = c.createOscillator(), g = c.createGain(), tt = t + k * 0.9; o.type = 'sine'; o.frequency.value = 520 * r; g.gain.setValueAtTime(v, tt); g.gain.exponentialRampToValueAtTime(0.0005, tt + 2.2); o.connect(g); g.connect(this.sfxBus); o.start(tt); o.stop(tt + 2.3); } }
  groan(vol) { const c = this.ctx, t = c.currentTime, o = c.createOscillator(), f1 = c.createBiquadFilter(), g = c.createGain(), d = 0.9 + Math.random() * 0.9, f0 = 70 + Math.random() * 60; o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * (0.7 + Math.random() * 0.2), t + d); f1.type = 'bandpass'; f1.frequency.setValueAtTime(500 + Math.random() * 300, t); f1.frequency.linearRampToValueAtTime(350, t + d); f1.Q.value = 4; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.2); g.gain.linearRampToValueAtTime(0, t + d); o.connect(f1); f1.connect(g); g.connect(this.sfxBus); o.start(t); o.stop(t + d + 0.05); }
  shout() { const c = this.ctx, t = c.currentTime; for (const [f, q] of [[700, 6], [1150, 8]]) { const src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain(); src.buffer = this.noise; bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25, t + 0.04); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45); src.connect(bp); bp.connect(g); g.connect(this.sfxBus); src.start(t, Math.random()); src.stop(t + 0.5); } this.tone('sawtooth', 160, 120, 0.4, 0.05); }
  oil() { this.noiseBurst(1.2, 0.22, 'lowpass', 1600, 0.8, 400); }
  boom() { this.tone('sine', 90, 30, 0.7, 0.45); this.noiseBurst(0.8, 0.35, 'lowpass', 900, 0.7, 200); }
  setMood(m) { if (!this.layer || m === this.mood && this.moodSet) return; this.mood = m; this.moodSet = 1; const t = this.ctx.currentTime;
    this.layer.calm.gain.setTargetAtTime(m === 'calm' ? 1 : 0.15, t, 1.5); this.layer.alert.gain.setTargetAtTime(m === 'alert' ? 1 : 0, t, 1); this.layer.war.gain.setTargetAtTime(m === 'war' ? 1 : 0, t, 0.8); this.padBus.gain.setTargetAtTime(m === 'war' ? 0.5 : 1, t, 1);
  }
  // ——— entrée : événements de simulation (lus depuis main.js, sans les modifier) ———
  onEvent(e) {
    if (!this.ctx) return;
    switch (e.type) {
      case 'waveStart': this.horn(); break;
      case 'built': this.built(); break;
      case 'repair': if (this.t - this.lastHammer > 0.3) { this.lastHammer = this.t; this.repair(); } break;
      case 'breach': this.wall(true); break;
      case 'waveEnd': case 'recap': break;
      case 'rally': this.shout(); break;
      case 'oil': this.oil(); break;
      case 'kill7': this.horn(); break;
    }
  }
  // ——— lecture de l'état de la simulation (une fois par image) ———
  frame(sim, dt) {
    if (!this.ctx) return; this.t += dt;
    if (this.ctx.state !== 'running') return;
    // (v4.0) musique : couche selon le moment ; cloche à l'alerte ; gémissements selon la taille de la horde proche
    this.schedule(); const mood = sim.phase === 'assault' ? 'war' : sim.phase === 'alert' ? 'alert' : 'calm'; if (mood !== this.mood || !this.moodSet) { if (mood === 'alert' && this.mood !== 'alert') this.bell(); this.setMood(mood); }
    { let near = 0; const Z = sim.zombies; for (let i = 0; i < Z.n; i += 2) if (Z.z[i] > 90) near++; if (near && this.t > (this.nextGroan || 0)) { this.nextGroan = this.t + Math.max(0.35, 3 - near * 0.04) * (0.6 + Math.random() * 0.8); this.groan(Math.min(0.09, 0.025 + near * 0.0012)); } }
    for (const b of sim.blasts) if (!b.au) { b.au = 1; if (b.kind === 'boom') this.boom(); }
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
