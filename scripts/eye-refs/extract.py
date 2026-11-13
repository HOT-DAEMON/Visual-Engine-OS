"""Extraction MESURÉE de references/eyes/*.{png,jpg} (protocole.md : tout relever pixel par pixel, pour NOURRIR le moteur d'yeux existant).
Entrées humaines (seules valeurs non calculées) : pour chaque œil, ROI + ancres grossières des marges palpébrales haute/basse (px de l'image)
+ centre/rayon approximatifs de l'iris. Tout le reste est CALCULÉ : accrochage des ancres sur le gradient de luminance (±SNAP px, image lissée),
rééchantillonnage, repère de l'œil (axe canthus interne -> externe), profils normalisés, ajustement de deux cubiques (moindres carrés, comme TRIANGLE
dans opening-styles.ts), iris (cv2.fitEllipse sur le limbe), pupille (disque sombre central), reflets (blobs V>0.93 dans l'iris), palette de sclère.
Sorties : references/eyes/measures.json + artefacts/eyes-refs/overlay-<id>.png (preuve de l'ajustement). Limite : refs recadrées => canthus parfois coupé (note `cropped`)."""
import json, math, os
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi
from scipy.optimize import least_squares

REF, OUT = 'references/eyes', 'artefacts/eyes-refs'
SNAP = 9
# id: (fichier, canthus interne (x,y), canthus externe (x,y), marge haute [(x,y)..], marge basse [(x,y)..], iris (cx,cy,r), cropped)
EYES = {
 '04': ('04.jpg', (96, 388), (752, 382),
        [(118, 330), (150, 262), (200, 200), (250, 158), (320, 128), (400, 116), (480, 118), (560, 134), (620, 158), (670, 195), (710, 250), (738, 312)],
        [(150, 396), (200, 406), (260, 422), (330, 440), (400, 458), (450, 465), (500, 468), (600, 464), (650, 452), (700, 428), (735, 400)], (415, 285, 188), True),
 '10a': ('10.jpg', (172, 462), (556, 306),
        [(190, 410), (200, 330), (232, 285), (270, 262), (350, 248), (430, 250), (500, 265), (540, 285)],
        [(200, 462), (260, 470), (330, 475), (400, 468), (450, 455), (500, 430), (540, 380), (552, 330)], (352, 352, 124), False),
 '10b': ('10.jpg', (150, 884), (600, 730),
        [(168, 840), (200, 790), (250, 725), (320, 685), (400, 665), (480, 668), (540, 690), (585, 715)],
        [(190, 890), (260, 905), (330, 910), (400, 905), (470, 888), (530, 850), (575, 800), (595, 760)], (370, 760, 122), False),
 '07': ('07.jpg', (95, 335), (545, 290),
        [(130, 290), (170, 250), (215, 215), (270, 190), (330, 178), (400, 180), (460, 195), (505, 230), (535, 262)],
        [(130, 355), (180, 380), (240, 400), (300, 410), (360, 412), (420, 405), (470, 390), (510, 360), (535, 328)], (309, 297, 140), False),
 '11': ('11.jpg', (108, 610), (690, 600),
        [(130, 580), (170, 535), (230, 495), (300, 465), (380, 445), (460, 445), (540, 460), (610, 495), (660, 545)],
        [(150, 660), (220, 690), (300, 705), (380, 708), (460, 700), (540, 675), (610, 650), (660, 625)], (400, 550, 150), True),
}
def lum(img): return cv2.GaussianBlur(cv2.cvtColor(img, cv2.COLOR_RGB2GRAY).astype(np.float32), (0, 0), 1.6)

def resample(pts, n):
    p = np.asarray(pts, float); d = np.r_[0, np.cumsum(np.hypot(*np.diff(p, axis=0).T))]
    t = np.linspace(0, d[-1], n); return np.c_[np.interp(t, d, p[:, 0]), np.interp(t, d, p[:, 1])]

def snap(pts, L, centre, rad=SNAP):
    """Déplace chaque ancre le long de la normale (vers/depuis le centre de l'œil) sur le plus fort gradient de luminance."""
    out, c = [], np.asarray(centre, float)
    for i, p in enumerate(pts):
        p = np.asarray(p, float); a = pts[max(i - 1, 0)]; b = pts[min(i + 1, len(pts) - 1)]
        t = np.asarray(b, float) - np.asarray(a, float); t /= np.hypot(*t) + 1e-9; n = np.array([-t[1], t[0]])
        if np.dot(n, c - p) < 0: n = -n
        best, bg = p, 0.0
        for s in np.linspace(-rad, rad, 2 * rad + 1):
            q0, q1 = p + n * (s - 1.5), p + n * (s + 1.5)
            try:
                g = ndi.map_coordinates(L, [[q1[1]], [q1[0]]], order=1)[0] - ndi.map_coordinates(L, [[q0[1]], [q0[0]]], order=1)[0]
            except Exception: continue
            if abs(g) > bg: bg, best = abs(g), p + n * s
        out.append(best)
    return np.array(out)

def bez(p0, p1, p2, p3, t):
    t = t[:, None]; return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3

def fit_cubic(pts, p0, p3):
    """Cubique p0->p3 dont les 2 contrôles minimisent l'écart aux points (paramétrage par longueur d'arc)."""
    pts = np.asarray(pts, float); d = np.r_[0, np.cumsum(np.hypot(*np.diff(pts, axis=0).T))]; t = d / d[-1]
    def res(v): return (bez(p0, v[:2], v[2:], p3, t) - pts).ravel()
    v0 = np.r_[p0 + (p3 - p0) / 3, p0 + 2 * (p3 - p0) / 3]
    r = least_squares(res, v0); return r.x[:2], r.x[2:], float(np.sqrt(np.mean(r.fun ** 2)))

def hexc(c): return '#%02x%02x%02x' % tuple(int(round(v)) for v in c)

def measure(eid):
    fn, pi, po, up, lo, (icx, icy, ir), cropped = EYES[eid]
    img = np.array(Image.open(f'{REF}/{fn}').convert('RGB')); L = lum(img); H_, W_ = L.shape
    pi, po = np.array(pi, float), np.array(po, float)
    mid = (pi + po) / 2
    # --- marges : ancres -> accrochage -> rééchantillonnage (canthi fixes)
    U = np.vstack([pi, snap(up, L, mid), po]); D = np.vstack([pi, snap(lo, L, mid), po])
    Ur, Dr = resample(U, 64), resample(D, 64)
    # --- repère de l'œil : x vers l'externe (miroir si l'externe est à gauche), y vers le bas, origine = bbox haut-gauche
    flip = po[0] < pi[0]; sgn = -1.0 if flip else 1.0
    def tx(P): P = np.asarray(P, float); return np.c_[sgn * (P[:, 0] - pi[0]), P[:, 1]]
    Ut, Dt, pit, pot = tx(Ur), tx(Dr), tx([pi])[0], tx([po])[0]
    allp = np.vstack([Ut, Dt]); x0, y0, x1, y1 = allp[:, 0].min(), allp[:, 1].min(), allp[:, 0].max(), allp[:, 1].max()
    Wb, Hb = x1 - x0, y1 - y0
    nrm = lambda P: ((np.asarray(P, float) - [x0, y0]) / [Wb, Hb])
    c1, c2, ru = fit_cubic(nrm(Ut), nrm([pit])[0], nrm([pot])[0])
    d1, d2, rl = fit_cubic(nrm(Dt[::-1]), nrm([pot])[0], nrm([pit])[0])
    # --- grandeurs dans le repère tourné (axe des canthi)
    ang = math.atan2(pot[1] - pit[1], pot[0] - pit[0]); ca, sa = math.cos(-ang), math.sin(-ang)
    rot = lambda P: np.c_[(P[:, 0] - pit[0]) * ca - (P[:, 1] - pit[1]) * sa, (P[:, 0] - pit[0]) * sa + (P[:, 1] - pit[1]) * ca]
    Wc = math.hypot(*(pot - pit)); Ur_, Dr_ = rot(Ut) / Wc, rot(Dt) / Wc
    hUp, hLo = -Ur_[:, 1].min(), Dr_[:, 1].max()
    m = {'file': fn, 'cropped': cropped, 'widthPx': round(Wc, 1), 'tiltDeg': round(-math.degrees(ang), 2),
         'aspect': round((hUp + hLo), 4), 'upperFraction': round(hUp / (hUp + hLo), 4),
         'upperPeakAt': round(float(Ur_[np.argmin(Ur_[:, 1]), 0]), 4), 'lowerPeakAt': round(float(Dr_[np.argmax(Dr_[:, 1]), 0]), 4),
         'upperProfile': [round(float(-v), 4) for v in np.interp(np.linspace(0, 1, 21), Ur_[:, 0], Ur_[:, 1])],
         'lowerProfile': [round(float(v), 4) for v in np.interp(np.linspace(0, 1, 21), Dr_[:, 0], Dr_[:, 1])],
         'normCurves': {'pi': nrm([pit])[0].round(4).tolist(), 'po': nrm([pot])[0].round(4).tolist(), 'u1': c1.round(4).tolist(), 'u2': c2.round(4).tolist(),
                        'l1': d1.round(4).tolist(), 'l2': d2.round(4).tolist(), 'bboxAspect': round(Hb / Wb, 4)}, 'fitRmsNorm': {'upper': round(ru, 4), 'lower': round(rl, 4)}}
    # canthus : angle d'ouverture (entre tangentes haute et basse) interne / externe
    def cant(a, b, c): v1, v2 = b - a, c - a; return math.degrees(abs(math.atan2(v1[0] * v2[1] - v1[1] * v2[0], v1 @ v2)))
    m['canthusAngleDeg'] = {'inner': round(cant(Ut[0], Ut[4], Dt[4]), 1), 'outer': round(cant(Ut[-1], Ut[-5], Dt[-5]), 1)}
    # --- masque de l'ouverture (polygone des deux marges) dans l'image
    poly = np.vstack([Ur, Dr[::-1]]).astype(np.int32); mask = np.zeros((H_, W_), np.uint8); cv2.fillPoly(mask, [poly], 1)
    # --- iris : rayons du limbe (plus fort gradient descendant sombre->clair vers l'extérieur) hors paupières
    pts = []
    for a in np.deg2rad(np.arange(0, 360, 4)):
        d = np.array([math.cos(a), math.sin(a)]); best, bg = None, 0
        for r in np.arange(0.88 * ir, 1.12 * ir, 1.0):
            p, q = np.array([icx, icy]) + d * r, np.array([icx, icy]) + d * (r + 3)
            if not (0 <= q[0] < W_ - 1 and 0 <= q[1] < H_ - 1) or not mask[int(p[1]), int(p[0])] or not mask[int(q[1]), int(q[0])]: continue
            g = L[int(q[1]), int(q[0])] - L[int(p[1]), int(p[0])]
            if g > bg: bg, best = g, p
        if best is not None and bg > 8: pts.append(best)
    ex, ey, rx = icx, icy, ir
    if len(pts) >= 12:   # cercle moindres carrés robuste (rejet itératif des points > 6 % du rayon)
        P = np.array(pts, float)
        for _ in range(4):
            A = np.c_[2 * P[:, 0], 2 * P[:, 1], np.ones(len(P))]; b = (P ** 2).sum(1)
            cx_, cy_, c_ = np.linalg.lstsq(A, b, rcond=None)[0]; rr = math.sqrt(max(c_ + cx_ ** 2 + cy_ ** 2, 1e-9)); res_ = np.abs(np.hypot(P[:, 0] - cx_, P[:, 1] - cy_) - rr)
            keep = res_ < max(0.06 * rr, 2.0)
            if keep.sum() < 10: break
            P = P[keep]
        ex, ey, rx = cx_, cy_, rr
    ry = rx
    ic = rot(tx([[ex, ey]])) / Wc
    m['iris'] = {'centreAlongAxis': round(float((ic[0, 0])), 4), 'centreAcrossAxis': round(float(ic[0, 1]), 4), 'radiusOverWidth': round(float((rx + ry) / 2 / Wc), 4),
                 'radiusOverOpeningHeight': round(float((rx + ry) / 2 / Wc / (hUp + hLo)), 4), 'aspect': round(float(max(rx, ry) / min(rx, ry)), 4), 'limbusPointsUsed': len(pts)}
    # --- pupille : composante sombre centrale (L < 38) dans 0.6 r
    yy, xx = np.mgrid[0:H_, 0:W_]; inI = ((xx - ex) / rx) ** 2 + ((yy - ey) / ry) ** 2 <= 1
    dark = (L < 38) & (((xx - ex) / rx) ** 2 + ((yy - ey) / ry) ** 2 <= 0.55 ** 2); lab, n = ndi.label(dark)
    if n:
        k = lab[int(ey), int(ex)] or 1 + int(np.argmax(ndi.sum(dark, lab, range(1, n + 1)))); pr = math.sqrt((lab == k).sum() / math.pi)
        m['pupilOverIris'] = round(pr / ((rx + ry) / 2), 4)
    # --- reflets : blobs très clairs peu saturés dans l'iris
    hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV).astype(float); hl = (hsv[..., 2] > 0.93 * 255) & (hsv[..., 1] < 0.3 * 255) & inI
    lab, n = ndi.label(ndi.binary_closing(hl)); hs = []
    for k in range(1, n + 1):
        ys, xs = np.where(lab == k)
        if len(ys) >= 25: hs.append({'dx': round((xs.mean() - ex) / rx, 3), 'dy': round((ys.mean() - ey) / ry, 3), 'rOverIris': round(math.sqrt(len(ys) / math.pi) / ((rx + ry) / 2), 3)})
    m['highlights'] = sorted(hs, key=lambda h: -h['rOverIris'])[:6]
    # --- palette sclère : ouverture privée de l'iris (×1.06) et des reflets, 3 bandes verticales (haut = ombre de paupière)
    scl = mask.astype(bool) & ~(((xx - ex) / (rx * 1.06)) ** 2 + ((yy - ey) / (ry * 1.06)) ** 2 <= 1) & (L > 45)
    if scl.sum() > 200:
        ys, xs = np.where(scl); yn = (ys - ys.min()) / max(ys.max() - ys.min(), 1); cols = img[ys, xs].astype(float)
        m['sclera'] = {'mean': hexc(cols.mean(0)), 'top': hexc(cols[yn < .33].mean(0)) if (yn < .33).any() else None, 'mid': hexc(cols[(yn >= .33) & (yn < .66)].mean(0)) if ((yn >= .33) & (yn < .66)).any() else None,
                       'bottom': hexc(cols[yn >= .66].mean(0)) if (yn >= .66).any() else None, 'lumRange': [int(np.percentile(L[scl], 5)), int(np.percentile(L[scl], 95))], 'pixels': int(scl.sum())}
    # --- peau périoculaire : couronne 30..90 px autour de l'ouverture, sans cheveux/cils (L<55) ni reflets
    ring = cv2.dilate(mask, np.ones((181, 181), np.uint8)).astype(bool) & ~cv2.dilate(mask, np.ones((61, 61), np.uint8)).astype(bool) & (L > 70) & (hsv[..., 2] < 0.97 * 255)
    if ring.sum() > 500:
        ys, xs = np.where(ring); above = ys < ys.mean(); cols = img[ys, xs].astype(float)
        m['skin'] = {'mean': hexc(cols.mean(0)), 'above': hexc(cols[above].mean(0)), 'below': hexc(cols[~above].mean(0)), 'pixels': int(ring.sum())}
    # --- épaisseur du trait de cils haut (bande sombre L<60 vers l'extérieur de la marge haute), médiane en fraction de la largeur
    th = []
    for i in range(6, 58):
        p = Ur[i]; t = Ur[i + 1] - Ur[i - 1]; t /= np.hypot(*t) + 1e-9; n = np.array([t[1], -t[0]])
        if np.dot(n, mid - p) > 0: n = -n
        k = 0
        while k < 40 and L[int(np.clip(p[1] + n[1] * k, 0, H_ - 1)), int(np.clip(p[0] + n[0] * k, 0, W_ - 1))] < 60: k += 1
        th.append(k)
    m['upperLidLineThicknessOverWidth'] = round(float(np.median(th)) / Wc, 4)
    # --- surimpression de preuve
    ov = img.copy(); cv2.polylines(ov, [Ur.astype(np.int32)], False, (255, 0, 0), 2); cv2.polylines(ov, [Dr.astype(np.int32)], False, (0, 255, 0), 2)
    cv2.ellipse(ov, ((float(ex), float(ey)), (float(2 * rx), float(2 * ry)), 0), (255, 255, 0), 2)
    for p in (pi, po): cv2.circle(ov, (int(p[0]), int(p[1])), 6, (0, 255, 255), -1)
    for h in m['highlights']: cv2.circle(ov, (int(ex + h['dx'] * rx), int(ey + h['dy'] * ry)), 5, (255, 0, 255), 2)
    pad = 40; bx0, by0 = int(max(allp[:, 0].min() * 0 + min(pi[0], po[0], Ur[:, 0].min()) - pad, 0)), int(max(Ur[:, 1].min() - pad, 0))
    bx1, by1 = int(min(max(pi[0], po[0], Dr[:, 0].max()) + pad, W_)), int(min(Dr[:, 1].max() + pad, H_))
    Image.fromarray(ov[by0:by1, bx0:bx1]).save(f'{OUT}/overlay-{eid}.png')
    return m

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    res = {k: measure(k) for k in EYES}
    json.dump({'method': 'ancres humaines + accrochage gradient ±%d px; tout le reste calculé' % SNAP, 'eyes': res}, open(f'{REF}/measures.json', 'w'), indent=1)
    for k, v in res.items(): print(k, 'tilt', v['tiltDeg'], 'asp', v['aspect'], 'upFrac', v['upperFraction'], 'peaks', v['upperPeakAt'], v['lowerPeakAt'], 'iris r/W', v['iris']['radiusOverWidth'], 'pupil', v.get('pupilOverIris'), 'fit', v['fitRmsNorm'])
