#!/usr/bin/env python3
"""Artefacts de la forme crânienne : montages avant / après, silhouettes superposées, diversité (XOR / union).
Usage : compose-cranial.py <galerie AVANT> <galerie APRÈS> <dossier de sortie> [graines, défaut 1..6]
Les galeries viennent de `artefacts-gallery.ts <dossier> <graines> <hauteurPx>` lancé dans l'arbre d'origine (avant) puis dans l'arbre modifié (après)."""
import sys, json, itertools
import numpy as np
from PIL import Image, ImageDraw
avant, apres, out = sys.argv[1:4]
seeds = [int(s) for s in (sys.argv[4] if len(sys.argv) > 4 else '1,2,3,4,5,6').split(',')]
YAWS = [0, 45, 90, 135, 180]
load = lambda d, s, y: Image.open(f'{d}/seed{s}/yaw_{y}.png').convert('RGBA')
def mask(im):
    a = np.array(im); h = int(a.shape[0] * 0.66)
    return (a[:h, :, 3] > 128) & ~((a[:h, :, :3] > 245).all(axis=2))
def div(ms): return float(np.mean([(a ^ b).sum() / max(1, (a | b).sum()) for a, b in itertools.combinations(ms, 2)]))
import os; os.makedirs(out, exist_ok=True)
# 1. montage avant / après : une graine par ligne, lacets 0 / 45 / 90 / 135 / 180, AVANT puis APRÈS
w, h = load(avant, seeds[0], 0).size; sc = 0.42; w2, h2 = int(w * sc), int(h * sc)
M = Image.new('RGB', (w2 * len(YAWS), h2 * len(seeds) * 2 + 24 * len(seeds)), 'white'); d = ImageDraw.Draw(M)
for i, s in enumerate(seeds):
    y0 = i * (2 * h2 + 24); d.text((4, y0 + 2), f'graine {s} - avant (haut) / apres (bas)', fill=(0, 0, 0))
    for j, yaw in enumerate(YAWS):
        for k, g in enumerate((avant, apres)):
            im = load(g, s, yaw).resize((w2, h2)); M.paste(im, (j * w2, y0 + 14 + k * h2), im)
M.save(f'{out}/01-avant-apres-5-lacets.png')
# 2. silhouettes superposées (profil 90° et 135°) : contour des 6 graines, avant à gauche, après à droite
cols = [(200, 30, 30), (30, 120, 200), (30, 160, 60), (230, 150, 0), (140, 40, 170), (0, 150, 150)]
S = Image.new('RGB', (w * 2 * 2, h), 'white')
for c, yaw in enumerate((90, 135)):
    for k, g in enumerate((avant, apres)):
        im = Image.new('RGB', (w, h), 'white')
        for n, s in enumerate(seeds):
            m = mask(load(g, s, yaw)); edge = m & ~(np.roll(m, 1, 0) & np.roll(m, -1, 0) & np.roll(m, 1, 1) & np.roll(m, -1, 1))
            a = np.array(im); a[:edge.shape[0]][edge] = cols[n % len(cols)]; im = Image.fromarray(a)
        S.paste(im, ((c * 2 + k) * w, 0))
dd = ImageDraw.Draw(S)
for c, yaw in enumerate((90, 135)):
    for k, t in enumerate(('avant', 'apres')): dd.text(((c * 2 + k) * w + 6, 6), f'{yaw} deg - {t}', fill=(0, 0, 0))
S.save(f'{out}/02-silhouettes-superposees-90-135.png')
# 3. diversité
res = {str(y): {'avant': round(div([mask(load(avant, s, y)) for s in seeds]), 4), 'apres': round(div([mask(load(apres, s, y)) for s in seeds]), 4)} for y in YAWS}
for v in res.values(): v['gain_relatif'] = round(v['apres'] / v['avant'] - 1, 3)
json.dump({'graines': seeds, 'diversite_silhouettes_xor_union': res}, open(f'{out}/diversite.json', 'w'), indent=1)
print(json.dumps(res))
