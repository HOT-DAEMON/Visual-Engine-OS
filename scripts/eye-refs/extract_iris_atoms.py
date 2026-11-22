#!/usr/bin/env python3
"""
MESURES ATOMIQUES D'IRIS (passe 12) : `python3 scripts/eye-refs/extract_iris_atoms.py` -> `references/eyes/measures-iris-atoms.json` + `artefacts/eyes-pass12/refs/*.png`.

Complète `extract_iris_photos.py` (passe 9/10 : couleurs, limbe, pupille, ton) par ce qui manquait pour le détail pixel par pixel :
  - FENTES RADIALES sombres (réf. 04) : minima angulaires étroits de luminance, par bande de rayon -> nombre, largeur (deg), profondeur, étendue radiale ;
  - CELLULES / FACETTES (réf. 07) : composantes connexes entre arêtes (Canny) dans l'iris -> distribution d'aires (fraction de l'aire de l'iris), élongation, solidité ;
  - ÉTOILES (réf. 10b) et éclats : composantes très claires et peu saturées -> longueur de Feret / rayon d'iris, aire, rayon polaire ;
  - ANNEAU et BRAISES (réf. 10a) : position et épaisseur de l'anneau clair-chaud, modulation angulaire (tirets), petits points lumineux (taille, rayon) ;
  - PART SOMBRE PAR BANDE RADIALE (toutes) : où se trouve le noir de l'iris (le moteur le plaçait trop bas).
Les ellipses viennent de `measures-iris-photos.json` (limbe, ou annotation humaine quand le limbe est coupé par la paupière : 10a). Aucune valeur n'est interprétée ici.
"""
import json, os, sys
import cv2
import numpy as np

REF = 'references/eyes'
OUT = 'artefacts/eyes-pass12/refs'
os.makedirs(OUT, exist_ok=True)
meas = json.load(open(f'{REF}/measures-iris-photos.json'))['eyes']
byid = {e['id']: e for e in meas}


def ellipse(e):
    a = e['annotation']; l = e['limbe']
    if e['id'] == '10a':
        return a['cx'], a['cy'], a['rx'], a['ry']
    return l['cx'], l['cy'], l['rx'], l['ry']


def polar(img, cx, cy, rx, ry, nr=160, na=720, r0=0.0, r1=1.0):
    """Déroulé polaire de l'iris : lignes = rayon normalisé (r0..r1), colonnes = angle (0° = droite, sens horaire écran)."""
    rr = np.linspace(r0, r1, nr)[:, None]; aa = np.linspace(0, 2 * np.pi, na, endpoint=False)[None, :]
    mx = (cx + rx * rr * np.cos(aa)).astype(np.float32); my = (cy + ry * rr * np.sin(aa)).astype(np.float32)
    return cv2.remap(img, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


def lum(bgr):
    b, g, r = [bgr[..., i].astype(np.float32) for i in (0, 1, 2)]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def disc_mask(shape, cx, cy, rx, ry, rho=0.92):
    yy, xx = np.mgrid[0:shape[0], 0:shape[1]]
    return ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= rho ** 2


def slits(bgr, cx, cy, rx, ry, rho_lo=0.30, rho_hi=0.90):
    """Minima angulaires étroits : sur chaque bande de rayon, L(angle) - moyenne glissante (fenêtre 24°) ; un creux < -`depth` sur <= 6° est une fente."""
    P = lum(polar(bgr, cx, cy, rx, ry, nr=120, na=720, r0=rho_lo, r1=rho_hi))
    k = 48                                       # 24° en pas de 0,5°
    found = []
    nb = 6
    for b in range(nb):
        band = P[b * (120 // nb):(b + 1) * (120 // nb)].mean(axis=0)
        ext = np.concatenate([band[-k:], band, band[:k]])
        base = np.convolve(ext, np.ones(k) / k, mode='same')[k:-k]
        d = band - base
        thr = -max(18.0, 0.6 * float(np.std(d)))
        below = d < thr
        # composantes angulaires cycliques
        i = 0
        while i < len(below):
            if below[i]:
                j = i
                while j + 1 < len(below) and below[j + 1]: j += 1
                w = (j - i + 1) * 0.5
                if w <= 6.0:
                    found.append({'band': b, 'rho': round(rho_lo + (rho_hi - rho_lo) * (b + 0.5) / nb, 3), 'angDeg': round(((i + j) / 2) * 0.5, 1), 'widthDeg': w, 'depth': round(float(-d[i:j + 1].min()), 1)})
                i = j + 1
            else: i += 1
    # fentes persistantes : même angle (±3°) dans >= 3 bandes
    ang = np.array([f['angDeg'] for f in found]) if found else np.array([])
    persistent = []
    used = set()
    for n, f in enumerate(found):
        if n in used: continue
        grp = [m for m, g in enumerate(found) if abs(((g['angDeg'] - f['angDeg']) + 180) % 360 - 180) <= 3.0]
        bands = {found[m]['band'] for m in grp}
        if len(bands) >= 3:
            used.update(grp)
            # DÉRIVE (passe 13) : angle de la fente à la bande la plus interne et à la plus externe du groupe -> une fente droite dérive de ~0°, une fente courbe (réf. 04) de plusieurs degrés
            bi = min(bands); bo = max(bands)
            ai = np.mean([found[m]['angDeg'] for m in grp if found[m]['band'] == bi]); ao = np.mean([found[m]['angDeg'] for m in grp if found[m]['band'] == bo])
            drift = ((ao - ai) + 180) % 360 - 180
            persistent.append({'angDeg': round(float(np.mean([found[m]['angDeg'] for m in grp])), 1), 'bands': len(bands), 'widthDeg': round(float(np.mean([found[m]['widthDeg'] for m in grp])), 2), 'depth': round(float(np.mean([found[m]['depth'] for m in grp])), 1), 'rhoMin': min(found[m]['rho'] for m in grp), 'rhoMax': max(found[m]['rho'] for m in grp), 'driftDeg': round(float(drift), 2), 'spanRho': round(float(max(found[m]['rho'] for m in grp) - min(found[m]['rho'] for m in grp)), 3)})
    return {'raw': len(found), 'persistent': persistent, 'persistentCount': len(persistent),
            'meanWidthDeg': round(float(np.mean([p['widthDeg'] for p in persistent])), 2) if persistent else None,
            'meanDepth': round(float(np.mean([p['depth'] for p in persistent])), 1) if persistent else None,
            'meanAbsDriftDeg': round(float(np.mean([abs(p['driftDeg']) for p in persistent])), 2) if persistent else None,
            'meanDriftPerRho': round(float(np.mean([abs(p['driftDeg']) / max(0.05, p['spanRho']) for p in persistent])), 2) if persistent else None}


def cells(bgr, cx, cy, rx, ry):
    """Cellules entre arêtes : Canny sur la luminance lissée, composantes connexes du complément dans l'iris (rho 0,3–0,9)."""
    g = cv2.GaussianBlur(lum(bgr), (0, 0), 1.1).astype(np.uint8)
    e = cv2.Canny(g, 40, 110)
    e = cv2.dilate(e, np.ones((2, 2), np.uint8))
    m = disc_mask(bgr.shape, cx, cy, rx, ry, 0.9) & ~disc_mask(bgr.shape, cx, cy, rx, ry, 0.3)
    free = ((e == 0) & m).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(free, connectivity=4)
    area_iris = np.pi * rx * ry
    out = []
    for i in range(1, n):
        a = int(st[i, cv2.CC_STAT_AREA])
        if a < 12 or a > 0.08 * area_iris: continue
        cnt, _ = cv2.findContours((lab == i).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        c = max(cnt, key=cv2.contourArea); hull = cv2.convexHull(c); ha = cv2.contourArea(hull)
        if len(c) >= 5:
            (_, _), (w, h), _ = cv2.minAreaRect(c); el = max(w, h) / max(1.0, min(w, h))
        else: el = 1.0
        out.append((a / area_iris, el, cv2.contourArea(c) / ha if ha > 0 else 1.0))
    A = np.array([o[0] for o in out]) if out else np.array([0.0])
    return {'count': len(out), 'areaMedian': round(float(np.median(A)), 5), 'areaP10': round(float(np.percentile(A, 10)), 5), 'areaP90': round(float(np.percentile(A, 90)), 5),
            'areaCV': round(float(np.std(A) / max(1e-9, np.mean(A))), 3), 'elongationMedian': round(float(np.median([o[1] for o in out])), 2) if out else None,
            'solidityMedian': round(float(np.median([o[2] for o in out])), 3) if out else None}


def stars(bgr, cx, cy, rx, ry):
    """Éclats : V > 0,93 et S < 0,35 (comme les reflets du ton) ; Feret / rayon d'iris et position polaire."""
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    mask = ((hsv[..., 2] / 255 > 0.93) & (hsv[..., 1] / 255 < 0.35)).astype(np.uint8)
    m = disc_mask(bgr.shape, cx, cy, rx, ry, 1.0)
    mask = mask & m.astype(np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    R = (rx + ry) / 2
    # CORPS des étoiles : ouverture (noyau = 5 % du rayon d'iris) -> retire les rayons fins qui relient les étoiles entre elles et au reflet central ;
    # sans elle, les composantes fusionnent (Feret > 1,8 R : mesure fausse, constatée au premier jet sur 10b)
    kk = max(3, int(round(0.05 * R))) | 1
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kk, kk)))
    n, lab, st, cen = cv2.connectedComponentsWithStats(mask, connectivity=8)
    # SÉPARATION (passe 13) : des corps qui se touchent (arc blanc + flare central, étoiles de l'anneau reliées par leurs pointes) formaient une seule composante (Feret 1,0 R sur ice).
    # Bassins versants sur la transformée de distance, marqueurs = h-maxima (h = 30 % du maximum de la composante) : on ne coupe qu'aux VRAIS étranglements ; un flare à plusieurs bras reste entier.
    from skimage.morphology import h_maxima
    dist = cv2.distanceTransform(mask, cv2.DIST_L2, 5)
    mk = np.zeros(mask.shape, np.int32); nm = 0
    for i in range(1, n):
        sel = lab == i; mx = float(dist[sel].max()) if sel.any() else 0.0
        if mx < 0.02 * R: continue
        hm = h_maxima(np.where(sel, dist, 0).astype(np.float32), 0.30 * mx) & sel
        c, l2 = cv2.connectedComponents(hm.astype(np.uint8))
        for j in range(1, c): nm += 1; mk[l2 == j] = nm
    if nm > n - 1:                                   # au moins une composante a plusieurs marqueurs : on sépare
        from skimage.segmentation import watershed
        lab = watershed(-dist, mk, mask=mask > 0).astype(np.int32); n = nm + 1
        st = np.zeros((n, 5), np.int32); cen = np.zeros((n, 2))
        for i in range(1, n):
            ys, xs = np.where(lab == i)
            if len(xs): st[i, cv2.CC_STAT_AREA] = len(xs); cen[i] = (xs.mean(), ys.mean())
    items = []
    for i in range(1, n):
        a = int(st[i, cv2.CC_STAT_AREA])
        if a < 20: continue
        pts = np.column_stack(np.where(lab == i))[:, ::-1].astype(np.float32)
        hull = cv2.convexHull(pts).reshape(-1, 2)
        d = max(np.hypot(*(p - q)) for p in hull for q in hull) if len(hull) > 1 else 0
        px, py = cen[i]; rho = float(np.hypot((px - cx) / rx, (py - cy) / ry))
        items.append({'feretOverR': round(float(d / R), 3), 'areaOverIris': round(a / (np.pi * rx * ry), 5), 'rho': round(rho, 3), 'angDeg': round(float(np.degrees(np.arctan2(py - cy, px - cx)) % 360), 1)})
    items.sort(key=lambda t: -t['feretOverR'])
    return {'count': len(items), 'top': items[:12], 'feretMax': items[0]['feretOverR'] if items else None,
            'feretTop6Mean': round(float(np.mean([t['feretOverR'] for t in items[:6]])), 3) if len(items) >= 1 else None}


def ring_embers(bgr, cx, cy, rx, ry):
    """Anneau chaud (10a) : profil radial de S x V ; modulation angulaire à la crête ; braises = petits points clairs hors de l'anneau."""
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    sv = (hsv[..., 1] / 255) * (hsv[..., 2] / 255)
    Psv = polar(sv.astype(np.float32), cx, cy, rx, ry, nr=100, na=720, r0=0.0, r1=1.0)
    prof = Psv.mean(axis=1)
    i = int(np.argmax(prof[15:85])) + 15
    peak = i / 99.0
    half = prof[i] * 0.5 + prof.min() * 0.5
    lo = i
    while lo > 0 and prof[lo] > half: lo -= 1
    hi = i
    while hi < 99 and prof[hi] > half: hi += 1
    ringA = Psv[max(0, i - 2):i + 3].mean(axis=0)
    ringA = (ringA - ringA.min()) / max(1e-6, ringA.max() - ringA.min())
    on = ringA > 0.5
    runs = int(np.sum(on & ~np.roll(on, 1)))
    return {'ringRho': round(peak, 3), 'ringWidthRho': round((hi - lo) / 99.0, 3), 'ringContrast': round(float(prof[i] - np.median(prof)), 3), 'angularDashes': runs, 'dutyCycle': round(float(on.mean()), 3)}


def dark_by_band(bgr, cx, cy, rx, ry):
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    P = lum(polar(bgr, cx, cy, rx, ry, nr=90, na=360, r0=0.0, r1=0.9))
    refl = polar(((hsv[..., 2] / 255 > 0.93) & (hsv[..., 1] / 255 < 0.35)).astype(np.uint8) * 255, cx, cy, rx, ry, nr=90, na=360, r0=0.0, r1=0.9) > 0
    out = []
    for lo, hi in ((0.0, 0.2), (0.2, 0.4), (0.4, 0.6), (0.6, 0.8), (0.8, 0.9)):
        a, b = int(lo / 0.9 * 90), int(hi / 0.9 * 90)
        sub = P[a:b]; ok = ~refl[a:b]
        out.append({'rho': [lo, hi], 'darkShare': round(float(((sub < 50) & ok).sum() / max(1, ok.sum())), 3), 'lum': round(float(sub[ok].mean()), 1) if ok.any() else None})
    return out


def panel(name, bgr, cx, cy, rx, ry, extra=None):
    x0, y0 = int(cx - rx * 1.15), int(cy - ry * 1.15); x1, y1 = int(cx + rx * 1.15), int(cy + ry * 1.15)
    crop = bgr[max(0, y0):y1, max(0, x0):x1].copy()
    P = polar(bgr, cx, cy, rx, ry, nr=180, na=720, r0=0.0, r1=1.0)
    P = cv2.resize(P, (crop.shape[1], int(crop.shape[1] * 0.5)))
    cv2.imwrite(f'{OUT}/{name}-crop.png', np.vstack([cv2.resize(crop, (P.shape[1], int(crop.shape[0] * P.shape[1] / crop.shape[1]))), P]))


def main():
    cache = {}
    res = {}
    for e in meas:
        f = e['file']
        if f not in cache: cache[f] = cv2.imread(f'{REF}/{f}')
        bgr = cache[f]
        cx, cy, rx, ry = ellipse(e)
        r = {'file': f, 'ellipse': {'cx': cx, 'cy': cy, 'rx': rx, 'ry': ry}, 'darkByBand': dark_by_band(bgr, cx, cy, rx, ry)}
        r['slits'] = slits(bgr, cx, cy, rx, ry)                       # passe 13 : toutes les références (04, 03, 05, 06, 07, 08a, 08b, 09, 10a, 10b), pas seulement 04
        if e['id'] in ('07', '04', '08a', '10a', '10b'): r['cells'] = cells(bgr, cx, cy, rx, ry)
        if e['id'] in ('10a', '10b', '07', '04'): r['stars'] = stars(bgr, cx, cy, rx, ry)
        if e['id'] in ('10a', '10b'): r['ring'] = ring_embers(bgr, cx, cy, rx, ry)
        res[e['id']] = r
        panel(e['id'], bgr, cx, cy, rx, ry)
    json.dump({'method': "ellipses de measures-iris-photos.json ; déroulé polaire ; seuils fixes (voir docstring) ; rien d'interprété", 'eyes': res}, open(f'{REF}/measures-iris-atoms.json', 'w'), indent=1, ensure_ascii=False)
    for k in ('04', '07', '10a', '10b'):
        r = res[k]
        print(k, 'slits', r.get('slits', {}).get('persistentCount'), r.get('slits', {}).get('meanWidthDeg'), r.get('slits', {}).get('meanDepth'),
              '| cells', r.get('cells', {}).get('count'), r.get('cells', {}).get('areaMedian'), r.get('cells', {}).get('areaCV'),
              '| stars', r.get('stars', {}).get('count'), r.get('stars', {}).get('feretMax'), r.get('stars', {}).get('feretTop6Mean'),
              '| ring', r.get('ring'))
        print('   dark', [b['darkShare'] for b in r['darkByBand']])


def measure_png(path, cx, cy, rx, ry):
    """Mode moteur : MÊMES détecteurs sur un rendu du moteur (png, ellipse d'iris en pixels) -> JSON sur stdout. Garantit que moteur et références sont mesurés à l'identique."""
    bgr = cv2.imread(path)
    return {'darkByBand': dark_by_band(bgr, cx, cy, rx, ry), 'slits': slits(bgr, cx, cy, rx, ry), 'cells': cells(bgr, cx, cy, rx, ry), 'stars': stars(bgr, cx, cy, rx, ry), 'ring': ring_embers(bgr, cx, cy, rx, ry)}


if __name__ == '__main__':
    if len(sys.argv) >= 7 and sys.argv[1] == '--png':
        print(json.dumps(measure_png(sys.argv[2], *[float(v) for v in sys.argv[3:7]])))
    else:
        main()
