"""Analyse de la cellule 01 : encre -> squelette -> branches (rubans de trait) + masses de ton.
Sortie : /home/claude/work/ribbons.json (repère image cellule, px) ; la mise au repère de tête se fait côté TS.
Usage : python3 analyze-01.py <image> [sortie.json] [dossier-contrôle]   (cellule 01 = coin haut-gauche 188x188 de l'image)
"""
import sys, json, numpy as np, cv2
from scipy import ndimage as ndi
from skimage.morphology import skeletonize

S = 4  # sur-échantillonnage
OUT_JSON = sys.argv[2] if len(sys.argv) > 2 else 'src/hair-grammar/profiles/tousled.ribbons.json'
CHK = sys.argv[3] if len(sys.argv) > 3 else 'artefacts/hair-grammar-ribbons'
src = cv2.imread(sys.argv[1], 0)[0:188, 0:188]
big = cv2.resize(src, None, fx=S, fy=S, interpolation=cv2.INTER_CUBIC)
# Zone utile : cheveux + visage de la cellule (exclut le personnage voisin x>150 et les vêtements y>135)
roi = np.zeros_like(big, np.uint8); roi[: 150 * S, : 152 * S] = 1
ink = ((big < 105) & (roi > 0)).astype(np.uint8)
# exclure le personnage voisin : composantes touchant x>=152
ink = cv2.morphologyEx(ink, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
dist = cv2.distanceTransform(ink, cv2.DIST_L2, 5)
sk = skeletonize(ink > 0)
ys, xs = np.nonzero(sk)
pts = set(zip(ys.tolist(), xs.tolist()))
N8 = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
def nbrs(p): return [(p[0] + dy, p[1] + dx) for dy, dx in N8 if (p[0] + dy, p[1] + dx) in pts]
deg = {p: len(nbrs(p)) for p in pts}
junction = {p for p, d in deg.items() if d >= 3}
# Branches : on marche depuis chaque extrémité/jonction le long des pixels de degré 2.
seen_edges = set(); branches = []
def walk(start, nxt):
    path = [start, nxt]; prev, cur = start, nxt
    while cur not in junction and deg[cur] == 2:
        c = [q for q in nbrs(cur) if q != prev and q not in junction or (q in junction and q != prev)]
        c = [q for q in nbrs(cur) if q != prev]
        if not c: break
        # préfère le voisin 4-connexe pour ne pas boucler
        prev, cur = cur, c[0]
        path.append(cur)
        if len(path) > 20000: break
    return path
starts = [p for p in pts if deg[p] == 1 or p in junction]
for s in starts:
    for n in nbrs(s):
        key = (s, n)
        if key in seen_edges: continue
        path = walk(s, n)
        seen_edges.add((path[0], path[1])); seen_edges.add((path[-1], path[-2]))
        branches.append(path)
print('branches brutes', len(branches))
out = []
for path in branches:
    a = np.array(path, float)  # (y,x)
    L = np.sum(np.hypot(*np.diff(a, axis=0).T))
    if L < 7 * S * 0.9: continue  # élague les éperons < ~6 px cellule
    w = np.array([dist[int(y), int(x)] for y, x in path]) * 2
    # lissage le long du chemin
    k = max(3, int(len(a) // 12) | 1)
    ker = np.ones(k) / k
    pad = lambda v: np.concatenate([np.full(k // 2, v[0]), v, np.full(k // 2, v[-1])])
    ys_, xs_ = [np.convolve(pad(v), ker, 'valid') for v in (a[:, 0], a[:, 1])]
    wm = ndi.median_filter(w, size=max(5, int(len(w) // 6) | 1), mode='nearest')   # médiane glissante : supprime les bulles aux jonctions
    ws_ = np.convolve(pad(np.minimum(np.minimum(w, wm * 1.25), 3.4 * S)), ker, 'valid')   # plafond 3,4 px cellule
    # ré-échantillonne à n points (pas ~3 px image)
    n = int(np.clip(L / (3 * S), 4, 60))
    t = np.concatenate([[0], np.cumsum(np.hypot(np.diff(ys_), np.diff(xs_)))]); t /= t[-1]
    tt = np.linspace(0, 1, n)
    out.append({'x': (np.interp(tt, t, xs_) / S).round(2).tolist(),
                'y': (np.interp(tt, t, ys_) / S).round(2).tolist(),
                'w': (np.interp(tt, t, ws_) / S).round(2).tolist()})
print('rubans', len(out))
# --- Classement hair / face (boîtes de repères en px cellule : yeux, nez, bas du visage) ---
FACE_BOXES = [(66, 88, 90, 104), (28, 90, 56, 106), (36, 104, 54, 126), (30, 122, 118, 152)]
def is_face(r):
    cx, cy = np.mean(r['x']), np.mean(r['y'])
    return any(x0 <= cx <= x1 and y0 <= cy <= y1 for x0, y0, x1, y1 in FACE_BOXES)
for i, r in enumerate(out): r['id'] = i; r['role'] = 'face' if is_face(r) else 'hair'
# --- Masses de ton : gris lissé, 2 niveaux (clair / moyen) dans la zone des cheveux ---
wmask = (cv2.dilate(ink, np.ones((5, 5), np.uint8)) == 0).astype(np.float32)   # gris lissé SANS les pixels d'encre (convolution normalisée)
blur = cv2.GaussianBlur(big.astype(np.float32) * wmask, (0, 0), 8) / np.maximum(cv2.GaussianBlur(wmask, (0, 0), 8), 1e-3)
sil = cv2.dilate(ink, np.ones((9, 9), np.uint8))
ff = sil.copy(); h_, w_ = ff.shape; m = np.zeros((h_ + 2, w_ + 2), np.uint8)
cv2.floodFill(ff, m, (0, 0), 2); filled = (ff != 2).astype(np.uint8)
filled = cv2.erode(filled, np.ones((9, 9), np.uint8)) * roi
hairzone = filled.copy(); hairzone[125 * S:, :] = 0
for x0, y0, x1, y1 in FACE_BOXES[:3]: hairzone[y0 * S:y1 * S, x0 * S:x1 * S] = 0
tones = []
for level, (lo, hi) in enumerate([(230, 247), (0, 230)], start=1):
    mk = ((blur >= lo) & (blur < hi) & (hairzone > 0) ).astype(np.uint8)
    mk = cv2.morphologyEx(mk, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8)); mk = cv2.morphologyEx(mk, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    cs, _ = cv2.findContours(mk, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    for c in cs:
        if cv2.contourArea(c) < 14 * S * S: continue
        c = cv2.approxPolyDP(c, 2.2, True)[:, 0, :] / S
        tones.append({'level': level, 'poly': c.round(2).tolist()})
print('masses de ton', len(tones))
OX, OY, UNIT = 77.0, 95.0, 109.5   # repère de tête : origine = iris de l'oeil proche, unité = hauteur de tête (calage de la session précédente)
def tf(x, y): return [round((x - OX) / UNIT, 4), round((y - OY) / UNIT, 4)]
ribs = [{'id': r['id'], 'role': r['role'], 'p': [tf(x, y) + [round(w / UNIT, 4)] for x, y, w in zip(r['x'], r['y'], r['w'])]} for r in out]
tz = [{'level': t['level'], 'poly': [tf(x, y) for x, y in t['poly']]} for t in tones]
json.dump({'frame': {'ox': OX, 'oy': OY, 'unit': UNIT, 'cell': 188}, 'ribbons': ribs, 'tones': tz}, open(OUT_JSON, 'w'))
print('hair', sum(r['role']=='hair' for r in out), 'face', sum(r['role']=='face' for r in out))
chk = np.zeros_like(big)
for r in out:
    X, Y, W = r['x'], r['y'], r['w']
    for i in range(len(X) - 1):
        for j in range(8):
            u = j / 8; cx = X[i] + (X[i + 1] - X[i]) * u; cy = Y[i] + (Y[i + 1] - Y[i]) * u; cw = W[i] + (W[i + 1] - W[i]) * u
            cv2.circle(chk, (int(round(cx * S)), int(round(cy * S))), max(1, int(round(cw * S / 2))), 255, -1)
inter = ((chk > 0) & (ink > 0)).sum(); uni = ((chk > 0) | (ink > 0)).sum()
print('IoU encre vs rubans', inter / uni)
cv2.imwrite(CHK+'/ribbons-check.png', np.hstack([ink * 255, chk, hairzone * 255]))
