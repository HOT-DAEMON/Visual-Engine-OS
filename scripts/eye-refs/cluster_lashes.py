"""Regroupe les yeux de references/eyes/measures-lashes.json en FAMILLES de cils : `python3 scripts/eye-refs/cluster_lashes.py [k]`.
Variables (cils du HAUT uniquement, normalisées par la largeur de l'œil) : nombre, longueur moyenne, longueur max, éventail (|angle| moyen, 0 = vertical), courbure moyenne, part de touffes,
rapport longueur externe / interne. k-means (graine fixe, 50 initialisations) sur variables centrées-réduites ; on écrit centres + membres + les valeurs brutes de chaque famille.
Les yeux sans >= 2 cils du haut (iris seuls, composantes sans cils) sont écartés et listés AVEC LEUR MOTIF. Sortie : references/eyes/lash-families.json.
TRAÇABILITÉ (audit des cils §3) : la sortie porte `meta` (version de l'extracteur et du schéma, date, empreinte SHA-256 des mesures utilisées, paramètres du clustering, identifiants inclus / exclus + motifs) ;
tests/eye-lash-corpus.test.ts échoue si l'empreinte ne correspond plus aux mesures présentes (clustering périmé). Le clustering reste un outil EXPLORATOIRE : les 10 familles du moteur sont définies à la main
(src/generation/eye-lash-families.ts) ; un groupe de moins de 3 yeux est marqué `singular` (singularité ou erreur d'extraction, pas une famille).
Options : `--with-lean-width` ajoute `baseWidth` aux variables (audit §4.1 ; `lean` signé non utilisable : signe non normalisé par l'extracteur)."""
import hashlib, json, sys, datetime
import numpy as np

args = [a for a in sys.argv[1:] if not a.startswith('--')]
K = int(args[0]) if args else 4
WITH_LW = '--with-lean-width' in sys.argv
MEASURES = 'references/eyes/measures-lashes.json'
raw = open(MEASURES, 'rb').read()
SHA = hashlib.sha256(raw).hexdigest()
doc = json.loads(raw.decode('utf8'))
data = doc['eyes']
rows, skipped = [], []
skipped_why = {}
for e in data:
    up = [s for s in e['strokes'] if s['upper']]
    if len(up) < 2: skipped.append(e['id']); skipped_why[e['id']] = f'{len(up)} trait(s) supérieur(s) < 2 (iris seul, composante sans cils ou cils fusionnés dans le liner)'; continue
    # Schéma v2 de measures-lashes.json : `baseX` est DÉJÀ orienté (0 = canthus interne, 1 = externe), `startAngleDeg` est l'angle de départ par rapport à la normale de la paupière,
    # `bendDeg` la courbure (signée), `ends` = extrémités du squelette (toujours >= 2 : NE SERT PAS à détecter une touffe) ; la part de touffes vient des pointes de silhouette (`upperSpikes[].clump` > 1). L'ancienne version (bodyCenterX, angleDeg, curvature, tips) ne correspond plus au fichier.
    # Le SIGNE de startAngleDeg dépend de l'orientation verticale de la planche (réf. 15 : +/-) : il n'est pas normalisé par l'extracteur, donc `lean` signé n'est PAS utilisé (voir docs/EYES-LASHES-AUDIT.md).
    ang = np.array([abs(s['startAngleDeg']) for s in up])
    outer = [s['length'] for s in up if s['baseX'] > 0.5]; inner = [s['length'] for s in up if s['baseX'] <= 0.5]
    ratio = (max(outer) / max(inner)) if outer and inner else 1.0
    bend = float(np.mean([abs(s['bendDeg']) for s in up]))
    if bend > 90: skipped.append(e['id']); skipped_why[e['id']] = f'REJETÉ : courbure moyenne {bend:.0f}° > 90° (squelette fusionné avec un pli ou du liner : géométrie plausible, interprétation anatomique non fiable)'; continue
    rows.append({'id': e['id'], 'n': len(up), 'lenMean': float(np.mean([s['length'] for s in up])), 'lenMax': float(max(s['length'] for s in up)), 'sweepDeg': float(np.mean(ang)),
                 'curv': float(np.mean([abs(s['bendDeg']) for s in up])), 'tuft': float(np.mean([sp['clump'] > 1 for sp in e['upperSpikes']])) if e['upperSpikes'] else 0.0, 'outerOverInner': float(min(ratio, 4.0)),
                 'baseWidth': float(np.mean([s['baseWidth'] for s in up]))})
F = ['n', 'lenMean', 'lenMax', 'sweepDeg', 'curv', 'tuft', 'outerOverInner'] + (['baseWidth'] if WITH_LW else [])
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
    fam.append({'cluster': k, 'size': len(mem), 'singular': len(mem) < 3, 'members': [m['id'] for m in mem], 'mean': {f: round(float(np.mean([m[f] for m in mem])), 3) for f in F + ([] if WITH_LW else ['baseWidth'])}})
fam.sort(key=lambda f: -f['mean']['lenMean'])
meta = {'status': 'exploratoire : les familles du moteur sont définies à la main (src/generation/eye-lash-families.ts), pas par ce clustering',
        'extractor': {'script': 'scripts/eye-refs/extract_lashes.py', 'measuresVersion': doc.get('version'), 'method': doc.get('method')},
        'schemaVersion': 2, 'generated': datetime.date.today().isoformat(), 'measuresFile': MEASURES, 'measuresSha256': SHA,
        'params': {'algorithm': 'k-means', 'k': K, 'initialisations': 50, 'maxIter': 100, 'normalisation': 'centrée-réduite', 'minUpperStrokes': 2, 'withBaseWidth': WITH_LW},
        'included': [r['id'] for r in rows], 'excluded': [{'id': i, 'reason': skipped_why[i]} for i in skipped]}
json.dump({'meta': meta, 'k': K, 'features': F, 'skipped': skipped, 'families': fam, 'rows': rows}, open('references/eyes/lash-families.json', 'w'), indent=1, ensure_ascii=False)
print('écartés:', skipped)
for f in fam: print(f['cluster'], f['size'], f['members']); print('   ', f['mean'])
