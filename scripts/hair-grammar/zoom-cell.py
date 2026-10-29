"""Zooms ×2 « référence | rendu » à partir de 02-reference-vs-rubans.png. Usage : python3 zoom-cell.py <dossier> [x0 y0 x1 y1 nom]... (coordonnées ×4 de cellule)."""
import sys, cv2, numpy as np
D = sys.argv[1].rstrip('/') + '/'
cmp = cv2.imread(D + '02-reference-vs-rubans.png'); W = cmp.shape[1] // 2
ref, mine = cmp[:, :W], cmp[:, W:]
args = sys.argv[2:]
for i in range(0, len(args), 5):
    x0, y0, x1, y1 = map(int, args[i:i + 4]); name = args[i + 4]
    a = cv2.resize(ref[y0:y1, x0:x1], None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC); b = cv2.resize(mine[y0:y1, x0:x1], None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    cv2.imwrite(D + name, np.hstack([a, np.full((a.shape[0], 6, 3), (0, 0, 200), np.uint8), b]))
