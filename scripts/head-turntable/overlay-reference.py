#!/usr/bin/env python3
"""
SUPERPOSITION rendu / planche de référence : pour chaque lacet, le rendu du moteur (PNG) est contouré en rouge sur la vue correspondante
de `references/face/rotation_head.jpg`, recalée avec les MÊMES définitions que les mesures (axe du cou = pivot, sommet des cheveux = t = 0,
H = 150 px = 1 U). Entrées : un dossier de rendus `yaw_<lacet sur 3 chiffres>.png` ; sortie : `ov_<lacet>.png` + une planche de contact.
Usage : python3 scripts/head-turntable/overlay-reference.py <dossier_rendus> <dossier_sortie> <ppu>
"""
import json, sys
import cv2
import numpy as np

src, out, ppu = sys.argv[1], sys.argv[2], float(sys.argv[3])
ref = cv2.imread('references/face/rotation_head.jpg')
meas = json.load(open('references/face/rotation_head.measures.json'))
H = meas['H_px']
YAWS = [0, 20, 45, 70, 90, 110, 135, 160, 180]
tiles = []
for yaw in YAWS:
    r = cv2.imread(f'{src}/yaw_{yaw:03d}.png')
    h, w = r.shape[:2]
    v = meas['views'][str(yaw)]
    nonbg = (np.abs(r.astype(int) - 255).sum(axis=2) > 24)
    ys, xs = np.nonzero(nonbg)
    top_r = int(ys.min())
    ox = 0.75 * ppu                                    # pivot du cadre par défaut (defaultFrame)
    s = ppu / H                                        # échelle planche -> rendu
    canvas = np.full((h, w, 3), 255, np.uint8)
    # place la planche : (axis_px, top_px) -> (ox, top_r)
    M = np.float32([[s, 0, ox - v['axis_px'] * s], [0, s, top_r - v['top_px'] * s]])
    canvas = cv2.warpAffine(ref, M, (w, h), flags=cv2.INTER_CUBIC, borderValue=(255, 255, 255))
    # coupe les vues voisines : ne garde que la boite de la vue
    y0, y1, x0, x1 = v['box_px']
    mask = np.zeros((ref.shape[0], ref.shape[1]), np.uint8); mask[y0:y1, x0:x1] = 255
    mw = cv2.warpAffine(mask, M, (w, h), flags=cv2.INTER_NEAREST)
    canvas[mw == 0] = 255
    edge = cv2.morphologyEx(nonbg.astype(np.uint8) * 255, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8))
    canvas[edge > 0] = (0, 0, 230)
    cv2.putText(canvas, f'{yaw}', (8, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2)
    cv2.imwrite(f'{out}/ov_{yaw}.png', canvas)
    tiles.append(canvas)
blank = np.full_like(tiles[0], 255)
cv2.imwrite(f'{out}/overlay_sheet.png', np.vstack([np.hstack(tiles[:5]), np.hstack(tiles[5:] + [blank])]))
print('ok', out)
