# Nez : ce qui n'est PAS fait (suite de `docs/NOSE-REFS.md`, `NOSE-UNDERVIEW.md`, `NOSE-UNDERVIEW-CALIB.md`, `NOSE-REFS-03-05.md`, `NOSE-UNDERVIEW-LIT.md`)

Légende : ✅ fait et prouvé · 🟡 partiel · ⬜ non fait. Rien ici n'est prétendu fait ailleurs. Mise à jour du 12 nov. 2026.

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
- 🟡 Narines vues de dessous en cavités (creux) : fait dans la carte de profondeur (z = projection × (nostril − 0,45)) ; bord de narine et épaisseur de paroi NON faits.
- 🟡 Columelle comme **masse** : faite dans la carte de profondeur, mais construction NON mesurée (section et profil de mon choix) ; elle se lit comme une tige.
- ⬜ Enveloppe lisse : l'enveloppe de `noseView` reste facettée (le rendu éclairé la lisse par moyenne de profondeur, pas la géométrie).

## Apparence
- ⬜ Matériau et texture propres au nez (brillance de la pointe, pores) : la peau est celle de l'hôte ; **les mesures 03/05 ne sont branchées nulle part**.
- 🟡 Teinte partagée : la vue de dessous éclairée reçoit la couleur de peau de l'hôte ; cohérence nez/joues/membres supérieurs NON mesurée.
- ✅ La vue de dessous est éclairée par `src/relief` (même `LightModel`, aucune lumière propre) ; ⬜ mais la **silhouette reste « champignon »** (ailes en plaques, columelle en tige) et l'ombre très sombre : `NOSE-UNDERVIEW-LIT.md` §4.
- 🟡 Lisibilité : séparation des dômes, sillon alaire, ouverture des narines ne changent que ≈ 1–2 % des pixels dans la vue de face ; inchangé.
- 🟡 **Séparation des narines du moteur sous la plage mesurée** (défaut 0,325 contre 0,381–0,496) : écart verrouillé par test, NON corrigé.

## Moteur
- ⬜ **La vue de dessous n'est toujours pas branchée dans `head_3d`** (qui garde sa propre silhouette de nez) ; `litUnderview` n'est consommée que par les artefacts et les tests.
- ⬜ Compilateur propre au nez : toujours non nécessaire (fonctions pures, pas un `kind` de scène) ; aucun enregistrement ajouté.
- ⬜ Couche de vérification du rendu éclairé : les contrôles (trous, cavités, contraste, déterminisme) sont des TESTS, pas encore des règles de `src/verify` ; cohérence géométrique/anatomique/style du rendu éclairé non branchée dans `verifyFace`.
- ⬜ Asymétrie des ailes comme région, bosse osseuse volumétrique, cartilage supra-alaire.
- ⬜ Estimateur d'ellipse du moteur (moments d'aire) différent de celui de la mesure (moindres carrés) : écart non quantifié.
