#!/usr/bin/env python3
"""
MESURE DE LA PLANCHE DE ROTATION `references/face/rotation_head.jpg` (9 vues : 0, 20, 45, 70, 90, 110, 135, 160, 180 degres).

Sortie : `references/face/rotation_head.measures.json` -- tout est mesure sur l'image par masques de couleur (aucun repere
tape a la main dans ce script). Unite = H, la hauteur de la tete de la vue 0 (sommet des cheveux -> bas du menton).
Origine x = axe du cou de CHAQUE vue (milieu de la silhouette du cou sous le menton) : c'est l'axe de rotation de la camera.
Les ordonnees sont relatives au sommet des cheveux de chaque vue (la camera tourne autour de l'axe vertical : y est invariant).

Usage : python3 scripts/head-turntable/measure-rotation.py [chemin_image] [chemin_json]
"""
import json, sys
import cv2
import numpy as np
from scipy import ndimage as ndi

SRC = sys.argv[1] if len(sys.argv) > 1 else 'references/face/rotation_head.jpg'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'references/face/rotation_head.measures.json'
YAWS = [0, 20, 45, 70, 90, 110, 135, 160, 180]
TITLE_BAND = 85          # le bandeau jaune du titre est au-dessus de cette ligne
MIN_AREA = 1500          # surface minimale d'une vue (px)
N_ROWS = 41              # nombre d'ordonnees du profil de silhouette (pas de 0,025 H)

im = cv2.imread(SRC)
if im is None:
    raise SystemExit(f'image introuvable : {SRC}')
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
Hh, Ss, Vv = (hsv[..., i].astype(int) for i in range(3))
rgb_sum = im.astype(int).sum(axis=2)

# --- masques de couleur (seuils lus sur la planche : cheveux jaunes, iris bleu, bouche rouge)
nonwhite = rgb_sum < 3 * 235
nonwhite[:TITLE_BAND, :] = False
hair = (Hh >= 20) & (Hh <= 34) & (Ss > 70) & (Vv > 180)
hair[:TITLE_BAND, :] = False
iris = (Hh >= 100) & (Hh <= 125) & (Ss > 70)
mouth = ((Hh <= 8) | (Hh >= 170)) & (Ss > 90) & (Vv > 120)

# --- localisation des 9 vues : composantes connexes de la silhouette, triees rangee par rangee
lab, _ = ndi.label(ndi.binary_closing(nonwhite, iterations=2))
boxes = []
for i, s in enumerate(ndi.find_objects(lab)):
    if (lab[s] == i + 1).sum() > MIN_AREA:
        boxes.append((s[0].start, s[0].stop, s[1].start, s[1].stop, i + 1))
boxes.sort(key=lambda b: (b[0] // 200, b[2]))
if len(boxes) != len(YAWS):
    raise SystemExit(f'{len(boxes)} vues trouvees au lieu de {len(YAWS)}')


def rows_extent(mask, y0, y1, xa, xb):
    """(gauche, droite) du masque, DANS les colonnes xa..xb de la vue, pour chaque ligne y0..y1 ; None si la ligne est vide."""
    out = []
    for y in range(y0, y1):
        xs = np.flatnonzero(mask[y, xa:xb + 1])
        out.append((int(xs[0]) + xa, int(xs[-1]) + xa) if xs.size else None)
    return out


def blobs(mask, box, min_area=12):
    """Composantes connexes du masque dans la boite : centre, surface, boite englobante (px)."""
    y0, y1, x0, x1 = box
    sub = np.zeros_like(mask)
    sub[y0:y1, x0:x1] = mask[y0:y1, x0:x1]
    lb, n = ndi.label(sub)
    res = []
    for i in range(1, n + 1):
        ys, xs = np.nonzero(lb == i)
        if ys.size >= min_area:
            res.append({'cx': float(xs.mean()), 'cy': float(ys.mean()), 'area': int(ys.size),
                        'x0': int(xs.min()), 'x1': int(xs.max()), 'y0': int(ys.min()), 'y1': int(ys.max())})
    return sorted(res, key=lambda b: b['cx'])


own = {}                       # silhouette propre de chaque vue : composante connexe SEULE (les marges se recouvrent)
views = {}
for yaw, box in zip(YAWS, boxes):
    own[yaw] = (lab == box[4]) & nonwhite
    y0, y1, x0, x1 = box[:4]
    pad = 6
    bx = (max(0, y0 - pad), y1 + pad, max(0, x0 - pad), x1 + pad)
    hy, hx = np.nonzero(hair[bx[0]:bx[1], bx[2]:bx[3]])
    views[yaw] = {'box': bx, 'top': int(hy.min()) + bx[0]}      # sommet des cheveux = origine des ordonnees

# --- H : hauteur de tete = sommet des cheveux -> bas du menton, lue sur le PROFIL (vue 90), ou le menton est une pointe isolee.
# Le menton est la derniere ligne dont le bord avant (gauche) reste dans le tiers avant de la tete ; plus bas, le contour est celui du cou.
# (Piege evite : sur la vue 0 le « menton » de la silhouette est la ligne du menton, 17 px AU-DESSUS du bas reel de la machoire,
#  que seule l'ombre sous le menton dessine ; mesure sur le profil, H = 151 px et non 133.)
y0p, y1p, x0p, x1p = views[90]['box']
ext90 = rows_extent(own[90], views[90]['top'], y1p, x0p, x1p)
lefts = np.array([e[0] if e else 10 ** 6 for e in ext90])
rights = np.array([e[1] if e else -1 for e in ext90])
span = rights[: int(0.9 * 150)].max() - lefts.min()
chin_k = int(np.flatnonzero(lefts < lefts.min() + 0.33 * span)[-1])
H_REF = chin_k
result = {'source': SRC, 'unit': 'H = hauteur de tete de la vue 0 (px)', 'H_px': H_REF, 'views': {}}

for yaw in YAWS:
    v = views[yaw]
    top = v['top']
    y0, y1, x0, x1 = v['box']
    chin_row = top + H_REF
    # axe du cou : milieu de la silhouette du cou juste sous le menton (1,03 à 1,11 H sous le sommet ; plus bas, le cou de la planche penche)
    neck_rows = [top + int(round(k * H_REF)) for k in (1.03, 1.07, 1.11)]
    mids = []
    for r in neck_rows:
        xs = np.flatnonzero(own[yaw][r, x0:x1 + 1])
        if xs.size:
            mids.append((xs[0] + xs[-1]) / 2 + x0)
    axis = float(np.mean(mids))
    to_h = lambda px: round(float(px) / H_REF, 4)
    # profil de silhouette de la tete (sommet -> menton) : bords gauche / droit relatifs a l'axe
    ext = rows_extent(own[yaw], top, chin_row + 1, x0, x1)
    prof = []
    for k in range(N_ROWS):
        t = k / (N_ROWS - 1)
        e = ext[min(len(ext) - 1, int(round(t * H_REF)))]
        prof.append({'t': round(t, 3), 'left': to_h(e[0] - axis) if e else None, 'right': to_h(e[1] - axis) if e else None})
    valid = [(p['left'], p['right']) for p in prof if p['left'] is not None]
    widths_h = [r - l for l, r in valid]
    # largeur maximale de la tete (crane) : sur la moitie haute, sans les oreilles (oreilles : entre 0,45 H et 0,85 H)
    upper = [p for p in prof if p['left'] is not None and p['t'] <= 0.40]
    cranium_w = max(p['right'] - p['left'] for p in upper)
    # bornes du masque de cheveux
    hys, hxs = np.nonzero(hair[y0:y1, x0:x1])
    hair_box = {'left': to_h(hxs.min() + x0 - axis), 'right': to_h(hxs.max() + x0 - axis), 'bottom_t': to_h(hys.max() + y0 - top)}
    eyes = [{'x': to_h(b['cx'] - axis), 't': to_h(b['cy'] - top), 'w': to_h(b['x1'] - b['x0'] + 1), 'h': to_h(b['y1'] - b['y0'] + 1), 'area_h2': round(b['area'] / H_REF ** 2, 5)}
            for b in blobs(iris, (y0, y1, x0, x1))]
    mouths = [{'x': to_h(b['cx'] - axis), 't': to_h(b['cy'] - top), 'w': to_h(b['x1'] - b['x0'] + 1), 'h': to_h(b['y1'] - b['y0'] + 1)}
              for b in blobs(mouth, (top, chin_row, x0, x1), 40)]
    # bout du nez / avancee du visage : point le plus avance du cote visage entre 0,55 H et 0,80 H (utile des 45 degres)
    face_sign = -1 if 0 < yaw < 180 else 0
    nose = None
    if face_sign:
        best = None
        for k in range(int(0.55 * H_REF), int(0.80 * H_REF)):
            e = ext[k]
            if e and (best is None or e[0] < best[0]):
                best = (e[0], k)
        nose = {'x': to_h(best[0] - axis), 't': to_h(best[1])}
    result['views'][str(yaw)] = {
        'axis_px': round(axis, 1), 'top_px': top, 'box_px': list(v['box']), 'cranium_width': round(cranium_w, 4),
        'silhouette': prof, 'hair': hair_box, 'irises': eyes, 'mouth': mouths, 'front_extreme': nose,
        'visible_irises': len(eyes),
    }

# --- AJUSTEMENT RIGIDE : la planche est-elle une tete rigide qui tourne autour de l'axe du cou ?
# Modele : x_img = x cos(a) - z sin(a) ; z1 = x sin(a) + z cos(a) ; t_img = y cos(b) - z1 sin(b)  (a = lacet, b = tangage de CAMERA).
# Inconnues : demi-ecart des yeux xe, profondeur ze, hauteur vraie ye des yeux, tangage b, puis profondeur/hauteur de la bouche.
from scipy.optimize import least_squares
rad = np.radians
V = result['views']
obs = []
for yaw in (0, 20, 45, 70, 90, 110):
    irs = sorted(V[str(yaw)]['irises'], key=lambda e: e['x'])
    if yaw in (0, 20, 45):
        obs += [(yaw, -1, irs[0]['x'], irs[0]['t']), (yaw, +1, irs[1]['x'], irs[1]['t'])]
    else:
        obs.append((yaw, +1, irs[-1]['x'], irs[-1]['t']))      # seul l'oeil proche est visible

def res_eye(p):
    xe, ze, ye, b = p
    r = []
    for yaw, sg, x, t in obs:
        f = rad(yaw); X = sg * xe
        z1 = X * np.sin(f) + ze * np.cos(f)
        r += [X * np.cos(f) - ze * np.sin(f) - x, ye * np.cos(rad(b)) - z1 * np.sin(rad(b)) - t]
    return r

fe = least_squares(res_eye, [0.167, 0.39, 0.5, 10])
xe, ze, ye, pitch = (float(v) for v in fe.x)
mouth_obs = [(y, V[str(y)]['mouth'][0]['x'], V[str(y)]['mouth'][0]['t']) for y in (0, 20, 45, 70) if V[str(y)]['mouth']]

def res_mouth(p):
    zm, ym = p
    r = []
    for yaw, x, t in mouth_obs:
        f = rad(yaw)
        r += [-zm * np.sin(f) - x, ym * np.cos(rad(pitch)) - zm * np.cos(f) * np.sin(rad(pitch)) - t]
    return r

fm = least_squares(res_mouth, [0.38, 0.8])
result['rigid_fit'] = {
    'pitch_deg': round(pitch, 2),
    'eye': {'x': round(xe, 4), 'z': round(ze, 4), 'y': round(ye, 4), 'rms_H': round(float(np.sqrt(np.mean(np.square(fe.fun)))), 4)},
    'mouth': {'z': round(float(fm.x[0]), 4), 'y': round(float(fm.x[1]), 4), 'rms_H': round(float(np.sqrt(np.mean(np.square(fm.fun)))), 4)},
    'n_observations': len(obs) * 2 + len(mouth_obs) * 2,
    'note': 'tangage de camera commun aux 9 vues ; y = hauteur vraie (tete a plat) en H ; rms en H (1 H = 150 px)',
}
print('ajustement rigide :', result['rigid_fit'])

with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=1)
print(f'H = {H_REF}px ; {len(YAWS)} vues ; ecrit {OUT}')
for yaw in YAWS:
    r = result['views'][str(yaw)]
    print(f"{yaw:>3}deg  largeur crane {r['cranium_width']:.3f} H | iris {[(e['x'], e['t'], e['w']) for e in r['irises']]} | bouche {[(m['x'], m['t'], m['w']) for m in r['mouth']]} | nez {r['front_extreme']}")
