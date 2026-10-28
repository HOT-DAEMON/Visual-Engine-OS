"""Extraction v2 de la cellule 01 : encre -> (masses pleines) + (traits fins en rubans lissés par spline, pointes effilées) + (tons mesurés).
Différences avec analyze-01.py : plus de plafond de largeur (les masses noires sont des polygones à part), splines lissantes
au lieu d'une moyenne glissante, effilement aux extrémités libres, 5 niveaux de ton dont le gris est MESURÉ sur la référence.
Usage : python3 analyze-01b.py <image> [sortie.json] [dossier-contrôle]"""
import sys, json, numpy as np, cv2
from scipy import ndimage as ndi
from scipy.interpolate import splprep, splev
from skimage.morphology import skeletonize

S = 4
OUT_JSON = sys.argv[2] if len(sys.argv) > 2 else 'src/hair-grammar/profiles/tousled.ribbons.json'
CHK = sys.argv[3] if len(sys.argv) > 3 else 'artefacts/hair-grammar-ribbons'
src = cv2.imread(sys.argv[1], 0)[0:188, 0:188]
big = cv2.resize(src, None, fx=S, fy=S, interpolation=cv2.INTER_LANCZOS4)
sm = cv2.GaussianBlur(big, (0, 0), 1.2)
roi = np.zeros_like(big, np.uint8); roi[: 150 * S, : 152 * S] = 1
INK_T = 108
ink = ((sm < INK_T) & (roi > 0)).astype(np.uint8)
disk = lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
# --- 1. masses pleines : ce qui survit à l'ouverture par un disque de ~1,7 px cellule, puis reconstruction bornée par l'encre
R_SOLID = int(round(2.4 * S))
core = cv2.morphologyEx(ink, cv2.MORPH_OPEN, disk(R_SOLID))
nl, lab, st, _ = cv2.connectedComponentsWithStats(core)
for i in range(1, nl):
    if st[i, cv2.CC_STAT_AREA] < (4.5 * S) ** 2: core[lab == i] = 0
solid = (cv2.dilate(core, disk(R_SOLID)) & ink).astype(np.uint8)
thin = (ink & (cv2.dilate(solid, disk(1)) == 0)).astype(np.uint8)
FACE_BOXES = [(66, 88, 90, 104), (28, 90, 56, 106), (36, 104, 54, 126), (30, 122, 118, 152)]
def is_face(cx, cy): return any(x0 <= cx <= x1 and y0 <= cy <= y1 for x0, y0, x1, y1 in FACE_BOXES)
OX, OY, UNIT = 77.0, 95.0, 109.5
def tf(x, y): return [round(float((x - OX) / UNIT), 4), round(float((y - OY) / UNIT), 4)]
def rings_of(mask, simplify, min_area):
    cs, hier = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    out = []
    for c, h in zip(cs, hier[0]):
        if abs(cv2.contourArea(c)) < min_area: continue
        pts = c[:, 0, :].astype(np.float32)
        if len(pts) >= 9:   # lissage circulaire du contour (supprime l'escalier de pixels)
            k = 5; pad = np.concatenate([pts[-k:], pts, pts[:k]])
            pts = np.stack([np.convolve(pad[:, i], np.ones(2 * k + 1) / (2 * k + 1), 'valid') for i in (0, 1)], 1)
        pts = cv2.approxPolyDP(np.ascontiguousarray(pts, dtype=np.float32).reshape(-1, 1, 2), simplify, True)[:, 0, :] / S
        if len(pts) >= 3: out.append(pts)
    return out
solids = []
for ring in rings_of(solid, 1.0, 2.0 * S * S):
    cx, cy = ring.mean(0); solids.append({'role': 'face' if is_face(cx, cy) else 'hair', 'ring': [tf(x, y) for x, y in ring]})
print('masses pleines', len(solids))
# --- 2. traits fins : squelette du masque fin, branches, spline lissante, largeur = 2 x distance (sans plafond), effilement des pointes libres
dist = cv2.distanceTransform(ink, cv2.DIST_L2, 5)
sk = skeletonize(ink > 0)   # squelette de l'encre COMPLÈTE : traits continus ; les masses pleines se superposent (union de noirs)
pts = set(zip(*[a.tolist() for a in np.nonzero(sk)]))
N8 = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
nb = lambda p: [(p[0] + dy, p[1] + dx) for dy, dx in N8 if (p[0] + dy, p[1] + dx) in pts]
deg = {p: len(nb(p)) for p in pts}; junction = {p for p, d in deg.items() if d >= 3}
seen, branches = set(), []
def walk(s, n):
    path, prev, cur = [s, n], s, n
    while cur not in junction and deg[cur] == 2 and len(path) < 20000:
        c = [q for q in nb(cur) if q != prev]
        if not c: break
        prev, cur = cur, c[0]; path.append(cur)
    return path
for s in [p for p in pts if deg[p] == 1 or p in junction]:
    for n in nb(s):
        if (s, n) in seen: continue
        p = walk(s, n); seen.add((p[0], p[1])); seen.add((p[-1], p[-2])); branches.append(p)
ribs = []; MIN_LEN = 4.5 * S
for path in branches:
    a = np.array(path, float)[:, ::-1]   # (x,y) px sur-échantillonnés
    seg = np.hypot(*np.diff(a, axis=0).T); L = seg.sum()
    if L < MIN_LEN: continue
    free_a, free_b = deg[path[0]] == 1, deg[path[-1]] == 1
    w = np.array([dist[y, x] for y, x in path]) * 2
    wm = ndi.median_filter(w, size=max(5, int(len(w) // 6) | 1), mode='nearest')
    w = np.minimum(np.minimum(w, wm * 1.3), 2 * R_SOLID)
    s_ = np.concatenate([[0], np.cumsum(seg)])
    n = int(np.clip(L / (2.5 * S), 5, 70)); tt = np.linspace(0, 1, n)
    if len(a) >= 6:
        try:
            tck, _ = splprep([a[:, 0], a[:, 1]], u=s_ / L, s=len(a) * (0.55 * S / 4) ** 2, k=3)
            xs, ys = splev(tt, tck)
        except Exception: xs, ys = np.interp(tt, s_ / L, a[:, 0]), np.interp(tt, s_ / L, a[:, 1])
    else: xs, ys = np.interp(tt, s_ / L, a[:, 0]), np.interp(tt, s_ / L, a[:, 1])
    ww = ndi.gaussian_filter1d(np.interp(tt, s_ / L, w), 1.2, mode='nearest')
    arc = tt * L; Lt = min(0.28 * L, 5.0 * S)
    f = np.ones(n)
    if free_a: f = np.minimum(f, 0.25 + 0.75 * np.clip(arc / Lt, 0, 1))
    if free_b: f = np.minimum(f, 0.25 + 0.75 * np.clip((L - arc) / Lt, 0, 1))
    ww = np.maximum(ww * f, 0.3 * S)   # largeur plancher 0,3 px cellule
    cx, cy = float(np.mean(xs)) / S, float(np.mean(ys)) / S
    ribs.append({'role': 'face' if is_face(cx, cy) else 'hair', 'p': [tf(x / S, y / S) + [round(float(q) / S / UNIT, 4)] for x, y, q in zip(xs, ys, ww)]})
for i, r in enumerate(ribs): r['id'] = i
print('rubans fins', len(ribs), 'dont cheveux', sum(r['role'] == 'hair' for r in ribs))
# --- 3. tons : gris lissé SANS encre (convolution normalisée), bandes dont le gris est la moyenne mesurée dans la bande
free = (cv2.dilate(ink, disk(3)) == 0).astype(np.float32)
g = cv2.GaussianBlur(big.astype(np.float32) * free, (0, 0), 5) / np.maximum(cv2.GaussianBlur(free, (0, 0), 5), 1e-3)
ff = cv2.dilate(ink, np.ones((9, 9), np.uint8)).copy(); m_ = np.zeros((ff.shape[0] + 2, ff.shape[1] + 2), np.uint8)
cv2.floodFill(ff, m_, (0, 0), 2); filled = cv2.erode((ff != 2).astype(np.uint8), np.ones((9, 9), np.uint8)) * roi
zone = filled.copy(); zone[125 * S:, :] = 0
for x0, y0, x1, y1 in FACE_BOXES[:3]: zone[y0 * S:y1 * S, x0 * S:x1 * S] = 0
LEVELS = [246, 236, 222, 205, 180]
tones = []
for li, lv in enumerate(LEVELS, start=1):
    mk = ((g < lv) & (zone > 0)).astype(np.uint8)
    mk = cv2.morphologyEx(mk, cv2.MORPH_OPEN, disk(2)); mk = cv2.morphologyEx(mk, cv2.MORPH_CLOSE, disk(4))
    band = mk & ((g >= LEVELS[li] if li < len(LEVELS) else g >= 0))
    gray = int(round(float(g[band > 0].mean()))) if band.sum() else lv - 6
    rs = rings_of(mk, 1.1, 10 * S * S)
    if rs: tones.append({'level': li, 'gray': gray, 'rings': [[tf(x, y) for x, y in r] for r in rs]})
print('tons', [(t['level'], t['gray'], len(t['rings'])) for t in tones])
json.dump({'frame': {'ox': OX, 'oy': OY, 'unit': UNIT, 'cell': 188}, 'ribbons': ribs, 'solids': solids, 'tones': tones}, open(OUT_JSON, 'w'), separators=(',', ':'))
cv2.imwrite(CHK + '/extraction-masks.png', np.hstack([ink * 255, solid * 255, thin * 255, zone * 255]))
