#!/usr/bin/env python3
"""
RELEVÉ DES RÉFÉRENCES `references/face/01.jpg`, `02.png`, `05.png` (portraits à expression) -> `references/face/face_refs.measures.json`
+ images annotées. Les points bruts ci-dessous sont RELEVÉS À LA MAIN sur des vues quadrillées (précision ≈ ±5 px sur 01, ±15 px sur 02 et 05,
images de 1920 px) ; tous les rapports et angles sont CALCULÉS ici à partir de ces points. Ce n'est pas une mesure automatique : le script le dit.
Usage : python3 scripts/head-turntable/annotate-face-refs.py [dossier_sortie]
"""
import json, math, os, sys
import cv2

OUT = sys.argv[1] if len(sys.argv) > 1 else 'artefacts/head-turntable/references'
os.makedirs(OUT, exist_ok=True)
R = 'references/face/'
RAW = {
    '01.jpg': {  # portrait semi-réaliste, tête inclinée (roulis)
        'iris': [(184, 206), (403, 228)], 'iris_diameter': 56, 'eye_width': [116, 129],
        'brow_img_right': [(312, 178), (472, 156)],      # (bout interne, bout externe) : l'externe est plus haut
        'nose_tip': (262, 344), 'alae': [(219, 335), (306, 335)], 'mouth_corners': [(197, 418), (325, 414)], 'mouth_center': (261, 417),
        'chin': (262, 522), 'ear_img_left': {'top_y': 175, 'bottom_y': 325},
    },
    '05.png': {  # yeux écarquillés (peur / surprise), face
        'iris': [(609, 706), (1319, 710)], 'iris_diameter': 112, 'eye_width': [452, 453], 'eye_height': 264, 'nose_tip': (963, 1055),
    },
    '02.png': {  # colère, plan serré, léger lacet
        'iris': [(547, 528), (1081, 507)], 'eye_width': [284, 342],
        'brow_img_left': [(778, 528), (396, 297)], 'brow_img_right': [(858, 528), (1174, 356)],   # (bout interne, bout externe)
        'nose_tip': (765, 970),
    },
}

def angle_deg(p, q): return math.degrees(math.atan2(q[1] - p[1], q[0] - p[0]))
def dist(p, q): return math.hypot(q[0] - p[0], q[1] - p[1])

res = {'method': 'points relevés à la main sur grille ; rapports et angles calculés', 'images': {}}
for name, d in RAW.items():
    iod = dist(*d['iris']); out = {'interocular_px': round(iod, 1), 'eye_line_roll_deg': round(angle_deg(*d['iris']), 2)}
    ew = sum(d['eye_width']) / 2
    out['interocular_over_eye_width'] = round(iod / ew, 3)
    if 'iris_diameter' in d: out['iris_over_eye_width'] = round(d['iris_diameter'] / ew, 3)
    if 'eye_height' in d: out['eye_aspect_height_over_width'] = round(d['eye_height'] / ew, 3)
    if len(set(d['eye_width'])) > 1: out['eye_width_ratio_near_far'] = round(max(d['eye_width']) / min(d['eye_width']), 3)
    mid = ((d['iris'][0][0] + d['iris'][1][0]) / 2, (d['iris'][0][1] + d['iris'][1][1]) / 2)
    out['nose_tip_below_eyes_over_interocular'] = round((d['nose_tip'][1] - mid[1]) / iod, 3)
    if 'alae' in d: out['nose_width_over_interocular'] = round(dist(*d['alae']) / iod, 3)
    if 'mouth_corners' in d:
        out['mouth_width_over_interocular'] = round(dist(*d['mouth_corners']) / iod, 3)
        out['mouth_below_eyes_over_interocular'] = round((d['mouth_center'][1] - mid[1]) / iod, 3)
        out['chin_below_eyes_over_interocular'] = round((d['chin'][1] - mid[1]) / iod, 3)
        out['face_axis_tilt_deg'] = round(math.degrees(math.atan2(d['nose_tip'][0] - mid[0], d['nose_tip'][1] - mid[1])), 2)
    for k in ('brow_img_left', 'brow_img_right'):
        if k in d:
            inner, outer = d[k]; out[k.replace('img_', '') + '_tilt_deg'] = round(math.degrees(math.atan2(inner[1] - outer[1], abs(outer[0] - inner[0]))), 2)   # > 0 : le bout interne est plus BAS (froncement)
    if 'ear_img_left' in d and 'mouth_corners' in d:
        e = d['ear_img_left']; out['ear_span_over_interocular'] = round((e['bottom_y'] - e['top_y']) / iod, 3)
    res['images'][name] = out
    # image annotée (réduite à 1000 px de large au plus)
    im = cv2.imread(R + name); s = min(1.0, 1000 / im.shape[1]); P = lambda p: (int(p[0] * s), int(p[1] * s))
    im = cv2.resize(im, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    for c in d['iris']: cv2.circle(im, P(c), max(4, int(d.get('iris_diameter', 50) * s / 2)), (0, 255, 255), 2); cv2.circle(im, P(c), 3, (0, 0, 255), -1)
    cv2.line(im, P(d['iris'][0]), P(d['iris'][1]), (0, 255, 0), 2)
    for k in ('brow_img_left', 'brow_img_right'):
        if k in d: cv2.line(im, P(d[k][0]), P(d[k][1]), (255, 0, 255), 3)
    cv2.circle(im, P(d['nose_tip']), 6, (255, 128, 0), -1)
    if 'alae' in d: cv2.line(im, P(d['alae'][0]), P(d['alae'][1]), (255, 128, 0), 2)
    if 'mouth_corners' in d:
        cv2.line(im, P(d['mouth_corners'][0]), P(d['mouth_corners'][1]), (0, 128, 255), 3); cv2.circle(im, P(d['chin']), 6, (0, 200, 0), -1)
    cv2.imwrite(f"{OUT}/annotated_{name.split('.')[0]}.png", im)

json.dump(res, open(R + 'face_refs.measures.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for k, v in res['images'].items(): print(k, v)
