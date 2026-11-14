#!/usr/bin/env python3
"""Cuit le cheval low-poly (GLB sans squelette ni animation) en texture de sommets (VAT) : le squelette est reconstruit à la main
(pattes à deux segments, cou/tête, queue souple, corps qui tangue), 3 allures (pas, galop, repos), 8 robes (couleurs de sommets).
Unités de sortie : mètres « modèle » (dos du cheval ≈ 1,45 m), cheval tourné vers +z, pieds à y = 0, selle en (0, ~1.45, 0).
Usage : python3 tools/bake_horse.py horse.glb assets/characters/horse.bin"""
import struct, json, sys, math
import numpy as np

src, dst = sys.argv[1], sys.argv[2]
f = open(src, 'rb').read(); cl, _ = struct.unpack('<II', f[12:20]); J = json.loads(f[20:20 + cl]); off = 20 + cl; bl, _ = struct.unpack('<II', f[off:off + 8]); B0 = off + 8
BV, ACC = J['bufferViews'], J['accessors']; CT = {5125: np.uint32, 5126: np.float32}; NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}
def acc(i):
    a = ACC[i]; bv = BV[a['bufferView']]; n = NC[a['type']]; dt = np.dtype(CT[a['componentType']]); o = B0 + bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    return np.frombuffer(f, dt, a['count'] * n, o).reshape(a['count'], n)
MESH = {'ShortHair': 0, 'LongHair': 1, 'WhiteHair': 2}           # corps · crinière+queue · balzanes/chanfrein
P, Ix, Part = [], [], []; base = 0
for m in J['meshes']:
    pr = m['primitives'][0]; mn = J['materials'][pr['material']]['name']
    if mn not in MESH: continue                                   # le plan « sol » est ignoré
    p = acc(pr['attributes']['POSITION']).astype(float); P.append(p); Ix.append(acc(pr['indices']).reshape(-1).astype(int) + base); Part.append(np.full(len(p), MESH[mn])); base += len(p)
P = np.vstack(P); Ix = np.concatenate(Ix); Part = np.concatenate(Part); V = len(P)
x, y, z = P[:, 0], P[:, 1], P[:, 2]; ZG = z.min()                 # modèle : avant = −y, haut = +z, largeur = x

def sstep(a, b, v):
    t = np.clip((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
# ——— pondérations ———
def legw(ylo, yhi, sx, zhip, soft=1.6):
    wy = sstep(ylo - soft, ylo + soft, y) * (1 - sstep(yhi - soft, yhi + soft, y))
    wx = sstep(-0.9, 0.9, sx * x)
    wz = 1 - sstep(zhip - 5.0, zhip + 0.5, z)
    return wy * wx * wz
LEG = {'fl': legw(-24.5, -15.5, 1, 15.0), 'fr': legw(-24.5, -15.5, -1, 15.0), 'hl': legw(-7.5, 2.5, 1, 15.5), 'hr': legw(-7.5, 2.5, -1, 15.5)}
legsum = sum(LEG.values()); sc = np.minimum(1, 1 / np.maximum(legsum, 1e-6)); LEG = {k: v * sc for k, v in LEG.items()}; legsum = sum(LEG.values())
neck = np.clip(sstep(-18.5, -24.5, y) * sstep(10.5, 14.5, z + np.maximum(0, -y - 27) * 1.2), 0, 1) * (1 - legsum)
tail = sstep(-0.6, 2.2, y) * (Part == 1)
neck = neck * (1 - tail)
PIV = {'fl': (-20.0, 15.0), 'fr': (-20.0, 15.0), 'hl': (-3.5, 15.5), 'hr': (-3.5, 15.5)}       # (y, z) de l'épaule / de la hanche
KNEE = {'fl': (-20.0, 5.2), 'fr': (-20.0, 5.2), 'hl': (-1.6, 6.4), 'hr': (-1.6, 6.4)}
NECKP = (-19.0, 15.0); TAILP = (0.0, 19.5); BODYP = (-11.0, 12.0)

def rx(a, py, pz, yy, zz):                                      # rotation d'angle a autour de l'axe x passant par (py, pz)
    c, s = math.cos(a), math.sin(a); dy, dz = yy - py, zz - pz; return py + dy * c - dz * s, pz + dy * s + dz * c
def pose(par):
    X, Y, Z = x.copy(), y.copy(), z.copy()
    for k in LEG:
        w = LEG[k]; hy, hz = PIV[k]; ky, kz = KNEE[k]; a, kf = par['hip'][k], par['knee'][k]
        wk = sstep(kz + 1.8, kz - 1.0, Z) if False else sstep(kz + 1.6, kz - 1.0, z)         # sous le genou : suit la flexion
        y1, z1 = rx(kf, ky, kz, y, z); y1 = y + (y1 - y) * wk; z1 = z + (z1 - z) * wk          # flexion du genou
        y2, z2 = rx(a, hy, hz, y1, z1)                                                         # rotation de la hanche
        Y += (y2 - Y) * w; Z += (z2 - Z) * w
    # cou / tête
    yn, zn = rx(par['neck'], *NECKP, Y, Z); Y += (yn - Y) * neck; Z += (zn - Z) * neck
    # queue : flexible, chaque point tourne selon sa distance à la racine
    tt = np.clip((TAILP[1] - Z) / 16.0, 0, 1); yt, zt = rx(par['tail'], TAILP[0], TAILP[1], Y, Z)
    a = par['tailyaw'] * tt; c, s = np.cos(a), np.sin(a); xt = X * c - (yt - TAILP[0]) * s; yt = TAILP[0] + X * s + (yt - TAILP[0]) * c
    X = X + (xt - X) * tail; Y = Y + (yt - Y) * tail; Z = Z + (zt - Z) * tail
    # corps : tangage + rebond
    Y, Z = rx(par['pitch'], *BODYP, Y, Z); Z = Z + par['bob']
    return X, Y, Z
def bodymat(par):                                                # transformation rigide du tronc, en repère modèle (pour la selle)
    M = np.eye(4); c, s = math.cos(par['pitch']), math.sin(par['pitch'])
    R = np.eye(4); R[1, 1] = c; R[1, 2] = -s; R[2, 1] = s; R[2, 2] = c
    T1 = np.eye(4); T1[1, 3] = BODYP[0]; T1[2, 3] = BODYP[1]; T0 = np.eye(4); T0[1, 3] = -BODYP[0]; T0[2, 3] = -BODYP[1]; TB = np.eye(4); TB[2, 3] = par['bob']
    return TB @ T1 @ R @ T0

# ——— allures ———
def legs(A, K, off, kk=1.0):
    return {k: None for k in off}
def clip_walk(n):
    out = []
    for i in range(n):
        ph = 2 * math.pi * i / n; offs = {'hl': 0.0, 'fl': 0.25, 'hr': 0.5, 'fr': 0.75}; hip = {}; kn = {}
        for k, o in offs.items():
            p = ph + 2 * math.pi * o; A = 0.42 if k[0] == 'f' else 0.36; hip[k] = A * math.cos(p); kn[k] = (1.1 if k[0] == 'f' else 0.9) * max(0, math.sin(p))
        out.append(dict(hip=hip, knee=kn, neck=0.10 * math.sin(ph * 2 + 0.6) + 0.05, tail=0.10 + 0.05 * math.sin(ph), tailyaw=0.30 * math.sin(ph), pitch=0.03 * math.sin(ph * 2), bob=0.12 * math.sin(ph * 2 + 1.0)))
    return out
def clip_gallop(n):
    out = []
    for i in range(n):
        ph = 2 * math.pi * i / n; offs = {'hl': 0.0, 'hr': 0.08, 'fl': 0.42, 'fr': 0.5}; hip = {}; kn = {}
        for k, o in offs.items():
            p = ph + 2 * math.pi * o; A = 0.85 if k[0] == 'f' else 0.75; hip[k] = A * math.cos(p) - (0.12 if k[0] == 'f' else -0.05); kn[k] = (1.5 if k[0] == 'f' else 1.2) * max(0, math.sin(p))
        out.append(dict(hip=hip, knee=kn, neck=-0.16 + 0.10 * math.sin(ph + 0.8), tail=0.55 + 0.1 * math.sin(ph), tailyaw=0.12 * math.sin(ph * 2), pitch=-0.07 * math.sin(ph + 0.4), bob=0.35 * max(0, math.sin(ph + 0.2)) + 0.05 * math.sin(ph * 2)))
    return out
def clip_idle(n):
    out = []
    for i in range(n):
        ph = 2 * math.pi * i / n; hip = {'fl': 0.0, 'fr': 0.0, 'hl': 0.0, 'hr': 0.0}; kn = {'fl': 0.0, 'fr': 0.0, 'hl': 0.0, 'hr': 0.0}
        pw = max(0, math.sin(ph * 2)) if i < n else 0                    # la patte avant droite gratte le sol (une fois par cycle)
        hip['fr'] = -0.35 * pw; kn['fr'] = 0.9 * pw
        out.append(dict(hip=hip, knee=kn, neck=0.14 * math.sin(ph) + 0.10, tail=0.10, tailyaw=0.35 * math.sin(ph), pitch=0.015 * math.sin(ph), bob=0.04 * math.sin(ph)))
    return out
CLIPS = [('walk', clip_walk(16)), ('gallop', clip_gallop(12)), ('idle', clip_idle(12))]
frames, clipInfo, seatM = [], {}, []
S = 0.075                                                         # unités modèle → mètres
for name, seq in CLIPS:
    start = len(frames); n = len(seq)
    for par in seq + [seq[0]]:                                    # + première image dupliquée (boucle lisse avec vf1 = vf0+1)
        X, Y, Z = pose(par); frames.append(np.stack([X, Y, Z], 1)); seatM.append(bodymat(par))
    clipInfo[name] = [start, n]
frames = np.array(frames)                                          # F, V, 3 (repère modèle)
# vers le repère jeu : X = x, Y = z − sol, Z = −y − yc  (selle en z jeu ≈ 0), puis échelle
YC = -11.0
C = np.array([[1, 0, 0, 0], [0, 0, 1, -ZG], [0, -1, 0, YC], [0, 0, 0, 1]], float); C[:3] *= S; C[3, 3] = 1; Ci = np.linalg.inv(C)
G = np.stack([frames[..., 0], frames[..., 2] - ZG, -frames[..., 1] + YC], -1) * S
F = len(G); seat = []
for M in seatM:
    Mg = C @ M @ Ci; seat.append(Mg.T.reshape(-1).tolist())
# point de selle (au repos) : dessus du dos près de y = −11
sel = (np.abs(x) < 1.2) & (np.abs(y - (-11.0)) < 1.5) & (Part == 0); backz = float(((z[sel].max()) - ZG) * S)
mn = G.reshape(-1, 3).min(0); mx = G.reshape(-1, 3).max(0); q = np.clip(np.round((G - mn) / (mx - mn) * 65535), 0, 65535).astype(np.uint16)

# ——— robes : (corps, crinière/queue, balzanes/chanfrein) en sRGB 0‑255 ———
SKINS = {'bay': ((176, 98, 52), (48, 30, 20), (238, 238, 238)), 'black': ((44, 40, 40), (22, 20, 20), (60, 56, 56)), 'white': ((236, 234, 228), (214, 210, 200), (246, 244, 240)),
         'chestnut': ((168, 84, 36), (122, 60, 28), (232, 226, 214)), 'grey': ((142, 144, 150), (84, 86, 92), (190, 192, 196)), 'palomino': ((218, 170, 84), (246, 236, 214), (246, 240, 226)),
         'dun': ((190, 156, 104), (60, 44, 32), (214, 204, 186)), 'paint': ((236, 232, 224), (96, 54, 30), (170, 98, 52))}
def colours(k):
    b, m, w = SKINS[k]; pal = np.array([b, m, w], float)
    out = pal[Part].copy()
    if k == 'paint':                                               # robe pie : taches brunes sur le corps
        pl = (np.sin(x * 0.9 + y * 0.45) + np.sin(y * 0.6 - z * 0.7) > 0.55) & (Part == 0); out[pl] = (170, 98, 52)
    return np.clip(out, 0, 255).astype(np.uint8)
hdr = {'V': int(V), 'I': int(len(Ix)), 'F': int(F), 'mn': mn.tolist(), 'mx': mx.tolist(), 'clips': clipInfo, 'skins': list(SKINS), 'seat': seat, 'backY': backz, 'height': float(mx[1]), 'length': float(mx[2] - mn[2])}
hb = json.dumps(hdr).encode(); al = lambda b: b + b'\0' * ((-len(b)) % 4)
out = struct.pack('<I', len(hb)) + hb; out = al(out); out += al(Ix.astype(np.uint16).tobytes())
for k in SKINS: out += al(colours(k).tobytes())
out += al(q.tobytes()); open(dst, 'wb').write(out)
np.save('/tmp/horse/frames.npy', G); np.save('/tmp/horse/idx.npy', Ix); np.save('/tmp/horse/part.npy', Part)
print('sommets', V, 'images', F, 'clips', clipInfo, 'dos', round(backz, 2), 'bbox', mn.round(2), mx.round(2), len(out) // 1024, 'Ko')
