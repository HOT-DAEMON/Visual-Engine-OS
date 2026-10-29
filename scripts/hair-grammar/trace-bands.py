"""Bandes iso-tons d'une cellule : contours sous-pixel multi-seuils de la référence (x4) -> chemins SVG PRÉCOMPILÉS (pixels de cellule).
Couche de RENDU fidèle au pixel (yeux, traits fins, hachures de gris) ; les rubans (analyze-cell.py) restent la couche de STRUCTURE.
Usage : python3 trace-bands.py cells/03-swept_back.json profils/xxx.ribbons.json   (le profil est complété du champ `bands`)
Paramètres optionnels de la cellule : trace_levels (seuils décroissants), trace_sigma (flou x4), trace_eps (simplification x4), trace_min_area (px² cellule)."""
import sys, json, numpy as np, cv2
from skimage import measure

CFG = json.load(open(sys.argv[1])); PROF = sys.argv[2]
S = 4
x0, y0, x1, y1 = CFG['crop']
img = cv2.imread(CFG['image'], 0)[y0:y1, x0:x1]
big = cv2.resize(img, None, fx=S, fy=S, interpolation=cv2.INTER_LANCZOS4).astype(np.float32)
rx0, ry0, rx1, ry1 = CFG['roi']                      # hors zone d'intérêt = papier (voisine, col du costume)
m = np.zeros(big.shape, bool); m[(ry0 - y0) * S:(ry1 - y0) * S, (rx0 - x0) * S:(rx1 - x0) * S] = True
big = np.where(m, big, 255).astype(np.float32)
LEVELS = CFG.get('trace_levels', [236, 210, 184, 156, 126, 94, 60])    # région « plus sombre que le seuil » ; empilées du plus clair au plus sombre
SIG, EPS, MINA = CFG.get('trace_sigma', 1.0), CFG.get('trace_eps', 0.9), CFG.get('trace_min_area', 0.8)
sm = cv2.GaussianBlur(big, (0, 0), SIG)
# seuils CLAIRS (aplats de gris, hachures) : lissage plus fort et anneaux minuscules écartés -> moins de grain JPEG ; seuils sombres (traits) inchangés
SIG_L, LIGHT_FROM, MINA_L = CFG.get('trace_sigma_light', SIG), CFG.get('trace_light_from', 184), CFG.get('trace_min_area_light', MINA)
sm_l = cv2.GaussianBlur(big, (0, 0), SIG_L)
pad, pad_l = np.pad(sm, 1, constant_values=255.0), np.pad(sm_l, 1, constant_values=255.0)   # bord blanc : tous les contours sont fermés

def fmt(v):                                          # 1 décimale, sans zéro inutile
    s = f'{v:.1f}'.rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s

def path_of(rings):
    """Anneaux (pixels x4) -> chemin relatif en pixels de cellule, pas de 0,1 px : `M x y l dx dy ...z` (évenodd : trous = anneaux imbriqués)."""
    out = []
    for r in rings:
        q = np.round(r / S * 10).astype(int)         # dixièmes de pixel de cellule
        d = f'M{fmt(q[0][0] / 10)} {fmt(q[0][1] / 10)}'; px, py = q[0]
        for x, y in q[1:]:
            if x == px and y == py: continue
            d += f'l{fmt((x - px) / 10)} {fmt((y - py) / 10)}'; px, py = x, y
        out.append(d + 'z')
    return ''.join(out)

bands, tot_pts = [], 0
for i, t in enumerate(LEVELS):
    rings = []; light = t >= LIGHT_FROM
    for c in measure.find_contours(pad_l if light else pad, t):
        pts = (c[:, ::-1] - 1.0).astype(np.float32)  # (col,row) -> (x,y), retrait du bord ajouté
        if len(pts) < 4: continue
        a = abs(cv2.contourArea(pts.reshape(-1, 1, 2))) / (S * S)
        if a < (MINA_L if light else MINA): continue
        ap = cv2.approxPolyDP(pts.reshape(-1, 1, 2), EPS, True)[:, 0, :]
        if len(ap) >= 3: rings.append(ap)
    nxt = LEVELS[i + 1] if i + 1 < len(LEVELS) else -1
    sel = ((sm_l if light else sm) < t) & ((sm_l if light else sm) >= nxt) & m
    gray = int(round(float(big[sel].mean()))) if sel.sum() else t - 12   # gris de remplissage = moyenne mesurée de la bande
    d = path_of(rings); tot_pts += sum(len(r) for r in rings)
    bands.append({'level': t, 'gray': gray, 'd': d})
    print(f'seuil {t:3d}  gris {gray:3d}  anneaux {len(rings):3d}  octets {len(d)}')
prof = json.load(open(PROF)); prof['bands'] = bands
prof['trace'] = {'levels': LEVELS, 'sigma': SIG, 'sigmaLight': SIG_L, 'lightFrom': LIGHT_FROM, 'minAreaLight': MINA_L, 'eps': EPS, 'minArea': MINA, 'scale': S}
json.dump(prof, open(PROF, 'w'), separators=(',', ':'))
print('nœuds', tot_pts, 'octets chemins', sum(len(b['d']) for b in bands))
