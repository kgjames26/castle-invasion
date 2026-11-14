import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { InstancedType } from './Instances.js';
import { buildUnitGeometries, buildResourceGeometries, buildProjectileGeometries, buildEffectGeometries } from '../world/Models.js';
import { loadZombies, loadArcher, makeNorthFog, patchNorthFog, makeVatMaterials } from '../world/AnimModels.js';
import { MAP } from '../data/Config.js';

const SKY = 0x9cc8ee;

// Rendu, scène, éclairage, brouillard, chargement des modèles
export class SceneManager {
  constructor(container) {
    this.container = container;
    this.mobile = matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.mobile ? 1.75 : 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY);
    this.scene.fog = new THREE.FogExp2(0xbcd6ee, 0.0016);
    this.cityScene = new THREE.Scene();
    this.cityScene.background = new THREE.Color(SKY);
    this.cityScene.fog = new THREE.FogExp2(0xbcd6ee, 0.0022);
    this.active = 'map';

    this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.5, 700);

    // Éclairage de jour : ciel bleu clair + soleil haut
    this.hemi = new THREE.HemisphereLight(0xdcebff, 0x86905c, 1.55);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d2, 3.1);
    this.sun.castShadow = true;
    const sm = this.mobile ? 1024 : 2048;
    this.sun.shadow.mapSize.set(sm, sm);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.05;
    this.scene.add(this.sun, this.sun.target);
    this.fill = new THREE.DirectionalLight(0xbfd4f0, 0.5);
    this.fill.position.set(40, 30, -40);
    this.scene.add(this.fill);
    // ville (scène séparée)
    this.cityScene.add(new THREE.HemisphereLight(0xdcebff, 0x86905c, 1.55));
    this.citySun = new THREE.DirectionalLight(0xfff0d2, 3.0);
    this.citySun.position.set(-40, 70, 50);
    this.citySun.castShadow = true;
    this.citySun.shadow.mapSize.set(sm, sm);
    const cc = this.citySun.shadow.camera;
    cc.left = -60; cc.right = 60; cc.top = 60; cc.bottom = -60; cc.near = 10; cc.far = 220;
    this.citySun.shadow.bias = -0.0006; this.citySun.shadow.normalBias = 0.05;
    this.cityScene.add(this.citySun, this.citySun.target);
    this.fogU = makeNorthFog();
    this.configureMap();

    // Matériaux partagés (brouillard du nord appliqué par shader)
    const withFog = m => { m.onBeforeCompile = sh => patchNorthFog(sh, this.fogU); m.customProgramCacheKey = () => 'nfog'; return m; };
    this.withFog = withFog;
    this.mat = {
      medieval: withFog(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, color: 0xf2ece4 })),
      medievalDamaged: withFog(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, color: 0x9a8a80 })),
      units: withFog(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })),
      ground: withFog(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })),
      ghostOk: new THREE.MeshBasicMaterial({ color: 0x40ff80, transparent: true, opacity: 0.45, depthWrite: false }),
      ghostBad: new THREE.MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: 0.45, depthWrite: false }),
    };
    // la ville n'a pas de brouillard du nord
    this.matCity = {
      medieval: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, color: 0xf2ece4 }),
      units: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
      ground: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
    };
    this.torches = [];
    this.models = {};
    this.lodProps = [];
    this.lodNear = true;
    window.addEventListener('resize', () => this.resize());
  }

  async load(onProgress) {
    const loader = new GLTFLoader();
    let gltf;
    try {
      gltf = await loader.loadAsync('./assets/models/medieval.glb', e => {
        if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
      });
    } catch (err) {
      // repli : hébergeurs qui ne servent pas les .glb → copie encodée en base64 dans un module JS
      const mod = await import('../../assets/models/medieval-glb.js');
      const bin = Uint8Array.from(atob(mod.default), c => c.charCodeAt(0));
      gltf = await loader.parseAsync(bin.buffer, './assets/models/');
    }
    gltf.scene.traverse(o => { if (o.isMesh) this.models[o.name] = o.geometry; });
    this.unitGeo = buildUnitGeometries();
    this.resGeo = buildResourceGeometries();
    this.projGeo = buildProjectileGeometries();
    this.fxGeo = buildEffectGeometries();
    const [z, a] = await Promise.all([loadZombies('./assets/models/zombies.bin'), loadArcher('./assets/models/archer.bin')]);
    this.zombies = z;
    this.zombies.mats = z.variants.map(v => makeVatMaterials(v, this.fogU));
    this.archerGeo = a;
    this.mat.archer = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  }

  // Ombre, plan de coupe du soleil et brouillard selon la taille de la carte
  configureMap() {
    const cz = (MAP.minZ + MAP.maxZ) / 2;
    this.sun.position.set(-55, 85, cz + 45);
    this.sun.target.position.set(0, 0, cz);
    this.sun.target.updateMatrixWorld();
    const sc = this.sun.shadow.camera;
    const hw = MAP.HALF + 12, hd = MAP.H / 2 + 22;
    sc.left = -hw; sc.right = hw; sc.top = hd; sc.bottom = -hd; sc.near = 10; sc.far = 260;
    sc.updateProjectionMatrix();
    this.fogU.uNFogRange.value.set(MAP.PLAIN_Z, MAP.FOG_END_Z);
  }

  // Instance d'un modèle du pack médiéval
  model(name, { scale = 1, rotY = 0, x = 0, y = 0, z = 0, shadow = false, receive = false, mat, lod = false, scene } = {}) {
    const geo = this.models[name];
    if (!geo) { console.warn('Modèle manquant', name); return new THREE.Group(); }
    const m = new THREE.Mesh(geo, mat || (scene ? this.matCity.medieval : this.mat.medieval));
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    m.scale.setScalar(scale);
    m.castShadow = shadow;
    m.receiveShadow = receive;
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    (scene || this.scene).add(m);
    if (lod) this.lodProps.push(m);
    return m;
  }
  // LOD simple : les petits accessoires disparaissent quand la caméra est loin
  updateLod(dist) {
    const near = dist < 105;
    if (near === this.lodNear) return;
    this.lodNear = near;
    for (const m of this.lodProps) m.visible = near;
    if (this.snow) this.snow.visible = dist < 140;
  }

  instanced(geometry, capacity, opts) {
    return new InstancedType(this.scene, geometry, opts?.material || this.mat.units, capacity, opts);
  }

  addTorch(x, y, z, intensity = 14, dist = 18, withLight = false) {
    const l = withLight ? new THREE.PointLight(0xff8a3a, intensity, dist, 1.6) : new THREE.Object3D();
    l.position.set(x, y, z);
    l.userData.base = intensity;
    l.userData.phase = Math.random() * 10;
    (this.activeSceneFor || this.scene).add(l);
    this.torches.push(l);
    // flamme
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 5), new THREE.MeshBasicMaterial({ color: 0xffb040 }));
    f.position.set(x, y - 0.1, z);
    (this.activeSceneFor || this.scene).add(f);
    l.userData.flame = f;
    return l;
  }

  addSnow(count = 900) {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 140;
      p[i * 3 + 1] = Math.random() * 45;
      p[i * 3 + 2] = (Math.random() - 0.5) * 140;
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.snow = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe8f0, size: 0.28, transparent: true, opacity: 0.75, depthWrite: false, fog: true }));
    this.snow.frustumCulled = false;
    this.scene.add(this.snow);
  }

  tick(time, dt) {
    for (const l of this.torches) {
      const k = 0.8 + 0.2 * Math.sin(time * 9 + l.userData.phase) + 0.1 * Math.sin(time * 23 + l.userData.phase * 2);
      if (l.isLight) l.intensity = l.userData.base * k;
      if (l.userData.flame) l.userData.flame.scale.y = 0.8 + 0.4 * k;
    }
    if (this.snow) {
      const a = this.snow.geometry.attributes.position.array;
      for (let i = 0; i < a.length; i += 3) {
        a[i + 1] -= dt * 2.2;
        a[i] += Math.sin(time * 0.7 + i) * dt * 0.4;
        if (a[i + 1] < 0) a[i + 1] = 45;
      }
      this.snow.geometry.attributes.position.needsUpdate = true;
    }
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.onResize) this.onResize(w, h);
  }

  render() { this.renderer.render(this.active === 'city' ? this.cityScene : this.scene, this.camera); }
}
