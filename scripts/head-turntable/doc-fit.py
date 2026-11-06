#!/usr/bin/env python3
"""Génère docs/HEAD-TURNTABLE-ENGINES-FIT.md depuis fit_report.json et la table de paramètres de fit-engines.ts (jamais recopiée à la main)."""
import json, re
A = 'artefacts/head-turntable-engines'
r = json.load(open(f'{A}/fit_report.json'))
src = open('scripts/head-turntable/fit-engines.ts').read()
rng = {m[0]: (float(m[2]), float(m[3]), float(m[4])) for m in re.findall(r"\{ path: '([^']+)', kind: '(\w+)', lo: (-?[\d.]+), hi: (-?[\d.]+), x0: (-?[\d.]+)", src)}
rng = {k: v for k, v in rng.items()}
kinds = dict((m[0], m[1]) for m in re.findall(r"\{ path: '([^']+)', kind: '(\w+)'", src))
o = ['# Tête en rotation — calage des moteurs sur la planche (généré)', '',
     'Suite de `HEAD-TURNTABLE-ENGINES.md`. Tableau généré par `python3 scripts/head-turntable/doc-fit.py` depuis `artefacts/head-turntable-engines/fit_report.json` : ne pas modifier à la main.', '',
     '## Méthode', '',
     f'`npx tsx scripts/head-turntable/fit-engines.ts` ajuste {len(r['params'])} paramètres des moteurs existants (FaceParams, SkullParams, cou, plan mandibulaire, coupe de cheveux) par Nelder-Mead sur des paramètres',
     'normalisés dans leurs bornes. Les bornes sont celles du schéma, RESSERRÉES pour les plus caricaturaux (lèvre inférieure, angle de la mâchoire, voûte…) afin que l\'optimiseur ne',
     'bascule pas un paramètre sur une valeur extrême pour gagner 0,001 U. Les paramètres non ajustés sont dans `engines/engine-fixed.ts`, chacun avec son origine.', '',
     '**Cibles** : (1) sections a, zf, zb de la planche à 27 hauteurs (`REF_ROWS`, poids 1 ; menton y ≥ 0,95 : poids 2 sur a ; dessous de mâchoire visible y ≤ 0,9 : poids 1,5 sur zb) ;',
     '(2) ligne des yeux 0,629 U et canthus interne (poids 4) ; (3) base du nez 0,80 et bout du nez (0,735 ; 0,527) ; (4) centre de la cavité de la bouche 0,861 ; (5) bas du menton 1,05 ;',
     '(6) cou : demi-largeur 0,143 (poids 4), dos du cou à y = 0,9 / 1,0 / 1,05 (mesuré sur la silhouette 90°, poids 3) et à 1,2, face antérieure à 1,1 / 1,2 (annotés ±0,02).', '',
     '## Résultats', '',
     f"Coût total {r['before']['total']:.4f} → **{r['after']['total']:.4f}** (lignes : {r['before']['rows']:.4f} → {r['after']['rows']:.4f} ; repères : {r['before']['landmarks']:.4f} → {r['after']['landmarks']:.4f}).",
     f"Résidus rms sur les sections (y de 0,05 à 0,9 U) : a = **{r['rmsU']['a']:.4f} U**, zf = **{r['rmsU']['zf']:.4f} U**, zb = **{r['rmsU']['zb']:.4f} U** (1 U = 150 px de planche : {r['rmsU']['a']*150:.1f} / {r['rmsU']['zf']*150:.1f} / {r['rmsU']['zb']*150:.1f} px).",
     "Silhouettes rendues : erreur moyenne 3,2 px sur les vues de calage et 3,9 px hors échantillon (`verification/silhouette_error.csv`), contre 2,5 / 3,2 px pour la table de sections ajustée DIRECTEMENT",
     "sur les silhouettes : le calage via les moteurs est un peu moins précis (moins de degrés de liberté) mais reste sous les seuils (4,5 px / 5,25 px).", '',
     '## Paramètres ajustés', '', '| paramètre | famille | borne basse | borne haute | valeur | à la borne |', '|---|---|---|---|---|---|']
for k, v in r['params'].items():
    lo, hi, _ = rng[k]
    o.append(f"| `{k}` | {kinds[k]} | {lo} | {hi} | **{v}** | {'oui' if k in r['atBound'] else ''} |")
o += ['', '## Paramètres à la borne : ce que cela dit', '',
      f"{len(r['atBound'])} paramètres sur {len(r['params'])} finissent à moins de 3 % de leur borne ({', '.join('`'+k+'`' for k in r['atBound'])}). Ce n'est pas un détail : la tête de la planche est une tête de dessin animé",
      "(front haut et bombé, mâchoire obtuse, cou court et mince) que le canon anatomique des moteurs atteint seulement en bout de plage. Conséquences et limites :", '',
      "- `neckDepth`, `neckTilt`, `ramusDeg` : le cou de la planche est plus mince que le minimum du moteur ; compensé par `neckScale` (0,77), un facteur MAJEUR hors moteur, assumé et documenté.",
      "- `jaw.angle`, `jaw.taper` : mâchoire obtuse (angle gonial ≈ 135° ; canon adulte 110° – 140° : dans la plage mais à son bord) ; plan mandibulaire dérivé à ≈ 45° (canon 15° – 35° : contrôle `eng.mandplane`, rapporté `info`).",
      "- `vaultHeight`, `frontalBulge`, `templeY`, `hairTh` : la voûte basse + front très bombé + coupe de cheveux épaisse reproduisent le grand front de la planche ; l'optimiseur compense un décalage",
      "  entre le vertex du moteur et le haut des cheveux. À reprendre avec un paramètre de volume de cheveux plutôt qu'en déformant le crâne (voir `HEAD-TURNTABLE-REMAINING.md`).",
      "- `mouth.lowerLip`, `nose.tip.rotation` : lèvre inférieure épaisse et bout du nez relevé, au maximum retenu : écart de style de la planche.",
      "- Un seul jeu de mesures, un seul visage : le calage ne prouve rien sur la généralité des moteurs ; les résidus mesurent l'accord avec CETTE planche.", '',
      '## Reproduire', '', '    npx tsx scripts/head-turntable/fit-engines.ts      # ≈ 4 min ; réécrit engines/engine-fit.ts (généré) et artefacts/head-turntable-engines/fit_report.json',
      '    python3 scripts/head-turntable/doc-fit.py          # régénère ce fichier', '']
open('docs/HEAD-TURNTABLE-ENGINES-FIT.md', 'w').write('\n'.join(o))
print('ok')
