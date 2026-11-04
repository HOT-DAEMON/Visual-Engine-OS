#!/usr/bin/env python3
"""
RECOUVREMENT DES CHEVEUX rendu / planche : pour chaque lacet, IoU entre la région « cheveux » du rendu (couleurs de la palette cheveux) et le masque
de cheveux de la planche (jaune, HSV), recalés comme dans overlay-reference.py. Sortie : verification/hair_iou.csv. Mesure RAPPORTÉE (non bloquante).
Usage : python3 scripts/head-turntable/hair-iou.py artefacts/head-turntable
"""
import json, sys
import cv2
import numpy as np

A = sys.argv[1] if len(sys.argv) > 1 else 'artefacts/head-turntable'
ref = cv2.imread('references/face/rotation_head.jpg'); meas = json.load(open('references/face/rotation_head.measures.json'))
H = meas['H_px']; ppu = 520 / 1.75; s = ppu / H
hsv = cv2.cvtColor(ref, cv2.COLOR_BGR2HSV); Hh, Ss, Vv = (hsv[..., i].astype(int) for i in range(3))
refhair = ((Hh >= 20) & (Hh <= 34) & (Ss > 70) & (Vv > 180)).astype(np.uint8) * 255
hair_cols = [np.array(c[::-1], float) for c in ((0xf3, 0xe2, 0x90), (0xe0, 0xcf, 0x7c))]   # BGR
rows = ['yaw_deg,iou_cheveux']
for yaw in [0, 20, 45, 70, 90, 110, 135, 160, 180]:
    r = cv2.imread(f'{A}/turntable/yaw_{yaw:03d}.png'); h, w = r.shape[:2]; v = meas['views'][str(yaw)]
    nonbg = (np.abs(r.astype(int) - 255).sum(axis=2) > 24); top_r = int(np.nonzero(nonbg)[0].min())
    M = np.float32([[s, 0, 0.75 * ppu - v['axis_px'] * s], [0, s, top_r - v['top_px'] * s]])
    y0, y1, x0, x1 = v['box_px']; box = np.zeros(ref.shape[:2], np.uint8); box[y0:y1, x0:x1] = 255
    rm = cv2.warpAffine(cv2.bitwise_and(refhair, box), M, (w, h), flags=cv2.INTER_NEAREST) > 0
    mm = np.zeros((h, w), bool)
    for c in hair_cols: mm |= (np.linalg.norm(r.astype(float) - c, axis=2) < 22)
    mm = cv2.morphologyEx(mm.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8)) > 0
    iou = (rm & mm).sum() / max(1, (rm | mm).sum())
    rows.append(f'{yaw},{iou:.3f}'); print(yaw, f'{iou:.3f}')
open(f'{A}/verification/hair_iou.csv', 'w').write('\n'.join(rows) + '\n')
