# Chevalier : modèle GLB statique très dense (≈215 000 sommets, une texture) → maillage léger en couleurs de sommets,
# découpé en pièces rigides animables (corps, jambes, bras d'épée, cape) pour l'instanciation par escouades.
# Décimation par regroupement de sommets sur une grille (aucune dépendance hors numpy / OpenCV).
# Usage : python3 tools/bake_knight.py knight.glb assets/characters/knight.bin
import json, struct, sys
import numpy as np, cv2

def read_glb(path):
    d = open(path, 'rb').read(); L = struct.unpack('<I', d[12:16])[0]; j = json.loads(d[20:20 + L])
    o = 20 + L; bl = struct.unpack('<I', d[o:o + 4])[0]; binb = d[o + 8:o + 8 + bl]; return j, binb

def accessor(j, b, i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]; off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]; dt = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}[a['componentType']]
    stride = bv.get('byteStride', 0); cnt = a['count']; isz = np.dtype(dt).itemsize * n
    if stride and stride != isz:
        raw = np.frombuffer(b, np.uint8, count=stride * (cnt - 1) + isz, offset=off)
        return np.stack([np.frombuffer(raw[k * stride:k * stride + isz].tobytes(), dt) for k in range(cnt)])
    return np.frombuffer(b, dt, count=cnt * n, offset=off).reshape(cnt, n) if n > 1 else np.frombuffer(b, dt, count=cnt, offset=off)

def node_mat(n):
    if 'matrix' in n: return np.array(n['matrix'], dtype=np.float64).reshape(4, 4).T
    M = np.eye(4); t = n.get('translation', [0, 0, 0]); r = n.get('rotation', [0, 0, 0, 1]); s = n.get('scale', [1, 1, 1])
    x, y, z, w = r; R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    M[:3, :3] = R * np.array(s); M[:3, 3] = t; return M

def gather(j, b, tex):
    P, C, I = [], [], []; base = 0
    def walk(ni, M):
        nonlocal base
        n = j['nodes'][ni]; M = M @ node_mat(n)
        if 'mesh' in n:
            for p in j['meshes'][n['mesh']]['primitives']:
                pos = accessor(j, b, p['attributes']['POSITION']).astype(np.float64); uv = accessor(j, b, p['attributes']['TEXCOORD_0'])
                idx = accessor(j, b, p['indices']).astype(np.int64) if 'indices' in p else np.arange(len(pos))
                pw = (M[:3, :3] @ pos.T).T + M[:3, 3]
                h, w = tex.shape[:2]; u = np.clip((uv[:, 0] % 1) * (w - 1), 0, w - 1).astype(int); v = np.clip((uv[:, 1] % 1) * (h - 1), 0, h - 1).astype(int)
                col = tex[v, u, ::-1].astype(np.float64) / 255
                P.append(pw); C.append(col); I.append(idx + base); base += len(pw)
        for c in n.get('children', []): walk(c, M)
    for r in j['scenes'][j.get('scene', 0)]['nodes']: walk(r, np.eye(4))
    return np.concatenate(P), np.concatenate(C), np.concatenate(I).reshape(-1, 3)

def decimate(P, C, T, cell):
    key = np.floor(P / cell).astype(np.int64); _, inv = np.unique(key, axis=0, return_inverse=True); inv = inv.reshape(-1)
    n = inv.max() + 1; cnt = np.bincount(inv, minlength=n)[:, None]
    NP = np.zeros((n, 3)); np.add.at(NP, inv, P); NP /= cnt
    NC = np.zeros((n, 3)); np.add.at(NC, inv, C); NC /= cnt
    T2 = inv[T]; ok = (T2[:, 0] != T2[:, 1]) & (T2[:, 1] != T2[:, 2]) & (T2[:, 0] != T2[:, 2]); T2 = T2[ok]
    T2 = np.unique(np.sort(T2, 1), axis=0, return_index=True)[1]; T2 = inv[T][ok][np.sort(T2)]
    # couleur par TRIANGLE (rendu à facettes) : moyenne des sommets d'origine qui tombent dans le triangle → plus fidèle à la texture
    return NP, NC, T2

def main():
    src, out = sys.argv[1], sys.argv[2]; j, b = read_glb(src)
    img = j['images'][0]; bv = j['bufferViews'][img['bufferView']]; tex = cv2.imdecode(np.frombuffer(b[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']], np.uint8), cv2.IMREAD_COLOR)
    P, C, T = gather(j, b, tex)
    mn, mx = P.min(0), P.max(0); H = mx[1] - mn[1]
    P = (P - np.array([(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2])) / H * 2.0     # 2 m, pieds à y = 0, centré
    cell = float(sys.argv[3]) if len(sys.argv) > 3 else 0.034
    NP, NC, NT = decimate(P, C, T, cell)
    # pièces : jambes (sous la taille, devant la cape), bras droit (côté -x, entre coude et épaule), cape (dos), corps (le reste)
    cen = NP[NT].mean(1); y, x, z = cen[:, 1], cen[:, 0], cen[:, 2]
    part = np.zeros(len(NT), np.int8)                                  # 0 corps
    capeZ = -0.09
    part[(y < 0.9) & (x < 0) & (z > capeZ)] = 1                         # jambe (x<0)
    part[(y < 0.9) & (x >= 0) & (z > capeZ)] = 2                        # jambe (x>0)
    part[(y >= 0.82) & (y < 1.52) & (x < -0.27)] = 3                    # bras droit (-x)
    part[(y >= 0.25) & (y < 1.5) & (z <= capeZ) & (np.abs(x) < 0.34)] = 4   # cape
    print('triangles', len(NT), 'sommets', len(NP), 'pièces', np.bincount(part, minlength=5))
    # export : par pièce, triangles non indexés (positions float16 suffisent ? on garde u16 quantifié) + couleur par triangle
    hdr = {'parts': [], 'H': 2.0}; blobs = []
    names = ['body', 'legA', 'legB', 'arm', 'cape']
    for k in range(5):
        tri = NT[part == k]; pos = NP[tri].reshape(-1, 3); col = NC[tri].mean(1)          # couleur par face
        col = np.repeat(col, 3, 0)
        pmn, pmx = pos.min(0), pos.max(0); q = np.round((pos - pmn) / np.maximum(pmx - pmn, 1e-6) * 65535).astype('<u2')
        c8 = np.round(np.clip(col, 0, 1) * 255).astype('u1')
        hdr['parts'].append({'name': names[k], 'V': len(pos), 'mn': pmn.tolist(), 'mx': pmx.tolist()})
        blobs += [q.tobytes(), c8.tobytes()]
    al = lambda x: x + b'\0' * ((-len(x)) % 4); hb = json.dumps(hdr).encode()
    open(out, 'wb').write(al(struct.pack('<I', len(hb)) + hb) + b''.join(al(x) for x in blobs))

if __name__ == '__main__': main()
