#!/usr/bin/env python3
"""Extrait d'un pack GLB (Sketchfab 'Low poly winter medieval castle and town pack') un kit compact :
  assets/world/kit.bin  (sommets quantifiés + indices) · kit.json (index) · kit.png (palette de textures).
Chaque maillage est recentré : centre en X/Z, base à Y=0, mètres, Y vers le haut. Les maillages COLLIDER sont ignorés.
Usage : python3 -I tools/extract_kit.py <pack.glb> [dossier_sortie]"""
import json, struct, sys, io
import numpy as np
src = sys.argv[1]; out = sys.argv[2] if len(sys.argv) > 2 else 'assets/world'
f = open(src, 'rb').read(); cl = struct.unpack('<I', f[12:16])[0]; J = json.loads(f[20:20 + cl])
bo = 20 + cl; bl = struct.unpack('<I', f[bo:bo + 4])[0]; BIN = f[bo + 8:bo + 8 + bl]
N, M, A, BV = J['nodes'], J['meshes'], J['accessors'], J['bufferViews']
CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}; NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
def acc(i):
    a = A[i]; bv = BV[a['bufferView']]; dt = CT[a['componentType']]; nc = NC[a['type']]; off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = bv.get('byteStride') or nc * np.dtype(dt).itemsize
    if stride == nc * np.dtype(dt).itemsize: return np.frombuffer(BIN, dt, a['count'] * nc, off).reshape(-1, nc)
    return np.stack([np.frombuffer(BIN, dt, nc, off + k * stride) for k in range(a['count'])])
def mat(n):
    if 'matrix' in n: return np.array(n['matrix'], dtype=np.float64).reshape(4, 4).T
    T = np.eye(4)
    if 'translation' in n: T[:3, 3] = n['translation']
    return T
meshes = {}
def walk(i, P):
    n = N[i]; W = P @ mat(n)
    if 'mesh' in n and 'COLLIDER' not in n['name']:
        name = n['name'].replace('_Medieval_0', ''); parts = meshes.setdefault(name, [])
        for p in M[n['mesh']]['primitives']:
            pos = acc(p['attributes']['POSITION']).astype(np.float64); nor = acc(p['attributes']['NORMAL']).astype(np.float64); uv = acc(p['attributes']['TEXCOORD_0']).astype(np.float64)
            idx = acc(p['indices']).reshape(-1).astype(np.uint32)
            pos = (W @ np.c_[pos, np.ones(len(pos))].T).T[:, :3]; nor = (np.linalg.inv(W[:3, :3]).T @ nor.T).T; nor /= np.maximum(np.linalg.norm(nor, axis=1, keepdims=True), 1e-9)
            parts.append((pos, nor, uv, idx))
    for c in n.get('children', []): walk(c, W)
walk(J['scenes'][0]['nodes'][0], np.eye(4))
# palette de textures
img = [i for i in J['images']][0]; bv = BV[img['bufferView']]; open(out + '/kit.png', 'wb').write(BIN[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']])
blob = bytearray(); index = {}
for name, parts in sorted(meshes.items()):
    # fusionne les parties d'un même objet (ex. château en deux maillages), recentre
    pos = np.vstack([p[0] for p in parts]); nor = np.vstack([p[1] for p in parts]); uv = np.vstack([p[2] for p in parts])
    idx = np.concatenate([p[3] + sum(len(q[0]) for q in parts[:k]) for k, p in enumerate(parts)]).astype(np.uint32)
    lo, hi = pos.min(0), pos.max(0); c = np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2]); pos = pos - c; lo2, hi2 = pos.min(0), pos.max(0)
    ext = np.maximum(np.maximum(abs(lo2), abs(hi2)), 1e-6)
    q = np.round(pos / ext * 32767).astype(np.int16); nq = np.round(nor * 127).astype(np.int8); nq = np.c_[nq, np.zeros(len(nq), np.int8)]
    uq = np.round(np.clip(uv, -3.99, 3.99) * 8192).astype(np.int16)   # les UV dépassent [0,1] (texture répétée)
    # soudure des sommets identiques (position + normale + uv quantifiés) : réduit fortement le poids
    key = np.ascontiguousarray(np.c_[q, nq[:, :3].astype(np.int16), uq.astype(np.int32)].astype(np.int32))
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True); inv = inv.reshape(-1)
    q, nq, uq = q[first], nq[first], uq[first]; idx = inv[idx].astype(np.uint32); pos = pos[first]
    wide = len(pos) > 65535
    index[name] = { 'size': [round(float(x), 3) for x in hi - lo], 'ext': [float(x) for x in ext], 'v': int(len(pos)), 'i': int(len(idx)), 'off': len(blob), 'idx32': wide }
    for arr in (q, nq, uq, idx.astype(np.uint32 if wide else np.uint16)):
        b = arr.tobytes(); blob += b + b'\0' * (-len(b) % 4)
open(out + '/kit.bin', 'wb').write(blob)
json.dump({ 'source': 'Low poly winter medieval castle and town pack — assetfactory (Sketchfab Standard license)', 'meshes': index }, open(out + '/kit.json', 'w'), indent=1)
print(len(index), 'objets,', len(blob) // 1024, 'Ko'); print({k: (v['size'], v['v']) for k, v in index.items()})
