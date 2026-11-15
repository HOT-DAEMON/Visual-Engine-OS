# Nez : ce qui n'est PAS fait (suite de `docs/NOSE-REFS.md`, `NOSE-UNDERVIEW.md`, `NOSE-UNDERVIEW-CALIB.md`, `NOSE-REFS-03-05.md`, `NOSE-UNDERVIEW-LIT.md`)

Légende : ✅ fait et prouvé · 🟡 partiel · ⬜ non fait. Rien ici n'est prétendu fait ailleurs. Mise à jour du 15 nov. 2026, 2e passe (voir `NOSE-BASE-MASS.md`, `NOSE-NOSTRIL-SLIT.md`, `NOSE-ASPECT-CEILING.md`, `NOSE-ARCHETYPE-WIRING.md` et `NOSE-MATERIAL.md`).

## Références
- ✅ `04.jpg` : traits de narines quantifiés (9 traits, majorant, `measures-04-nostrils.json`) ; quantifiée (ellipse + triangle) et désormais aussi **dans le repère propre de l'ellipse** (roulis compensé, nez à orientation ambiguë 7 et 8 exclus).
- ✅ `03.jpg` quantifiée (11 paires de narines sur 15 nez, un amas de deux nez fusionnés détecté et exclu) ; `05.jpg` quantifiée (grille 6 × 4, 16 paires de narines). Limites : `NOSE-REFS-03-05.md`.
- ✅ `02.jpg` quantifiée (8 nez au trait ; seul le L/H de la boîte est robuste, médiane 0,59 : `NOSE-ASPECT-CEILING.md` §4). 🟡 `01.jpg` : 17 amas valides sur 21 après contrôle visuel, L/H seulement ; narines, lobule et reflet de pointe NON mesurés (§5).
- ⬜ **Rougeurs de `05.jpg` : impossibles** (dessin au graphite en gris, aucune teinte). La moucheture mesurée est un proxy bruité (5.2 et 3.2 faux positifs probables).
- ⬜ Rapport lobule/base de `04.jpg` : seul le rapport triangle/ellipse est mesuré, pas la taille du lobule seul.
- 🟡 Planche 06 : **re-comparée** (superposition sur la planche réelle, axes libérés). Pyramide et cloche-ailes suivies ; ellipse large, trapèze plat et losange **toujours non reproduits** (résidus 0,44 / 0,16 / 0,31 > 0,15) : `NOSE-ASPECT-CEILING.md` §2.
- ✅ Le plafond 0,825 : **cause établie** (évasement à sa borne, largeur ≤ 0,28, `root.height` non exploré, longueur sous le plancher de zone inerte) ; plafond réel 1,40 ; ellipse large (1,60) et losange (1,52) hors de portée d'une silhouette de face qui part de la racine. Archétypes réajustés.
- ✅ Archétypes branchés dans le générateur aléatoire par l'option **opt-in** `noseArchetype` (`'pyramide' | 'cloche-ailes' | 'random'`) : étude chiffrée, silhouette identique en `classic` et `structured` (écart de L/H < 0,002 sur 40 graines), preuve visuelle sur têtes complètes : `NOSE-ARCHETYPE-WIRING.md`. ⬜ Non activé par défaut (aucune graine existante ne change) ; 🟡 1 visage sur 24 en cloche-ailes échoue `round-dome-centered` (0,0502 pour 0,05), cause non expliquée.

## Calibration de la vue de dessous
- ✅ Défaut corrigé : le tangage n'est plus libre (identifié sur 2 observables), roulis compensé, erreurs normalisées, leave-one-out, comparaison à la médiane et à une régression, identifiabilité mesurée.
- ⬜ **Résultat négatif non résolu** : aucun jeu de constantes ne rend le modèle prédictif (LOO 1,09 contre 1,12 pour la médiane ; 1,35 contre 1,04 sur les 3 grandeurs prédites). Le rendu garde le jeu v1 a priori NON validé.
- ⬜ `lobuleRim` : identifié (plateau 0,14–0,32) mais seulement sous des ailes dégénérées : **non adopté** ; `alarBase` : NON identifié (optimum sur la borne). Hypothèse non testée : il manque des axes morphologiques par nez.
- ⬜ Lacet et roulis dans la comparaison : **lus**, mais le lacet est limité à |lacet| et à des vues où l'ellipse reste valide ; les nez 1, 5, 9, 11, 13 saturent à tangage 0° et 3, 10 prennent un lacet de 52°.
- ⬜ Bootstrap d'identifiabilité à B = 8 : indicatif seulement.

## Angle de caméra
- 🟡 Vue de dessous / dessus / trois quarts : géométrie projetée avec tangage + lacet + roulis, éclairée ; profil pur (90° de lacet) comparé aux références : NON fait.
- 🟡 Narines vues de dessous : **fentes allongées** mesurées (allongement 2,2 par défaut, extrémité externe relevée de 23°, longueur 0,20 × la largeur du nez : `NOSE-NOSTRIL-SLIT.md`), prouvées sur l'image et par une règle ; restent plus claires que les traits noirs de la réf. 04, courbure et profondeur = choix NON mesurés ; épaisseur de paroi NON faite.
- 🟡 Columelle comme **masse** : fusionnée à l'ovoïde de la base (`base-mass.ts`), plus de tige (col ≥ 0,78 mesuré) ; construction toujours NON mesurée, et son V est à peine lisible.
- ⬜ Enveloppe lisse : l'enveloppe de `noseView` reste facettée (le rendu éclairé la lisse par moyenne de profondeur, pas la géométrie).

## Apparence
- 🟡 Matériau propre au nez : `skinMaterial.noseDetail` (`tipShine`, `alarBlush`), mesuré sur pixels, tests, planche gros plan : `NOSE-MATERIAL.md`. ⬜ **Pores du nez essayés puis retirés** (aucun effet lisible) ; ⬜ choix artistiques, pas des mesures (réf. graphite) ; ⬜ effet très discret sur tête complète ; ⬜ non branché sur la vue de dessous. Ancien constat conservé : ⬜ Matériau et texture propres au nez (brillance de la pointe, pores) : la peau est celle de l'hôte. Mesures 03/05 : 🟡 **résumés générés (`refs.generated.ts`) et lus par la règle de séparation** ; ⬜ aucune brillance/texture n'est dérivable (dessins gris, moucheture ≈ 1–2 points par nez).
- 🟡 Teinte partagée : la vue de dessous éclairée reçoit la couleur de peau de l'hôte ; cohérence nez/joues/membres supérieurs NON mesurée.
- ✅ La vue de dessous est éclairée par `src/relief` (même `LightModel`, aucune lumière propre) ; ⬜ ✅ la silhouette « champignon » est corrigée (`NOSE-BASE-MASS.md`) ; ⬜ l'ombre reste très sombre, lobule allongé du nez par défaut à 60°, encoche de « cloche-ailes », bandes fines à 40°.
- 🟡 Lisibilité : séparation des dômes, sillon alaire, ouverture des narines ne changent que ≈ 1–2 % des pixels dans la vue de face ; inchangé.
- ✅ **Séparation des narines** : corrigée (défaut 0,300 → 0,432 sur la silhouette, médiane de la réf. 03 : 0,431 ; 12 réglages dans 0,381–0,496) par la loi de placement de `nostrils.ts`, `docs/NOSE-NOSTRIL-PLACEMENT.md`. L'aspect et la longueur des ouvertures vues de dessous sont traités (`NOSE-NOSTRIL-SLIT.md`) ; la profondeur reste un choix non mesuré.

## Moteur
- ⬜ **La vue de dessous n'est toujours pas branchée dans `head_3d`** : tentative faite puis retirée (1,6–2,5 % de pixels changés, échec de `head.roll.joined` si peu enfoui) : `NOSE-BASE-MASS.md` §5.
- ⬜ Compilateur propre au nez : toujours non nécessaire (fonctions pures, pas un `kind` de scène) ; aucun enregistrement ajouté.
- ✅ Couche de vérification du rendu éclairé : règles `src/verify/nose-lit.ts` (géométrie, anatomie, style) dans `verifyFace`, avec détection prouvée de l'ancien défaut ; ⬜ le déterminisme et le contraste restent des tests ; cohérence nez/joues/membres non mesurée.
- ⬜ Asymétrie des ailes comme région, bosse osseuse volumétrique, cartilage supra-alaire.
- ✅ Estimateur d'ellipse : écart moments d'aire / moindres carrés **quantifié** (rapport d'axes médian 1,6 %, max 4,6 % ; angle max 0,6°) sur 36 enveloppes du moteur ; non mesuré sur contours rasterisés bruités.
