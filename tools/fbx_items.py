# Convertit des objets FBX binaires (pack d'objets low-poly : épées, cristaux, potions…) en un fichier compact
# assets/items/items.bin lu par src/render/Items.js. Couleurs = DiffuseColor des matériaux, posées en couleurs de sommets.
# Usage : python3 tools/fbx_items.py <dossier_fbx> <sortie.bin> Nom1 Nom2 …
import struct, zlib, sys, json, math, os
import numpy as np

def read_node(d, o, v):
    if v >= 7500: end, nprop, plen = struct.unpack_from('<QQQ', d, o); o += 24
    else: end, nprop, plen = struct.unpack_from('<III', d, o); o += 12
    nl = d[o]; o += 1
    if end == 0: return None, o
    name = d[o:o + nl].decode(); o += nl
    props = []
    for _ in range(nprop):
        t = chr(d[o]); o += 1
        if t == 'Y': props.append(struct.unpack_from('<h', d, o)[0]); o += 2
        elif t == 'C': props.append(d[o] != 0); o += 1
        elif t == 'I': props.append(struct.unpack_from('<i', d, o)[0]); o += 4
        elif t == 'F': props.append(struct.unpack_from('<f', d, o)[0]); o += 4
        elif t == 'D': props.append(struct.unpack_from('<d', d, o)[0]); o += 8
        elif t == 'L': props.append(struct.unpack_from('<q', d, o)[0]); o += 8
        elif t in 'fdlib':
            n, enc, cl = struct.unpack_from('<III', d, o); o += 12
            raw = d[o:o + cl]; o += cl
            if enc: raw = zlib.decompress(raw)
            dt = {'f': '<f4', 'd': '<f8', 'l': '<i8', 'i': '<i4', 'b': 'u1'}[t]
            props.append(np.frombuffer(raw, dtype=dt, count=n))
        elif t in 'SR':
            n = struct.unpack_from('<I', d, o)[0]; o += 4; props.append(d[o:o + n]); o += n
        else: raise ValueError('type ' + t)
    kids = []
    null = 25 if v >= 7500 else 13
    while o < end:
        if end - o == null: o = end; break
        k, o = read_node(d, o, v)
        if k is None: break
        kids.append(k)
    return {'name': name, 'props': props, 'kids': kids}, end

def parse(path):
    d = open(path, 'rb').read(); v = struct.unpack_from('<I', d, 23)[0]; o = 27; top = []
    while o < len(d) - 200:
        n, o = read_node(d, o, v)
        if n is None: break
        top.append(n)
    return top

def kid(n, name): return next((k for k in n['kids'] if k['name'] == name), None)
def p70(n):
    out = {}; P = kid(n, 'Properties70')
    for p in (P['kids'] if P else []):
        key = p['props'][0].decode(); out[key] = p['props'][4:]
    return out

def euler_mat(rx, ry, rz):   # FBX : ordre XYZ (degrés) → R = Rz·Ry·Rx
    rx, ry, rz = map(math.radians, (rx, ry, rz))
    X = np.array([[1, 0, 0], [0, math.cos(rx), -math.sin(rx)], [0, math.sin(rx), math.cos(rx)]])
    Y = np.array([[math.cos(ry), 0, math.sin(ry)], [0, 1, 0], [-math.sin(ry), 0, math.cos(ry)]])
    Z = np.array([[math.cos(rz), -math.sin(rz), 0], [math.sin(rz), math.cos(rz), 0], [0, 0, 1]])
    return Z @ Y @ X

def extract(path):
    top = parse(path); objs = next(n for n in top if n['name'] == 'Objects'); conns = next(n for n in top if n['name'] == 'Connections')
    by = {}
    for o in objs['kids']: by[o['props'][0]] = o
    parent = {}; mats_of = {}
    for c in conns['kids']:
        if c['props'][0] != b'OO': continue
        ch, pa = c['props'][1], c['props'][2]
        if ch in by and by[ch]['name'] == 'Material': mats_of.setdefault(pa, []).append(ch)
        else: parent[ch] = pa
    def world(mid):   # matrice monde (3×3 + translation) d'un modèle
        M = np.eye(4)
        while mid in by and by[mid]['name'] == 'Model':
            p = p70(by[mid]); L = np.eye(4)
            R = euler_mat(*p.get('Lcl Rotation', (0, 0, 0))); S = np.diag(p.get('Lcl Scaling', (1, 1, 1)))
            pre = euler_mat(*p.get('PreRotation', (0, 0, 0)))
            L[:3, :3] = pre @ R @ S; L[:3, 3] = p.get('Lcl Translation', (0, 0, 0))
            M = L @ M; mid = parent.get(mid, 0)
        return M
    P, C = [], []
    for gid, g in by.items():
        if g['name'] != 'Geometry': continue
        V = kid(g, 'Vertices')['props'][0].reshape(-1, 3); I = kid(g, 'PolygonVertexIndex')['props'][0]
        model = parent.get(gid); M = world(model); Vw = (M[:3, :3] @ V.T).T + M[:3, 3]
        lm = kid(g, 'LayerElementMaterial'); mi = kid(lm, 'Materials')['props'][0] if lm else None
        cols = []
        for m in mats_of.get(model, []):
            pp = p70(by[m]); c = pp.get('DiffuseColor', pp.get('Diffuse', (0.7, 0.7, 0.7))); cols.append(c[:3])
        if not cols: cols = [(0.7, 0.7, 0.7)]
        poly, pi = [], 0
        for idx in I:
            if idx < 0: poly.append(~idx)
            else: poly.append(idx); continue
            c = cols[(mi[pi] if mi is not None and len(mi) > 1 else (mi[0] if mi is not None else 0)) % len(cols)]
            for k in range(1, len(poly) - 1):
                for q in (poly[0], poly[k], poly[k + 1]): P.append(Vw[q]); C.append(c)
            poly = []; pi += 1
    return np.array(P, dtype=np.float32), np.array(C, dtype=np.float32)

def main():
    src, out, names = sys.argv[1], sys.argv[2], sys.argv[3:]
    hdr, blobs = {'items': []}, []
    for nm in names:
        P, C = extract(os.path.join(src, nm + '.fbx'))
        # repère du jeu : y vers le haut ; on recentre sur le bas de l'objet et on normalise la hauteur à 1
        mn, mx = P.min(0), P.max(0); h = max(mx[1] - mn[1], 1e-6)
        P = (P - np.array([(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2])) / h
        mn, mx = P.min(0), P.max(0)
        q = np.round((P - mn) / np.maximum(mx - mn, 1e-6) * 65535).astype('<u2')
        c = np.round(np.clip(C, 0, 1) ** (1 / 2.2) * 255).astype('u1')
        key = np.concatenate([q.view('u1').reshape(len(q), 6), c], 1)          # sommets dédoublonnés (position + couleur)
        uk, inv = np.unique(key, axis=0, return_inverse=True)
        q = np.ascontiguousarray(uk[:, :6]).view('<u2').reshape(-1, 3); c = np.ascontiguousarray(uk[:, 6:]); idx = inv.reshape(-1).astype('<u2')
        hdr['items'].append({'name': nm, 'V': len(q), 'I': len(idx), 'mn': mn.tolist(), 'mx': mx.tolist(), 'size': (mx - mn).tolist()})
        blobs.append(idx.tobytes()); blobs.append(q.tobytes()); blobs.append(c.tobytes())
        print(nm, len(P) // 3, 'triangles', np.round(mx - mn, 2))
    hb = json.dumps(hdr).encode(); body = b''
    al = lambda b: b + b'\0' * ((-len(b)) % 4)
    for b in blobs: body += al(b)
    open(out, 'wb').write(al(struct.pack('<I', len(hb)) + hb) + body)

if __name__ == '__main__': main()
