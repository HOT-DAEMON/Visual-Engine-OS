"""Mesure des traits de narines de references/nez/04.jpg -> references/nez/measures-04-nostrils.json.

Méthode (aucune lecture à l'œil) : pixels sombres (gris < 70) -> ouverture morphologique 5x5 (retire les contours fins, garde les traits épais) -> composantes
-> rectangle orienté minimal (longueur L, épaisseur T) et axe principal (ACP). Chaque trait est rattaché à l'ellipse cyan la plus proche de measures-04.json ; son
angle est lu DANS LE REPÈRE de cette ellipse (roulis compensé). Sont gardés les traits dont l'axe est à moins de 45 degrés de l'axe majeur de l'ellipse
(les autres sont des morceaux de contour). LIMITES : l'épaisseur T est l'épaisseur du TRAIT dessiné, pas l'ouverture réelle, donc l'allongement est un majorant ;
l'échantillon est petit ; un morceau de contour épais peut passer le filtre.
"""
import json, math, statistics as st
import cv2, numpy as np

im = cv2.imread('references/nez/04.jpg'); g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
dark = (g < 70).astype(np.uint8)
op = cv2.morphologyEx(dark, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
n, lab, stats, _ = cv2.connectedComponentsWithStats(op)
noses = json.load(open('references/nez/measures-04.json'))['noses']
out = []
for i in range(1, n):
    if stats[i, 4] < 50: continue
    ys, xs = np.where(lab == i); pts = np.column_stack([xs, ys]).astype(np.float64)
    c = pts.mean(0); u, s, vt = np.linalg.svd(pts - c, full_matrices=False)
    ax = vt[0]; ang = math.degrees(math.atan2(ax[1], ax[0]))
    (_, _), (w, h), _ = cv2.minAreaRect(pts.astype(np.float32)); L, T = max(w, h), max(1.0, min(w, h))
    e = min(noses, key=lambda q: (q['ellipse']['cx'] - c[0]) ** 2 + (q['ellipse']['cy'] - c[1]) ** 2); el = e['ellipse']
    roll = el['majorAngleDeg']; rel = (ang - roll + 90) % 180 - 90          # angle dans le repère de l'ellipse, dans [-90, 90)
    if abs(rel) > 45: continue
    side = 1 if c[0] >= el['cx'] else -1
    # hauteur de l'extrémité EXTERNE par rapport à l'extrémité interne (positive = l'extrémité externe est plus haute à l'écran)
    rise = (-rel) if side == 1 else rel
    out.append({'nose': e['index'], 'side': side, 'cx': round(float(c[0]), 1), 'cy': round(float(c[1]), 1), 'lengthPx': round(L, 1), 'thicknessPx': round(T, 1),
                'elongation': round(L / T, 2), 'angleInEllipseFrameDeg': round(rel, 1), 'outerEndRiseDeg': round(rise, 1),
                'lengthOverEllipseMajor': round(L / el['major'], 3), 'distCentreOverMajor': round(math.hypot(c[0] - el['cx'], c[1] - el['cy']) / el['major'], 3)})
med = lambda k: round(st.median([o[k] for o in out]), 3)
summary = {'strokes': len(out), 'elongation': {'median': med('elongation'), 'min': min(o['elongation'] for o in out), 'max': max(o['elongation'] for o in out)},
           'outerEndRiseDeg': {'median': med('outerEndRiseDeg')}, 'lengthOverEllipseMajor': {'median': med('lengthOverEllipseMajor')}}
json.dump({'source': 'references/nez/04.jpg', 'method': 'sombres -> ouverture 5x5 -> composantes -> axe ACP dans le repère de l\'ellipse ; majorant (T = épaisseur du trait)', 'summary': summary, 'strokes': out},
          open('references/nez/measures-04-nostrils.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps(summary, ensure_ascii=False)); [print(o) for o in out]
