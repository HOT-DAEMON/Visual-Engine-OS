#!/usr/bin/env python3
"""Génère docs/HEAD-TURNTABLE-VERIFY-CHECKS.md depuis le rapport JSON (les tableaux ne sont jamais recopiés à la main)."""
import json, sys
A = sys.argv[1] if len(sys.argv) > 1 else 'artefacts/head-turntable-engines/apres'
r = json.load(open(f'{A}/verification/verification_report.json'))
names = {'geometry': 'Couche 1 — Cohérence géométrique', 'anatomy': 'Couche 2 — Cohérence anatomique', 'style': 'Couche 3 — Style artistique'}
o = ['# Tête en rotation — tous les contrôles de vérification (généré)', '',
     f'Suite de `HEAD-TURNTABLE-VERIFY.md`. Généré par `python3 scripts/head-turntable/doc-checks.py` depuis `{A}/verification/verification_report.json` : ne pas modifier à la main.',
     f"Tangage ajusté {r['pitchDeg']}° ; résidu de l'ajustement rigide {r['rigidFitResidualU']} U ; verdict global : {'OK' if r['pass'] else 'ÉCHEC'}.", '']
for l in r['layers']:
    o += [f"## {names[l['layer']]} ({len(l['checks'])} contrôles, dont {sum(1 for c in l['checks'] if c['id'].startswith('eng.'))} liés aux moteurs `eng.*`)", '', '| id | contrôle | bornes | valeur | ok |', '|---|---|---|---|---|']
    for c in l['checks']:
        ok = 'oui' if c['ok'] else 'NON'
        if c.get('kind') == 'info': ok += ' (info)'
        o.append(f"| `{c['id']}` | {c['label'].replace('|', '/')} | {c['min']} – {c['max']} | **{c['value']}** | {ok} |")
    o.append('')
open('docs/HEAD-TURNTABLE-VERIFY-CHECKS.md', 'w').write('\n'.join(o) + '\n')
print('ok', sum(len(l['checks']) for l in r['layers']), 'contrôles')
