import * as THREE from 'three';
import { IndexPool } from '../utils/ObjectPool.js';

const _o = new THREE.Object3D();
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);
const _col = new THREE.Color();

// Un type d'objet rendu par InstancedMesh : un seul draw call pour toutes ses instances
export class InstancedType {
  constructor(scene, geometry, material, capacity, { shadow = true, receive = false, renderOrder = 0 } = {}) {
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = shadow;
    this.mesh.receiveShadow = receive;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
    this.mesh.count = 0;
    this.pool = new IndexPool(capacity);
    for (let i = 0; i < capacity; i++) { this.mesh.setMatrixAt(i, _zero); this.mesh.setColorAt(i, _col.setRGB(1, 1, 1)); }
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
  }
  // animation par texture de sommets : un flottant (pose courante) par instance
  enableAnim(depthMaterial) {
    this.anim = new THREE.InstancedBufferAttribute(new Float32Array(this.pool.cap || this.mesh.instanceMatrix.count), 1);
    this.anim.setUsage(THREE.DynamicDrawUsage);
    this.mesh.geometry.setAttribute('aAnim', this.anim);
    if (depthMaterial) this.mesh.customDepthMaterial = depthMaterial;
  }
  setAnim(i, f) { if (this.anim) this.anim.array[i] = f; }
  alloc() { return this.pool.alloc(); }
  release(i) {
    if (i < 0) return;
    this.mesh.setMatrixAt(i, _zero);
    this.mesh.setColorAt(i, _col.setRGB(1, 1, 1));
    this.pool.release(i);
  }
  set(i, x, y, z, rotY = 0, scale = 1, tiltX = 0, tiltZ = 0, sy = scale) {
    _o.position.set(x, y, z);
    _o.rotation.set(tiltX, rotY, tiltZ, 'YXZ');
    _o.scale.set(scale, sy, scale);
    _o.updateMatrix();
    this.mesh.setMatrixAt(i, _o.matrix);
  }
  setQuat(i, x, y, z, quat, sx = 1, sy = 1, sz = 1) {
    _o.position.set(x, y, z);
    _o.quaternion.copy(quat);
    _o.scale.set(sx, sy, sz);
    _o.updateMatrix();
    this.mesh.setMatrixAt(i, _o.matrix);
  }
  color(i, r, g, b) { this.mesh.setColorAt(i, _col.setRGB(r, g, b)); }
  hide(i) { this.mesh.setMatrixAt(i, _zero); }
  commit() {
    this.mesh.count = this.pool.high;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    if (this.anim) this.anim.needsUpdate = true;
  }
}

// Liste d'instances reconstruite à chaque image (barres de vie, anneaux de sélection…)
export class InstancedList {
  constructor(scene, geometry, material, capacity, renderOrder = 10) {
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
    this.mesh.setColorAt(0, _col.setRGB(1, 1, 1));
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.capacity = capacity;
    this.n = 0;
    scene.add(this.mesh);
  }
  begin() { this.n = 0; }
  push(x, y, z, quat, sx, sy, sz, r, g, b) {
    if (this.n >= this.capacity) return;
    _o.position.set(x, y, z);
    if (quat) _o.quaternion.copy(quat); else _o.quaternion.identity();
    _o.scale.set(sx, sy, sz);
    _o.updateMatrix();
    this.mesh.setMatrixAt(this.n, _o.matrix);
    this.mesh.setColorAt(this.n, _col.setRGB(r, g, b));
    this.n++;
  }
  end() {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
