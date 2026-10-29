"""Extraction générique d'une cellule de l'image d'inspiration -> profil de rubans (masses pleines + traits fins + bandes de ton).
Généralisation de analyze-01b.py : AUCUNE constante propre à une coiffure ; tout vient d'une configuration de cellule (cells/*.json) :
recadrage, origine du repère de tête (iris proche, px image), unité (hauteur de tête, px), zone d'intérêt, seuil d'encre, zones « visage ».
Usage : python3 analyze-cell.py cells/02-side_sweep.json <profil.json> <dossier-contrôle>"""
import sys, json, numpy as np, cv2
from scipy import ndimage as ndi
from scipy.interpolate import splprep, splev
from skimage.morphology import skeletonize

CFG = json.load(open(sys.argv[1])); OUT_JSON = sys.argv[2]; CHK = sys.argv[3]
S = 4
x0, y0, x1, y1 = CFG['crop']
img = cv2.imread(CFG['image'], 0)[y0:y1, x0:x1]
H0, W0 = img.shape
big = cv2.resize(img, None, fx=S, fy=S, interpolation=cv2.INTER_LANCZOS4)
sm = cv2.GaussianBlur(big, (0, 0), 1.2)
loc = lambda x, y: ((x - x0) * S, (y - y0) * S)   # image -> sur-échantillonné local
rx0, ry0, rx1, ry1 = CFG['roi']
roi = np.zeros_like(big, np.uint8); roi[max(0, (ry0 - y0) * S):(ry1 - y0) * S, max(0, (rx0 - x0) * S):(rx1 - x0) * S] = 1
disk = lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))

def mask_of(boxes, polys):
    m = np.zeros_like(big, np.uint8)
    for bx in boxes:
        a, b = loc(bx[0], bx[1]); c, d = loc(bx[2], bx[3]); m[int(b):int(d), int(a):int(c)] = 1
    for pl in polys:
        cv2.fillPoly(m, [np.array([loc(*p) for p in pl], np.int32)], 1)
    return m
face_m = mask_of(CFG['face_boxes'], CFG['face_polys'])
eye_m = mask_of(CFG.get('eye_boxes', []), [])
role_of = lambda pts_xy: ('eye' if eye_m.any() and frac_in(eye_m, pts_xy) > 0.5 else ('face' if face_frac(pts_xy) > 0.5 else 'hair'))
tone_ex = mask_of(CFG['tone_exclude_boxes'], CFG.get('tone_exclude_polys', []))
# seuil d'encre : plus tolérant dans la zone visage (nez, bouche = traits gris fins), sinon seuil général
thr = np.where(face_m > 0, CFG.get('ink_t_face', CFG['ink_t']), CFG['ink_t'])
ink = ((sm < thr) & (roi > 0)).astype(np.uint8)
def frac_in(m, pts_xy):
    p = np.clip(np.round(pts_xy).astype(int), 0, [big.shape[1] - 1, big.shape[0] - 1])
    return float(m[p[:, 1], p[:, 0]].mean())
def face_frac(pts_xy):   # part de points (sur-échantillonnés, x,y) dans la zone visage
    p = np.clip(np.round(pts_xy).astype(int), 0, [big.shape[1] - 1, big.shape[0] - 1])
    return float(face_m[p[:, 1], p[:, 0]].mean())

# --- 1. masses pleines : ouverture par un disque, reconstruction bornée par l'encre
R_SOLID = int(round(2.4 * S))
core = cv2.morphologyEx(ink, cv2.MORPH_OPEN, disk(R_SOLID))
nl, lab, st, _ = cv2.connectedComponentsWithStats(core)
for i in range(1, nl):
    if st[i, cv2.CC_STAT_AREA] < (4.5 * S) ** 2: core[lab == i] = 0
solid = (cv2.dilate(core, disk(R_SOLID)) & ink).astype(np.uint8)
thin = (ink & (cv2.dilate(solid, disk(1)) == 0)).astype(np.uint8)
OX, OY = CFG['origin'][0] - x0, CFG['origin'][1] - y0; UNIT = CFG['unit']
tf = lambda x, y: [round(float((x - OX) / UNIT), 4), round(float((y - OY) / UNIT), 4)]

def rings_of(mask, simplify, min_area):
    cs, hier = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    out = []
    if hier is None: return out   # bande vide
    for c, h in zip(cs, hier[0]):
        if abs(cv2.contourArea(c)) < min_area: continue
        pts = c[:, 0, :].astype(np.float32)
        if len(pts) >= 9:
            k = 5; pad = np.concatenate([pts[-k:], pts, pts[:k]])
            pts = np.stack([np.convolve(pad[:, i], np.ones(2 * k + 1) / (2 * k + 1), 'valid') for i in (0, 1)], 1)
        pts = cv2.approxPolyDP(np.ascontiguousarray(pts, dtype=np.float32).reshape(-1, 1, 2), simplify, True)[:, 0, :] / S
        if len(pts) >= 3: out.append(pts)
    return out
solids = []
for ring in rings_of(solid, 1.0, 2.0 * S * S):
    solids.append({'role': role_of(ring * S), 'ring': [tf(x, y) for x, y in ring]})
print('masses pleines', len(solids), 'dont cheveux', sum(s['role'] == 'hair' for s in solids))

# --- 2. traits fins : squelette de l'encre complète, branches, spline lissante, largeur = 2 x distance, effilement des pointes libres
dist = cv2.distanceTransform(ink, cv2.DIST_L2, 5)
sk = skeletonize(ink > 0)
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
gsm = cv2.GaussianBlur(big.astype(np.float32), (0, 0), 0.6 * S)   # gris de la référence, pour le dégradé le long de chaque ruban
ribs = []; MIN_LEN = 4.5 * S
for path in branches:
    a = np.array(path, float)[:, ::-1]
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
    role = role_of(np.stack([xs, ys], 1)); is_f = role != 'hair'
    if is_f and 'face_width_cap_px' in CFG: ww = np.minimum(ww, CFG['face_width_cap_px'] * S)   # un trait de visage reste un trait
    ww = np.maximum(ww * f, 0.3 * S)
    gy = np.clip(np.round(ys).astype(int), 0, big.shape[0] - 1); gx = np.clip(np.round(xs).astype(int), 0, big.shape[1] - 1)
    gl = ndi.gaussian_filter1d(gsm[gy, gx].astype(float), 1.5, mode='nearest')   # gris le long du ruban, lissé
    ribs.append({'role': role, 'p': [tf(x / S, y / S) + [round(float(q) / S / UNIT, 4)] for x, y, q in zip(xs, ys, ww)], 'g': [int(round(v)) for v in gl]})
for i, r in enumerate(ribs): r['id'] = i
print('rubans fins', len(ribs), 'dont cheveux', sum(r['role'] == 'hair' for r in ribs))

# --- 3. tons : gris lissé SANS encre (convolution normalisée), bandes dont le gris est la moyenne mesurée dans la bande
free = (cv2.dilate(ink, disk(3)) == 0).astype(np.float32)
SIG = CFG.get('tone_sigma', 5)
wgt = cv2.GaussianBlur(free, (0, 0), SIG)
g = cv2.GaussianBlur(big.astype(np.float32) * free, (0, 0), SIG) / np.maximum(wgt, 1e-3)
valid = (wgt > 0.04).astype(np.uint8)   # gris mesurable seulement là où il reste assez de papier non encré (sinon g -> 0 : artefact)
ff = cv2.dilate(ink, np.ones((9, 9), np.uint8)).copy(); m_ = np.zeros((ff.shape[0] + 2, ff.shape[1] + 2), np.uint8)
cv2.floodFill(ff, m_, (0, 0), 2); filled = cv2.erode((ff != 2).astype(np.uint8), np.ones((9, 9), np.uint8)) * roi
zone = filled.copy(); zone[int((CFG['cut_y'] - y0) * S):, :] = 0; zone[tone_ex > 0] = 0
if CFG.get('tone_exclude_face_poly', True): zone[face_m > 0] = 0
LEVELS = CFG.get('tone_levels', [246, 236, 222, 205, 180])
tones = []
for li, lv in enumerate(LEVELS, start=1):
    mk = ((g < lv) & (zone > 0) & (valid > 0)).astype(np.uint8)
    mk = cv2.morphologyEx(mk, cv2.MORPH_OPEN, disk(2)); mk = cv2.morphologyEx(mk, cv2.MORPH_CLOSE, disk(4))
    band = mk & ((g >= LEVELS[li] if li < len(LEVELS) else g >= 0))
    gray = int(round(float(g[band > 0].mean()))) if band.sum() else lv - 6   # moyenne mesurée (zones valides seulement)
    rs = rings_of(mk, 1.1, 10 * S * S)
    if rs: tones.append({'level': li, 'gray': gray, 'rings': [[tf(x, y) for x, y in r] for r in rs]})
print('tons', [(t['level'], t['gray'], len(t['rings'])) for t in tones])
out = {'frame': {'ox': OX, 'oy': OY, 'unit': UNIT, 'cell': W0}, 'ribbons': ribs, 'solids': solids, 'tones': tones}
if 'landmarks_px' in CFG:   # repères du visage mesurés à la grille, convertis dans le repère de tête
    L = CFG['landmarks_px']
    out['landmarks'] = {'crownV': round((L['crown_y'] - CFG['origin'][1]) / UNIT, 4), 'faceContourU': round((L['face_contour_x'] - CFG['origin'][0]) / UNIT, 4),
                        'noseTipV': round((L['nose_tip_y'] - CFG['origin'][1]) / UNIT, 4), 'mouthV': round((L['mouth_y'] - CFG['origin'][1]) / UNIT, 4), 'chinV': round((L['chin_y'] - CFG['origin'][1]) / UNIT, 4)}
if 'protect_boxes' in CFG:   # zones que les cheveux ne doivent pas recouvrir (yeux, nez, bouche) : [nom, x0, y0, x1, y1] en px image -> repère de tête
    out['protect'] = [{'name': b[0], 'box': tf(b[1] - x0, b[2] - y0) + tf(b[3] - x0, b[4] - y0)} for b in CFG['protect_boxes']]
if 'limits' in CFG: out['limits'] = CFG['limits']
if 'style_limits' in CFG: out['styleLimits'] = CFG['style_limits']
if 'eye_slot' in CFG: out['eyeSlot'] = CFG['eye_slot']
json.dump(out, open(OUT_JSON, 'w'), separators=(',', ':'))
cv2.imwrite(CHK + '/extraction-masks.png', np.hstack([ink * 255, solid * 255, thin * 255, zone * 255, face_m * 255]))
