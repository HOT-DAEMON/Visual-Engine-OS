"""Extraction MESURÉE de references/nez/04.jpg : 14 nez avec une ellipse cyan (enveloppe lobule + ailes)
et un triangle rouge (base des narines, sommet = columelle).
Sorties : references/nez/measures-04.json + artefacts/nez-refs/04-overlay.png (preuve de l'ajustement).
Aucune valeur n'est saisie à la main : seuils de couleur -> amas -> cv2.fitEllipse / minAreaEnclosingTriangle.
Le texte cyan du bas (y >= 632) est exclu. Limite : l'ellipse est dessinée en traits partiellement masqués par l'encre noire ;
on rapporte donc un résidu radial par nez, pas seulement l'ellipse.
AJOUT (12 nov. 2026) : le triangle est AUSSI mesuré dans le repère propre de l'ellipse (champ `frame`), c'est-à-dire avec le roulis dans le plan
compensé. Les rapports « image » historiques (normalisés par l'étendue verticale de l'image) sont conservés tels quels. Le repère de l'ellipse n'est
retenu (`frame.valid`) que si |angle du grand axe| <= 45 deg ET rapport d'axes <= 0,85 : au-delà, l'orientation du nez est AMBIGUË (grand axe quasi
vertical, ou ellipse quasi ronde dont l'angle n'a pas de sens) et le nez est exclu de ces statistiques au lieu d'être deviné."""
import json, os
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi

SRC = 'references/nez/04.jpg'
img = np.array(Image.open(SRC).convert('RGB'))
a = img.astype(int)
R, G, B = a[..., 0], a[..., 1], a[..., 2]
cyan = (G - R > 35) & (B - R > 25) & (G > 150)
cyan[632:, :] = False                                    # exclut le texte « PLAY WITH… »
red = (R - G > 45) & (R - B > 30) & (R > 170)
red[632:, :] = False

lab, n = ndi.label(ndi.binary_dilation(cyan, iterations=8), structure=np.ones((3, 3)))
clusters = []
for i in range(1, n + 1):
    ys, xs = np.where((lab == i) & cyan)
    if len(ys) < 80:                                      # débris
        continue
    clusters.append({'pts': np.column_stack([xs, ys]).astype(np.float32)})
clusters.sort(key=lambda c: (round(c['pts'][:, 1].min() / 120), c['pts'][:, 0].min()))   # ordre de lecture grossier

# rattache chaque pixel rouge au nez dont la boîte (cyan) est la plus proche ; rejette au-delà de 30 px
ry, rx = np.where(ndi.binary_closing(red, iterations=1))
for c in clusters:
    c['red'] = []
    p = c['pts']; c['bbox'] = (p[:, 0].min(), p[:, 1].min(), p[:, 0].max(), p[:, 1].max())
for x, y in zip(rx, ry):
    best, bd = None, 1e9
    for c in clusters:
        x0, y0, x1, y1 = c['bbox']
        d = np.hypot(max(x0 - x, 0, x - x1), max(y0 - y, 0, y - y1))
        if d < bd:
            best, bd = c, d
    if best is not None and bd <= 30:
        best['red'].append((x, y))


def ellipse_extent(e):
    (cx, cy), (w, h), ang = e                              # w,h = axes complets
    t = np.deg2rad(ang)
    ex = 0.5 * np.hypot(w * np.cos(t), h * np.sin(t))     # demi-étendue horizontale
    ey = 0.5 * np.hypot(w * np.sin(t), h * np.cos(t))     # demi-étendue verticale
    return ex, ey


out, vis = [], img.copy()
for k, c in enumerate(clusters):
    e = cv2.fitEllipse(c['pts'])
    (cx, cy), (w, h), ang = e
    major, minor = max(w, h), min(w, h)
    # angle du grand axe par rapport à l'horizontale, replié dans [-90, 90]
    maj_ang = ang if w >= h else ang + 90
    maj_ang = ((maj_ang + 90) % 180) - 90
    # résidu radial normalisé : distance au contour de l'ellipse ajustée / demi-petit-axe
    t = np.deg2rad(ang)
    d = c['pts'] - np.array([cx, cy], dtype=np.float32)
    u = d[:, 0] * np.cos(t) + d[:, 1] * np.sin(t)
    v = -d[:, 0] * np.sin(t) + d[:, 1] * np.cos(t)
    rho = np.sqrt((u / (w / 2)) ** 2 + (v / (h / 2)) ** 2)
    resid = float(np.mean(np.abs(rho - 1)))
    ex, ey = ellipse_extent(e)
    rec = {'index': k + 1, 'cyanPx': int(len(c['pts'])), 'ellipse': {
        'cx': round(float(cx), 1), 'cy': round(float(cy), 1), 'major': round(float(major), 1), 'minor': round(float(minor), 1),
        'axisRatio': round(float(minor / major), 4), 'majorAngleDeg': round(float(maj_ang), 1),
        'extentW': round(float(2 * ex), 1), 'extentH': round(float(2 * ey), 1), 'radialResidual': round(resid, 4)}}
    cv2.ellipse(vis, ((float(cx), float(cy)), (float(w), float(h)), float(ang)), (255, 0, 255), 1)
    rp = np.array(c['red'], dtype=np.float32)
    if len(rp) >= 25:
        # sommet = point rouge le plus bas (columelle) ; base = enveloppe horizontale de la ligne rouge haute
        hull = cv2.convexHull(rp)
        fit_tri = getattr(cv2, 'minEnclosingTriangle', None) or cv2.minAreaEnclosingTriangle   # renommé en OpenCV 5
        _, tri = fit_tri(hull)
        tri = tri.reshape(3, 2)
        order = np.argsort(tri[:, 1])                       # y croissant : les deux premiers = base, le dernier = sommet
        apex = tri[order[2]]
        b0, b1 = sorted(tri[order[:2]].tolist(), key=lambda p: p[0])
        base_w = float(np.hypot(b1[0] - b0[0], b1[1] - b0[1]))
        bmx, bmy = (b0[0] + b1[0]) / 2, (b0[1] + b1[1]) / 2
        EW, EH = 2 * ex, 2 * ey
        rec['triangle'] = {
            'redPx': int(len(rp)), 'apex': [round(float(apex[0]), 1), round(float(apex[1]), 1)],
            'baseWidthOverEllipseW': round(base_w / EW, 4),
            'heightOverEllipseH': round(float(apex[1] - bmy) / EH, 4),
            'baseYRelEllipseCentre': round(float(bmy - cy) / EH, 4),
            'apexXRelEllipseCentre': round(float(apex[0] - cx) / EW, 4),
            'apexBelowEllipseBottom': round(float(apex[1] - (cy + ey)) / EH, 4)}
        # dégénéré = triangle quasi plat (hauteur < 10 % de l'ellipse) ou trop peu de pixels rouges : exclu des statistiques
        rec['triangle']['degenerate'] = bool(rec['triangle']['heightOverEllipseH'] < 0.10 or len(rp) < 40)
        # --- repère propre de l'ellipse (roulis compensé) ---------------------------------------------------------------------------------
        phi = np.deg2rad(maj_ang)                           # angle du grand axe / horizontale, repère image (y vers le bas)
        def to_frame(q):                                    # u le long du grand axe, v le long du petit axe (v > 0 = « vers le bas » du nez)
            dx, dy = q[0] - cx, q[1] - cy
            return dx * np.cos(phi) + dy * np.sin(phi), -dx * np.sin(phi) + dy * np.cos(phi)
        (u0, v0), (u1, v1), (ua, va) = to_frame(b0), to_frame(b1), to_frame(apex)
        bvm = (v0 + v1) / 2
        valid = bool(abs(maj_ang) <= 45 and minor / major <= 0.85)
        rec['triangle']['frame'] = {
            'valid': valid, 'rollDeg': round(float(maj_ang), 1),
            'baseWidthOverMajor': round(float(abs(u1 - u0)) / major, 4),
            'heightOverMinor': round(float(va - bvm) / minor, 4),
            'baseVRelCentre': round(float(bvm) / minor, 4),
            'apexBelowBottom': round(float(va - minor / 2) / minor, 4),
            'apexUOverMajor': round(float(ua) / major, 4)}
        cv2.polylines(vis, [tri.astype(np.int32)], True, (0, 120, 255), 1)
    else:
        rec['triangle'] = None                              # trop peu de pixels rouges : non mesuré, non inventé
    out.append(rec)

os.makedirs('artefacts/nez-refs', exist_ok=True)
Image.fromarray(vis).resize((vis.shape[1] * 2, vis.shape[0] * 2), Image.LANCZOS).save('artefacts/nez-refs/04-overlay.png')

tris = [r['triangle'] for r in out if r['triangle'] and not r['triangle']['degenerate']]
summary = {'noses': len(out), 'withTriangle': sum(1 for r in out if r['triangle']), 'usedInStats': len(tris),
           'degenerateIndices': [r['index'] for r in out if r['triangle'] and r['triangle']['degenerate']]}
if len(tris) >= 3:
    for key in ('baseWidthOverEllipseW', 'heightOverEllipseH', 'baseYRelEllipseCentre', 'apexBelowEllipseBottom'):
        vals = np.array([t[key] for t in tris])
        summary[key] = {'median': round(float(np.median(vals)), 4), 'min': round(float(vals.min()), 4), 'max': round(float(vals.max()), 4)}
    ratios = np.array([r['ellipse']['axisRatio'] for r in out if r['triangle'] and not r['triangle']['degenerate']])
    heights = np.array([t['heightOverEllipseH'] for t in tris])
    summary['pearson_axisRatio_vs_triangleHeight'] = round(float(np.corrcoef(ratios, heights)[0, 1]), 3)
fr = [r['triangle']['frame'] for r in out if r['triangle'] and not r['triangle']['degenerate'] and r['triangle']['frame']['valid']]
summary['frameValid'] = len(fr)
summary['frameExcludedIndices'] = [r['index'] for r in out if r['triangle'] and not r['triangle']['degenerate'] and not r['triangle']['frame']['valid']]
for key in ('baseWidthOverMajor', 'heightOverMinor', 'baseVRelCentre', 'apexBelowBottom', 'apexUOverMajor'):
    if len(fr) >= 3:
        vals = np.array([f[key] for f in fr]); summary['frame_' + key] = {'median': round(float(np.median(vals)), 4), 'min': round(float(vals.min()), 4), 'max': round(float(vals.max()), 4)}
summary['ellipseResidualMedian'] = round(float(np.median([r['ellipse']['radialResidual'] for r in out])), 4)
json.dump({'source': SRC, 'method': 'seuils couleur -> amas -> fitEllipse (cyan) / minAreaEnclosingTriangle (rouge) ; + repère propre de l\'ellipse (roulis compensé)',
           'summary': summary, 'noses': out}, open('references/nez/measures-04.json', 'w'), indent=1)
print(json.dumps(summary, indent=1))
