#!/usr/bin/env python3
"""
EXPORT DES MASQUES DE CHEVEUX DE LA PLANCHE, recalés sur le cadre de rendu (même transformation que overlay-reference.py) : un fichier binaire
`<dossier>/hair_<lacet>.bin` (largeur × hauteur octets, 1 = cheveux) par lacet, lu par `fit-hairline.ts`. Le dossier est un scratch (non versionné).
Usage : python3 scripts/head-turntable/export-hair-masks.py <dossier_sortie> [hauteur_cadre_px=520]
"""
import json, os, sys
import cv2
import numpy as np

out = sys.argv[1]; hp = int(sys.argv[2]) if len(sys.argv) > 2 else 520
os.makedirs(out, exist_ok=True)
ref = cv2.imread('references/face/rotation_head.jpg'); meas = json.load(open('references/face/rotation_head.measures.json'))
ppu = hp / 1.75; s = ppu / meas['H_px']; W = round(1.5 * ppu)
hsv = cv2.cvtColor(ref, cv2.COLOR_BGR2HSV); Hh, Ss, Vv = (hsv[..., i].astype(int) for i in range(3))
hair = ((Hh >= 20) & (Hh <= 34) & (Ss > 70) & (Vv > 180)).astype(np.uint8) * 255
for yaw in [0, 20, 45, 70, 90, 110, 135, 160, 180]:
    v = meas['views'][str(yaw)]; y0, y1, x0, x1 = v['box_px']
    box = np.zeros(ref.shape[:2], np.uint8); box[y0:y1, x0:x1] = 255
    # Le sommet du rendu (première ligne couverte) vaut oy = 0,2 ppu pour un cadre par défaut ; la planche place son sommet de cheveux au même endroit (t = 0).
    top_r = round(0.2 * ppu)
    M = np.float32([[s, 0, 0.75 * ppu - v['axis_px'] * s], [0, s, top_r - v['top_px'] * s]])
    m = cv2.warpAffine(cv2.bitwise_and(hair, box), M, (W, hp), flags=cv2.INTER_NEAREST) > 0
    m.astype(np.uint8).tofile(f'{out}/hair_{yaw}.bin')
print('ok', out, W, hp)
