"""Extraction MESURÉE de references/nez/02.jpg : 8 nez au trait propre (2 rangées x 4 colonnes), vues de face / trois quarts légèrement dessous.
Sorties : references/nez/measures-02.json + artefacts/nez-refs/02-overlay.png. Aucune valeur saisie à la main.
Méthode : encre sombre (< 110, les hachures grises claires sont exclues) ; grille par vallées de projection ; par cellule, le plus gros amas d'encre (dilaté) = le nez ;
profil de largeur à 25 niveaux (même définition que `widthProfile25` et `extract_06.py` : premier et dernier croisement d'encre dans une bande de ±3 px, du haut au bas, normalisé par la plus grande largeur),
rapport L/H de la boîte de l'encre, rapport largeur du haut (racine, niveaux 0-4) / largeur max, et rapport de la largeur du bas (niveaux 20-24) / largeur max.
Limites déclarées : (1) trait, pas aplat : le premier/dernier croisement suit les traits d'arête et d'aile, pas une silhouette fermée ; (2) les nez sont vus en trois quarts
(lacet non nul) pour 5 des 8 : le profil de largeur est un profil PROJETÉ, pas celui d'une vue de face stricte ; (3) 8 nez = échantillon petit (médiane et étendue seulement)."""
import json
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi
SRC = 'references/nez/02.jpg'
img = np.array(Image.open(SRC).convert('L')).astype(np.float32)
H, W = img.shape
ink = img < 110
px = ndi.uniform_filter1d(ink.sum(0).astype(float), 7); py = ndi.uniform_filter1d(ink.sum(1).astype(float), 7)
def valleys(proj, n, lo, hi):
    e = np.linspace(lo, hi, n + 1); cuts = []
    for k in range(1, n):
        half = (hi - lo) / n / 3; a, b = int(e[k] - half), int(e[k] + half); cuts.append(int(a + np.argmin(proj[a:b])))
    return [int(lo)] + cuts + [int(hi)]
xs0, xs1 = np.where(px > 1)[0][[0, -1]]; ys0, ys1 = np.where(py > 1)[0][[0, -1]]
xc = valleys(px, 4, xs0, xs1 + 1); yc = valleys(py, 2, ys0, ys1 + 1)
cells = []; overlay = np.stack([img] * 3, -1).astype(np.uint8)
for r in range(2):
    for c in range(4):
        x0, x1, y0, y1 = xc[c], xc[c + 1], yc[r], yc[r + 1]
        sub = ink[y0:y1, x0:x1]
        lab, n = ndi.label(ndi.binary_dilation(sub, iterations=16), structure=np.ones((3, 3)))
        if n == 0: cells.append({'row': r + 1, 'col': c + 1, 'measured': False}); continue
        sizes = ndi.sum(sub, lab, range(1, n + 1)); main = (lab == 1 + int(np.argmax(sizes))) & sub
        ys, xs = np.where(main); bx0, bx1, by0, by1 = xs.min(), xs.max(), ys.min(), ys.max()
        w, h = int(bx1 - bx0 + 1), int(by1 - by0 + 1)
        prof = []
        for t in np.linspace(0.02, 0.98, 25):
            yy = int(by0 + t * (h - 1)); row = np.where(main[max(0, yy - 3):yy + 4].any(0))[0]   # bande de ±3 px : une ligne mince peut passer entre deux traits
            prof.append(float(row.max() - row.min() + 1) if len(row) else 0.0)
        wmax = max(prof); prof = [round(v / wmax, 4) for v in prof]
        cells.append({'row': r + 1, 'col': c + 1, 'measured': True, 'bbox': [int(x0 + bx0), int(y0 + by0), w, h], 'aspectWH': round(w / h, 4), 'widthProfile25': prof,
                      'topOverMax': round(float(np.mean(prof[0:5])), 4), 'bottomOverMax': round(float(np.mean(prof[20:25])), 4), 'inkFraction': round(float(main.sum() / (w * h)), 4)})
        cv2.rectangle(overlay, (int(x0 + bx0), int(y0 + by0)), (int(x0 + bx1), int(y0 + by1)), (0, 160, 60), 1)
m = [c for c in cells if c['measured']]
def stat(k): v = np.array([c[k] for c in m]); return {'median': round(float(np.median(v)), 4), 'min': round(float(v.min()), 4), 'max': round(float(v.max()), 4)}
prof = np.array([c['widthProfile25'] for c in m])
summary = {'noses': len(m), 'aspectWH': stat('aspectWH'), 'topOverMax': stat('topOverMax'), 'bottomOverMax': stat('bottomOverMax'),
           'profileMedian25': [round(float(v), 4) for v in np.median(prof, 0)], 'profileMin25': [round(float(v), 4) for v in prof.min(0)], 'profileMax25': [round(float(v), 4) for v in prof.max(0)]}
json.dump({'source': SRC, 'method': 'encre sombre < 110, grille 2x4 par vallées, plus gros amas par cellule, profil de largeur à 25 niveaux', 'summary': summary, 'cells': cells}, open('references/nez/measures-02.json', 'w'), indent=1)
import os; os.makedirs('artefacts/nez-refs', exist_ok=True)
Image.fromarray(overlay).resize((W * 2, H * 2), Image.LANCZOS).save('artefacts/nez-refs/02-overlay.png')
print(json.dumps({k: summary[k] for k in ('noses', 'aspectWH', 'topOverMax', 'bottomOverMax')}))
