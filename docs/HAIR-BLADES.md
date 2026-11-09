# Frange en touffes continues (`fringe-blades.ts`, `fringe2.ts`, `hair-fringe-tufts.ts`)

Suite de `HAIR-FORM-FRINGE.md` (qui réglait le RYTHME). Traite `HAIR-FORM-REMAINING.md` 8 (zigzag `wispy`) ; touche `HAIR-BOUNDARY-REMAINING.md` 6.

## Problème (constat sur `artefacts/hair-s4/`, colonne AVANT)
Le mode `blades` posait 5 à 7 grands triangles à bords droits (profil `cone`, base large, pointe courte), sans lien entre eux ni avec l'implantation : des éclats posés sur le front, des « dents de requin ». Anatomiquement, une frange est une masse qui se sépare en mèches voisines et SE CHEVAUCHENT à la racine ; la peau ne se voit qu'entre les pointes. Le mode `wispy` avait en plus un bord en scie : chaque hauteur de pointe était tirée seule.

## Mesures sur 126 visages à lames (9 coiffures × 14 graines, mêmes graines avant / après)
Avant = commit `909c134`. Échecs aux contrôles ci-dessous :

| contrôle | avant | après |
|---|---|---|
| `fringe-tuft-continuous` (trous de peau entre racines) | 53 | 0 |
| `fringe-tuft-width` (lame géante) | 114 | 0 |
| `fringe-tuft-slender` (touffes plus larges que longues) | 77 | 0 |
| `fringe-tip-jag` (avertissement : bord en scie) | 5 | 0 |

Rugosité du bord (`tipJag`, fraction de H ; médiane / p90 / max) : `blades` 0,0151 / 0,0260 / 0,0375 → 0,0104 / 0,0157 / 0,0219 ; `wispy` 0,0181 / 0,0299 / 0,0460 → 0,0027 / 0,0038 / 0,0046. `asym_brow` et `sheer` : valeurs identiques (non touchés). ATTENTION : les seuils (`TUFT_LIMITS`) ont été posés après la correction, sur ce corpus : « 0 échec » ne prouve pas que les seuils sont bons, seulement que le corpus y est conforme (voir `HAIR-BLADES-REMAINING.md` 1).

## Correction
`layoutBlades` (nouveau, `fringe-blades.ts`) remplace la mise en page de `blades` :
- racines continues de part et d'autre du jour (le jour central est un vide, plus un trou entre deux dents) ; touffes 3 × plus nombreuses (plafond 20) ;
- largeur de base = pas local × recouvrement 1,35 à 1,9 : les voisines se chevauchent ;
- longueurs corrélées (ondulation douce + tirage propre) : le côté `side` est long (0,68 ± 0,26 de l'espace), l'autre court (0,38 ± 0,30) ;
- profil `ribbon` lancéolé, pointe penchée à l'opposé du jour de plus en plus loin du jour ;
- tirage de la mise en page retenté (≤ 8) tant que le rythme (CV des pas et des largeurs) est < 0,4 : repris de la série 3.
La mise en page des racines utilise un flux PROPRE ; les valeurs `pre` du flux principal sont tirées dans le même ordre qu'avant.
**Le reste de la chevelure N'EST PAS identique** (mesuré, mèches hors `kind: 'fringe'`, 126 visages) : 0 / 126 identiques, même nombre de mèches pour 10 / 126, écart de −71 à +61 (médiane −1). Cause probable, NON vérifiée : plus de touffes → plus de tirages par mèche (`tone()` dans la boucle de `lockFrom`) → flux aléatoire décalé pour la suite ; le remplissage de coque (`crown-fill`) dépend aussi de la couverture. Les planches avant / après diffèrent donc aussi hors frange (ex. dessus de l'afro), à graine égale.
`wispy` : mèches `ribbon` fines + lissage [¼ ½ ¼] ×2 des hauteurs de pointe le long de x (les tirages ne changent pas). `sheer` : paramètres explicites, rendu identique. `asym_brow` : essai de passage en `ribbon` écarté (aucune différence visible), laissé tel quel.

## Vérification (couche forme, `hair-fringe-tufts.ts`, branchée dans `hair-form.ts`)
- **Géométrie** : `fringe-tuft-continuous` (2e plus grand écart entre intervalles de racine ≤ 0,03 W ; le plus grand est le jour), `fringe-tuft-width` (largeur ≤ 0,25 W).
- **Style** : `fringe-tuft-slender` (≤ 70 % de touffes plus larges que longues), `fringe-tip-jag` (avertissement, ≤ 0,03 H).
- Anatomie : inchangée (`fringe-reach-bound`, implantation) ; ces contrôles ne jugent que les lames (`mode === 'blades'`), sauf la rugosité.
Tests : `tests/hair-fringe-tufts.test.ts` (7 : positif 90 visages, 4 négatifs construits, mode non jugé). Suite complète : 2879 tests verts avant ajout du fichier ; `npm run regress` : 34/34 `exact`.

## Preuves
`artefacts/hair-s4/` (`README.md` : mode d'emploi du « avant » depuis un worktree).
