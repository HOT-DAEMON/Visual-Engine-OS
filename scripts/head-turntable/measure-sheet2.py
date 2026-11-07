"""Mesure la planche `references/face/rotation_head_1.jpg` (2e personnage : visage rond, menton petit, mâchoire douce) : proportions de FACE (vue 1) et de PROFIL (vue 2).
Segmentation par couleur (peau très pâle : R ≥ 240, R − B ∈ [6, 45] ; cheveux gris) puis composantes connexes. Écrit references/face/rotation_head_1.measures.json et une image annotée.
Usage : python3 measure-sheet2.py [dossier de sortie des images]"""
import json, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

SRC = 'references/face/rotation_head_1.jpg'
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
a = np.asarray(Image.open(SRC).convert('RGB')).astype(int)
R, G, B = a[..., 0], a[..., 1], a[..., 2]
skin = (R >= 240) & (B <= 248) & (R - B >= 6) & (R - B <= 45) & (G >= 225)
hair = (abs(R - G) < 14) & (abs(G - B) < 22) & (R < 205) & (R > 90)
ink = (R < 150) & (abs(R - B) < 60)     # traits sombres et yeux
H, W = R.shape
# Régions d'intérêt (x0, y0, x1, y1) relevées sur le masque : le visage seul (la peau du cou et de la chemise touche le visage par le col), et la tête entière pour le sommet de la chevelure.
cells = {'face': (200, 230, 700, 770), 'profil': (870, 250, 1260, 770)}
heads = {'face': (110, 60, 770, 780), 'profil': (850, 60, 1520, 780)}

def comp(mask, point):
    lab, _ = ndi.label(ndi.binary_opening(mask, iterations=2))
    return lab == lab[point[1], point[0]]

def rows_extent(m, y0, y1):
    return {y: (np.where(m[y])[0].min(), np.where(m[y])[0].max()) for y in range(y0, y1) if m[y].any()}

res = {'source': SRC, 'unite': 'fractions de la hauteur de tête H (sommet de la chevelure → bas du menton), sauf mention', 'vues': {}}
dbg = Image.fromarray(a.astype(np.uint8)); d = ImageDraw.Draw(dbg)

# ---- FACE (vue 1) : le visage = composante de peau contenant le point entre les yeux/nez
x0, y0, x1, y1 = cells['face']
sub_skin = np.zeros_like(skin); sub_skin[y0:y1, x0:x1] = skin[y0:y1, x0:x1]
X0, Y0, X1, Y1 = heads['face']
hy, hx = np.where(((hair | ink)[Y0:Y1, X0:X1]))
top = Y0 + hy.min()                                    # sommet de la chevelure
lab_s, ns = ndi.label(ndi.binary_opening(sub_skin, iterations=2)); areas = ndi.sum(sub_skin, lab_s, range(1, ns + 1))
face = lab_s == (1 + int(np.argmax(areas)))          # le plus grand amas de peau de la région = le visage
fy, fx = np.where(face)
chin = fy.max(); Hh = chin - top
ext = rows_extent(face, fy.min(), chin)
width = lambda y: (ext[y][1] - ext[y][0]) / Hh
head_w = (hx.max() - hx.min()) / Hh
# yeux : amas sombres dans la moitié haute du visage
eyes = ink[fy.min():fy.min() + int((chin - fy.min()) * 0.62), x0:x1] & ndi.binary_fill_holes(face)[fy.min():fy.min() + int((chin - fy.min()) * 0.62), x0:x1]
lab, n = ndi.label(ndi.binary_dilation(eyes, iterations=3)); sizes = ndi.sum(eyes, lab, range(1, n + 1))
big = np.argsort(sizes)[::-1][:2]
ec = [ndi.center_of_mass(lab == (i + 1)) for i in big]
eye_y = fy.min() + np.mean([c[0] for c in ec]); eye_dx = abs(ec[0][1] - ec[1][1]) / Hh if len(ec) == 2 else None
res['vues']['face'] = {
    'hauteur_tete_px': int(Hh), 'largeur_chevelure_sur_H': round(head_w, 3), 'sommet_visage_sur_H': round((fy.min() - top) / Hh, 3),
    'ligne_yeux_sur_H': round((eye_y - top) / Hh, 3), 'ecart_yeux_sur_H': None if eye_dx is None else round(eye_dx, 3),
    'largeur_visage_aux_yeux_sur_H': round(width(int(min(max(eye_y, fy.min()), chin - 1))), 3),
    'largeur_visage_a_70pct_menton_sur_H': round(width(int(fy.min() + 0.70 * (chin - fy.min()))), 3),
    'largeur_visage_a_88pct_menton_sur_H': round(width(int(fy.min() + 0.88 * (chin - fy.min()))), 3),
    'largeur_visage_a_96pct_menton_sur_H': round(width(int(fy.min() + 0.96 * (chin - fy.min()))), 3),
}
res['vues']['face']['rapport_largeur_menton_96_sur_yeux'] = round(res['vues']['face']['largeur_visage_a_96pct_menton_sur_H'] / res['vues']['face']['largeur_visage_aux_yeux_sur_H'], 3)
d.rectangle((x0, y0, x1, y1), outline=(255, 0, 0)); d.line((x0, chin, x1, chin), fill=(0, 160, 0), width=3); d.line((x0, int(eye_y), x1, int(eye_y)), fill=(0, 0, 255), width=3); d.line((x0, top, x1, top), fill=(255, 0, 255), width=3)

# ---- PROFIL (vue 2) : bord gauche du visage (peau) ligne par ligne, arrière de la tête (cheveux)
x0, y0, x1, y1 = cells['profil']
sub = np.zeros_like(skin); sub[y0:y1, x0:x1] = skin[y0:y1, x0:x1]
X0, Y0, X1, Y1 = heads['profil']
hy, hx = np.where(((hair | ink)[Y0:Y1, X0:X1]))
ptop = Y0 + hy.min()
lab_s, ns = ndi.label(ndi.binary_opening(sub, iterations=2)); areas = ndi.sum(sub, lab_s, range(1, ns + 1))
face2 = lab_s == (1 + int(np.argmax(areas)))
py_, px_ = np.where(face2)
pchin = py_.max(); PH = pchin - ptop
front = {y: np.where(face2[y])[0].min() for y in range(py_.min(), pchin + 1) if face2[y].any()}
xf0 = min(front.values()); depth_hair = (hx.max() - hx.min()) / PH
nose_y = min(front, key=lambda y: front[y] if y > py_.min() + 0.25 * (pchin - py_.min()) else 1e9)   # point le plus avancé sous le front : bout du nez
chin_x = front[pchin] if pchin in front else front[max(front)]
xs_front_forehead = front[int(py_.min() + 0.10 * (pchin - py_.min()))]
sag = lambda y: (xs_front_forehead - front[y]) / PH         # saillie par rapport au front (+ = en avant)
res['vues']['profil'] = {
    'hauteur_tete_px': int(PH), 'profondeur_chevelure_sur_H': round(depth_hair, 3),
    'bout_du_nez_sur_H': round((nose_y - ptop) / PH, 3), 'saillie_nez_sur_front_H': round(sag(nose_y), 3),
    'menton_saillie_sur_front_H': round(sag(pchin - 3), 3),
    'sommet_visage_sur_H': round((py_.min() - ptop) / PH, 3),
}
d.rectangle((x0, y0, x1, y1), outline=(255, 0, 0)); d.line((x0, pchin, x1, pchin), fill=(0, 160, 0), width=3); d.line((x0, nose_y, x1, nose_y), fill=(0, 0, 255), width=3); d.line((x0, ptop, x1, ptop), fill=(255, 0, 255), width=3)
dbg.crop((0, 0, 1520, 1100)).save(f'{OUT}/rotation_head_1_mesures.png')
json.dump(res, open('references/face/rotation_head_1.measures.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps(res, indent=1, ensure_ascii=False))
