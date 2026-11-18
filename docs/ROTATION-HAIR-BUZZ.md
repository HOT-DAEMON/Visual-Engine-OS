# Coupe rasée : fin de la « calotte » (passe 7)

Diagnostic de la passe 6 (§2.3) : la zone rasée se lisait comme une calotte orange sur un crâne chauve. Preuves : `artefacts/rotation-hair-review/01-rase-avant-apres.png` (HEAD précédent vs après, 2 têtes × −45/0/45°) et `02-…` (coque / lisière / crâne par coiffure).

## 1. Cause (mesurée sur la géométrie, pas supposée)
`SHELL.buzz.reach = 'none'` : la coque s'arrêtait au coin de tempe, alors que `short` descend jusqu'au-dessus de l'oreille. Entre la tempe et l'oreille la peau restait nue : le crâne paraissait chauve avec une plaque sur le dessus. Anatomiquement, une coupe rasée couvre aussi les flancs, avec un fondu (fade) vers la peau.

## 2. Corrections
1. `src/face/hair/boundary/shell.ts` : `buzz.reach = 'ear'` (aile jusqu'à l'arche de l'oreille, oreille dégagée). Pour une coque mince (`maxT < 0,02 W`), l'aile suit le CRÂNE et non la joue (le contour du visage s'écarte du crâne de 9 px aux tempes sur la graine 6211 : le contrôle `skull-shell-bound` voyait 7,7 px pour 4,9 permis).
2. `src/face/hair/scalp.ts` : après `guard.fit` (qui repousse les sommets de patte jusqu'au contour du visage), une coque mince est ramenée à crâne + épaisseur au-dessus de la limite des sourcils (aucun œil en jeu).
3. `src/face/hair/comb.ts` + `src/render/face/hair.ts` : deux fondus de peau, constantes UNIQUES (`HAIRLINE_FADE`, `FLANK_FADE`) : voile flou le long de l'implantation (la coque se fond dans le front) ; voile vertical de la tempe au bas de l'aile (plus de marche horizontale). Le fondu horizontal existant (`FADE`) est inchangé.

## 3. Résultat et honnêteté
- Les flancs sont couverts ; à 0° la tête ne se lit plus comme chauve avec plaque ; coque ≤ épaisseur anatomique sur 6 graines (`tests/hair-buzz-flank.test.ts`, 3 tests).
- Références visuelles inchangées (`scripts/regress.ts check`).
- **Reste visible** : à ±45° du côté lointain (bande dépliée), l'aile forme un bloc à bord intérieur vertical (bord de patte) et bas encore perceptible malgré le fondu vertical ; le fondu y est plus clair mais pas nul (voile de peau 0,06 de teinte cheveu). Cause suspectée : la coque posée est projetée point par point (bande dépliée ×2–3) ; piste : coupe à l'horizon + fondu dans l'espace projeté (voir `ROTATION-HAIR-LIMB.md` §6).
- Le fondu d'implantation (`HAIRLINE_FADE`) est discret ; réglage fait à l'œil, non à un seuil.
