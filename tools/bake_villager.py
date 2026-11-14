#!/usr/bin/env python3
"""Cuit le villageois GLB (Mixamo, une seule pose) en texture de sommets (VAT) : poses procédurales (marche, portage, coup d'outil, repos)
calculées par squelette (skinning linéaire), couleurs de sommets échantillonnées sur les textures, variantes de couleur par métier.
Usage : python3 tools/bake_villager.py model.glb assets/characters/villager.bin"""
import struct, json, io, sys, math
import numpy as np
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
f = open(src, 'rb').read()
cl, _ = struct.unpack('<II', f[12:20]); J = json.loads(f[20:20 + cl]); off = 20 + cl; bl, _ = struct.unpack('<II', f[off:off + 8]); B0 = off + 8
BV, ACC = J['bufferViews'], J['accessors']
CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
def acc(i):
    a = ACC[i]; bv = BV[a['bufferView']]; n = NC[a['type']]; dt = np.dtype(CT[a['componentType']]); o = B0 + bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = bv.get('byteStride') or n * dt.itemsize
    if stride == n * dt.itemsize: arr = np.frombuffer(f, dt, a['count'] * n, o).reshape(a['count'], n)
    else: arr = np.stack([np.frombuffer(f, dt, n, o + k * stride) for k in range(a['count'])])
    arr = arr.astype(np.float64)
    if a.get('normalized'): arr /= np.iinfo(CT[a['componentType']]).max
    return arr
def image(i):
    bv = BV[J['images'][i]['bufferView']]; o = B0 + bv.get('byteOffset', 0); return np.array(Image.open(io.BytesIO(f[o:o + bv['byteLength']])).convert('RGBA')).astype(np.float64) / 255

# ——— nœuds, hiérarchie, matrices monde ———
nodes = J['nodes']; N = len(nodes); parent = [-1] * N
for i, n in enumerate(nodes):
    for c in n.get('children', []): parent[c] = i
def qmat(q):
    x, y, z, w = q; return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 0], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 0], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y), 0], [0, 0, 0, 1]])
def local(n):
    if 'matrix' in n: return np.array(n['matrix']).reshape(4, 4).T
    M = np.eye(4); S = np.diag(list(n.get('scale', [1, 1, 1])) + [1]); M = qmat(n.get('rotation', [0, 0, 0, 1])) @ S; M[:3, 3] = n.get('translation', [0, 0, 0]); return M
world = [None] * N
def W(i):
    if world[i] is None: world[i] = (W(parent[i]) if parent[i] >= 0 else np.eye(4)) @ local(nodes[i])
    return world[i]
skin = J['skins'][0]; joints = skin['joints']; jidx = {nodes[j]['name']: k for k, j in enumerate(joints)}
meshNode = next(i for i, n in enumerate(nodes) if 'mesh' in n); MW = W(meshNode); MWi = np.linalg.inv(MW)
Jm = [MWi @ W(j) for j in joints]                      # matrices de bind des articulations, en espace du maillage
jpar = [(joints.index(parent[j]) if parent[j] in joints else -1) for j in joints]
def find(prefix): return next(k for k, j in enumerate(joints) if nodes[j]['name'].startswith('mixamorig:' + prefix + '_'))

# ——— maillages fusionnés ———
COL = {'Body': None, 'Bottom': None, 'Moustache': (0.2, 0.11, 0.06), 'Shoes': None, 'material': None, 'Beard': (0.2, 0.11, 0.06), 'Hair': None}
BOOST = {'Bottom': 1.9, 'Shoes': 2.0, 'material': 2.2, 'Hair': 2.4, 'Body': 1.0}
P, Wt, Jn, Cl, Ix, Part = [], [], [], [], [], []; base = 0
for node in nodes:
    if 'mesh' not in node: continue
    for prim in J['meshes'][node['mesh']]['primitives']:
        a = prim['attributes']; mat = J['materials'][prim['material']]; mn = mat['name']
        pos = acc(a['POSITION']); uv = acc(a['TEXCOORD_0']); jn = acc(a['JOINTS_0']).astype(int); wt = acc(a['WEIGHTS_0']); idx = acc(prim['indices']).astype(int).reshape(-1)
        t = mat['extensions']['KHR_materials_pbrSpecularGlossiness']['diffuseTexture']['index']; img = image(J['textures'][t]['source']); H, Wd = img.shape[:2]
        if COL.get(mn): col = np.tile(np.array(COL[mn]), (len(pos), 1))
        else:
            x = np.clip(uv[:, 0] % 1.0 * (Wd - 1), 0, Wd - 1).astype(int); y = np.clip(uv[:, 1] % 1.0 * (H - 1), 0, H - 1).astype(int); col = img[y, x, :3]
            col = np.clip(col * BOOST.get(mn, 1.5), 0, 1)
        P.append(pos); Wt.append(wt); Jn.append(jn); Cl.append(col); Ix.append(idx + base); Part.append(np.full(len(pos), {'Body': 0, 'material': 1, 'Bottom': 2, 'Shoes': 3, 'Hair': 4, 'Moustache': 5, 'Beard': 5}[mn])); base += len(pos)
P = np.vstack(P); Wt = np.vstack(Wt); Jn = np.vstack(Jn); Cl = np.vstack(Cl); Ix = np.concatenate(Ix); Part = np.concatenate(Part); V = len(P)
print('sommets', V, 'triangles', len(Ix) // 3)
inv = [np.linalg.inv(m) for m in Jm]
def skin_pose(Jp):
    S = np.stack([Jp[k] @ inv[k] for k in range(len(joints))])   # (J,4,4)
    Ph = np.concatenate([P, np.ones((V, 1))], 1)
    out = np.zeros((V, 3))
    for c in range(4): out += Wt[:, c:c + 1] * np.einsum('vij,vj->vi', S[Jn[:, c]], Ph)[:, :3]
    return out
# contrôle : pose de bind = maillage d'origine
assert np.abs(skin_pose(Jm) - P).max() < 0.05, 'bind pose incohérente'

# ——— poses procédurales (rotations en axes MONDE autour de chaque articulation) ———
def Rx(a): c, s = math.cos(a), math.sin(a); return np.array([[1, 0, 0, 0], [0, c, -s, 0], [0, s, c, 0], [0, 0, 0, 1]])
def Ry(a): c, s = math.cos(a), math.sin(a); return np.array([[c, 0, s, 0], [0, 1, 0, 0], [-s, 0, c, 0], [0, 0, 0, 1]])
def Rz(a): c, s = math.cos(a), math.sin(a); return np.array([[c, -s, 0, 0], [s, c, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]])
def T(p): M = np.eye(4); M[:3, 3] = p; return M
names = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot']
BI = {n: find(n) for n in names}
sx = 1 if Jm[BI['LeftArm']][0, 3] > 0 else -1           # côté +x = gauche ?
def pose(rot, hipsy=0.0):
    """rot : nom → (rx, ry, rz) appliqués en axes monde ; renvoie les matrices posées des articulations (espace maillage)."""
    Jp = [None] * len(joints)
    for k in range(len(joints)):                          # les parents précèdent les enfants dans la liste des nœuds
        rel = Jm[k] if jpar[k] < 0 else np.linalg.inv(Jm[jpar[k]]) @ Jm[k]
        M = rel if jpar[k] < 0 else Jp[jpar[k]] @ rel
        nm = nodes[joints[k]]['name']; nm = (nm.split(':')[1] if ':' in nm else nm).rsplit('_', 1)[0]
        if nm in rot:
            rx, ry, rz = rot[nm]; q = M[:3, 3].copy(); M = T(q) @ Rx(rx) @ Ry(ry) @ Rz(rz) @ T(-q) @ M
        if nm == 'Hips': M = T([0, hipsy, 0]) @ M
        Jp[k] = M
    return Jp
A = 1.1   # bras le long du corps
def arms_down(rot, k=1.0):
    rot['LeftArm'] = (0, 0, -sx * A * k); rot['RightArm'] = (0, 0, sx * A * k)
def walk(p, carry=False):
    s, c = math.sin(p), math.cos(p); rot = {}
    arms_down(rot, 0.55 if carry else 1.0)
    rot['LeftUpLeg'] = (-0.55 * s, 0, 0); rot['RightUpLeg'] = (0.55 * s, 0, 0)
    rot['LeftLeg'] = (0.85 * max(0, c), 0, 0); rot['RightLeg'] = (0.85 * max(0, -c), 0, 0)
    rot['LeftFoot'] = (-0.25 * rot['LeftLeg'][0] + 0.3 * s * 0.5, 0, 0); rot['RightFoot'] = (-0.25 * rot['RightLeg'][0] - 0.3 * s * 0.5, 0, 0)
    if carry == 'front':                                  # charge tenue à deux mains devant le ventre (pierres, panier de minerai)
        rot['RightArm'] = (-0.345, 0, sx * 1.425); rot['RightForeArm'] = (-0.713 + 0.05 * s, -sx * 0.225, sx * 0.65)
        rot['LeftArm'] = (-0.345, 0, -sx * 1.425); rot['LeftForeArm'] = (-0.713 - 0.05 * s, sx * 0.225, -sx * 0.65)
        for n in ('Spine', 'Spine1', 'Spine2'): rot[n] = (-0.04, 0.03 * s, 0)
    elif carry == 'shoulder':                             # rondins / sac sur l'épaule droite, tenus d'une main ; l'autre bras balance
        rot['RightArm'] = (0.556, 0, -sx * 0.462); rot['RightForeArm'] = (0.131, 0, -sx * 2.231)
        rot['LeftArm'] = (0.45 * s, 0, -sx * A); rot['LeftForeArm'] = (-0.3 - 0.2 * max(0, -s), 0, 0)
        for n in ('Spine', 'Spine1', 'Spine2'): rot[n] = (0.03, -0.05 * s, -sx * 0.035)
    else:
        rot['LeftArm'] = (0.5 * s, 0, -sx * A); rot['RightArm'] = (-0.5 * s, 0, sx * A); rot['LeftForeArm'] = (-0.3 - 0.2 * max(0, -s), 0, 0); rot['RightForeArm'] = (-0.3 - 0.2 * max(0, s), 0, 0)
        for n in ('Spine', 'Spine1', 'Spine2'): rot[n] = (0.04, -0.08 * s, 0.03 * s)
    rot['Head'] = (-0.03, 0.05 * s, -sx * 0.1 if carry == 'shoulder' else 0); rot['Hips'] = (0, 0.12 * s, 0)
    return rot, 1.3 * abs(s) * (0.6 if carry else 1.0)
def smooth(x): x = min(1, max(0, x)); return x * x * (3 - 2 * x)
def work(t):
    if t < 0.5: a = smooth(t / 0.5)
    elif t < 0.62: a = 1 - smooth((t - 0.5) / 0.12)
    else: a = 0.0
    rot = {}; arms_down(rot, 1.0)
    low = 1 - 0.6 * a
    rot['LeftArm'] = (-(0.45 + 1.35 * a), 0, -sx * A * low); rot['RightArm'] = (-(0.45 + 1.35 * a), 0, sx * A * low)
    rot['LeftForeArm'] = (-(0.55 + 0.25 * a), 0, 0); rot['RightForeArm'] = (-(0.55 + 0.25 * a), 0, 0)
    lean = 0.36 * (1 - a) - 0.10 * a
    for n in ('Spine', 'Spine1', 'Spine2'): rot[n] = (lean / 3 * 1.2, 0, 0)
    rot['Head'] = (0.1 * (1 - a), 0, 0); rot['LeftUpLeg'] = (-0.28, 0, 0); rot['RightUpLeg'] = (0.12, 0, 0); rot['LeftLeg'] = (0.4, 0, 0); rot['RightLeg'] = (0.25, 0, 0)
    return rot, -4.0 * (1 - a)
def idle(t):
    s = math.sin(t * 2 * math.pi); rot = {}; arms_down(rot, 1.0)
    rot['LeftForeArm'] = (-0.12, 0, 0); rot['RightForeArm'] = (-0.12, 0, 0); rot['Spine1'] = (0.02 * s, 0, 0); rot['Head'] = (0.02 * s, 0.05 * s, 0)
    return rot, 0.5 * s
CLIPS = [('walk', 10, lambda t: walk(2 * math.pi * t)), ('carry', 10, lambda t: walk(2 * math.pi * t, 'front')), ('shoulder', 10, lambda t: walk(2 * math.pi * t, 'shoulder')), ('work', 12, work), ('idle', 4, idle)]
frames = []; clipInfo = {}; hand = []; head = []; spine = []
RH, HD, SP = BI['RightHand'], BI['Head'], BI['Spine2']
for name, n, fn in CLIPS:
    start = len(frames)
    for i in range(n + 1):                                # la dernière image répète la première : boucle propre
        rot, hy = fn((i % n) / n); Jp = pose(rot, hy); frames.append(skin_pose(Jp))
        hand.append((Jp[RH] @ inv[RH]).T.reshape(-1).tolist()); head.append((Jp[HD] @ inv[HD]).T.reshape(-1).tolist()); spine.append((Jp[SP] @ inv[SP]).T.reshape(-1).tolist())
    clipInfo[name] = [start, n]
F = len(frames); frames = np.stack(frames); print('images', F)
# gabarit : pieds au sol
miny = frames[..., 1].min(); frames[..., 1] -= miny
mn = frames.reshape(-1, 3).min(0); mx = frames.reshape(-1, 3).max(0)
Q = np.round((frames - mn) / (mx - mn) * 65535).astype(np.uint16)       # (F,V,3)
# couleurs : une variante par métier (le manteau « top » = partie 1 est teinté)
TINT = {'idle': (1, 1, 1), 'wood': (0.75, 1.0, 0.62), 'stone': (0.95, 0.95, 1.0), 'iron': (0.68, 0.85, 1.12), 'gold': (1.15, 1.05, 0.55), 'food': (1.1, 1.0, 0.7), 'repair': (1.2, 0.85, 0.5), 'build': (1.2, 0.95, 0.6)}
variants = {}
for k, tint in TINT.items():
    c = Cl.copy(); m = Part == 1; c[m] = np.clip(c[m] * np.array(tint) * (1.0 if k == 'idle' else 1.25), 0, 1); variants[k] = (c * 255 + 0.5).astype(np.uint8)
hdr = {'V': int(V), 'I': int(len(Ix)), 'F': int(F), 'mn': mn.tolist(), 'mx': mx.tolist(), 'clips': clipInfo, 'tints': list(TINT), 'hand': hand, 'head': head, 'spine': spine, 'miny': float(miny), 'height': float(mx[1] - mn[1]), 'sx': sx, 'handPos': Jm[RH][:3, 3].tolist(), 'headPos': Jm[HD][:3, 3].tolist()}
def align(o): return (o + 3) & ~3
hb = json.dumps(hdr).encode(); out = bytearray(struct.pack('<I', len(hb))) + hb
while len(out) % 4: out += b' '
out += Ix.astype(np.uint16).tobytes()
while len(out) % 4: out += b'\0'
for k in TINT:
    out += variants[k].tobytes()
    while len(out) % 4: out += b'\0'
out += np.ascontiguousarray(Q).tobytes()
open(dst, 'wb').write(out); print('écrit', dst, len(out) // 1024, 'Ko', 'hauteur', hdr['height'])
