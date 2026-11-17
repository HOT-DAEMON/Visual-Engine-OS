"""Saillie du nez au contour lointain à 45° sur la planche de rotation (references/face/rotation_head.jpg).
Mesure sur les PIXELS du contour gauche (visage tourné vers la gauche de l'image), 1 U = 150 px (H de la vue 0).
La saillie = écart entre le contour réel et la corde (interpolation linéaire) tendue entre deux ancres encadrant le nez (t_a sous l'œil, t_b lèvre sup.).
Sortie : bande (min–max) sur 3 seuils de fond × 3 ancres hautes × 3 ancres basses, + vue 20° et 70° pour la tendance.
Usage : python3 scripts/nose-refs/yaw45-ref.py  -> references/nez/measures-45deg-protrusion.json"""
import json
import numpy as np
from PIL import Image

H, TOP = 150.0, 96
A = np.asarray(Image.open('references/face/rotation_head.jpg').convert('RGB')).astype(float)
VIEWS = {'20': (172, 307), '45': (309, 447), '70': (446, 590)}

def contour(x0, x1, th, y0=88, y1=292):
    m = np.linalg.norm(A[y0:y1, x0:x1] - 255, axis=2) > th
    out = {}
    for r in range(m.shape[0]):
        xs = np.where(m[r])[0]
        if len(xs):
            out[y0 + r] = x0 + float(xs[0])
    return out

def bump(L, ta, tb):
    ya, yb = TOP + ta * H, TOP + tb * H
    xa = np.interp(ya, sorted(L), [L[k] for k in sorted(L)])
    xb = np.interp(yb, sorted(L), [L[k] for k in sorted(L)])
    best, tbest = 0.0, None
    for y in range(int(round(ya)) + 1, int(round(yb))):
        if y not in L: continue
        base = xa + (xb - xa) * (y - ya) / (yb - ya)
        d = base - L[y]       # > 0 : le contour sort plus à gauche que la corde
        if d > best: best, tbest = d, (y - TOP) / H
    return best / H, tbest

res = {}
for v, (x0, x1) in VIEWS.items():
    vals = []
    for th in (30, 45, 70):
        L = contour(x0, x1, th)
        for ta in (0.50, 0.54, 0.58):
            for tb in (0.70, 0.72, 0.74):
                b, t = bump(L, ta, tb)
                vals.append(dict(th=th, ta=ta, tb=tb, bump_U=round(b, 4), t_at=None if t is None else round(t, 3)))
    bs = [x['bump_U'] for x in vals]
    res[v] = dict(min=min(bs), median=float(np.median(bs)), max=max(bs), n=len(bs), detail=vals)
    print(v, 'saillie du nez (U) min/médiane/max =', res[v]['min'], round(res[v]['median'], 4), res[v]['max'])
json.dump(dict(source='references/face/rotation_head.jpg', unit='U = 150 px = H de la vue 0', method='corde entre ancres ta/tb, 3 seuils de fond', views=res), open('references/nez/measures-45deg-protrusion.json', 'w'), indent=1)
