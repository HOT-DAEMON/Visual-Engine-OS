"""Réunit les tranches `proofs-<i>.json` écrites par `artefacts-vault.ts` (VAULT_SHARD=i/n) en `proofs.json` + `proofs.csv`, dans l'ordre d'origine des cas de preuve (indice = i + n·k).
Usage : python3 merge-vault-proofs.py <dossier>"""
import glob, json, os, sys

d = os.path.join(sys.argv[1], 'verification')
parts = sorted(glob.glob(os.path.join(d, 'proofs-*.json')), key=lambda p: int(p.rsplit('-', 1)[1].split('.')[0]))
n = len(parts)
rows = [None] * sum(len(json.load(open(p, encoding='utf-8'))) for p in parts)
for i, p in enumerate(parts):
    for k, item in enumerate(json.load(open(p, encoding='utf-8'))):
        rows[i + n * k] = item
assert all(r is not None for r in rows), 'tranches incomplètes'
json.dump(rows, open(os.path.join(d, 'proofs.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
with open(os.path.join(d, 'proofs.csv'), 'w', encoding='utf-8') as f:
    f.write('parametre,perceptible,meilleure_vue,xor_pct,ombre_pct\n')
    f.write('\n'.join(f"{r['id']},{str(r['perceptible']).lower()},{r['best']['view']},{r['best']['xor'] * 100:.3f},{r['best']['shadeFrac'] * 100:.3f}" for r in rows))
for p in parts: os.remove(p)
print(len(rows), 'cas réunis ;', sum(1 for r in rows if not r['perceptible']), 'non perceptibles')
