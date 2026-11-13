"""Mesure AUTOMATIQUE des planches de formes d'yeux sur fond uni (references/eyes/12.jpg et 16.webp : iris noirs pleins avec reflets blancs) — pas d'ancre manuelle.
Méthode : seuil de luminance (encre < 90), ouverture morphologique (retire cils et traits fins), composantes connexes = iris ; pour chacun : rapport d'aspect h/l,
inclinaison de l'ellipse équivalente (moments), reflets = composantes claires (> 200) entièrement dans l'iris : rayon / demi-axe moyen et position (dx, dy) normalisée
par les demi-axes. Sortie : references/eyes/measures-sheets.json (quartiles). 13 et 17 (yeux au trait), 14 (flèches) et 15 (sprites) ne sont pas mesurés ici (voir docs/EYES-REFS.md)."""
import json
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi

REF = 'references/eyes'
def q(v): v = np.asarray(v, float); return {'n': int(len(v)), 'p10': round(float(np.percentile(v, 10)), 3), 'median': round(float(np.median(v)), 3), 'p90': round(float(np.percentile(v, 90)), 3)}

def sheet(fn, kmin_area, thr=90, open_it=3):
    im = np.array(Image.open(f'{REF}/{fn}').convert('L')).astype(np.uint8)
    ink = im < thr
    core = ndi.binary_opening(ink, structure=np.ones((3, 3)), iterations=open_it)
    lab, n = ndi.label(core)
    asp, tilt, hl1, hl2, hdx, hdy, hdx2, hdy2 = [], [], [], [], [], [], [], []
    for k in range(1, n + 1):
        m = lab == k; area = int(m.sum())
        if area < kmin_area: continue
        ys, xs = np.where(m)
        if xs.min() == 0 or ys.min() == 0 or xs.max() == im.shape[1] - 1 or ys.max() == im.shape[0] - 1: continue  # coupés par le bord
        filled = ndi.binary_fill_holes(m)
        cnt = cv2.findContours(filled.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0][0]
        (cx, cy), (w, h), ang = cv2.fitEllipse(cnt)
        a, b = max(w, h) / 2, min(w, h) / 2
        if b < 6 or area / (np.pi * a * b) < 0.8: continue  # pas une ellipse pleine (union de formes)
        # aspect hauteur / largeur dans l'image (axes alignés sur l'écran) : bbox de l'ellipse équivalente
        bw, bh = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
        asp.append(bh / bw); tilt.append(((ang + 90) % 180) - 90 if w < h else ang - 90)
        holes = filled & ~m & (im > 200)
        hl, nh = ndi.label(holes); blobs = []
        for j in range(1, nh + 1):
            hy, hx = np.where(hl == j)
            if len(hy) >= 12: blobs.append((len(hy), hx.mean(), hy.mean()))
        blobs.sort(reverse=True); rm = (bw + bh) / 4
        if blobs:
            s, x, y = blobs[0]; hl1.append(np.sqrt(s / np.pi) / rm); hdx.append((x - (xs.min() + bw / 2)) / (bw / 2)); hdy.append((y - (ys.min() + bh / 2)) / (bh / 2))
        if len(blobs) > 1:
            s, x, y = blobs[1]; hl2.append(np.sqrt(s / np.pi) / rm); hdx2.append((x - (xs.min() + bw / 2)) / (bw / 2)); hdy2.append((y - (ys.min() + bh / 2)) / (bh / 2))
    return {'file': fn, 'irisAspectHeightOverWidth': q(asp), 'primaryHighlightRadiusOverIris': q(hl1), 'primaryHighlightDx': q(hdx), 'primaryHighlightDy': q(hdy),
            'secondaryHighlightRadiusOverIris': q(hl2) if hl2 else None, 'secondaryHighlightDx': q(hdx2) if hdx2 else None, 'secondaryHighlightDy': q(hdy2) if hdy2 else None}

out = {'method': 'automatique (seuil + ouverture + composantes connexes), sans ancre manuelle', 'sheets': {'12': sheet('12.jpg', 500), '16': sheet('16.webp', 2500)}}
json.dump(out, open(f'{REF}/measures-sheets.json', 'w'), indent=1)
for k, v in out['sheets'].items(): print(k, json.dumps({a: (b['median'], b['n']) if isinstance(b, dict) else b for a, b in v.items() if a != 'file'}))
