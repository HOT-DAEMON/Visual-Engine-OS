"""Seconde planche de rotation (references/face/rotation_head_1.jpg) : le profil (cellule 2, haut, 2e colonne) est la SEULE vue où le contour du nez est mesurable
(sur les trois-quarts les cheveux couvrent la joue lointaine : contrôle visuel, docs/NOSE-YAW-BOUNDS.md §4). H = 602 px (sommet de la chevelure -> menton, references/face/rotation_head_1.measures.json).
Mesure : contour gauche = premier pixel non blanc de chaque rangée ; pointe = minimum de x sous la ligne des yeux ; saillie = écart à la corde tendue entre les contours a ± delta·H de la pointe, en H.
delta in {0,06, 0,09, 0,12} -> bande. Ecrit references/nez/measures-plate2-profile.json. Usage : python3 scripts/nose-refs/plate2-profile.py"""
import json
import numpy as np
from PIL import Image
A = np.asarray(Image.open('references/face/rotation_head_1.jpg').convert('RGB')).astype(float)
X0, X1, Y0, Y1, H = 854, 1482, 88, 1085, 602.0
cell = A[Y0:Y1, X0:X1]
nw = np.linalg.norm(cell - 255, axis=2) > 40
top = int(np.where(nw.any(axis=1))[0][0])
L = {r: float(np.where(nw[r])[0][0]) for r in range(nw.shape[0]) if nw[r].any()}
# ligne des yeux : centre du plus grand amas bleuté (iris)
blue = (cell[:, :, 2] > cell[:, :, 0] + 8) & (cell[:, :, 2] > cell[:, :, 1] + 3) & (cell.sum(axis=2) < 600)
from scipy import ndimage
lab, n = ndimage.label(blue); sizes = ndimage.sum(blue, lab, range(1, n + 1)); k = int(np.argmax(sizes)) + 1
eye_row = int(ndimage.center_of_mass(blue, lab, k)[0])
win = [r for r in L if eye_row + 0.03 * H < r < eye_row + 0.30 * H]
tip = min(win, key=lambda r: L[r]); res = []
for d in (0.06, 0.09, 0.12):
    a, b = int(tip - d * H), int(tip + d * H)
    if a in L and b in L:
        chord = L[a] + (L[b] - L[a]) * (tip - a) / (b - a); res.append(dict(delta=d, saillie_H=round((chord - L[tip]) / H, 4)))
out = dict(source='references/face/rotation_head_1.jpg', cellule='profil', H_px=H, haut_px=top, ligne_yeux_sur_H=round((eye_row - top) / H, 3), pointe_sur_H=round((tip - top) / H, 3), saillie=res)
print(out); json.dump(out, open('references/nez/measures-plate2-profile.json', 'w'), indent=1)
