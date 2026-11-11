"""Extraction MESURÉE de references/nez/06.png : les 5 silhouettes de base en aplat rose (colonne de gauche).
Sortie : references/nez/measures-06.json (profils de largeur normalisés). Aucune valeur n'est saisie à la main."""
import json
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

a = np.array(Image.open('references/nez/06.png').convert('RGB')).astype(int)
R, G, B = a[..., 0], a[..., 1], a[..., 2]
pink = (R > 200) & (B > 190) & (R - G > 25) & (B - G > 15)          # aplat rose
outline = (R > 100) & (R < 220) & (G < 90) & (B > 100)               # contour magenta
mask = pink | outline
mask[:, 400:] = False                                                # colonne 1 seulement
mask = ndi.binary_closing(mask, iterations=3)
mask = ndi.binary_fill_holes(mask)
lab, n = ndi.label(mask)
objs = []
for i in range(1, n + 1):
    ys, xs = np.where(lab == i)
    if len(ys) < 4000:
        continue
    objs.append((ys.min(), i))
objs.sort()
out = []
for k, (_, i) in enumerate(objs):
    m = lab == i
    ys, xs = np.where(m)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    h, w = y1 - y0 + 1, x1 - x0 + 1
    cx = (x0 + x1) / 2
    prof = []
    for t in np.linspace(0.02, 0.98, 25):                            # 25 niveaux, du haut (0) au bas (1)
        row = m[int(y0 + t * (h - 1))]
        xr = np.where(row)[0]
        prof.append(round(float((xr.max() - xr.min() + 1) / w), 4) if len(xr) else 0.0)
    out.append({'index': k, 'bboxPx': [int(x0), int(y0), int(w), int(h)], 'aspectWoverH': round(float(w / h), 4),
                'areaFill': round(float(m.sum() / (w * h)), 4), 'widthProfile25': prof,
                'bottomBias': round(float((ys.mean() - y0) / h), 4)})
json.dump({'source': 'references/nez/06.png', 'method': 'segmentation aplat rose, colonne 1, 25 niveaux normalisés', 'shapes': out},
          open('references/nez/measures-06.json', 'w'), indent=1)
for s in out:
    print(s['index'], s['bboxPx'], 'W/H', s['aspectWoverH'], 'fill', s['areaFill'])
