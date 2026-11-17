"""Détecteur de cellules annotées pour les références en motif périodique (réf. 17).
La réf. 17 est un fragment d'un motif périodique (période ≈ 477 px en x et en y, mesurée par autocorrélation puis phase) : les yeux « coupés par la tuile » existent
en entier ailleurs dans la période. On reconstruit donc UNE période complète (recalage sous-pixel des copies), on la pose en 3×3 (raccords sans coupure), puis on
détecte les cellules (un œil + ses cils + son sourcil = un groupe d'encre) et on les ANNOTE : numéro, boîte, aire, composantes (iris / ouverture / sourcil / cils).
Sorties : references/eyes/cells-17.json (cellules + ancres canthi/marges proposées), artefacts/eyes-refs3/17-cellules.png (annotation visuelle).
Aucune silhouette n'est inventée : les ancres sont accrochées au gradient par les helpers de extract.py comme pour les autres références."""
import json, os, sys
import numpy as np, cv2
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from extract import REF  # noqa: E402
OUT = 'artefacts/eyes-refs3'; P = 477

def load(fn):
    return np.array(Image.open(f'{REF}/{fn}').convert('L')).astype(np.float32)

def period_tile(im, P=P):
    """Période complète (P×P) : chaque pixel de la période est lu dans toutes les copies présentes (décalage entier P + correction sous-pixel mesurée), moyenne pondérée."""
    H, W = im.shape
    def shift(A, B):
        w = cv2.createHanningWindow((A.shape[1], A.shape[0]), cv2.CV_32F); return cv2.phaseCorrelate(B.copy(), A.copy(), w)[0]
    sx = shift(im[:, P:W], im[:, 0:W - P]); sy = shift(im[P:H, :], im[0:H - P, :])  # (dx, dy) des copies décalées
    acc = np.zeros((P, P), np.float32); cnt = np.zeros((P, P), np.float32)
    for j in range(-1, 3):
        for i in range(-1, 3):
            # position de la copie (i, j) dans l'image : décalage P·(i, j) + correction sous-pixel proportionnelle
            ox = P * i + i * sx[0] + j * sy[0]; oy = P * j + i * sx[1] + j * sy[1]
            M = np.float32([[1, 0, -ox], [0, 1, -oy]])
            win = cv2.warpAffine(im, M, (P, P), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=-1)
            msk = (cv2.warpAffine(np.ones_like(im), M, (P, P), flags=cv2.INTER_NEAREST, borderMode=cv2.BORDER_CONSTANT, borderValue=0) > 0.99).astype(np.float32)
            acc += np.where(msk > 0, win, 0) * msk; cnt += msk
    assert cnt.min() > 0, 'période incomplète'
    return acc / cnt, cnt, (sx, sy)

def components(ink, params):
    """Classe les composantes d'encre d'une cellule : iris (grand blob sombre compact), ouverture (arc continu fin), sourcil (barre allongée haute), cils (petites pointes)."""
    n, lab, st, cen = cv2.connectedComponentsWithStats(ink, connectivity=8); out = []
    for i in range(1, n):
        x, y, w, h, a = st[i]
        fill = a / float(w * h); ar = max(w, h) / max(min(w, h), 1)
        kind = 'iris' if (a > 1500 and fill > 0.5 and ar < 1.6) else ('sourcil' if (ar > 2.6 and a > 800 and fill < 0.6 and min(w, h) > 8) else ('cils' if a < 400 else 'ouverture'))
        out.append({'kind': kind, 'bbox': [int(x), int(y), int(w), int(h)], 'areaPx': int(a)})
    return out

def detect(fn='17.jpg'):
    im = load(fn); tile, cnt, sh = period_tile(im)
    big = np.tile(tile, (3, 3)); ink = (big < 128).astype(np.uint8)
    d = cv2.dilate(ink, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
    n, lab, st, cen = cv2.connectedComponentsWithStats(d, connectivity=8); cells = []
    for i in range(1, n):
        cx, cy = cen[i]
        if not (P <= cx < 2 * P and P <= cy < 2 * P): continue          # une seule période représentative (centroïde dans la tuile centrale)
        x, y, w, h = st[i, :4]; sub = ink[y:y + h, x:x + w] * (lab[y:y + h, x:x + w] == i)
        comps = components(sub.astype(np.uint8), None)
        for c in comps: c['bbox'][0] += int(x - P); c['bbox'][1] += int(y - P)
        cells.append({'bbox': [int(x - P), int(y - P), int(w), int(h)], 'centre': [round(float(cx - P), 1), round(float(cy - P), 1)], 'inkPx': int(sub.sum()), 'components': comps})
    cells.sort(key=lambda c: (round(c['centre'][1] / 120), c['centre'][0]))
    for k, c in enumerate(cells): c['id'] = f'17-P{k:02d}'
    return tile, big, cells, sh

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True); tile, big, cells, sh = detect()
    cv2.imwrite(f'{OUT}/17-periode.png', tile.clip(0, 255).astype(np.uint8))
    ov = cv2.cvtColor(big.clip(0, 255).astype(np.uint8), cv2.COLOR_GRAY2BGR); col = {'iris': (0, 0, 255), 'sourcil': (255, 0, 0), 'cils': (0, 160, 0), 'ouverture': (0, 140, 255)}
    for c in cells:
        for cc in c['components']:
            x, y, w, h = cc['bbox']; cv2.rectangle(ov, (x + P, y + P), (x + P + w, y + P + h), col[cc['kind']], 1)
        x, y, w, h = c['bbox']; cv2.rectangle(ov, (x + P, y + P), (x + P + w, y + P + h), (255, 0, 255), 2); cv2.putText(ov, c['id'][-3:], (x + P + 4, y + P + 16), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 0, 255), 2)
    cv2.imwrite(f'{OUT}/17-cellules.png', ov[P - 60:2 * P + 60, P - 60:2 * P + 60])
    json.dump({'method': 'réf. 17 : période 477 px reconstruite (copies recalées au sous-pixel), cellules détectées sur motif 3×3 (aucune coupure de tuile)', 'period': P,
               'subpixelShift': {'x': [float(v) for v in sh[0]], 'y': [float(v) for v in sh[1]]}, 'cells': cells}, open(f'{REF}/cells-17.json', 'w'), indent=1)
    print(len(cells), 'cellules'); [print(c['id'], c['centre'], c['inkPx'], [cc['kind'] for cc in c['components'] if cc['areaPx'] > 200]) for c in cells]
