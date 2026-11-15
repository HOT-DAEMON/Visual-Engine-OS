"""Tentative de quantification de references/nez/01.jpg (croquis au crayon photographié, ~22 nez vus de dessous / de trois quarts, fond gris moucheté, traits fins).
Sorties : references/nez/measures-01.json + artefacts/nez-refs/01-overlay.png. Méthode : fond estimé par flou large puis soustrait (le papier n'est pas uniforme), encre = écart au fond,
amas par dilatation, un nez = un amas d'au moins 2 500 px. Mesuré : boîte et rapport L/H de chaque amas ; fraction d'encre ; AUCUNE narine ni lobule isolé (voir limites).
Le script ÉCRIT le verdict de fiabilité : le nombre d'amas retenus et la part dont la boîte contient exactement un nez (contrôle visuel sur l'overlay, saisi dans CHECK ci-dessous
après lecture de 01-overlay.png) - il ne le déduit pas."""
import json, os
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi
SRC = 'references/nez/01.jpg'
g = np.array(Image.open(SRC).convert('L')).astype(np.float32)
bg = cv2.GaussianBlur(g, (0, 0), 25); d = np.clip(bg - g, 0, None)
ink = d > 50
lab, n = ndi.label(ndi.binary_dilation(ink, iterations=5), structure=np.ones((3, 3)))
objs = ndi.find_objects(lab); cells = []; ov = np.stack([g] * 3, -1).astype(np.uint8)
for i, sl in enumerate(objs, 1):
    m = (lab[sl] == i) & ink[sl]
    if m.sum() < 400: continue
    ys, xs = np.where(m); x0, y0 = sl[1].start + xs.min(), sl[0].start + ys.min(); w, h = int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)
    if w < 40 or h < 30: continue
    cells.append({'id': len(cells) + 1, 'bbox': [int(x0), int(y0), w, h], 'aspectWH': round(w / h, 4), 'inkFraction': round(float(m.sum() / (w * h)), 4)})
    cv2.rectangle(ov, (int(x0), int(y0)), (int(x0 + w), int(y0 + h)), (0, 160, 60), 2); cv2.putText(ov, str(len(cells)), (int(x0) + 3, int(y0) + 16), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 0, 0), 2)
os.makedirs('artefacts/nez-refs', exist_ok=True); Image.fromarray(ov).save('artefacts/nez-refs/01-overlay.png')
# CONTRÔLE VISUEL (lecture de 01-overlay.png, saisi ici explicitement : ce n'est PAS une sortie du script) : amas qui contiennent exactement un nez.
# Défectueux : 2 (nez coupé par le haut), 10 (deux nez fusionnés), 14 (chevauche l'amas 16), 16 (nez + signature manuscrite fusionnés).
BAD = {2, 10, 14, 16}
for c in cells: c['visuallyValid'] = c['id'] not in BAD
ok = [c for c in cells if c['visuallyValid']]
a = np.array([c['aspectWH'] for c in ok])
summary = {'clusters': len(cells), 'visuallyValid': len(ok), 'excluded': sorted(BAD), 'aspectWH': {'median': round(float(np.median(a)), 4), 'min': round(float(a.min()), 4), 'max': round(float(a.max()), 4)}}
json.dump({'source': SRC, 'method': 'fond flou soustrait, encre > 50, amas par dilatation 5 ; contrôle visuel des amas', 'summary': summary, 'cells': cells}, open('references/nez/measures-01.json', 'w'), indent=1)
print(json.dumps(summary))
