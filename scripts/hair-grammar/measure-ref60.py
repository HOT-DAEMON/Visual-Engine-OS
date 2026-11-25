#!/usr/bin/env python3
"""Mesures sur references/hair/60.jpg (tutoriel « dessiner les reflets en suivant la direction des mèches »), passe 7.

Reprend la méthode de la passe 6 (reflet = pixels R > 190 et G > 55, grappes contiguës ≥ 6 px, positions en fraction de la longueur du ruban)
et mesure ce que la passe 6 avait laissé : l'ÉVENTAIL (panneau C), les BANDES RECOUVERTES (panneau D) et la TÊTE illustrée.
Sortie : artefacts/hair-engine-pass7/measures-ref60.json (lue par tests/hair-engine-ring-measures.test.ts : les constantes de `spec-ring.ts` doivent rester dans ces plages).
Usage : python3 -I scripts/hair-grammar/measure-ref60.py
"""
import json
import os

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'references', 'hair', '60.jpg')
OUT = os.path.join(ROOT, 'artefacts', 'hair-engine-pass7', 'measures-ref60.json')
IM = np.asarray(Image.open(SRC).convert('RGB')).astype(float)

# Boîtes des panneaux dans l'image 736 × 736 (x0, y0, x1, y1).
BOX = {'A': (535, 170, 715, 245), 'B': (585, 260, 675, 425), 'C': (505, 435, 725, 565), 'D': (515, 585, 715, 705)}


def red_mask(r, g, min_area=200):
    m = (r - g > 35) & (r > 60)
    lab, n = ndi.label(m)
    sz = ndi.sum(m, lab, range(1, n + 1))
    return np.isin(lab, [i + 1 for i, s in enumerate(sz) if s > min_area])


def highlight_mask(red, r, g, min_px=6):
    hl = red & (r > 190) & (g > 55)
    lab, n = ndi.label(hl)
    sz = ndi.sum(hl, lab, range(1, n + 1))
    keep = [i + 1 for i, s in enumerate(sz) if s >= min_px]
    return np.isin(lab, keep), lab, keep


def panel_area(name):
    x0, y0, x1, y1 = BOX[name]
    c = IM[y0:y1, x0:x1]
    r, g = c[..., 0], c[..., 1]
    red = red_mask(r, g)
    hm, _, keep = highlight_mask(red, r, g)
    return {'redArea': int(red.sum()), 'hlArea': int(hm.sum()), 'hlShare': float(hm.sum() / max(1, red.sum())), 'clusters': len(keep)}


def fan():
    """Panneau C : l'éventail. Rayons mesurés depuis le sommet (racine commune des mèches), en fraction du rayon R de l'arc."""
    x0, y0, x1, y1 = BOX['C']
    c = IM[y0:y1, x0:x1]
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    red = red_mask(r, g)
    ys, xs = np.nonzero(red)
    ay = ys.min()
    ax = xs[ys == ay].mean()
    rmax = np.hypot(xs - ax, ys - ay).max()
    hm, _, _ = highlight_mask(red, r, g)
    hy, hx = np.nonzero(hm)
    hr = np.hypot(hx - ax, hy - ay)
    ha = np.degrees(np.arctan2(hx - ax, hy - ay))
    a_lo, a_hi = np.percentile(np.degrees(np.arctan2(xs - ax, ys - ay)), [0.5, 99.5])
    # Épaisseur radiale du reflet par tranche d'angle de 3° (comparable aux étendues des rubans A et B ; max − min sur toute la grappe y ajouterait la dentelure).
    thick = []
    for a in np.arange(ha.min(), ha.max(), 3.0):
        s = (ha >= a) & (ha < a + 3.0)
        if s.sum() >= 3:
            thick.append((hr[s].max() - hr[s].min()) / rmax)
    # Concentricité : rayon moyen du reflet par tranche d'angle (un arc concentrique garde un rayon constant).
    edges = np.linspace(ha.min(), ha.max(), 9)
    mean_r = [hr[(ha >= edges[i]) & (ha < edges[i + 1])].mean() / rmax for i in range(8) if ((ha >= edges[i]) & (ha < edges[i + 1])).sum() > 3]
    # Profil de luminance le long du rayon, sur le secteur du reflet.
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    yy, xx = np.mgrid[0:c.shape[0], 0:c.shape[1]]
    r_all = np.hypot(xx - ax, yy - ay)
    a_all = np.degrees(np.arctan2(xx - ax, yy - ay))
    sel = red & (np.abs(a_all - (ha.min() + ha.max()) / 2) < 25)
    prof = []
    for rr in np.arange(0.10, 1.0, 0.04):
        s = sel & (r_all >= rr * rmax) & (r_all < (rr + 0.04) * rmax)
        if s.sum() > 5:
            prof.append((float(rr), float(np.median(lum[s]))))
    p = np.array(prof)
    base = float(np.median(p[p[:, 0] > 0.7, 1]))
    edge = hr.max() / rmax
    after = p[p[:, 0] > edge]
    dip = after[np.argmin(after[:, 1])]
    half = (dip[1] + base) / 2
    back_half = after[(after[:, 0] > dip[0]) & (after[:, 1] >= half)]
    full = after[(after[:, 0] > dip[0]) & (after[:, 1] >= 0.97 * base)]
    return {
        'apex': [float(ax), int(ay)], 'fanDeg': float(a_hi - a_lo),
        'center': float(hr.mean() / rmax), 'thickness': float(np.mean(thick)), 'thicknessMin': float(min(thick)), 'thicknessMax': float(max(thick)),
        'angularCoverage': float((ha.max() - ha.min()) / (a_hi - a_lo)), 'arcSpread': float(max(mean_r) - min(mean_r)),
        'dip': float((dip[1] - base) / base), 'dipAt': float(dip[0]), 'edgeAt': float(edge),
        'shadowHalfLen': float(back_half[0, 0] - edge) if len(back_half) else None, 'shadowFullLen': float(full[0, 0] - edge) if len(full) else None,
        'profile': [[round(a, 2), round(b, 1)] for a, b in prof],
    }


def ribbon(name):
    """Panneaux A et B : un ruban droit. Abscisse u le long de l'axe principal (PCA), 0..1 ; reflet = grappes >= 6 px dans le ruban érodé de 3 px (sinon le liseré anti-aliasé du bord est pris pour un reflet)."""
    x0, y0, x1, y1 = BOX[name]
    c = IM[y0:y1, x0:x1]
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    m = (r - g > 35) & (r > 60)
    lab, n = ndi.label(m)
    sz = ndi.sum(m, lab, range(1, n + 1))
    red = lab == (1 + int(np.argmax(sz)))
    inner = ndi.binary_erosion(red, iterations=3)
    hm, _, _ = highlight_mask(inner, r, g)
    ys, xs = np.nonzero(red)
    pts = np.stack([xs, ys], 1).astype(float)
    mu = pts.mean(0)
    _, v = np.linalg.eigh(np.cov((pts - mu).T))
    ax = v[:, 1]
    t = (pts - mu) @ ax
    t0, length = t.min(), t.max() - t.min()
    hy, hx = np.nonzero(hm)
    uh = ((np.stack([hx, hy], 1) - mu) @ ax - t0) / length
    u = (t - t0) / length
    lum = (0.299 * r + 0.587 * g + 0.114 * b)[ys, xs]
    hl = hm[ys, xs]
    prof = []
    for a in np.arange(0, 1, 0.04):
        s = (u >= a) & (u < a + 0.04) & ~hl & inner[ys, xs]
        if s.sum() > 4:
            prof.append((a + 0.02, float(np.median(lum[s]))))
    p = np.array(prof)
    level = float(np.median(p[:, 1]))
    best = None
    for sign in (1, -1):  # l'ombre aval est d'UN côté : on garde le sens où le creux est le plus net
        edge = uh.max() if sign == 1 else uh.min()
        aft = p[p[:, 0] > edge] if sign == 1 else p[p[:, 0] < edge][::-1]
        if len(aft) < 3:
            continue
        i = int(np.argmin(aft[:, 1]))
        dip = aft[i]
        half = (dip[1] + level) / 2
        back = [a for a in aft[i:] if a[1] >= half]
        cand = {'dip': float((dip[1] - level) / level), 'dipAt': float(abs(dip[0] - edge)), 'shadowHalfLen': float(abs(back[0][0] - edge)) if back else None}
        if best is None or cand['dip'] < best['dip']:
            best = cand
    return {'extent': float(uh.max() - uh.min()), 'center': float(uh.mean()), **best}


def head():
    """Tête illustrée (moitié gauche) : part de reflet, répartition verticale."""
    x0, y0, x1, y1 = 0, 180, 500, 640
    c = IM[y0:y1, x0:x1]
    r, g = c[..., 0], c[..., 1]
    hair = (r - g > 35) & (r > 45)
    lab, n = ndi.label(hair)
    sz = ndi.sum(hair, lab, range(1, n + 1))
    hair = lab == (1 + int(np.argmax(sz)))
    hl = hair & (r > 190) & (g > 55)
    ys, _ = np.nonzero(hair)
    hy, _ = np.nonzero(hl)
    top, bot = ys.min(), ys.max()
    lab2, _ = ndi.label(hl)
    sz2 = ndi.sum(hl, lab2, range(1, lab2.max() + 1))
    return {'hairArea': int(hair.sum()), 'hlArea': int(hl.sum()), 'hlShare': float(hl.sum() / hair.sum()), 'clusters8px': int((sz2 >= 8).sum()), 'centerHeight': float((hy.mean() - top) / (bot - top))}


def main():
    out = {'source': 'references/hair/60.jpg', 'threshold': 'R>190 & G>55, grappes >= 6 px', 'panels': {k: panel_area(k) for k in BOX}, 'ribbons': {k: ribbon(k) for k in ('A', 'B')}, 'fan': fan(), 'head': head()}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w') as f:
        json.dump(out, f, indent=1)
    print(json.dumps({k: v for k, v in out.items() if k not in ('fan', 'panels')}, indent=1))
    fn = {k: v for k, v in out['fan'].items() if k != 'profile'}
    print('fan', json.dumps(fn, indent=1))


if __name__ == '__main__':
    main()
