// Pool d'objets générique : évite les allocations pendant le jeu (projectiles, particules, ennemis…)
export class ObjectPool {
  constructor(factory, reset, initial = 0) {
    this.factory = factory;
    this.reset = reset || (() => {});
    this.free = [];
    for (let i = 0; i < initial; i++) this.free.push(factory());
  }
  get(...args) {
    const o = this.free.length ? this.free.pop() : this.factory();
    this.reset(o, ...args);
    return o;
  }
  release(o) { this.free.push(o); }
}

// Gestion d'index libres pour un InstancedMesh (pool d'instances)
export class IndexPool {
  constructor(capacity) {
    this.capacity = capacity;
    this.free = [];
    for (let i = capacity - 1; i >= 0; i--) this.free.push(i);
    this.used = 0;
    this.high = 0; // plus haut index utilisé + 1
  }
  alloc() {
    if (!this.free.length) return -1;
    const i = this.free.pop();
    this.used++;
    if (i + 1 > this.high) this.high = i + 1;
    return i;
  }
  release(i) { this.free.push(i); this.used--; }
}
