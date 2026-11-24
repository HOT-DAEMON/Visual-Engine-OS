"""Extraction des proportions de l'oreille HUMAINE colorée de references/orreil/01.jpg (rangée du bas, à gauche).
Segmentation par couleur : rose = hélix+lobule, bleu = anthélix, vert = tragus, gris clair = creux (conque/scapha/fosse).
Sortie : references/orreil/measures-01.json. Aucune valeur n'est inventée : tout vient des pixels."""
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage
im = np.asarray(Image.open('references/orreil/01.jpg').convert('RGB')).astype(int)
H, W, _ = im.shape
x0, x1, y0, y1 = 0, 118, 212, 394          # cadre de l'oreille humaine colorée (rangée du bas, gauche)
c = im[y0:y1, x0:x1]
r, g, b = c[..., 0], c[..., 1], c[..., 2]
pink = (r > 200) & (g < 170) & (b > 120) & (b < 215) & (r - g > 70)
blue = (b > 180) & (r < 120) & (g > 90) & (g < 200)
green = (g > 150) & (r < 170) & (b < 120)
dark = (r < 70) & (g < 70) & (b < 70)
gray = (abs(r - g) < 14) & (abs(g - b) < 14) & (r > 150) & (r < 235)
white = (r > 240) & (g > 240) & (b > 240)
def biggest(m, keep=1):
    lab, n = ndimage.label(m, structure=np.ones((3, 3)))
    if n == 0: return m
    sizes = ndimage.sum(m, lab, range(1, n + 1)); order = np.argsort(sizes)[::-1][:keep] + 1
    return np.isin(lab, order)
# nettoyage : on garde les grandes composantes (les points isolés sont du crénelage de JPEG, pas de la structure)
pink = biggest(pink, 2); blue = biggest(blue, 2); green = biggest(green, 1)
gray = ndimage.binary_opening(gray, iterations=1); gray = biggest(gray, 4)
dark = biggest(dark, 3)
ys, xs = np.nonzero(pink | blue | green | gray | dark)
# boîte de l'oreille = pixels non blancs (hors étiquettes) dans le cadre
ink = pink | blue | green | dark
yy, xx = np.nonzero(ink)
bx0, bx1, by0, by1 = xx.min(), xx.max(), yy.min(), yy.max()
h = by1 - by0 + 1; w = bx1 - bx0 + 1
def share(m): return float(m.sum()) / float((pink | blue | green | gray).sum())
def span_y(m):
    yy2, _ = np.nonzero(m); return [float((yy2.min() - by0) / h), float((yy2.max() - by0) / h)]
def cent(m):
    yy2, xx2 = np.nonzero(m); return [float((xx2.mean() - bx0) / w), float((yy2.mean() - by0) / h)]
# lobule = partie ROSE sous le bas du bleu (anthélix) : tout ce qui est rose et plus bas que le bas de l'anthélix
blue_bottom = np.nonzero(blue)[0].max()
lob = pink.copy(); lob[: blue_bottom + 1, :] = False
out = {
  'source': 'references/orreil/01.jpg (oreille humaine colorée, rangée du bas à gauche)',
  'boite_px': [int(bx0 + x0), int(by0 + y0), int(w), int(h)],
  'ratio_largeur_hauteur': float(w / h),
  'part_aire_pavillon': {'helix_rose': share(pink), 'antihelix_bleu': share(blue), 'tragus_vert': share(green), 'creux_gris': share(gray)},
  'ordonnee_relative_haut_bas': {'antihelix': span_y(blue), 'tragus': span_y(green), 'creux': span_y(gray)},
  'bas_antihelix_relatif': float((blue_bottom - by0) / h),
  'lobule_hauteur_relative': float(1 - (blue_bottom - by0) / h),
  'centroides_xy_relatifs': {'antihelix': cent(blue), 'creux': cent(gray), 'tragus': cent(green)},
}
json.dump(out, open('references/orreil/measures-01.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps(out, indent=1, ensure_ascii=False))
# image de contrôle des masques
dbg = np.full(c.shape, 255, np.uint8)
dbg[pink] = (255, 105, 180); dbg[blue] = (30, 144, 255); dbg[green] = (60, 200, 60); dbg[gray] = (170, 170, 170); dbg[dark] = (0, 0, 0)
Image.fromarray(dbg).resize((w * 3 if False else (x1 - x0) * 3, (y1 - y0) * 3), Image.NEAREST).save('/tmp/ref01-masks.png')
