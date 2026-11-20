# Moteur capillaire — pont « une seule apparence » (`HairLock.geom`)

Code : `src/face/hair/types.ts` (`HairLockGeom`) · `src/hair-grammar/interop.ts` · `src/render/face/hair-cel.ts` · `hair-lock.ts` · `hair-detail.ts`
Tests : `tests/hair-engine-geom-bridge.test.ts` (14) · preuve : `artefacts/hair-engine-pass2/02-pont-geometrie-locale.png`.

## Constat (vérifié avant de coder)
`LockGeom` (`local-geometry.ts`) existait côté grammaire : largeur, torsion, face visible, occlusion par échantillon de l'axe. Le rendu principal
(`celBands`, `lockMarkup`, `hairGloss`) ne le lisait pas : il recalculait une largeur par formule (`halfWidth(t, w0, sharp, …)`) et posait un reflet global.
Deux apparences pour une même mèche = incohérence. Rien de cela n'était déjà branché (grep `geom` dans `src/render` : 0 résultat avant).

## Ce qui est fait
- Type `HairLockGeom { width, twist, backface, occlusion }`, champ optionnel `HairLock.geom`. Tous les tableaux ont la longueur de `spine`.
- `grammarToHairLocks` accepte des `PaintedWithGeom` (sortie de `paintHairPro`) : largeur × échelle `k` de la similitude yeux→yeux. Sans géométrie (`paintHair` simple) : `geom` absent, rien n'est inventé.
- `checkHairLockContract` vérifie : tableaux alignés, largeurs finies ≥ 0 (la pointe vaut 0, donc « au moins une > 0 »), torsion finie, occlusion ∈ [0, 1].
- `celBands` : demi-largeur = celle de la LAME (`max(0,03·w0, width/2)`) ; reflet × `|cos twist|^1,2 · (1 − 0,6·occlusion)` ; côté du reflet inversé sur le dessous du ruban.
- `lockMarkup` hors mode cel : un reflet local par mèche épaisse de devant, clippé par SA mèche (opacité `0,2 + 0,5·intensité`, plafond 0,7).
- `hairGloss` : la tache globale est multipliée par `1 − localGlossShare(locks)` → elle s'efface quand les mèches portent leur reflet (pas de double reflet).
- Aucune grandeur ne dépend de la lumière : le rendu principal garde son `ld` 2D. La géométrie dit ce qu'EST la mèche, pas comment elle est éclairée.

## Preuves
- Régression : géométrie « neutre » (largeurs = formule, torsion 0, face avant, occlusion 0) → bandes identiques à 1e-9 à l'ancien rendu.
- Élargir la lame élargit l'ombre (aire × > 1,2) ; torsion forte → reflet étranglé (< 0,8 de l'aire plate, < 0,05 de face à la tranche) ; occlusion totale → 0,4 ; dessous → reflet de l'autre côté de l'axe, même amplitude.
- Rendu réel : 50 mèches de TOUSLED, 50 avec `geom` ; contrat sans violation (planche 02 : formule d'avant | géométrie locale d'après, cel et hors cel).

## Reste à faire (non fait)
1. Pas de lumière 3D dans le moteur principal : l'apparence reste en `ld` 2D. Une vraie normale par échantillon exigerait un contrat de lumière commun.
2. `paintHairPro` reste un second pinceau dans la grammaire ; le principal ne l'appelle pas (le pont consomme sa géométrie, pas son SVG).
3. Les mèches `part` (queue, chignon, tresse) et `sim` du principal n'ont pas de `geom` (aucun producteur) : elles gardent la formule.
4. Pas de comparaison pixel à pixel sur une scène complète du générateur principal avec cheveux `grammar` (le pont est prouvé sur `lockMarkup` et `hairGloss`).
5. Filtres SVG du principal (flou, grain) : toujours dépendants du SVG, non traités.
