#!/usr/bin/env python3
"""
MONTAGES DES ARTEFACTS de la tête en rotation (après `artefacts-turntable.ts`) : planche des 9 lacets, tour complet, rendu / planche côte à côte,
extraction (masques de segmentation, vues quadrillées), détails agrandis. Tout est dérivé des PNG déjà produits : aucun rendu ici.
Usage : python3 scripts/head-turntable/compose-artefacts.py
"""
import json, os, subprocess, sys
import cv2
import numpy as np

A = os.environ.get('OUT', 'artefacts/head-turntable')
for d in ('comparison', 'extraction', 'references'): os.makedirs(f'{A}/{d}', exist_ok=True)
meas = json.load(open('references/face/rotation_head.measures.json'))
ref = cv2.imread('references/face/rotation_head.jpg')
YAWS = [0, 20, 45, 70, 90, 110, 135, 160, 180]
pad = lambda n: str(n % 360).zfill(3)
def label(im, text, org=(10, 28), col=(40, 40, 40)):
    cv2.putText(im, text, org, cv2.FONT_HERSHEY_SIMPLEX, 0.85, (255, 255, 255), 4); cv2.putText(im, text, org, cv2.FONT_HERSHEY_SIMPLEX, 0.85, col, 2); return im
def grid_sheet(tiles, cols):
    h, w = tiles[0].shape[:2]; rows = (len(tiles) + cols - 1) // cols
    tiles = tiles + [np.full_like(tiles[0], 255)] * (rows * cols - len(tiles))
    return np.vstack([np.hstack(tiles[r * cols:(r + 1) * cols]) for r in range(rows)])

# 1. planche des 9 lacets (rendus) et tour complet
tiles = [label(cv2.imread(f'{A}/turntable/yaw_{pad(y)}.png'), f'{y} deg') for y in YAWS]
cv2.imwrite(f'{A}/turntable/turntable_sheet.png', grid_sheet(tiles, 5))
full = [label(cv2.imread(f'{A}/turntable/full_{pad(y)}.png'), f'{y} deg') for y in range(0, 360, 45)]
cv2.imwrite(f'{A}/turntable/turntable_360.png', grid_sheet(full, 4))

# 2. superposition des contours sur la planche (mêmes définitions que les mesures) + côte à côte planche | rendu
subprocess.run([sys.executable, 'scripts/head-turntable/overlay-reference.py', f'{A}/turntable', f'{A}/comparison', str(520 / 1.75)], check=True)
H = meas['H_px']; ppu = 520 / 1.75; s = ppu / H; pairs = []
for y in YAWS:
    r = cv2.imread(f'{A}/turntable/yaw_{pad(y)}.png'); h, w = r.shape[:2]; v = meas['views'][str(y)]
    nonbg = (np.abs(r.astype(int) - 255).sum(axis=2) > 24); top_r = int(np.nonzero(nonbg)[0].min())
    M = np.float32([[s, 0, 0.75 * ppu - v['axis_px'] * s], [0, s, top_r - v['top_px'] * s]])
    c = cv2.warpAffine(ref, M, (w, h), flags=cv2.INTER_CUBIC, borderValue=(255, 255, 255))
    y0, y1, x0, x1 = v['box_px']; m = np.zeros(ref.shape[:2], np.uint8); m[y0:y1, x0:x1] = 255
    c[cv2.warpAffine(m, M, (w, h), flags=cv2.INTER_NEAREST) == 0] = 255
    pairs.append(label(np.hstack([c, r]), f'{y} deg : planche | moteur'))
cv2.imwrite(f'{A}/comparison/side_by_side_sheet.png', cv2.resize(grid_sheet(pairs, 3), None, fx=0.6, fy=0.6, interpolation=cv2.INTER_AREA))

# 3. extraction : masques de segmentation et vues quadrillées de la planche
hsv = cv2.cvtColor(ref, cv2.COLOR_BGR2HSV); Hh, Ss, Vv = (hsv[..., i].astype(int) for i in range(3))
masks = {'cheveux': ((Hh >= 20) & (Hh <= 34) & (Ss > 70) & (Vv > 180), (0, 220, 255)), 'iris': ((Hh >= 100) & (Hh <= 125) & (Ss > 70), (255, 100, 0)),
         'bouche': (((Hh <= 8) | (Hh >= 170)) & (Ss > 90) & (Vv > 120), (0, 0, 255)), 'encre': (Vv < 110, (60, 60, 60))}
vis = np.full_like(ref, 255); vis[:85] = 255
for name, (mk, col) in masks.items(): mk = mk.copy(); mk[:85] = False; vis[mk] = col
cv2.imwrite(f'{A}/extraction/segmentation_masks.png', cv2.resize(vis, None, fx=2, fy=2, interpolation=cv2.INTER_NEAREST))
S = 5
for yaw in (0, 90):
    v = meas['views'][str(yaw)]; y0, y1, x0, x1 = v['box_px']; c = cv2.resize(ref[y0:y1, x0:x1], None, fx=S, fy=S, interpolation=cv2.INTER_CUBIC)
    for gx in range(0, x1 - x0, 10): cv2.line(c, (gx * S, 0), (gx * S, c.shape[0]), (200, 200, 200) if gx % 20 else (120, 120, 255), 1)
    for gy in range(0, y1 - y0, 10): cv2.line(c, (0, gy * S), (c.shape[1], gy * S), (200, 200, 200) if gy % 20 else (120, 120, 255), 1)
    ax = (v['axis_px'] - x0) * S; top = (v['top_px'] - y0) * S
    cv2.line(c, (int(ax), 0), (int(ax), c.shape[0]), (0, 160, 0), 2); cv2.line(c, (0, int(top)), (c.shape[1], int(top)), (0, 160, 0), 2)
    cv2.line(c, (0, int(top + H * S)), (c.shape[1], int(top + H * S)), (0, 160, 0), 2)
    cv2.imwrite(f'{A}/extraction/grid_{yaw}_axis_top_chin.png', c)

# 4. détails agrandis (rendus 1800 px) : yeux, nez + bouche de face, 3/4, profil
ppu_b = 1800 / 1.75; ox, oy = 0.75 * ppu_b, 0.2 * ppu_b
def crop(path, cx, cy, hw, hh):
    im = cv2.imread(path); x0, y0 = int(cx - hw), int(cy - hh); return im[max(0, y0):y0 + int(2 * hh), max(0, x0):x0 + int(2 * hw)]
f0, f30, f90 = (f'{A}/details/big_{n}.png' for n in ('000', '030', '090'))
eyes = crop(f0, ox, oy + 0.48 * ppu_b, 0.36 * ppu_b, 0.17 * ppu_b)
nosemouth = crop(f0, ox, oy + 0.62 * ppu_b, 0.26 * ppu_b, 0.2 * ppu_b)
tq = crop(f30, ox - 0.1 * ppu_b, oy + 0.55 * ppu_b, 0.42 * ppu_b, 0.42 * ppu_b)
prof = crop(f90, ox - 0.15 * ppu_b, oy + 0.55 * ppu_b, 0.42 * ppu_b, 0.42 * ppu_b)
for n, im in (('eyes_front', eyes), ('nose_mouth_front', nosemouth), ('three_quarter_30', tq), ('profile_90', prof)): cv2.imwrite(f'{A}/details/detail_{n}.png', im)
hh = 420; row = [cv2.resize(im, (int(im.shape[1] * hh / im.shape[0]), hh), interpolation=cv2.INTER_AREA) for im in (eyes, nosemouth, tq, prof)]
cv2.imwrite(f'{A}/details/detail_sheet.png', np.hstack(row))
print('montages ecrits dans', A)
