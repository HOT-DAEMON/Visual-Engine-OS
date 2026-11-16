"""Échantillonnage pixel par pixel des CILS des références 12, 13, 14, 15, 16 (trait noir sur blanc ; 14 et 15 : encre = sombre ET peu saturé, iris colorés exclus) : `python3 scripts/eye-refs/extract_lashes.py`.
Sortie : references/eyes/measures-lashes.json + artefacts/eyes-refs3/02-cils-segmentation-{12,13,16}.png (contrôle visuel : chaque œil retenu est numéroté).
Méthode : (1) masque encre (luminance < 110) ; fermeture 5 px pour fusionner un œil, composantes connexes ; on garde les composantes « œil » (grande, rapport L/H 0,7 à 2,6, contenant
une masse sombre compacte = iris/pupille) et on écarte sourcils, sourires, joues. (2) Profil de silhouette haut y_top(x) et bas y_bot(x). (3) Enveloppe du bord = ouverture en niveaux
de gris du profil (fenêtre 0,14 L) : ce qui dépasse l'enveloppe = cils. (4) Pointes = maxima de dépassement h(x) de prominence >= 0,035 L. Mesures normalisées par la largeur L de l'œil.
Le côté EXTERNE est le côté où la somme des dépassements est la plus forte (heuristique, consignée) ; positions 0 = interne, 1 = externe. Aucune valeur inventée : tout vient du masque."""
import json, math, sys
import numpy as np, cv2
from scipy.signal import find_peaks
from scipy.ndimage import grey_opening

ROOT, OUT = 'references/eyes/', 'artefacts/eyes-refs3/'
SRC = {'12': '12.jpg', '13': '13.jpg', '14': '14.jpg', '15': '15.png', '16': '16.webp'}
# Réf. 17 (motif de 14 yeux, encre GRISE luminance ≈ 57) : essayée avec `eyes_of` (2026-11-16) puis REJETÉE — boîtes sans les éventails de cils (yeux 1, 4, 17, 19), sourcils pris pour des yeux (13, 15), tuile coupée (0) :
# artefacts/eyes-pass5/05-ref17-extraction-rejetee.png. Il faut un détecteur d'yeux propre à ce motif (cellules annotées comme les réfs 14/15) avant de l'ajouter ici.

def load(name):
    im = cv2.imread(ROOT + SRC[name], cv2.IMREAD_UNCHANGED)
    if im is None:  # webp : repli PIL
        from PIL import Image
        im = np.array(Image.open(ROOT + SRC[name]).convert('RGB'))[:, :, ::-1]
    return im if im.ndim == 3 else cv2.cvtColor(im, cv2.COLOR_GRAY2BGR)

def eyes_of(img, name_hint=''):
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    ink = (g < 110).astype(np.uint8)
    h, w = ink.shape
    ink[:6, :] = 0; ink[-6:, :] = 0; ink[:, :6] = 0; ink[:, -6:] = 0       # cadre noir de la réf. 13
    k = max(5, int(0.006 * max(h, w)))
    merged = cv2.morphologyEx(ink, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    n, lbl, st, _ = cv2.connectedComponentsWithStats(merged)
    eyes = []
    for i in range(1, n):
        x, y, bw, bh, a = st[i]
        if bw < 0.05 * w or bh < 0.04 * h or not 0.7 <= bw / bh <= 2.6: continue
        comp = (lbl[y:y + bh, x:x + bw] == i) & (ink[y:y + bh, x:x + bw] > 0)
        core = cv2.erode(comp.astype(np.uint8), np.ones((int(bh * 0.18) | 1,) * 2, np.uint8))   # masse compacte (iris) : un œil en a une, un sourcil non
        if core.sum() < 30 and a < 0.2 * bw * bh: continue
        if bw / bh > 1.75 and name_hint == '16': continue                  # paire d'yeux fusionnée (réf. 16)
        if bh < 0.5 * bw and core.sum() < 200: continue                    # sourcil, joue : plat et sans masse d'iris
        eyes.append((x, y, bw, bh, comp))
    eyes.sort(key=lambda e: (round(e[1] / (0.12 * h)), e[0]))
    return eyes

def spikes(profile_h, L):
    """profile_h : dépassement (px) au-dessus de l'enveloppe, par colonne. Renvoie pointes (x, hauteur px, largeur à mi-hauteur px)."""
    pk, pr = find_peaks(profile_h, prominence=0.035 * L, distance=max(2, int(0.012 * L)))
    out = []
    for p, prom in zip(pk, pr['prominences']):
        half = profile_h[p] - prom / 2
        l = p
        while l > 0 and profile_h[l] > half: l -= 1
        r = p
        while r < len(profile_h) - 1 and profile_h[r] > half: r += 1
        out.append((int(p), float(profile_h[p]), float(r - l)))
    return out

def side_stats(h_prof, L):
    sp = spikes(h_prof, L)
    if not sp: return {'count': 0}
    xs = np.array([s[0] for s in sp], float); hs = np.array([s[1] for s in sp]) / L; ws = np.array([s[2] for s in sp]) / L
    gaps = np.diff(xs) / L if len(xs) > 1 else np.array([0.0])
    return {'count': len(sp), 'heightMax': float(hs.max()), 'heightMean': float(hs.mean()), 'heightP90': float(np.percentile(hs, 90)),
            'sharpness': float(np.clip(1 - np.median(ws / np.maximum(hs, 1e-6)) , 0, 1)),   # 1 = aiguille (largeur << hauteur)
            'spacingMean': float(gaps.mean()), 'spacingCV': float(gaps.std() / max(gaps.mean(), 1e-6)) if len(gaps) > 1 else 0.0,
            'clumpRatio': float(np.mean(gaps < 0.55 * np.median(gaps))) if len(gaps) > 2 else 0.0,
            'positions': [float(x) for x in xs / max(len(h_prof) - 1, 1)], 'heights': [float(v) for v in hs], 'sumHeight': float(hs.sum())}

def analyse(comp):
    """Profils haut/bas de la silhouette puis dépassement au-dessus de l'enveloppe du bord (ouverture en niveaux de gris : retire ce qui est plus étroit que la fenêtre)."""
    bh, bw = comp.shape
    L = float(bw)
    top = np.array([np.argmax(comp[:, x]) if comp[:, x].any() else bh for x in range(bw)], float)
    bot = np.array([bh - 1 - np.argmax(comp[::-1, x]) if comp[:, x].any() else -1 for x in range(bw)], float)
    win = max(5, int(0.14 * L)) | 1
    A = bh - top                                    # hauteur de la silhouette vers le haut (grand = loin du bas)
    up = np.clip(A - grey_opening(A, size=win), 0, None)
    lo = np.clip(bot - grey_opening(bot, size=win), 0, None)
    return L, up, lo, top, bot


from skimage.morphology import skeletonize

def spur_lashes(m, L, cy_eye):
    """Cils branchés sur un trait fin (arc de paupière de la réf. 12) : une branche courte du squelette qui part d'une extrémité et finit sur une jonction est un cil."""
    sk = skeletonize(m); sku = sk.astype(np.uint8)
    nb = cv2.filter2D(sku, -1, np.ones((3, 3), np.float32), borderType=cv2.BORDER_CONSTANT) - 1
    ends = np.argwhere(sk & (nb <= 1)); res = []
    for e in ends:
        path = [tuple(e)]; seen = {tuple(e)}; cur = tuple(e); junction = None
        for _ in range(int(0.4 * L)):
            ys, xs = cur
            nxt = [(y, x) for y in range(ys - 1, ys + 2) for x in range(xs - 1, xs + 2) if (y, x) != cur and 0 <= y < sk.shape[0] and 0 <= x < sk.shape[1] and sk[y, x] and (y, x) not in seen]
            if len(nxt) == 0: break
            if len(nxt) >= 2 or nb[cur] >= 3: junction = cur; break
            cur = nxt[0]; seen.add(cur); path.append(cur)
        if junction is None or len(path) < max(4, 0.03 * L): continue
        base = np.array(junction); far = np.array(e); v = far - base; chord = float(np.hypot(*v))
        mid = np.array(path[len(path) // 2]); w = mid - base
        res.append({'upper': bool(base[0] < cy_eye), 'baseX': float(base[1] / L), 'length': float(len(path) * 1.1 / L), 'chord': chord / L, 'angleDeg': float(math.degrees(math.atan2(v[1], -v[0]))),
                    'curvature': float(abs(v[0] * w[1] - v[1] * w[0]) / max(chord, 1e-6) / max(chord, 1e-6)), 'tips': 1, 'baseWidth': 0.0, 'mode': 'spur'})
    return res

def strokes(comp):
    """Analyse au niveau du TRAIT : on retire la masse épaisse (ouverture par un disque de rayon rt = 1 % de L : paupière, iris), ce qui reste d'encre et touche la masse = cils.
    Chaque cil : squelette -> longueur, base (extrémité la plus proche de la masse), pointe(s), angle base->pointe par rapport à la verticale (signé vers l'extérieur, fait plus tard),
    courbure (flèche / corde), largeur de base. Plusieurs pointes sur un même squelette = touffe (cils réunis en mèche)."""
    bh, bw = comp.shape; L = float(bw); rt = 4 if L < 200 else max(2, int(round(0.010 * L)))   # rayon d'épaisseur de la « masse » : 1 % de L ; 4 px pour les petits yeux de la réf. 12 (traits de 4 à 8 px, plus fins que l'iris)
    c8 = comp.astype(np.uint8)
    body = cv2.morphologyEx(c8, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * rt + 1, 2 * rt + 1)))
    thin = (c8 > 0) & (body == 0)
    near = cv2.dilate(body, np.ones((5, 5), np.uint8)) > 0
    d_body = cv2.distanceTransform((body == 0).astype(np.uint8), cv2.DIST_L2, 3)
    dt = cv2.distanceTransform(c8, cv2.DIST_L2, 3)
    n, lbl, st, _ = cv2.connectedComponentsWithStats(thin.astype(np.uint8), connectivity=8)
    out = []
    cy_eye = None
    ys, xs = np.where(body > 0)
    cy_eye = float(ys.mean()) if len(ys) else bh / 2; cx_eye = float(xs.mean()) if len(xs) else bw / 2
    for i in range(1, n):
        m = lbl == i
        if st[i, cv2.CC_STAT_AREA] < 0.0006 * L * L: continue
        if not (m & near).any():
            out += spur_lashes(m, L, cy_eye); continue
        sk = skeletonize(m)
        pts = np.argwhere(sk)
        if len(pts) < max(4, 0.03 * L): continue
        # extrémités : pixels du squelette à un seul voisin
        nb = cv2.filter2D(sk.astype(np.uint8), -1, np.ones((3, 3), np.float32), borderType=cv2.BORDER_CONSTANT) - 1
        ends = np.argwhere(sk & (nb <= 1))
        if len(ends) < 2: ends = pts[[0, -1]]
        db = np.array([d_body[y, x] for y, x in ends])
        base = ends[int(np.argmin(db))]
        tips = [e for e, d in zip(ends, db) if d > 0.025 * L and np.hypot(*(e - base)) > 0.03 * L]
        if not tips: continue
        far = max(tips, key=lambda e: np.hypot(*(e - base)))
        v = far - base; chord = float(np.hypot(*v))
        mid = pts[np.argmin(np.abs(np.hypot(*(pts - base).T) - chord / 2))]
        w = mid - base; sag = float(abs(v[0] * w[1] - v[1] * w[0]) / max(chord, 1e-6))   # distance du milieu à la corde
        upper = base[0] < cy_eye
        out.append({'upper': bool(upper), 'baseX': float(base[1] / L), 'length': float(len(pts) * 1.1 / L), 'chord': chord / L,
                    'angleDeg': float(math.degrees(math.atan2(v[1], -v[0]))),   # 0 = vers le haut image, + = vers la droite image
                    'curvature': sag / max(chord, 1e-6), 'tips': len(tips), 'baseWidth': float(2 * dt[base[0], base[1]] / L)})
    return out, cx_eye / L


# ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
# V2 (2026-11-15) : regroupement des traits AUTOUR DE CHAQUE IRIS (le v1 ne gardait parfois que l'iris), orientation externe par CONSTRUCTION, cils mesurés comme TRAITS ordonnés
# (squelette de la base à la pointe : angle de départ par rapport à la normale de la paupière, courbure signée, effilement), + pointes verticales par tranches de hauteur, réfs 14 et 15 incluses.
# Le v1 déduisait le côté externe du plus grand dépassement (faux pour les yeux sans aile) -> rapport externe/interne contredisant la lecture visuelle.
# ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
# Orientation. Planches en paires (12, 16) : partenaire = masque retourné qui recouvre l'autre à > 0,8 (IoU) ; le plus à gauche du couple a son externe à gauche. Planche 15 : colonne de gauche = œil gauche.
# Ancres visuelles (relevées à l'œil, consignées) : tous les yeux de la 13 et de la 14 ont l'aile / les mèches à DROITE, sauf 13-04 (masse de cils vers la gauche, coin droit pointu à deux traits).
OUTER_ANCHOR = {'13': {4: 'left'}}
ALL_RIGHT = {'13', '14'}
# Cellules d'yeux des planches 14 et 15 (iris colorés : pas de blob d'encre) : (x0, y0, x1, y1), mesurées sur les composantes d'encre.
CELLS = {
    '14': [(20, 60, 230, 200), (230, 50, 420, 200), (420, 55, 625, 215), (20, 270, 230, 420), (230, 260, 430, 420), (430, 270, 625, 420)],
    '15': [(60, 55, 290, 225), (350, 55, 585, 225), (60, 330, 290, 500), (350, 330, 585, 500), (60, 615, 290, 760), (350, 615, 585, 760), (60, 850, 290, 1030), (350, 850, 585, 1030), (60, 1110, 290, 1280), (350, 1110, 585, 1280)],
}

def load_rgb(name):
    from PIL import Image
    pil = Image.open(ROOT + SRC[name])
    if pil.mode in ('RGBA', 'LA'):
        bg = Image.new('RGB', pil.size, (255, 255, 255)); bg.paste(pil, mask=pil.split()[-1]); pil = bg
    return np.array(pil.convert('RGB'))

def ink_mask(rgb, coloured):
    g = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    if not coloured: return (g < 110).astype(np.uint8)
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    return ((g < 85) & (hsv[:, :, 1] < 100)).astype(np.uint8)       # encre = sombre ET peu saturé : écarte iris colorés, flèches rouges, aplats

def disk(r): return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))

def eyes_by_iris(ink, W):
    """Planches 12 et 16 : l'iris = blob compact survivant à une ouverture de rayon 2,2 % de la largeur de la planche ; chaque composante d'encre est rattachée à l'iris le plus proche
    dont la boîte élargie la touche ; sourcils (entièrement au-dessus de l'iris), joues et sourires (sous l'iris, ou petits et sous son centre) sont écartés."""
    r = int(0.012 * W)
    op = cv2.morphologyEx(ink, cv2.MORPH_OPEN, disk(r))
    n, lbl, st, cen = cv2.connectedComponentsWithStats(op)
    iris = []
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if a < 1.2 * math.pi * r * r or not 0.5 <= w / h <= 1.45: continue
        iris.append((x, y, w, h, cen[i]))
    # joues (ovales noires sous un iris) et doublons : un « iris » dont le centre est sous un autre iris (même colonne à ± 0,6 largeur) ou qui le recouvre à plus de 30 % n'en est pas un
    keep = []
    for a_i, (x, y, w, h, c) in enumerate(iris):
        bad = False
        for b_i, (x2, y2, w2, h2, c2) in enumerate(iris):
            if a_i == b_i: continue
            if abs(c[0] - c2[0]) < 0.6 * max(w, w2) and c2[1] + 0.6 * max(h, h2) < c[1] < c2[1] + 1.6 * max(h, h2) and w * h < 0.8 * w2 * h2: bad = True
            ox = max(0, min(x + w, x2 + w2) - max(x, x2)); oy = max(0, min(y + h, y2 + h2) - max(y, y2))
            if ox * oy > 0.3 * min(w * h, w2 * h2) and (w * h < w2 * h2 or (w * h == w2 * h2 and a_i > b_i)): bad = True
        if not bad: keep.append((x, y, w, h, c))
    iris = keep
    closed = cv2.morphologyEx(ink, cv2.MORPH_CLOSE, disk(2))
    n2, lbl2, st2, cen2 = cv2.connectedComponentsWithStats(closed)
    groups = {k: [] for k in range(len(iris))}
    for i in range(1, n2):
        x, y, w, h, a = st2[i]
        if a < 40: continue
        best, bd = None, 1e9
        for k, (ix, iy, iw, ih, c) in enumerate(iris):
            ex0, ex1, ey0, ey1 = ix - 1.5 * iw, ix + iw + 1.5 * iw, iy - 0.9 * ih, iy + ih + 0.5 * ih
            if x + w < ex0 or x > ex1 or y + h < ey0 or y > ey1: continue
            if y + h < iy - 0.04 * ih: continue                                  # sourcil : entièrement au-dessus de l'iris
            if y > iy + ih + 0.03 * ih: continue                                 # joue / sourire sous l'œil
            if w < 0.8 * iw and h < 0.5 * ih and y > iy + 0.5 * ih and not ((lbl2[iy:iy + ih, ix:ix + iw] == i).any()): continue
            d = abs(x + w / 2 - c[0])
            if d < bd: best, bd = k, d
        if best is not None: groups[best].append(i)
    eyes = []
    for k, (ix, iy, iw, ih, c) in enumerate(iris):
        ids = groups[k]
        if not ids: continue
        m = np.isin(lbl2, ids) & (ink > 0)
        ys, xs = np.where(m)
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        if any(x0 < c2[0] < x1 and y0 < c2[1] < y1 for k2, (_, _, _, _, c2) in enumerate(iris) if k2 != k): continue   # boîte contenant l'iris d'un autre œil = fusion : écartée (jamais corrigée à la main)
        eyes.append(((int(x0), int(y0), int(x1 - x0), int(y1 - y0)), m[y0:y1, x0:x1], (int(ix), int(iy), int(iw), int(ih))))
    return eyes

def mirror_pairs(masks):
    """Les planches 12 et 16 sont des PAIRES d'un même dessin retourné : le partenaire d'un œil est celui dont le masque, retourné et mis à la même taille, le recouvre à plus de 0,8 (IoU).
    L'œil le plus à gauche du couple a son externe à gauche. Robuste aux yeux manquants ou fusionnés (ils n'ont simplement pas de partenaire -> 'heuristic')."""
    res = [None] * len(masks)
    def norm(m, size=(96, 96)): return cv2.resize(m.astype(np.uint8), size, interpolation=cv2.INTER_AREA) > 0
    for i, ((xa, ya, wa, ha), ma) in enumerate(masks):
        best, bs = None, 0.8
        for j, ((xb, yb, wb, hb), mb) in enumerate(masks):
            if i == j or abs(wa - wb) > 0.15 * wa or abs(ha - hb) > 0.15 * ha or abs((ya + ha / 2) - (yb + hb / 2)) > 0.35 * ha: continue
            a, b = norm(ma[:, ::-1]), norm(mb); iou = (a & b).sum() / max((a | b).sum(), 1)
            if iou > bs: best, bs = j, iou
        if best is not None: res[i] = 'left' if xa < masks[best][0][0] else 'right'
    return res

def cell_eye(ink, box):
    x0, y0, x1, y1 = box; sub = ink[y0:y1, x0:x1].copy()
    n, lbl, st, _ = cv2.connectedComponentsWithStats(sub, connectivity=8)
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if (w > 90 and h / w < 0.25 and y + h / 2 < 0.33 * (y1 - y0)) or a < 25: sub[lbl == i] = 0      # sourcil / pli fin du haut de la cellule, poussières
    ys, xs = np.where(sub > 0)
    if len(xs) < 50: return None
    bx, by = xs.min(), ys.min(); bw, bh = xs.max() - bx + 1, ys.max() - by + 1
    return ((int(x0 + bx), int(y0 + by), int(bw), int(bh)), sub[by:by + bh, bx:bx + bw].astype(bool))

def skel_path(sk, a, b):
    from skimage.graph import route_through_array
    cost = np.where(sk, 1.0, 1e4)
    path, _ = route_through_array(cost, tuple(a), tuple(b), fully_connected=True, geometric=True)
    return np.array(path)

def stroke_polylines(c):
    """Cils-TRAITS de l'œil (outer = droite) : retire la masse épaisse (ouverture, rayon 1 % de L, 4 px pour les petits yeux), squelette de chaque trait restant touchant la masse ;
    chemin ordonné base -> pointe (la base = extrémité la plus proche de la masse). Retourne polylignes (x, y) en px + largeur locale (transformée en distance)."""
    bh, bw = c.shape; L = float(bw); rt = 4 if L < 200 else max(2, int(round(0.010 * L)))
    c8 = c.astype(np.uint8)
    body = cv2.morphologyEx(c8, cv2.MORPH_OPEN, disk(rt))
    thin = (c8 > 0) & (body == 0)
    near = cv2.dilate(body, np.ones((7, 7), np.uint8)) > 0
    d_body = cv2.distanceTransform((body == 0).astype(np.uint8), cv2.DIST_L2, 3)
    dt = cv2.distanceTransform(c8, cv2.DIST_L2, 3)
    n, lbl, st, _ = cv2.connectedComponentsWithStats(thin.astype(np.uint8), connectivity=8)
    out = []
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < 0.0005 * L * L: continue
        m = lbl == i
        if not (m & near).any(): continue
        sk = skeletonize(m)
        pts = np.argwhere(sk)
        if len(pts) < max(4, 0.03 * L): continue
        nb = cv2.filter2D(sk.astype(np.uint8), -1, np.ones((3, 3), np.float32), borderType=cv2.BORDER_CONSTANT) - 1
        ends = np.argwhere(sk & (nb <= 1))
        if len(ends) < 2: continue
        db = np.array([d_body[y, x] for y, x in ends])
        base = ends[int(np.argmin(db))]
        far = max((e for e in ends if np.hypot(*(e - base)) > 0.03 * L), key=lambda e: np.hypot(*(e - base)), default=None)
        if far is None: continue
        path = skel_path(sk, base, far)
        if len(path) < 4: continue
        out.append({'pts': path[:, ::-1].astype(float), 'width': np.array([dt[y, x] * 2 for y, x in path]), 'ends': len(ends)})
    return out, body

def wrap180(d):
    """Ramène un angle (ou une différence d'angles) dans [-180, 180). Sans cela, `a1 - a0` de deux atan2 pouvait valoir jusqu'à ±360° (54 traits sur 437 avaient |bendDeg| > 180°, physiquement impossible)."""
    return float((d + 180.0) % 360.0 - 180.0)

def stroke_features(poly, L, lid_slope_deg):
    pts, wd = poly['pts'], poly['width']; n = len(pts)
    seg = np.hypot(*np.diff(pts, axis=0).T); arc = float(seg.sum())
    a = pts[0]; k1 = max(1, n // 3); k2 = max(k1 + 1, 2 * n // 3)
    def ang(p, q): return math.degrees(math.atan2(q[0] - p[0], -(q[1] - p[1])))     # 0 = vers le haut image, + = vers la droite (externe)
    a0, a1 = ang(pts[0], pts[k1]), ang(pts[k2], pts[-1])
    chord = float(np.hypot(*(pts[-1] - pts[0])))
    w0 = float(np.mean(wd[:max(2, n // 6)])); wm = float(np.mean(wd[n // 2 - 1:n // 2 + 2])); wt = float(np.mean(wd[-max(2, n // 6):]))
    return {'baseX': float(pts[0][0] / L), 'tipX': float(pts[-1][0] / L), 'length': arc / L, 'chord': chord / L, 'startAngleDeg': wrap180(a0 - lid_slope_deg), 'endAngleDeg': wrap180(a1 - lid_slope_deg),
            'bendDeg': wrap180(a1 - a0), 'startVsHorizontalDeg': ang(pts[0], pts[k1]) - 90 if False else float(math.degrees(math.atan2(-(pts[k1][1] - pts[0][1]), pts[k1][0] - pts[0][0]))),
            'baseWidth': w0 / L, 'taperMid': wm / max(w0, 0.5), 'taperTip': wt / max(w0, 0.5), 'baseY': float(pts[0][1])}

def lid_slope(c, x):
    """Pente (degrés) de l'enveloppe haute de la silhouette autour de la colonne x (normale locale de la paupière)."""
    bh, bw = c.shape
    top = np.array([np.argmax(c[:, k]) if c[:, k].any() else bh for k in range(bw)], float)
    A = bh - top; win = max(5, int(0.14 * bw)) | 1
    env = bh - grey_opening(A, size=win)
    sm = cv2.GaussianBlur(env.reshape(1, -1).astype(np.float32), (0, 0), sigmaX=max(2, 0.04 * bw)).ravel()
    return math.degrees(math.atan(float(np.gradient(sm)[int(min(max(x, 0), bw - 1))])))

LEVELS = (0.15, 0.35, 0.55, 0.75, 0.92)

def spike_geometry(comp, L, side):
    """Pointes verticales (au-dessus de l'enveloppe du bord) par tranches de hauteur : ligne médiane, effilement, angles base/pointe par rapport à la NORMALE locale (+ = vers l'externe)."""
    c = comp if side == 'up' else comp[::-1]
    bh, bw = c.shape
    top = np.array([np.argmax(c[:, x]) if c[:, x].any() else bh for x in range(bw)], float)
    A = bh - top; win = max(5, int(0.14 * L)) | 1
    env_a = grey_opening(A, size=win); env_top = bh - env_a; up = np.clip(A - env_a, 0, None)
    pk, pr = find_peaks(up, prominence=0.03 * L, distance=max(2, int(0.01 * L)))
    sm = cv2.GaussianBlur(env_top.reshape(1, -1).astype(np.float32), (0, 0), sigmaX=max(2, 0.04 * L)).ravel(); slope = np.gradient(sm)
    out = []
    for p, prom in zip(pk, pr['prominences']):
        hp = float(up[p])
        if hp < 0.03 * L: continue
        wmax = int(0.14 * L); x0, x1 = max(0, p - wmax), min(bw, p + wmax + 1)
        cx, wd, ys = [], [], []
        for f in LEVELS:
            y = int(round(env_top[p] - f * hp))
            if y < 0 or y >= bh: cx.append(None); wd.append(None); ys.append(y); continue
            row = np.where(c[y, x0:x1] > 0)[0]
            if len(row) == 0: cx.append(None); wd.append(None); ys.append(y); continue
            q = row[np.argmin(np.abs(row + x0 - p))] + x0
            l = q
            while l > x0 and c[y, l - 1]: l -= 1
            r = q
            while r < x1 - 1 and c[y, r + 1]: r += 1
            cx.append((l + r) / 2.0); wd.append(float(r - l + 1)); ys.append(y)
        pts = [(cx[k], ys[k]) for k in range(len(LEVELS)) if cx[k] is not None]
        if len(pts) < 4: continue
        def ang(a, b): return math.degrees(math.atan2(b[0] - a[0], -(b[1] - a[1])))
        nrm = math.degrees(math.atan(float(slope[p])))
        a_base = ang(pts[0], pts[len(pts) // 2]) - nrm; a_tip = ang(pts[len(pts) // 2], pts[-1]) - nrm
        wb = max(wd[0] or 1.0, 1.0)
        out.append({'x': float(p / max(bw - 1, 1)), 'length': hp / L, 'baseWidth': wb / L, 'baseAngleDeg': wrap180(a_base), 'tipAngleDeg': wrap180(a_tip), 'bendDeg': wrap180(a_tip - a_base),
                    'taper': [None if v is None else float(v / wb) for v in wd], 'prominence': float(prom / L)})
    out.sort(key=lambda s: s['x'])
    k = 0
    while k < len(out):
        j = k
        while j + 1 < len(out) and (out[j + 1]['x'] - out[j]['x']) * (bw - 1) < max(out[j]['baseWidth'], out[j + 1]['baseWidth']) * L: j += 1
        for q in range(k, j + 1): out[q]['clump'] = j - k + 1
        k = j + 1
    return out

def med(v): return float(np.median(v)) if len(v) else None

def eye_record(sid, i, comp, outer, how, upper_only=False):
    c = comp if outer == 'right' else comp[:, ::-1]
    L = float(c.shape[1])
    su = spike_geometry(c, L, 'up'); sl = [] if upper_only else spike_geometry(c, L, 'down')
    polys, body = stroke_polylines(c)
    cyb = float(np.where(body > 0)[0].mean()) if body.any() else c.shape[0] / 2
    strokes_ = []
    for p in polys:
        f = stroke_features(p, L, lid_slope(c, p['pts'][0][0])); f['upper'] = bool(f['baseY'] < cyb); f['ends'] = int(p['ends']); strokes_.append(f)
    return {'id': f'{sid}-{i:02d}', 'width': L, 'outerSide': outer, 'orientation': how, 'upperSpikes': su, 'lowerSpikes': sl, 'strokes': strokes_,
            'upperCount': len(su), 'lowerCount': len(sl)}, c

def run(name):
    rgb = load_rgb(name); coloured = name in ('14', '15'); ink = ink_mask(rgb, coloured); masks = []
    if coloured:
        for box in CELLS[name]:
            r = cell_eye(ink, box)
            if r: masks.append((r[0], r[1]))
    elif name == '13':
        for (x, y, bw, bh, comp) in eyes_of(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), name): masks.append(((x, y, bw, bh), comp))
    else:
        for (box, m, iris) in eyes_by_iris(ink, rgb.shape[1]): masks.append((box, m))
    boxes = [m[0] for m in masks]
    alt = mirror_pairs(masks) if name in ('12', '16') else [None] * len(boxes)
    rows, dbg = [], cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR).copy()
    for i, ((x, y, bw, bh), comp) in enumerate(masks):
        if name in ALL_RIGHT: outer, how = OUTER_ANCHOR.get(name, {}).get(i, 'right'), 'anchor'
        elif name == '15': outer, how = ('left' if i % 2 == 0 else 'right'), 'pair'
        elif alt[i]: outer, how = alt[i], 'pair'
        else:
            half = comp.shape[1] // 2; _, up, _, _, _ = analyse(comp.astype(np.uint8)); outer, how = ('right' if up[half:].sum() >= up[:half].sum() else 'left'), 'heuristic'
        rec, c = eye_record(name, i, comp, outer, how, upper_only=coloured)
        rec['bbox'] = [int(x), int(y), int(bw), int(bh)]; rows.append(rec)
        col = (0, 160, 0) if how != 'heuristic' else (0, 140, 255)
        ov = np.zeros_like(dbg); sub = ov[y:y + bh, x:x + bw]; sub[comp] = (255, 120, 0)
        dbg = cv2.addWeighted(dbg, 1.0, ov, 0.35, 0)
        cv2.rectangle(dbg, (x, y), (x + bw, y + bh), col, 2); cv2.putText(dbg, f'{i}{"R" if outer == "right" else "L"}', (x + 4, y + 16), cv2.FONT_HERSHEY_SIMPLEX, 0.55, col, 2)
        for s in rec['strokes']:
            px = x + (s['baseX'] if outer == 'right' else 1 - s['baseX']) * (bw - 1); cv2.circle(dbg, (int(px), int(y + s['baseY'])), 3, (0, 0, 255), -1)
    sc = 1100 / max(dbg.shape[:2]); cv2.imwrite(OUT + f'02-cils-segmentation-{name}.png', cv2.resize(dbg, None, fx=sc, fy=sc, interpolation=cv2.INTER_AREA))
    return rows

def sheet_summary(rows):
    st = [s for r in rows for s in r['strokes']]; up = [s for r in rows for s in r['upperSpikes']]; lo = [s for r in rows for s in r['lowerSpikes']]
    def agg_sp(sp):
        if not sp: return {}
        f = lambda k: [s[k] for s in sp]
        tm = [s['taper'][2] for s in sp if s['taper'][2] is not None]; tt = [s['taper'][4] for s in sp if s['taper'][4] is not None]
        return {'n': len(sp), 'lengthMed': med(f('length')), 'lengthP90': float(np.percentile(f('length'), 90)), 'baseAngleMed': med(f('baseAngleDeg')), 'bendMed': med(f('bendDeg')),
                'baseWidthMed': med(f('baseWidth')), 'taperMid': med(tm), 'taperTop': med(tt), 'clumpMean': float(np.mean(f('clump')))}
    def agg_st(ss):
        if not ss: return {}
        f = lambda k: [s[k] for s in ss]
        return {'n': len(ss), 'lengthMed': med(f('length')), 'lengthP90': float(np.percentile(f('length'), 90)), 'startAngleMed': med(f('startAngleDeg')), 'bendMed': med(f('bendDeg')),
                'baseXMed': med(f('baseX')), 'outerShare': float(np.mean([s['baseX'] > 0.6 for s in ss])), 'taperMid': med(f('taperMid')), 'taperTip': med(f('taperTip')), 'baseWidthMed': med(f('baseWidth'))}
    return {'eyes': len(rows), 'orientation': {k: sum(r['orientation'] == k for r in rows) for k in ('pair', 'anchor', 'heuristic')},
            'upperSpikes': agg_sp(up), 'lowerSpikes': agg_sp(lo), 'strokesUpper': agg_st([s for s in st if s['upper']]), 'strokesLower': agg_st([s for s in st if not s['upper']])}

if __name__ == '__main__':
    allrows, summary = [], {}
    for nm in SRC:
        r = run(nm); allrows += r; summary[nm] = sheet_summary(r)
        print(nm, len(r), 'yeux', sum(x['upperCount'] for x in r), 'pointes hautes', sum(len(x['strokes']) for x in r), 'traits', summary[nm]['orientation'])
    json.dump({'method': __doc__.split('\n')[0], 'version': 2, 'levels': LEVELS, 'summary': summary, 'eyes': allrows}, open(ROOT + 'measures-lashes.json', 'w'), indent=1)
    print(len(allrows), 'yeux au total')
