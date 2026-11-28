"""Mesure des CHIGNONS d'une référence (references/hair) : disques ajustés sur le masque des cheveux, en unité « hauteur de crâne » Hc.

Pourquoi Hc et non H : les références ont un front plus haut que le moteur (réf. 04 : œil→sommet ≈ 0,94 H contre 0,50 H), donc une mesure « au-dessus de la ligne
des yeux » ne se transporte pas. On normalise par la hauteur de tête visible (sommet du crâne → menton) : Hc = chin_y − crown_y ; le moteur a Hc = 1,00 H.
Usage : python3 -I measure-buns.py <id> <dossier-sortie>
Règle de segmentation (auditable, surcouche écrite) : écart Lab au fond uni (médiane des bords) > 40, ROI au-dessus de la frange ; chignon = composante qui survit à une ouverture par un disque de rayon `open_r`.
Valeurs lues à la main (ancres œil, menton, sommet de crâne) marquées `manual`.
"""
from __future__ import annotations
import json, sys
from pathlib import Path
import cv2, numpy as np
from PIL import Image

REFS = {
    # crown = sommet du crâne HORS chignons (ligne d'implantation au milieu du front, lue sur grille), chin = menton, cx = axe du visage.
    '04': dict(file='04.jpg', eye=620, chin=862, cx=352, crown=170, rule='bgdist', roi_y=(0, 330), min_r=40, bun_min_above=0.05),
}

def main() -> None:
    root = Path(__file__).resolve().parents[2]
    rid, outd = sys.argv[1], Path(sys.argv[2]); outd.mkdir(parents=True, exist_ok=True)
    c = REFS[rid]
    bgr = cv2.imread(str(root / 'references/hair' / c['file']))
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(float)
    L = lab[..., 0] / 255 * 100
    edge = np.concatenate([lab[0:10].reshape(-1, 3), lab[:, :6].reshape(-1, 3), lab[:, -6:].reshape(-1, 3)])
    m = np.sqrt(((lab - np.median(edge, axis=0)) ** 2).sum(2)) > 40       # écart de couleur au fond (médiane des bords)
    y0, y1 = c['roi_y']; m[:y0] = False; m[y1:] = False
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    # Disques inscrits : maxima locaux de la transformée en distance du masque (centre = pic, rayon = valeur). Suppression des non-maxima (pas de disque dont le
    # centre est dans un disque plus grand) ; on garde ceux de rayon ≥ `min_r` px. Le crâne (grosse masse sous les chignons) sort aussi : il est identifié par son centre bas.
    dt = cv2.distanceTransform(m, cv2.DIST_L2, 5)
    Hc = c['chin'] - c['crown']
    out = {'id': rid, 'Hc_px': Hc, 'rule': c['rule'], 'manual': ['eye', 'chin', 'cx', 'crown'], 'buns': []}
    ov = np.asarray(Image.open(root / 'references/hair' / c['file']).convert('RGB')).copy()
    taken: list[tuple[float, float, float]] = []
    for _ in range(6):
        y, x = np.unravel_index(int(np.argmax(dt)), dt.shape); r = float(dt[y, x])
        if r < c['min_r']: break
        taken.append((float(x), float(y), r)); cv2.circle(dt, (int(x), int(y)), int(r * 1.15), 0, -1)
    cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    pts = np.vstack([q.reshape(-1, 2) for q in cnts]).astype(float)
    rng = np.random.default_rng(7)
    def circle3(p1, p2, p3):
        A = np.array([[p2[0] - p1[0], p2[1] - p1[1]], [p3[0] - p1[0], p3[1] - p1[1]]]) * 2
        rhs = np.array([p2 @ p2 - p1 @ p1, p3 @ p3 - p1 @ p1])
        if abs(np.linalg.det(A)) < 1e-6: return None
        cc = np.linalg.solve(A, rhs); return cc, float(np.hypot(*(p1 - cc)))
    # Chignons = disques inscrits dont le centre est à plus de 0,15 Hc au-dessus de la ligne d'implantation (le reste est la masse du crâne).
    for x, y, r in sorted(taken):
        if (c['crown'] - y) / Hc < c.get('bun_min_above', 0.0): continue
        sg = -1.0 if x < c['cx'] else 1.0
        ang = np.degrees(np.arctan2(-(pts[:, 1] - y), sg * (pts[:, 0] - x)))           # 0° = vers l'extérieur, 90° = vers le haut
        d = np.hypot(pts[:, 0] - x, pts[:, 1] - y)
        sel = pts[(ang > -20) & (ang < 150) & (d > 0.9 * r) & (d < 2.6 * r)]            # arc extérieur et haut du contour (hors raccord au crâne)
        best = None
        for _ in range(3000):
            q = sel[rng.choice(len(sel), 3, replace=False)]; cr = circle3(*q)
            if cr is None or not (0.9 * r < cr[1] < 2.6 * r): continue
            res = np.abs(np.hypot(sel[:, 0] - cr[0][0], sel[:, 1] - cr[0][1]) - cr[1]); inl = int((res < 3).sum())
            if best is None or inl > best[0]: best = (inl, cr[0], cr[1])
        inl, cc, rr = best
        out['buns'].append({'cx_Hc': (cc[0] - c['cx']) / Hc, 'cy_above_crown_Hc': (c['crown'] - cc[1]) / Hc, 'r_Hc': rr / Hc, 'r_inscribed_Hc': r / Hc, 'inliers': inl, 'arc_points': int(len(sel)), 'px': [float(cc[0]), float(cc[1]), float(rr)]})
        cv2.circle(ov, (int(cc[0]), int(cc[1])), int(rr), (0, 120, 255), 3)
    op = m
    # silhouette du crâne + chignons : largeur au niveau des yeux (têtes) pour l'échelle latérale
    full = np.sqrt(((lab - np.median(edge, axis=0)) ** 2).sum(2)) > 40
    row = full[int(c['eye'] - 0.1 * Hc)]; xs = np.nonzero(row)[0]
    out['hair_width_at_brow_Hc'] = float((xs.max() - xs.min()) / Hc) if len(xs) else None
    Image.fromarray(ov).save(outd / f'ref{rid}-buns-overlay.png')
    Image.fromarray((op * 255).astype(np.uint8)).save(outd / f'ref{rid}-buns-mask.png')
    (outd / f'ref{rid}-buns.json').write_text(json.dumps(out, indent=1)); print(json.dumps(out, indent=1))
main()
