"""Superpose les silhouettes de face du moteur (v1 gris, v2 couleur) sur les 5 formes RÉELLES de references/nez/06.png (colonne de gauche).
Entrée : artefacts/nez-aspect-plafond/silhouettes.json (produit par scripts/artefacts-nose-aspect.ts). Sortie : artefacts/nez-aspect-plafond/06-superposition.png.
Chaque silhouette est mise à l'échelle dans la boîte de la forme (même normalisation que l'ajustement : profil de largeur normalisé + rapport L/H, pas d'alignement libre).
Les ~28 % du bas ne sont PAS comparés par l'ajustement (le contour de la référence est fermé par le lobule, le moteur par une base plate) : une ligne pointillée les sépare."""
import json
import numpy as np, cv2
from PIL import Image
S = json.load(open('artefacts/nez-aspect-plafond/silhouettes.json'))
img = np.array(Image.open('references/nez/06.png').convert('RGB'))
panels = []
for s in S:
    x0, y0, w, h = s['bbox']; pad = 20
    crop = img[max(0, y0 - pad):y0 + h + pad, max(0, x0 - pad):x0 + w + pad].copy()
    ox, oy = x0 - max(0, x0 - pad), y0 - max(0, y0 - pad)
    # le moteur est dessiné dans la boîte de la forme (largeur et hauteur imposées par la référence) : le rapport L/H propre du moteur se lit dans la légende
    for key, col, th in (('v1', (120, 120, 120), 2), ('v2', (0, 150, 60), 3)):
        pts = np.array([[ox + p[0] * w, oy + p[1] * h] for p in s[key]['pts']], np.int32)
        cv2.polylines(crop, [pts], True, col, th, cv2.LINE_AA)
    yc = int(oy + 0.72 * h)
    for xx in range(ox, ox + w, 12): cv2.line(crop, (xx, yc), (min(xx + 6, ox + w), yc), (0, 0, 0), 1)
    ph = 320; sc = ph / crop.shape[0]; crop = cv2.resize(crop, (int(crop.shape[1] * sc), ph), interpolation=cv2.INTER_AREA)
    cv2.putText(crop, s['name'], (4, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, cv2.LINE_AA)
    cv2.putText(crop, f"v1 {s['v1Residual']:.2f}  v2 {s['v2Residual']:.2f}", (4, 34), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 90, 0), 1, cv2.LINE_AA)
    cv2.putText(crop, f"L/H ref {w / h:.2f} v1 {s['v1']['aspect']:.2f} v2 {s['v2']['aspect']:.2f}", (4, 312), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 0), 1, cv2.LINE_AA)
    panels.append(crop)
W = sum(p.shape[1] for p in panels) + 8 * (len(panels) - 1)
sheet = np.full((320, W, 3), 255, np.uint8); x = 0
for p in panels: sheet[:, x:x + p.shape[1]] = p; x += p.shape[1] + 8
Image.fromarray(sheet).save('artefacts/nez-aspect-plafond/06-superposition.png')
print('06-superposition.png', sheet.shape)
