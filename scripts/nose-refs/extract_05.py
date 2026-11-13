"""Extraction MESURÉE de references/nez/05.jpg : 24 nez au crayon graphite (grille 6 rangées x 4 colonnes), niveaux de gris.
Sorties : references/nez/measures-05.json + artefacts/nez-refs/05-overlay.png (preuve visuelle).
Méthode (aucune valeur saisie à la main) : la grille est dérivée des VALLÉES de la projection d'encre (4 colonnes, 6 rangées) ; dans chaque cellule le nez
est le plus gros amas d'encre (dilaté) ; mesures : boîte et rapport L/H, narines (taches sombres compactes de la moitié basse : une à gauche, une à droite,
position et taille relatives à la largeur du nez), densité de MOUCHETURES (petites taches sombres isolées hors de l'amas principal = proxy mesuré des « pores »
dessinés).
Limites déclarées : (1) le crayon est GRIS : les rougeurs de peau NE SONT PAS mesurables ici (aucune information de teinte), seule la moucheture l'est ;
(2) la boîte inclut les hachures de l'arête, donc L/H est celui du dessin, pas celui du lobule seul ; (3) les narines de profil strict (vue de côté) ne
donnent pas de paire : non mesuré, non inventé."""
import json, os
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi

SRC = 'references/nez/05.jpg'
img = np.array(Image.open(SRC).convert('L')).astype(np.float32)
H, W = img.shape
ink = img < 190
proj_x = ndi.uniform_filter1d(ink.sum(0).astype(float), 9)
proj_y = ndi.uniform_filter1d(ink.sum(1).astype(float), 9)


def valleys(proj, n_cells, lo, hi):
    """n_cells - 1 vallées de la projection, une par fenêtre égale entre lo et hi (vallée = minimum local de la projection lissée)."""
    edges = np.linspace(lo, hi, n_cells + 1)
    cuts = []
    for k in range(1, n_cells):
        c = edges[k]; half = (hi - lo) / n_cells / 3
        a, b = int(c - half), int(c + half)
        cuts.append(int(a + np.argmin(proj[a:b])))
    return [int(lo)] + cuts + [int(hi)]


xs0, xs1 = int(np.where(proj_x > 3)[0].min()), int(np.where(proj_x > 3)[0].max())
ys0, ys1 = int(np.where(proj_y > 3)[0].min()), int(np.where(proj_y > 3)[0].max())
xc = valleys(proj_x, 4, xs0, xs1 + 1)
yc = valleys(proj_y, 6, ys0, ys1 + 1)

cells = []
for r in range(6):
    for c in range(4):
        x0, x1, y0, y1 = xc[c], xc[c + 1], yc[r], yc[r + 1]
        sub_ink = ink[y0:y1, x0:x1]
        lab, n = ndi.label(ndi.binary_dilation(sub_ink, iterations=7), structure=np.ones((3, 3)))
        if n == 0:
            cells.append({'row': r + 1, 'col': c + 1, 'measured': False}); continue
        sizes = ndi.sum(sub_ink, lab, range(1, n + 1))
        main = lab == (1 + int(np.argmax(sizes)))
        core = main & sub_ink
        ys, xs = np.where(core)
        bx0, bx1, by0, by1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
        w, h = bx1 - bx0 + 1, by1 - by0 + 1
        # moucheture : petites taches sombres COMPACTES (3 à 60 px, boîte quasi carrée, remplie), comptées sur l'encre NON dilatée dans la boîte élargie du nez
        # (les hachures sont allongées et minces : rejetées par le critère de compacité ; un masque dilaté avalerait les taches voisines, d'où ce choix)
        pad = 14
        ex0, ex1, ey0, ey1 = max(0, bx0 - pad), min(sub_ink.shape[1], bx1 + pad + 1), max(0, by0 - pad), min(sub_ink.shape[0], by1 + pad + 1)
        raw_ink = (img[y0:y1, x0:x1] < 150)[ey0:ey1, ex0:ex1]
        il, inn = ndi.label(raw_ink, structure=np.ones((3, 3)))
        specks = 0
        for sl_i, sl in enumerate(ndi.find_objects(il), 1):
            comp = (il[sl] == sl_i); a = int(comp.sum()); hh, ww = comp.shape
            if 3 <= a <= 60 and max(hh, ww) / max(1, min(hh, ww)) < 2.2 and a / (hh * ww) >= 0.5:
                specks += 1
        # narines : taches très sombres (< 105) compactes dans la moitié basse de la boîte du nez
        dark = (img[y0:y1, x0:x1] < 105) & main
        dl, dn = ndi.label(dark, structure=np.ones((3, 3)))
        blobs = []
        for j in range(1, dn + 1):
            by_, bx_ = np.where(dl == j)
            if len(bx_) < 14:
                continue
            cx, cy = bx_.mean(), by_.mean()
            rx, ry = (cx - bx0) / w, (cy - by0) / h
            if ry < 0.45:                                  # moitié haute : hachures / racine, pas des narines
                continue
            blobs.append({'px': int(len(bx_)), 'cxRel': round(float(rx), 4), 'cyRel': round(float(ry), 4), 'sizeOverNoseW': round(float(np.sqrt(len(bx_)) / w), 4)})
        L = sorted([b for b in blobs if b['cxRel'] < 0.5], key=lambda b: -b['px'])[:1]
        R = sorted([b for b in blobs if b['cxRel'] >= 0.5], key=lambda b: -b['px'])[:1]
        pair = None
        if L and R:
            a, b = L[0], R[0]
            pair = {'separationOverNoseW': round(b['cxRel'] - a['cxRel'], 4), 'meanCyRel': round((a['cyRel'] + b['cyRel']) / 2, 4),
                    'meanSizeOverNoseW': round((a['sizeOverNoseW'] + b['sizeOverNoseW']) / 2, 4)}
        cells.append({'row': r + 1, 'col': c + 1, 'measured': True, 'bbox': [x0 + bx0, y0 + by0, x0 + bx1, y0 + by1], 'w': w, 'h': h,
                      'aspectWH': round(w / h, 4), 'inkFraction': round(float(core.sum()) / (w * h), 4), 'specks': specks,
                      'speckDensityPer1000px2': round(1000 * specks / (w * h), 3), 'nostrilPair': pair})

vis = np.stack([img] * 3, -1).astype(np.uint8)
for cdef in cells:
    if not cdef['measured']:
        continue
    x0, y0, x1, y1 = cdef['bbox']
    cv2.rectangle(vis, (x0, y0), (x1, y1), (255, 0, 255), 1)
    cv2.putText(vis, f"{cdef['row']}.{cdef['col']}", (x0 + 2, y0 + 11), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (255, 0, 255), 1)
    if cdef['nostrilPair']:
        # on retrace les deux points de narine retenus
        pass
for x in xc[1:-1]:
    cv2.line(vis, (x, 0), (x, H), (0, 200, 255), 1)
for y in yc[1:-1]:
    cv2.line(vis, (0, y), (W, y), (0, 200, 255), 1)
os.makedirs('artefacts/nez-refs', exist_ok=True)
Image.fromarray(vis).resize((W * 2, H * 2), Image.LANCZOS).save('artefacts/nez-refs/05-overlay.png')

ok = [c for c in cells if c['measured']]
pairs = [c['nostrilPair'] for c in ok if c['nostrilPair']]
summary = {'cells': len(cells), 'measured': len(ok), 'withNostrilPair': len(pairs), 'gridColumns': xc, 'gridRows': yc}
def stat(vals):
    v = np.array(vals); return {'median': round(float(np.median(v)), 4), 'min': round(float(v.min()), 4), 'max': round(float(v.max()), 4)}
summary['aspectWH'] = stat([c['aspectWH'] for c in ok])
summary['speckDensityPer1000px2'] = stat([c['speckDensityPer1000px2'] for c in ok])
summary['speckledCells(>=1.0)'] = [f"{c['row']}.{c['col']}" for c in ok if c['speckDensityPer1000px2'] >= 1.0]
for key in ('separationOverNoseW', 'meanCyRel', 'meanSizeOverNoseW'):
    if pairs:
        summary[key] = stat([p[key] for p in pairs])
json.dump({'source': SRC, 'method': 'grille par vallées de projection -> amas principal par cellule -> narines sombres / moucheture', 'summary': summary, 'cells': cells}, open('references/nez/measures-05.json', 'w'), indent=1)
print(json.dumps(summary, indent=1))
