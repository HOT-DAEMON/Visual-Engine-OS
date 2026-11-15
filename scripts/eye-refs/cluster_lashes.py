"""Regroupe les yeux de references/eyes/measures-lashes.json en FAMILLES de cils : `python3 scripts/eye-refs/cluster_lashes.py [k]`.
Variables (cils du HAUT uniquement, normalisées par la largeur de l'œil) : nombre, longueur moyenne, longueur max, éventail (|angle| moyen, 0 = vertical), courbure moyenne, part de touffes,
rapport longueur externe / interne. k-means (graine fixe, 50 initialisations) sur variables centrées-réduites ; on écrit centres + membres + les valeurs brutes de chaque famille.
Les yeux sans >= 2 cils du haut (iris seuls, composantes sans cils) sont écartés et listés. Sortie : references/eyes/lash-families.json."""
import json, sys
import numpy as np

K = int(sys.argv[1]) if len(sys.argv) > 1 else 4
data = json.load(open('references/eyes/measures-lashes.json', encoding='utf8'))['eyes']
rows, skipped = [], []
for e in data:
    up = [s for s in e['strokes'] if s['upper']]
    if len(up) < 2: skipped.append(e['id']); continue
    cx = e['bodyCenterX']
    outer_right = e['outerSide'] == 'right'
    ang = np.array([s['angleDeg'] for s in up]); sgn = 1 if outer_right else -1
    ang_out = ang * sgn                                       # > 0 : penche vers l'extérieur
    outer = [s['length'] for s in up if (s['baseX'] > cx) == outer_right]; inner = [s['length'] for s in up if (s['baseX'] > cx) != outer_right]
    ratio = (max(outer) / max(inner)) if outer and inner else 1.0
    rows.append({'id': e['id'], 'n': len(up), 'lenMean': float(np.mean([s['length'] for s in up])), 'lenMax': float(max(s['length'] for s in up)), 'sweepDeg': float(np.mean(np.abs(ang_out))),
                 'lean': float(np.mean(ang_out)), 'curv': float(np.mean([s['curvature'] for s in up])), 'tuft': float(np.mean([s['tips'] > 1 for s in up])), 'outerOverInner': float(min(ratio, 4.0)),
                 'baseWidth': float(np.mean([s['baseWidth'] for s in up]))})
F = ['n', 'lenMean', 'lenMax', 'sweepDeg', 'curv', 'tuft', 'outerOverInner']
X = np.array([[r[f] for f in F] for r in rows]); mu, sd = X.mean(0), X.std(0) + 1e-9; Z = (X - mu) / sd
best = None
for seed in range(50):
    rng = np.random.default_rng(seed); C = Z[rng.choice(len(Z), K, replace=False)]
    for _ in range(100):
        lab = np.argmin(((Z[:, None] - C[None]) ** 2).sum(2), 1)
        C2 = np.array([Z[lab == k].mean(0) if (lab == k).any() else C[k] for k in range(K)])
        if np.allclose(C, C2): break
        C = C2
    inertia = float(((Z - C[lab]) ** 2).sum())
    if best is None or inertia < best[0]: best = (inertia, lab.copy(), C.copy())
_, lab, C = best
fam = []
for k in range(K):
    mem = [r for r, l in zip(rows, lab) if l == k]
    if not mem: continue
    fam.append({'cluster': k, 'size': len(mem), 'members': [m['id'] for m in mem], 'mean': {f: round(float(np.mean([m[f] for m in mem])), 3) for f in F + ['lean', 'baseWidth']}})
fam.sort(key=lambda f: -f['mean']['lenMean'])
json.dump({'k': K, 'features': F, 'skipped': skipped, 'families': fam, 'rows': rows}, open('references/eyes/lash-families.json', 'w'), indent=1)
print('écartés:', skipped)
for f in fam: print(f['cluster'], f['size'], f['members']); print('   ', f['mean'])
