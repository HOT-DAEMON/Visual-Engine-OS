"""Mesure rigoureuse des coupes : MÊME estimateur pour une référence (references/hair) et pour un rendu du moteur.

Normalisation : unité H du moteur. Dans `DEFAULT_HEAD`, yeux y=0,04 et menton y=0,54 → (menton − yeux) = 0,50 H, donc H_px = 2 × (menton − yeux)
mesuré en pixels. Origine verticale = ligne des yeux ; origine horizontale = axe du visage (cx). Toutes les sorties sont en H (adimensionnelles) :
elles ne dépendent donc ni de la résolution ni du cadrage de l'image.

Usage :
  python3 -I measure-cuts.py ref  <id>  <dossier-sortie>          # mesure une référence (config dans REFS) ; écrit masque, surcouche, JSON
  python3 -I measure-cuts.py eng  <dossier-masques> <tag>         # mesure un rendu du moteur (paire -face / -full de render-masks.ts)
  python3 -I measure-cuts.py cmp  <ref.json> <eng.json>           # écarts moteur − référence, descripteur par descripteur

Limites assumées (documentées dans docs/HAIR-MEASURE.md) : les boîtes d'amorce sont posées à la main sur des planches à grille (incertitude ≈ ±5 px) ;
les accessoires clairs (bijoux, col) sont exclus par ROI ; les références ne partagent pas les proportions de visage du moteur (voir `faceW`).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

# --- Références : ancres (px) lues sur planches à grille + règle de segmentation colorimétrique (Lab) vérifiée sur surcouche ---------------------
# eye = ligne des yeux, chin = menton, cx = axe du visage. `outer_only` : le masque contient aussi le visage (seules les étendues extérieures sont valides).
# `manual` : valeurs LUES à la main sur la planche à grille (jamais présentées comme mesurées) ; elles complètent ce que la règle ne sépare pas.
REFS: dict[str, dict] = {
    '06': dict(file='06.jpg', eye=290, chin=432, cx=313, rule='bgdist', outer_only=True, roi_y=(0, 500), manual={}),
    '32': dict(file='32.jpg', eye=265, chin=385, cx=245, rule='white', outer_only=False, roi_y=(0, 265), manual={}),
    '47': dict(file='47.jpg', eye=510, chin=725, cx=395, rule='pale', outer_only=False, roi_y=(0, 620),
               manual={'fringe_bottom_px': 462, 'fringe_bottom_unc_px': 10, 'side_lock_bottom_px': 1000, 'note': 'bas de frange et mèche latérale lus sur grille ; pointes ombrées non isolées par la règle'}),
}


def _big(m: np.ndarray) -> np.ndarray:
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), connectivity=8)
    return lab == (1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))) if n > 1 else m


def segment_ref(cfg: dict, root: Path) -> np.ndarray:
    """Règles colorimétriques simples et auditables (une par image, voir `docs/HAIR-MEASURE.md`) ; la plus grande composante est conservée."""
    bgr = cv2.imread(str(root / 'references/hair' / cfg['file']))
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(float)
    y0, y1 = cfg['roi_y']
    rule = cfg['rule']
    if rule == 'white':          # cheveux presque blancs sur fond rose saturé : min(R,G,B) élevé
        m = bgr.min(axis=2) > 160
    elif rule == 'bgdist':       # fond clair uniforme : écart de couleur au fond (médiane des bords) ; masque = silhouette tête + cheveux
        edge = np.concatenate([lab[0:12].reshape(-1, 3), lab[:, :12].reshape(-1, 3), lab[:, -12:].reshape(-1, 3)])
        m = np.sqrt(((lab - np.median(edge, axis=0)) ** 2).sum(2)) > 14
    elif rule == 'pale':         # cheveux blanc-jaune : L* haut, a* et b* bas (peau : a* ≈ 14 ; fond jaune : b* ≈ 47) ; hors bords de l'image
        L = lab[..., 0] / 255 * 100
        m = (L > 72) & (lab[..., 1] - 128 < 7) & (lab[..., 2] - 128 < 38)
        m[:, :170] = False
        m[:, 640:] = False
    else:
        raise SystemExit(f'règle inconnue {rule}')
    m[:y0] = False
    m[y1:] = False
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)).astype(bool)
    return _big(m)


def descriptors(mask: np.ndarray, eye: float, chin: float, cx: float) -> dict:
    """Descripteurs adimensionnels (unité H) d'un masque de cheveux visibles. Voir docs/HAIR-MEASURE.md pour la définition de chacun."""
    H = 2.0 * (chin - eye)
    ys, xs = np.nonzero(mask)
    if len(ys) == 0:
        return {'empty': True}
    d: dict = {'H_px': H, 'area_H2': float(len(ys)) / (H * H)}
    d['top'] = float((eye - ys.min()) / H)                    # sommet des cheveux au-dessus de la ligne des yeux (H)
    d['bottom'] = float((ys.max() - eye) / H)                 # point le plus bas des cheveux sous la ligne des yeux (H)
    d['left'] = float((cx - xs.min()) / H)                    # demi-étendue gauche (H)
    d['right'] = float((xs.max() - cx) / H)                   # demi-étendue droite (H)
    # Largeur du masque (extension gauche/droite) à des niveaux fixes sous/sur la ligne des yeux.
    levels = {}
    for name, dy in [('m0.40', -0.40), ('m0.20', -0.20), ('eye', 0.0), ('p0.12', 0.12), ('p0.25', 0.25), ('chin', 0.5)]:
        y = int(round(eye + dy * H))
        if 0 <= y < mask.shape[0] and mask[y].any():
            xx = np.nonzero(mask[y])[0]
            levels[name] = {'l': float((cx - xx.min()) / H), 'r': float((xx.max() - cx) / H), 'cover': float(len(xx) / H)}
    d['levels'] = levels
    # Bord inférieur de la frange : pour chaque colonne de l'axe du visage ±0,30 H, plus bas pixel de cheveux CONTIGU depuis le haut du masque.
    fr = []
    for x in range(int(cx - 0.30 * H), int(cx + 0.30 * H) + 1):
        if not (0 <= x < mask.shape[1]):
            continue
        col = mask[:, x]
        idx = np.nonzero(col)[0]
        if len(idx) == 0:
            continue
        top = idx[0]
        run = top
        while run + 1 < len(col) and col[run + 1]:
            run += 1
        fr.append((run - eye) / H)
    if fr:
        d['fringe_bottom'] = {'min': float(np.min(fr)), 'med': float(np.median(fr)), 'max': float(np.max(fr))}
    # Chute latérale : plus bas pixel de cheveux dans |x − cx| > 0,38 H (retombée sur les côtés / l'oreille).
    side = mask[:, :].copy()
    cols = np.arange(mask.shape[1])
    side[:, np.abs(cols - cx) <= 0.38 * H] = False
    sy = np.nonzero(side)[0]
    d['side_drop'] = float((sy.max() - eye) / H) if len(sy) else None
    return d


def measure_engine(dirp: Path, tag: str, anchors: list[dict]) -> tuple[np.ndarray, dict]:
    a = next(q for q in anchors if q['tag'] == tag)
    face = np.asarray(Image.open(dirp / f'{tag}-face.png').convert('RGB')).astype(int)
    full = np.asarray(Image.open(dirp / f'{tag}-full.png').convert('RGB')).astype(int)
    mask = np.abs(face - full).sum(2) > 24
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    mask = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_OPEN, k).astype(bool)
    return mask, descriptors(mask, a['eyeY'], a['chinY'], a['cx'])


def overlay(img_path: Path | None, mask: np.ndarray, out: Path, base: np.ndarray | None = None) -> None:
    im = base if base is not None else np.asarray(Image.open(img_path).convert('RGB')).copy()
    o = im.copy()
    o[mask] = (0.5 * o[mask] + 0.5 * np.array([255, 0, 80])).astype(np.uint8)
    edge = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8)).astype(bool)
    o[edge] = (255, 255, 0)
    Image.fromarray(o).save(out)


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    cmd = sys.argv[1]
    if cmd == 'ref':
        rid, outd = sys.argv[2], Path(sys.argv[3])
        outd.mkdir(parents=True, exist_ok=True)
        cfg = REFS[rid]
        mask = segment_ref(cfg, root)
        Image.fromarray((mask * 255).astype(np.uint8)).save(outd / f'ref{rid}-mask.png')
        overlay(root / 'references/hair' / cfg['file'], mask, outd / f'ref{rid}-overlay.png')
        d = descriptors(mask, cfg['eye'], cfg['chin'], cfg['cx'])
        d['id'] = rid
        d['rule'] = cfg['rule']
        if cfg['outer_only']:        # le masque contient le visage : surface, couverture et frange ne signifient rien
            for k in ('area_H2', 'fringe_bottom'):
                d.pop(k, None)
            for lv in d.get('levels', {}).values():
                lv.pop('cover', None)
            d['outer_only'] = True
        if cfg['manual']:
            H = d['H_px']
            m = cfg['manual']
            d['manual'] = {**m, 'fringe_bottom_H': (m['fringe_bottom_px'] - cfg['eye']) / H, 'side_lock_bottom_H': (m['side_lock_bottom_px'] - cfg['eye']) / H}
        (outd / f'ref{rid}.json').write_text(json.dumps(d, indent=1))
        print(json.dumps(d, indent=1))
    elif cmd == 'eng':
        dirp, tag = Path(sys.argv[2]), sys.argv[3]
        anchors = json.loads((dirp / 'anchors.json').read_text())
        mask, d = measure_engine(dirp, tag, anchors)
        d['id'] = tag
        # Silhouette extérieure (tête + cheveux, tout ce qui n'est pas le fond blanc) : seule grandeur comparable aux références `outer_only`.
        full = np.asarray(Image.open(dirp / f'{tag}-full.png').convert('RGB')).astype(int)
        a = next(q for q in anchors if q['tag'] == tag)
        sil = (255 * 3 - full.sum(2)) > 30
        sil[int(a['eyeY'] + 0.75 * 2 * (a['chinY'] - a['eyeY'])):] = False
        d['outer'] = descriptors(sil, a['eyeY'], a['chinY'], a['cx'])
        Image.fromarray((mask * 255).astype(np.uint8)).save(dirp / f'{tag}-mask.png')
        overlay(dirp / f'{tag}-full.png', mask, dirp / f'{tag}-overlay.png')
        (dirp / f'{tag}.json').write_text(json.dumps(d, indent=1))
        print(json.dumps(d, indent=1))
    elif cmd == 'cmp':
        r, e = json.loads(Path(sys.argv[2]).read_text()), json.loads(Path(sys.argv[3]).read_text())
        keys = ['top', 'bottom', 'left', 'right', 'area_H2', 'side_drop']
        for k in keys:
            if r.get(k) is not None and e.get(k) is not None:
                print(f'{k:10s} ref={r[k]:+.3f}  moteur={e[k]:+.3f}  écart={e[k] - r[k]:+.3f}')
        for k in ('min', 'med', 'max'):
            if 'fringe_bottom' in r and 'fringe_bottom' in e:
                print(f'fringe_{k:3s} ref={r["fringe_bottom"][k]:+.3f}  moteur={e["fringe_bottom"][k]:+.3f}  écart={e["fringe_bottom"][k] - r["fringe_bottom"][k]:+.3f}')
    else:
        raise SystemExit(__doc__)


if __name__ == '__main__':
    main()
