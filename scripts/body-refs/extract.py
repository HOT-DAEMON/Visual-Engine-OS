"""Extraction des mesures des images de référence anatomiques (fond sombre ignoré).
Sortie : references/anatomy/measures.json (silhouette par ligne, repères normalisés par la hauteur de tête)."""
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

REFS = {
  'ref-02': dict(file='references/anatomy/ref-02-homme-muscles-colores.jpg', crop=None),
  'ref-04-face': dict(file='references/anatomy/ref-04-homme-ecorche-profil-face.jpg', crop=(0.45, 1.0)),
}
def mask_of(a, bgthr):
    # fond = pixels sombres peu saturés ; on garde la plus grande composante
    mx = a.max(2).astype(float); mn = a.min(2).astype(float)
    sat = (mx - mn) / np.maximum(mx, 1)
    m = (mx > bgthr) | (sat > 0.25)
    m = ndi.binary_opening(m, iterations=1)
    m = ndi.binary_closing(m, iterations=2)
    lab, n = ndi.label(m)
    if n == 0: return m
    sizes = ndi.sum(m, lab, range(1, n + 1))
    return lab == (1 + int(np.argmax(sizes)))
out = {}
for k, r in REFS.items():
    im = np.array(Image.open(r['file']).convert('RGB'))
    H0, W0 = im.shape[:2]
    x0 = 0; x1 = W0
    if r['crop']: x0, x1 = int(r['crop'][0] * W0), int(r['crop'][1] * W0)
    sub = im[:, x0:x1]
    m = mask_of(sub, 70 if k == 'ref-02' else 75)
    # coupe les barres horizontales du cadre (haut/bas)
    rows = np.where(m.sum(1) > 0)[0]
    top, bot = int(rows.min()), int(rows.max())
    h = bot - top + 1
    widths = []; xs = []
    for y in range(top, bot + 1):
        xx = np.where(m[y])[0]
        widths.append(int(xx.max() - xx.min() + 1) if len(xx) else 0)
        xs.append([int(xx.min()), int(xx.max())] if len(xx) else [0, 0])
    out[k] = dict(file=r['file'], crop_x0=x0, size=[int(sub.shape[1]), int(sub.shape[0])], top=top, bottom=bot, height=h,
                  rowSpan=xs[::4], area=int(m.sum()))
    Image.fromarray((m * 255).astype(np.uint8)).save(f'/tmp/mask_{k}.png')
json.dump(out, open('/tmp/measures_raw.json', 'w'))
for k, v in out.items(): print(k, v['size'], 'top', v['top'], 'bottom', v['bottom'], 'h', v['height'], 'area', v['area'])
# NB : `measures.json` (repères) a été écrit à partir de ce profil de lignes + lecture de la couleur des groupes musculaires (articulations).
