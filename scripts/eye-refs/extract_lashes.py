"""Échantillonnage pixel par pixel des CILS des références 12, 13, 16 (trait noir sur blanc) : `python3 scripts/eye-refs/extract_lashes.py`.
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
SRC = {'12': '12.jpg', '13': '13.jpg', '16': '16.webp'}

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

def run(name):
    img = load(name); eyes = eyes_of(img, name); rows = []
    dbg = img.copy()
    for i, (x, y, bw, bh, comp) in enumerate(eyes):
        L, up, lo, top, bot = analyse(comp)
        su, sl = side_stats(up, L), side_stats(lo, L)
        stk, cxn = strokes(comp)
        # côté externe = côté du plus grand dépassement haut
        half = len(up) // 2
        outer_right = up[half:].sum() >= up[:half].sum()
        def orient(s):
            if s.get('count', 0) == 0: return s
            s = dict(s)
            if not outer_right: s['positions'] = [1 - p for p in s['positions']][::-1]; s['heights'] = s['heights'][::-1]
            return s
        su, sl = orient(su), orient(sl)
        # allongement externe : pic du tiers externe / pic du tiers interne
        def outer_ratio(s):
            if s.get('count', 0) < 3: return None
            ps, hs = np.array(s['positions']), np.array(s['heights'])
            o, ii = hs[ps > 0.66], hs[ps < 0.34]
            return float(o.max() / ii.max()) if len(o) and len(ii) else None
        rows.append({'id': f'{name}-{i:02d}', 'bbox': [int(x), int(y), int(bw), int(bh)], 'width': float(L), 'outerSide': 'right' if outer_right else 'left',
                     'upper': su, 'lower': sl, 'upperOuterOverInner': outer_ratio(su), 'strokes': stk, 'bodyCenterX': cxn, 'upperPeakAt': (float(su['positions'][int(np.argmax(su['heights']))]) if su.get('count') else None)})
        cv2.rectangle(dbg, (x, y), (x + bw, y + bh), (0, 0, 255), 2)
        cv2.putText(dbg, str(i), (x + 4, y + 22), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
        for s in su.get('positions', []):
            px = x + int((s if outer_right else 1 - s) * (bw - 1)); cv2.circle(dbg, (px, y + int(top[min(max(px - x, 0), bw - 1)])), 4, (0, 200, 0), -1)
    s = 1100 / max(dbg.shape[:2]); cv2.imwrite(OUT + f'02-cils-segmentation-{name}.png', cv2.resize(dbg, None, fx=s, fy=s, interpolation=cv2.INTER_AREA))
    return rows

if __name__ == '__main__':
    allrows = []
    for nm in SRC: r = run(nm); print(nm, len(r), 'yeux'); allrows += r
    json.dump({'method': __doc__.split('\n')[0], 'eyes': allrows}, open(ROOT + 'measures-lashes.json', 'w'), indent=1)
    print(len(allrows), 'yeux au total')
