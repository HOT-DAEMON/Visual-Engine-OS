# Moteur capillaire — passe 5 : la segmentation par mèche dans l'ajustement (étude, résultat NÉGATIF)

Consigne (`HAIR-PASS4-REMAINING.md`) : « la segmentation n'est pas branchée au fit de référence ; elle n'est validée que sur des rendus du moteur ». Avant de coder : `segmentStrands` (`observe-strands.ts`) n'est utilisée par aucun module de `src/` ; `fitFromReference` ajuste `volume` et `weight` sur `observe()` (largeur, espaces négatifs).

## Étalonnage mesuré (`scripts/hair-grammar/seg-calibration.ts`, TOUSLED, 6 graines, rendus 156×150)
| axe (−1 → 0 → +1) | nombre de mèches | largeur moy. | longueur moy. |
|---|---|---|---|
| volume | 24 → 30 → 34 (≈ 5,3 / unité) | croît | croît |
| weight | 22 → 30 → 42 (≈ 10 / unité) | — | — |
| sleek, fringe | plat (30 → 29 → 30) | plat | plat |
- Conclusion 1 : la segmentation ne porte AUCUNE information sur `sleek` ni `fringe` : elle ne peut piloter aucun axe de plus.
- Conclusion 2 : son seul signal exploitable est `weight` (nombre de mèches), déjà piloté par `negative`. Hypothèse testée : un second estimateur indépendant lèverait l'ambiguïté « weight −0,5 → ajusté +0,21 » (passe 3).

## Expérience
Branchement temporaire dans `fitFromReference` : `weight += (1 − β)·(erreur négative) + β·(écart de nombre de mèches − part due au volume)/10`. Cibles : weight ∈ {−0,8 ; −0,5 ; 0 ; 0,5 ; 0,8} × volume ∈ {−0,3 ; 0,3} × 2 graines de référence (≠ graine d'ajustement), 4 itérations.
- Erreur moyenne sur `weight` : sans segmentation **0,356** ; avec β = 0,35 : 0,419 (pire). β = 0,1 / 0,2 : pas mieux, non monotone.
- Cause : à profil égal, le nombre de mèches varie de ±4 d'une graine à l'autre (≈ ±0,4 de poids) : le bruit de la mesure dépasse le gain d'information.

## Décision
Le branchement a été RETIRÉ (il dégradait l'ajustement ; garder une option qui dégrade serait de la dette). Gardés : le script d'étalonnage et ce constat. Un branchement n'aurait de sens que pour (a) un axe d'intention qui agit sur la taille des mèches (n'existe pas : `sleek`/`fringe` ne la changent pas) ou (b) un nombre de mèches moyenné sur plusieurs ajustements de graines.

## Non traité
- Validation sur de VRAIES illustrations : `references/face/` contient de vraies illustrations (01.jpg rendu 3D semi-réaliste, 05.png capture d'anime) MAIS ce sont des gros plans de visage : crâne coupé, chapeau (05) ou épingle (01), aucune coiffure entière ni vérité terrain par mèche. Y lancer `segmentStrands` produirait des nombres sans étalon (seuils `VALLEY` 0,07, `REACH` 2, `CORE` 1 mesurés sur le raster du moteur). Une validation honnête exige des têtes entières annotées à la main ; aucune n'est dans le dépôt.
- Qualité inchangée : rappel ≈ 0,53, précision ≈ 0,63, pureté ≈ 0,86.
