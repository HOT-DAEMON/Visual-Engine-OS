"""Compare l'estimateur d'ellipse du moteur (moments d'aire) à cv2.fitEllipse (moindres carrés, celui de la mesure des références) sur LES MÊMES contours (voir ellipse-estimators.ts).
Le contour est rééchantillonné à pas constant (3 px d'arc) avant fitEllipse : la mesure, elle, part des pixels d'un contour. Sortie : references/nez/ellipse-estimators.json."""
import json
import numpy as np, cv2
cases = json.load(open('artefacts/nez-aspect-plafond/ellipse-cases.json'))
def resample(pts, step=3.0):
    P = np.array([[q['x'], q['y']] for q in pts]); P = np.vstack([P, P[:1]]); d = np.hypot(*np.diff(P, axis=0).T); s = np.concatenate([[0], np.cumsum(d)])
    t = np.arange(0, s[-1], step); return np.stack([np.interp(t, s, P[:, 0]), np.interp(t, s, P[:, 1])], 1).astype(np.float32)
rows = []
for c in cases:
    pts = resample(c['envelope']); (cx, cy), (a, b), ang = cv2.fitEllipse(pts)
    major, minor = max(a, b), min(a, b); e = c['engine']
    # le moteur donne `major`/`minor` en grandeurs d'ellipse équivalente ; on compare des RAPPORTS (indépendants de l'échelle) et l'orientation (modulo 180°)
    ratio_ls, ratio_mom = minor / major, e['axisRatio']
    d_ang = abs(((ang if a >= b else ang + 90) - e['angleDeg'] + 90) % 180 - 90)
    rows.append({'nose': c['nose'], 'pitch': c['pitch'], 'yaw': c['yaw'], 'axisRatioMoments': round(ratio_mom, 4), 'axisRatioLeastSquares': round(float(ratio_ls), 4), 'relRatioGap': round(abs(ratio_mom - ratio_ls) / ratio_ls, 4), 'angleGapDeg': round(float(d_ang), 2),
                 'majorLSOverMoments': round(float(major / e['major']), 4)})
g = np.array([r['relRatioGap'] for r in rows]); an = np.array([r['angleGapDeg'] for r in rows]); mj = np.array([r['majorLSOverMoments'] for r in rows])
summary = {'cases': len(rows), 'relRatioGap': {'median': round(float(np.median(g)), 4), 'max': round(float(g.max()), 4)}, 'angleGapDeg': {'median': round(float(np.median(an)), 2), 'max': round(float(an.max()), 2)}, 'majorLSOverMoments': {'median': round(float(np.median(mj)), 4), 'min': round(float(mj.min()), 4), 'max': round(float(mj.max()), 4)}}
json.dump({'method': 'moments d\'aire (moteur) vs cv2.fitEllipse sur le contour rééchantillonné à 3 px', 'summary': summary, 'cases': rows}, open('references/nez/ellipse-estimators.json', 'w'), indent=1)
print(json.dumps(summary))
