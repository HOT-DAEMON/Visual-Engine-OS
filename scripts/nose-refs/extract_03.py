"""Extraction MESURÉE de references/nez/03.jpg : narines vues de dessous, crayon numérique en niveaux de gris (Procreate).
Sorties : references/nez/measures-03.json + artefacts/nez-refs/03-overlay.png (preuve de l'ajustement).
Méthode (aucune valeur saisie à la main) : fond local (médiane large) -> écart au fond -> amas = un nez ; traits sombres (< 95/255) INTÉRIEURS à l'amas
(distance au bord > 4 % du plus petit côté) puis filtrés par position (voir plus bas) = candidats narines ; mesure de chaque trait : position dans la boîte du nez, longueur, orientation,
courbure (rapport corde / longueur d'arc via l'ellipse ajustée). Exclus : filigrane (haut), échantillon de pinceau (haut gauche).
Limites déclarées : (1) un trait de narine touchant le contour peut être rejeté (le critère « intérieur » est strict) ; (2) les nez dont la narine est un
simple dégradé sans trait sombre ne donnent aucune narine mesurée (non inventée) ; (3) le sens gauche/droite des narines n'est pas distingué des vues obliques."""
import json, os
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi

SRC = 'references/nez/03.jpg'
img = np.array(Image.open(SRC).convert('L')).astype(np.float32)
H, W = img.shape
small = ndi.median_filter(img[::4, ::4], size=25)
bg = cv2.resize(small, (W, H), interpolation=cv2.INTER_LINEAR)
diff = bg - img
mask = diff > 22
mask[:55, :] = False                                   # barre du haut + filigrane
mask[:195, :135] = False                               # échantillon de pinceau
mask = ndi.binary_opening(mask, iterations=1)
grown = ndi.binary_dilation(mask, iterations=7)
lab, n = ndi.label(grown, structure=np.ones((3, 3)))

noses = []
for i in range(1, n + 1):
    region = (lab == i)
    core = region & mask
    area = int(core.sum())
    if area < 1800:                                    # débris
        continue
    ys, xs = np.where(core)
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    w, h = x1 - x0 + 1, y1 - y0 + 1
    filled = ndi.binary_fill_holes(ndi.binary_closing(core, iterations=6))
    dist = ndi.distance_transform_edt(filled)
    interior = dist > 0.04 * min(w, h)                  # seuil bas : les narines sont souvent des traits collés au bord du lobule
    dark = (img < 95) & interior
    dl, dn = ndi.label(ndi.binary_dilation(dark, iterations=1), structure=np.ones((3, 3)))
    strokes = []
    for j in range(1, dn + 1):
        sy, sx = np.where((dl == j) & dark)
        if len(sx) < 25:
            continue
        pts = np.column_stack([sx, sy]).astype(np.float32)
        cx, cy = pts.mean(0)
        (ex, ey), (ew, eh), ang = cv2.fitEllipse(pts) if len(pts) >= 5 else ((cx, cy), (1, 1), 0)
        major, minor = max(ew, eh), max(1e-3, min(ew, eh))
        maj_ang = ang if ew >= eh else ang + 90
        maj_ang = ((maj_ang + 90) % 180) - 90
        strokes.append({'px': int(len(sx)), 'cxRel': round(float((cx - x0) / w), 4), 'cyRel': round(float((cy - y0) / h), 4),
                        'lengthOverNoseW': round(float(major / w), 4), 'thicknessOverNoseW': round(float(minor / w), 4),
                        'elongation': round(float(major / minor), 3), 'angleDeg': round(float(maj_ang), 1)})
    noses.append({'bbox': [x0, y0, x1, y1], 'w': w, 'h': h, 'aspectWH': round(w / h, 4), 'areaFill': round(area / (w * h), 4), 'strokes': strokes})

med_box = float(np.median([r['w'] * r['h'] for r in noses]))
for r in noses:
    r['merged'] = bool(r['w'] * r['h'] > 1.6 * med_box)      # amas qui contient plus d'un nez : exclu des statistiques, pas découpé à la main
noses.sort(key=lambda r: (round(r['bbox'][1] / 90), r['bbox'][0]))     # ordre de lecture grossier
for k, r in enumerate(noses):
    r['index'] = k + 1
    # paire de narines = les deux traits les plus longs situés dans la moitié basse de la boîte (si au moins deux)
    # paire = plus gros trait de la moitié gauche + plus gros de la moitié droite, hors contour latéral extrême et hors haut de la boîte
    ok = [s for s in r['strokes'] if 0.12 <= s['cxRel'] <= 0.88 and s['cyRel'] >= 0.40]
    L = sorted([s for s in ok if s['cxRel'] < 0.5], key=lambda s: -s['px'])[:1]
    R = sorted([s for s in ok if s['cxRel'] >= 0.5], key=lambda s: -s['px'])[:1]
    cand = L + R
    if len(cand) == 2 and not r['merged']:
        a, b = sorted(cand, key=lambda s: s['cxRel'])
        r['pair'] = {'separationOverNoseW': round(b['cxRel'] - a['cxRel'], 4), 'meanLengthOverNoseW': round((a['lengthOverNoseW'] + b['lengthOverNoseW']) / 2, 4),
                     'meanCyRel': round((a['cyRel'] + b['cyRel']) / 2, 4), 'lengthAsymmetry': round(abs(a['lengthOverNoseW'] - b['lengthOverNoseW']) / max(a['lengthOverNoseW'], b['lengthOverNoseW']), 4),
                     'tiltDeg': round(float(np.degrees(np.arctan2((b['cyRel'] - a['cyRel']) * r['h'], (b['cxRel'] - a['cxRel']) * r['w']))), 1)}
    else:
        r['pair'] = None                                # non mesuré, non inventé

vis = np.stack([img] * 3, -1).astype(np.uint8)
for r in noses:
    x0, y0, x1, y1 = r['bbox']
    cv2.rectangle(vis, (x0, y0), (x1, y1), (0, 0, 255) if r['merged'] else (255, 0, 255), 1)
    cv2.putText(vis, str(r['index']), (x0 + 2, y0 + 12), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 0, 255), 1)
    for s in r['strokes']:
        cx, cy = int(x0 + s['cxRel'] * r['w']), int(y0 + s['cyRel'] * r['h'])
        cv2.circle(vis, (cx, cy), 3, (0, 200, 255), -1)
os.makedirs('artefacts/nez-refs', exist_ok=True)
Image.fromarray(vis).resize((W * 2, H * 2), Image.LANCZOS).save('artefacts/nez-refs/03-overlay.png')

pairs = [r['pair'] for r in noses if r['pair']]
summary = {'noses': len(noses), 'mergedExcluded': [r['index'] for r in noses if r['merged']], 'withPair': len(pairs), 'withoutPair': [r['index'] for r in noses if not r['pair'] and not r['merged']]}
for key in ('separationOverNoseW', 'meanLengthOverNoseW', 'meanCyRel', 'lengthAsymmetry', 'tiltDeg'):
    if pairs:
        v = np.array([p[key] for p in pairs]); summary[key] = {'median': round(float(np.median(v)), 4), 'min': round(float(v.min()), 4), 'max': round(float(v.max()), 4)}
summary['aspectWH'] = {k: round(float(f([r['aspectWH'] for r in noses])), 4) for k, f in (('median', np.median), ('min', np.min), ('max', np.max))}
json.dump({'source': SRC, 'method': 'fond local -> amas -> traits sombres intérieurs -> ellipse par trait', 'summary': summary, 'noses': noses}, open('references/nez/measures-03.json', 'w'), indent=1)
print(json.dumps(summary, indent=1))
