# Nez : ce qui n'est PAS fait (suite de `docs/NOSE-REFS.md`, `NOSE-UNDERVIEW.md`, `NOSE-UNDERVIEW-CALIB.md`, `NOSE-REFS-03-05.md`, `NOSE-UNDERVIEW-LIT.md`)

Légende : ✅ fait et prouvé · 🟡 partiel · ⬜ non fait. Rien ici n'est prétendu fait ailleurs. Mise à jour du 14 nov. 2026 (voir `NOSE-BASE-MASS.md`).

## Références
- ✅ `04.jpg` quantifiée (ellipse + triangle) et désormais aussi **dans le repère propre de l'ellipse** (roulis compensé, nez à orientation ambiguë 7 et 8 exclus).
- ✅ `03.jpg` quantifiée (11 paires de narines sur 15 nez, un amas de deux nez fusionnés détecté et exclu) ; `05.jpg` quantifiée (grille 6 × 4, 16 paires de narines). Limites : `NOSE-REFS-03-05.md`.
- ⬜ `01.jpg` et `02.jpg` toujours NON quantifiées (photo de croquis bruitée, trait fin : la segmentation utilisée pour 03/05 n'y est pas fiable).
- ⬜ **Rougeurs de `05.jpg` : impossibles** (dessin au graphite en gris, aucune teinte). La moucheture mesurée est un proxy bruité (5.2 et 3.2 faux positifs probables).
- ⬜ Rapport lobule/base de `04.jpg` : seul le rapport triangle/ellipse est mesuré, pas la taille du lobule seul.
- 🟡 Planche 06 (ellipse large, trapèze plat, losange) : **non re-comparée** ce jour ; non prétendue reproduite.
- ⬜ Le L/H de la silhouette de face plafonne à 0,825 sur trois ajustements (cause non établie).
- ⬜ Les archétypes ne sont pas branchés dans le générateur aléatoire.

## Calibration de la vue de dessous
- ✅ Défaut corrigé : le tangage n'est plus libre (identifié sur 2 observables), roulis compensé, erreurs normalisées, leave-one-out, comparaison à la médiane et à une régression, identifiabilité mesurée.
- ⬜ **Résultat négatif non résolu** : aucun jeu de constantes ne rend le modèle prédictif (LOO 1,09 contre 1,12 pour la médiane ; 1,35 contre 1,04 sur les 3 grandeurs prédites). Le rendu garde le jeu v1 a priori NON validé.
- ⬜ `lobuleRim` : identifié (plateau 0,14–0,32) mais seulement sous des ailes dégénérées : **non adopté** ; `alarBase` : NON identifié (optimum sur la borne). Hypothèse non testée : il manque des axes morphologiques par nez.
- ⬜ Lacet et roulis dans la comparaison : **lus**, mais le lacet est limité à |lacet| et à des vues où l'ellipse reste valide ; les nez 1, 5, 9, 11, 13 saturent à tangage 0° et 3, 10 prennent un lacet de 52°.
- ⬜ Bootstrap d'identifiabilité à B = 8 : indicatif seulement.

## Angle de caméra
- 🟡 Vue de dessous / dessus / trois quarts : géométrie projetée avec tangage + lacet + roulis, éclairée ; profil pur (90° de lacet) comparé aux références : NON fait.
- 🟡 Narines vues de dessous en cavités : paroi lisse dans `base-mass.ts`, mais petites (≤ 0,9 × leur demi-axe de profondeur) donc loin des ouvertures de la réf. 04 ; épaisseur de paroi NON faite.
- 🟡 Columelle comme **masse** : fusionnée à l'ovoïde de la base (`base-mass.ts`), plus de tige (col ≥ 0,78 mesuré) ; construction toujours NON mesurée, et son V est à peine lisible.
- ⬜ Enveloppe lisse : l'enveloppe de `noseView` reste facettée (le rendu éclairé la lisse par moyenne de profondeur, pas la géométrie).

## Apparence
- ⬜ Matériau et texture propres au nez (brillance de la pointe, pores) : la peau est celle de l'hôte. Mesures 03/05 : 🟡 **résumés générés (`refs.generated.ts`) et lus par la règle de séparation** ; ⬜ aucune brillance/texture n'est dérivable (dessins gris, moucheture ≈ 1–2 points par nez).
- 🟡 Teinte partagée : la vue de dessous éclairée reçoit la couleur de peau de l'hôte ; cohérence nez/joues/membres supérieurs NON mesurée.
- ✅ La vue de dessous est éclairée par `src/relief` (même `LightModel`, aucune lumière propre) ; ⬜ ✅ la silhouette « champignon » est corrigée (`NOSE-BASE-MASS.md`) ; ⬜ l'ombre reste très sombre, lobule allongé du nez par défaut à 60°, encoche de « cloche-ailes », bandes fines à 40°.
- 🟡 Lisibilité : séparation des dômes, sillon alaire, ouverture des narines ne changent que ≈ 1–2 % des pixels dans la vue de face ; inchangé.
- 🟡 **Séparation des narines du moteur sous la plage mesurée** (défaut 0,325 contre 0,381–0,496) : écart verrouillé par test, NON corrigé ; `nostrils.columella` = 1 n'atteint que 0,365 : le levier est la loi de placement de `nostrils.ts` (règle de style `nose-lit-nostril-separation`, avertissement).

## Moteur
- ⬜ **La vue de dessous n'est toujours pas branchée dans `head_3d`** : tentative faite puis retirée (1,6–2,5 % de pixels changés, échec de `head.roll.joined` si peu enfoui) : `NOSE-BASE-MASS.md` §5.
- ⬜ Compilateur propre au nez : toujours non nécessaire (fonctions pures, pas un `kind` de scène) ; aucun enregistrement ajouté.
- ✅ Couche de vérification du rendu éclairé : règles `src/verify/nose-lit.ts` (géométrie, anatomie, style) dans `verifyFace`, avec détection prouvée de l'ancien défaut ; ⬜ le déterminisme et le contraste restent des tests ; cohérence nez/joues/membres non mesurée.
- ⬜ Asymétrie des ailes comme région, bosse osseuse volumétrique, cartilage supra-alaire.
- ⬜ Estimateur d'ellipse du moteur (moments d'aire) différent de celui de la mesure (moindres carrés) : écart non quantifié.
