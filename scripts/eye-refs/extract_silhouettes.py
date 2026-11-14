"""Silhouettes d'ouverture des références 13, 15 (et 17, 14 quand tracées) -> references/eyes/measures-silhouettes.json.
MÊMES descripteurs que extract.py (tilt, aspect, fraction haute, sommets, profils à 21 points, angles de canthus) : ils nourrissent le moteur d'enveloppe existant
(src/generation/eye-ref-recipes.ts ajuste les paramètres de `opening.ts` sur ces profils) ; aucun moteur par référence.
 - 15 (RGBA, fond transparent) : AUTOMATIQUE par le canal alpha (composantes connexes = yeux ; sourcils écartés par leur aire).
 - 13 / 17 / 14 : ancres humaines (canthi + marges) accrochées par gradient (helpers de extract.py), comme pour les 5 premiers yeux."""
import json, math, os, sys
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi
sys.path.insert(0, os.path.dirname(__file__))
from extract import lum, resample, snap, REF  # noqa: E402  (extract.py se lance depuis la racine du dépôt)
OUT = 'artefacts/eyes-refs2'
# ancres humaines : id -> (fichier, canthus interne, canthus externe, marge haute [..], marge basse [..])
TRACED = {
 '13-E5': ('13.jpg', (385, 365), (598, 305), [(395, 330), (405, 305), (425, 293), (460, 287), (490, 285), (520, 291), (560, 298)], [(420, 375), (460, 380), (500, 384), (540, 378), (570, 365), (590, 340)]),
 '17-A': ('17.jpg', (160, 93), (288, 112), [(172, 80), (190, 68), (215, 62), (245, 61), (268, 70), (276, 90)], [(185, 120), (210, 132), (240, 134), (265, 126)]),
 '17-C': ('17.jpg', (332, 142), (465, 128), [(345, 125), (362, 112), (385, 108), (410, 110), (440, 115)], [(350, 146), (380, 146), (410, 144), (440, 137)]),
 '13-E10': ('13.jpg', (360, 860), (595, 825), [(380, 830), (400, 805), (430, 795), (470, 797), (510, 805), (550, 815)], [(400, 872), (440, 882), (480, 882), (520, 870), (560, 852)]),
}
TRACED_JSON = os.path.join(REF, 'traced-anchors.json')  # ancres supplémentaires (réf. 13/17/14) ajoutées sans toucher à ce fichier
def descriptors(Ut, Dt, pit, pot):
    """Ut/Dt : marges haute/basse (N,2) du canthus interne au externe, repère image tourné vers l'externe (x vers l'externe, y vers le bas)."""
    ang = math.atan2(pot[1] - pit[1], pot[0] - pit[0]); ca, sa = math.cos(-ang), math.sin(-ang)
    rot = lambda P: np.c_[(P[:, 0] - pit[0]) * ca - (P[:, 1] - pit[1]) * sa, (P[:, 0] - pit[0]) * sa + (P[:, 1] - pit[1]) * ca]
    Wc = math.hypot(*(np.asarray(pot) - np.asarray(pit))); Ur_, Dr_ = rot(Ut) / Wc, rot(Dt) / Wc
    hUp, hLo = -Ur_[:, 1].min(), Dr_[:, 1].max(); xs = np.linspace(0, 1, 21)
    def prof(P, sign): o = np.argsort(P[:, 0]); return [round(float(sign * v), 4) for v in np.interp(xs, P[o, 0], P[o, 1])]
    def cant(a, b, c): v1, v2 = b - a, c - a; return math.degrees(abs(math.atan2(v1[0] * v2[1] - v1[1] * v2[0], v1 @ v2)))
    k = max(len(Ut) // 16, 3)
    return {'widthPx': round(Wc, 1), 'tiltDeg': round(-math.degrees(ang), 2), 'aspect': round(hUp + hLo, 4), 'upperFraction': round(hUp / (hUp + hLo), 4),
            'upperPeakAt': round(float(Ur_[np.argmin(Ur_[:, 1]), 0]), 4), 'lowerPeakAt': round(float(Dr_[np.argmax(Dr_[:, 1]), 0]), 4),
            'upperProfile': prof(Ur_, -1), 'lowerProfile': prof(Dr_, 1),
            'canthusAngleDeg': {'inner': round(cant(Ut[0], Ut[k], Dt[k]), 1), 'outer': round(cant(Ut[-1], Ut[-1 - k], Dt[-1 - k]), 1)}}
def mirrored(P, flip, pit): return np.c_[(-1.0 if flip else 1.0) * (P[:, 0] - pit[0]), P[:, 1]]
def from_anchors(eid, fn, pi, po, up, lo):
    img = np.array(Image.open(f'{REF}/{fn}').convert('RGB')); L = lum(img); pi, po = np.array(pi, float), np.array(po, float); mid = (pi + po) / 2
    Ur, Dr = resample(np.vstack([pi, snap(up, L, mid), po]), 64), resample(np.vstack([pi, snap(lo, L, mid), po]), 64)
    flip = po[0] < pi[0]; Ut, Dt = mirrored(Ur, flip, pi), mirrored(Dr, flip, pi); pit, pot = mirrored(pi[None], flip, pi)[0], mirrored(po[None], flip, pi)[0]
    d = descriptors(Ut, Dt, pit, pot); d.update({'file': fn, 'method': 'anchors+snap'})
    ov = img.copy(); cv2.polylines(ov, [Ur.astype(np.int32)], False, (255, 0, 0), 2); cv2.polylines(ov, [Dr.astype(np.int32)], False, (0, 160, 0), 2)
    for p in (pi, po): cv2.circle(ov, (int(p[0]), int(p[1])), 5, (0, 200, 255), -1)
    x0, y0 = int(min(Ur[:, 0].min(), Dr[:, 0].min()) - 40), int(Ur[:, 1].min() - 40); x1, y1 = int(max(Ur[:, 0].max(), Dr[:, 0].max()) + 40), int(Dr[:, 1].max() + 40)
    Image.fromarray(ov[max(y0, 0):y1, max(x0, 0):x1]).save(f'{OUT}/sil-{eid}.png'); return d
def from_alpha(fn, min_area=5000):
    im = Image.open(f'{REF}/{fn}'); rgba = np.array(im.convert('RGBA')); a = rgba[..., 3] > 128; lab, n = ndi.label(a); W = a.shape[1]; res = {}
    ov = rgba[..., :3].copy(); ov[~a] = (40, 40, 40)
    comps = sorted([(k, np.argwhere(lab == k)) for k in range(1, n + 1) if (lab == k).sum() >= min_area], key=lambda t: (round(t[1][:, 0].mean() / 100), t[1][:, 1].mean()))
    for idx, (k, yx) in enumerate(comps):
        P = yx[:, ::-1].astype(float); c = P.mean(0); u, s, vt = np.linalg.svd(P - c, full_matrices=False)
        ax = vt[0] if s[0] / s[1] > 1.25 else np.array([1.0, 0.0])   # formes presque rondes : l'axe PCA est instable -> axe horizontal
        t = (P - c) @ ax; ends = P[[np.argmin(t), np.argmax(t)]]
        left_eye = c[0] < W / 2   # œil gauche de l'image : l'externe est à gauche
        pi, po = (ends[1], ends[0]) if left_eye == (ends[0][0] < ends[1][0]) else (ends[0], ends[1])
        if left_eye: pi, po = (ends[0], ends[1]) if ends[0][0] > ends[1][0] else (ends[1], ends[0])
        else: pi, po = (ends[0], ends[1]) if ends[0][0] < ends[1][0] else (ends[1], ends[0])
        flip = po[0] < pi[0]
        # colonnes dans le repère de l'axe des canthi
        Pm = mirrored(P, flip, pi); pit, pot = mirrored(pi[None], flip, pi)[0], mirrored(po[None], flip, pi)[0]
        th = math.atan2(pot[1] - pit[1], pot[0] - pit[0]); ca, sa = math.cos(-th), math.sin(-th)
        R = np.c_[(Pm[:, 0] - pit[0]) * ca - (Pm[:, 1] - pit[1]) * sa, (Pm[:, 0] - pit[0]) * sa + (Pm[:, 1] - pit[1]) * ca]; Wc = math.hypot(*(pot - pit)); R /= Wc
        bins = np.linspace(0, 1, 65); U, D = [], []
        for b0, b1 in zip(bins[:-1], bins[1:]):
            m = (R[:, 0] >= b0) & (R[:, 0] < b1)
            if m.sum() > 3: U.append((b0 + b1) / 2); D.append((R[m, 1].min(), R[m, 1].max()))
        U = np.array(U); lo_, hi_ = np.array(D)[:, 0], np.array(D)[:, 1]
        # profils en repère déjà tourné : on reconstruit des polylignes (x, y) normalisées puis on les repasse dans descriptors avec une rotation nulle
        Ut = np.c_[U, lo_] * Wc; Dt = np.c_[U, hi_] * Wc
        Ut[0] = [0, 0]; Dt[0] = [0, 0]; Ut[-1] = [Wc, 0]; Dt[-1] = [Wc, 0]
        d = descriptors(Ut, Dt, np.array([0.0, 0.0]), np.array([Wc, 0.0])); d['tiltDeg'] = round(-math.degrees(th), 2); d['widthPx'] = round(Wc, 1)
        d.update({'file': fn, 'method': 'alpha', 'areaPx': int(len(P)), 'side': 'gauche-image' if left_eye else 'droite-image'})
        res[f'15-{idx:02d}'] = d
        cv2.circle(ov, (int(pi[0]), int(pi[1])), 6, (255, 0, 0), -1); cv2.circle(ov, (int(po[0]), int(po[1])), 6, (0, 255, 0), -1)
    Image.fromarray(ov).save(f'{OUT}/sil-15-alpha.png'); return res
if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True); eyes = {}
    traced = dict(TRACED)
    if os.path.exists(TRACED_JSON): traced.update({k: (v[0], tuple(v[1]), tuple(v[2]), [tuple(p) for p in v[3]], [tuple(p) for p in v[4]]) for k, v in json.load(open(TRACED_JSON)).items()})
    for k, (fn, pi, po, up, lo) in traced.items(): eyes[k] = from_anchors(k, fn, pi, po, up, lo)
    eyes.update(from_alpha('15.png'))
    json.dump({'method': 'silhouettes : alpha (15) / ancres+accrochage gradient (13, 17, 14) ; descripteurs identiques à measures.json', 'eyes': eyes}, open(f'{REF}/measures-silhouettes.json', 'w'), indent=1)
    for k, v in eyes.items(): print(k, v['method'], 'tilt', v['tiltDeg'], 'asp', v['aspect'], 'upF', v['upperFraction'], 'pk', v['upperPeakAt'], v['lowerPeakAt'], 'cant', v['canthusAngleDeg'])
