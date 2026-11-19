"""Mesure pixel par pixel des IRIS des références illustrées 03, 05, 06, 09 (references/eyes) : `python3 scripts/eye-refs/extract_iris_photos.py`.
Ce que `extract.py` (marges palpébrales de 5 yeux) et `extract_iris_colour.py` (planches 14, 15) ne couvrent pas : l'iris détaillé des illustrations riches.
Entrée humaine (seule valeur non calculée) : centre / rayons APPROCHÉS de l'iris par œil (ANNOTATION HUMAINE, relue sur les superpositions).
Calculé : limbe (ellipse robuste, gradient radial sur 72 rayons, cv2.fitEllipse sur les rayons retenus), pupille (composante sombre compacte au centre),
profil radial de couleur (12 bandes) et angulaire (haut/bas/gauche/droite), anneau limbique (épaisseur, luminance), reflets (V > 0,93), contraste de fibres radiales,
couleur de la sclère voisine. Sortie : references/eyes/measures-iris-photos.json + artefacts/eyes-pass9/01-iris-photos-superposition.png."""
import json, math, os
import numpy as np, cv2

REF, OUT = 'references/eyes/', 'artefacts/eyes-pass9/'
# id: (fichier, cx, cy, rx, ry approchés, note)
IRIS = {
    '03': ('03.jpg', 364, 614, 98, 104, 'fente verticale, ciel bleu-vert en haut, rayons jaunes en bas'),
    '05': ('05.jpg', 485, 468, 88, 74, 'iris orange, calotte de ciel bleu en haut, éclats'),
    '06': ('06.jpg', 400, 405, 172, 150, 'or filigrané, anneau interne + pupille, limbe sombre épais'),
    '09': ('09.jpg', 395, 380, 182, 168, 'bleu glacé, fougères, collerette fibreuse, pupille noire'),
}

# seuil de luminance (V) de la pupille par œil : ANNOTATION HUMAINE (la fente de 03 est brun-rouge, la pupille de 06 est cernée d'un anneau doré)
PUP_V = {'03': 125, '05': 60, '06': 95, '09': 60}
PUP_R = {'03': 0.5, '05': 0.55, '06': 0.22, '09': 0.3}

def hexc(c): return '#%02x%02x%02x' % tuple(int(round(v)) for v in c)

def refine(L, cx, cy, rx, ry):
    """Ellipse du limbe : sur 72 rayons, le plus fort gradient de luminance (clair -> sombre vers l'extérieur n'est pas supposé : |gradient|) dans [0,82 ; 1,18] x rayon approché."""
    pts = []
    for a in np.linspace(0, 2 * math.pi, 72, endpoint=False):
        best, bg = None, 0.0
        for s in np.linspace(0.82, 1.18, 37):
            x0, y0 = cx + math.cos(a) * rx * (s - 0.03), cy + math.sin(a) * ry * (s - 0.03)
            x1, y1 = cx + math.cos(a) * rx * (s + 0.03), cy + math.sin(a) * ry * (s + 0.03)
            if not (0 <= x0 < L.shape[1] and 0 <= x1 < L.shape[1] and 0 <= y0 < L.shape[0] and 0 <= y1 < L.shape[0]): continue
            g = abs(float(L[int(y1), int(x1)]) - float(L[int(y0), int(x0)]))
            if g > bg: bg, best = g, (cx + math.cos(a) * rx * s, cy + math.sin(a) * ry * s)
        if best is not None and bg > 6: pts.append(best)
    P = np.array(pts, np.float32)
    if len(P) < 12: return (cx, cy, rx, ry, 0.0), len(P)
    (ex, ey), (w, h), ang = cv2.fitEllipse(P)
    # garde-fou : un ajustement qui s'écarte de plus de 25 % de l'annotation est rejeté (repli sur l'annotation)
    if not (0.75 < w / 2 / rx < 1.25 and 0.75 < h / 2 / ry < 1.25): return (cx, cy, rx, ry, 0.0), len(P)
    return (ex, ey, w / 2, h / 2, ang), len(P)

def measure(eid):
    fn, cx, cy, rx, ry, note = IRIS[eid]
    bgr = cv2.imread(REF + fn); rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB).astype(np.float32); hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    L = cv2.GaussianBlur(cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(np.float32), (0, 0), 1.8)
    (ex, ey, a, b, ang), n = refine(L, cx, cy, rx, ry)
    H, W = L.shape; yy, xx = np.mgrid[0:H, 0:W]
    # coordonnées normalisées dans l'ellipse axée (angle ignoré pour le profil : l'ellipse est quasi droite, |ang| < 15°)
    u, v = (xx - ex) / a, (yy - ey) / b; rr = np.hypot(u, v); th = (np.degrees(np.arctan2(u, -v)) + 360) % 360   # 0° = haut, horaire (convention IrisLayer)
    inside = rr <= 1.0
    spec = (hsv[..., 2] / 255 > 0.93) & (hsv[..., 1] / 255 < 0.35)
    # pupille : sombre (V < 22 % du max local) compacte, la plus proche du centre ; rayon = disque d'aire équivalente
    cand = ((hsv[..., 2] < PUP_V[eid]) & (rr < PUP_R[eid])).astype(np.uint8)
    cand = cv2.morphologyEx(cand, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    nl, lab, st, cen = cv2.connectedComponentsWithStats(cand)
    best, bd = None, 9.0
    for i in range(1, nl):
        if st[i, 4] < 30: continue
        d = math.hypot((cen[i][0] - ex) / a, (cen[i][1] - ey) / b)
        if d < bd: bd, best = d, i
    pup = None
    if best is not None:
        m = lab == best; ys, xs = np.nonzero(m)
        pw, ph = (xs.max() - xs.min() + 1), (ys.max() - ys.min() + 1)
        pup = {'cx': round(float((xs.mean() - ex) / a), 3), 'cy': round(float((ys.mean() - ey) / b), 3), 'rOverIris': round(float(math.sqrt(m.sum() / math.pi) / ((a + b) / 2)), 3),
               'aspectHW': round(float(ph / pw), 3), 'color': hexc(rgb[m].mean(0))}
    # profil radial : 12 bandes, hors reflets / pupille
    mask_ok = inside & ~spec & ~(cand.astype(bool))
    radial = []
    for k in range(12):
        lo, hi = k / 12, (k + 1) / 12; m = mask_ok & (rr >= lo) & (rr < hi)
        if m.sum() < 20: radial.append(None); continue
        c = rgb[m].mean(0); lm = L[m]; q25, q75 = np.percentile(lm, [25, 75])
        # moyenne = tons mélangés (fibres claires + fond sombre) ; les quartiles gardent le CONTRASTE (fond / filigrane) que la moyenne écrase
        radial.append({'r': round((lo + hi) / 2, 3), 'color': hexc(c), 'dark': hexc(rgb[m][lm <= q25].mean(0)), 'bright': hexc(rgb[m][lm >= q75].mean(0)), 'lum': round(float(lm.mean()), 1),
                       'lumSpread': round(float(q75 - q25), 1), 'sat': round(float(hsv[..., 1][m].mean() / 255), 3)})
    # profil angulaire : 8 secteurs de 45° entre 0,3 et 0,85 (haut = 0°)
    sect = []
    for k in range(8):
        lo, hi = k * 45 - 22.5, k * 45 + 22.5; t = (th - lo) % 360
        m = mask_ok & (rr > 0.3) & (rr < 0.85) & (t < 45)
        sect.append({'angleDeg': k * 45, 'color': hexc(rgb[m].mean(0)) if m.sum() > 20 else None})
    # anneau limbique : bande sombre contiguë au limbe (0,80 -> 1,0) : luminance moyenne vs bande 0,5 -> 0,75
    ring = mask_ok & (rr >= 0.88) & (rr <= 1.0); mid = mask_ok & (rr >= 0.5) & (rr < 0.75)
    thick = None
    prof = [float(L[mask_ok & (rr >= k / 20) & (rr < (k + 1) / 20)].mean()) if (mask_ok & (rr >= k / 20) & (rr < (k + 1) / 20)).sum() > 20 else np.nan for k in range(20)]
    lim_dark = float(np.nanmin(prof[14:20])) if not np.all(np.isnan(prof[14:20])) else None
    if lim_dark is not None:
        base = float(np.nanmedian(prof[8:14])); thr = base - 0.5 * (base - lim_dark)
        thick = round(sum(1 for p in prof[10:20] if not np.isnan(p) and p <= thr) / 20, 3)
    # reflets (blobs V > 0,93 dans l'iris)
    hl = (spec & inside).astype(np.uint8); nh, lh, sh, ch = cv2.connectedComponentsWithStats(hl); H_ = []
    for i in range(1, nh):
        if sh[i, 4] < 12: continue
        H_.append({'dx': round(float((ch[i][0] - ex) / a), 3), 'dy': round(float((ch[i][1] - ey) / b), 3), 'rOverIris': round(float(math.sqrt(sh[i, 4] / math.pi) / ((a + b) / 2)), 3)})
    H_.sort(key=lambda h: -h['rOverIris'])
    # fibres : contraste angulaire de luminance dans l'anneau 0,35 -> 0,75 (écart-type sur 360 secteurs, moyenné par rayon)
    fib = []
    for r0 in (0.4, 0.5, 0.6, 0.7):
        vals = []
        for k in range(180):
            m = mask_ok & (rr >= r0 - 0.04) & (rr < r0 + 0.04) & (((th - k * 2) % 360) < 2)
            if m.sum() > 4: vals.append(float(L[m].mean()))
        if len(vals) > 40: fib.append(float(np.std(vals)))
    # sclère voisine : anneau 1,15 -> 1,5, pixels clairs peu saturés
    sc = (rr > 1.12) & (rr < 1.6) & (hsv[..., 1] / 255 < 0.28) & (hsv[..., 2] / 255 > 0.55)
    return {'id': eid, 'file': fn, 'note': note, 'annotation': {'cx': cx, 'cy': cy, 'rx': rx, 'ry': ry}, 'limbe': {'cx': round(float(ex), 1), 'cy': round(float(ey), 1), 'rx': round(float(a), 1), 'ry': round(float(b), 1), 'angDeg': round(float(ang), 1), 'rayonsRetenus': n, 'aspectHW': round(float(b / a), 3)},
            'pupille': pup, 'radial': radial, 'secteurs': sect, 'anneauLimbique': {'luminanceMin': round(lim_dark, 1) if lim_dark is not None else None, 'epaisseurOverRayon': thick},
            'reflets': H_[:6], 'fibres': {'ecartTypeLuminance': [round(f, 2) for f in fib]}, 'sclere': hexc(rgb[sc].mean(0)) if sc.sum() > 50 else None}

def overlay(res):
    os.makedirs(OUT, exist_ok=True); tiles = []
    for r in res:
        img = cv2.imread(REF + r['file']); l = r['limbe']
        cv2.ellipse(img, (int(l['cx']), int(l['cy'])), (int(l['rx']), int(l['ry'])), l['angDeg'], 0, 360, (0, 255, 0), 2)
        a = r['annotation']; cv2.ellipse(img, (a['cx'], a['cy']), (a['rx'], a['ry']), 0, 0, 360, (0, 165, 255), 1)
        if r['pupille']:
            p = r['pupille']; rad = p['rOverIris'] * (l['rx'] + l['ry']) / 2
            cv2.circle(img, (int(l['cx'] + p['cx'] * l['rx']), int(l['cy'] + p['cy'] * l['ry'])), max(2, int(rad)), (0, 0, 255), 2)
        for h in r['reflets']:
            cv2.circle(img, (int(l['cx'] + h['dx'] * l['rx']), int(l['cy'] + h['dy'] * l['ry'])), max(2, int(h['rOverIris'] * l['rx'])), (255, 0, 255), 2)
        x0, y0 = max(0, int(l['cx'] - l['rx'] * 1.5)), max(0, int(l['cy'] - l['ry'] * 1.5)); crop = img[y0:int(l['cy'] + l['ry'] * 1.5), x0:int(l['cx'] + l['rx'] * 1.5)]
        tiles.append(cv2.resize(crop, (400, int(400 * crop.shape[0] / crop.shape[1]))))
    h = max(t.shape[0] for t in tiles); tiles = [cv2.copyMakeBorder(t, 0, h - t.shape[0], 0, 0, cv2.BORDER_CONSTANT) for t in tiles]
    cv2.imwrite(OUT + '01-iris-photos-superposition.png', np.hstack(tiles))

if __name__ == '__main__':
    res = [measure(k) for k in IRIS]
    json.dump({'method': 'annotation humaine (centre/rayons approchés) + limbe par gradient radial + tout le reste calculé', 'eyes': res}, open(REF + 'measures-iris-photos.json', 'w'), indent=1, ensure_ascii=False)
    overlay(res)
    for r in res: print(r['id'], r['limbe'], r['pupille'], r['anneauLimbique'], r['reflets'][:2])
