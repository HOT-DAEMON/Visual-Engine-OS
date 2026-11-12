# Nez : ce qui n'est PAS fait (suite de `docs/NOSE-REFS.md` et `docs/NOSE-UNDERVIEW.md`)

Légende : ✅ fait et prouvé · 🟡 partiel · ⬜ non fait. Rien ici n'est prétendu fait ailleurs.

## Références
- ✅ `04.jpg` quantifiée : ellipse + triangle, 13 nez exploitables (`measures-04.json`, `NOSE-UNDERVIEW.md` §2).
- ⬜ `01`, `02`, `03`, `05` toujours NON quantifiées : formes de narines de `03.jpg`, détails de peau (pores, rougeurs) de `05.jpg`, hachures de `01.jpg`/`02.jpg`.
- ⬜ Rapport lobule/base de `04.jpg` : seul le rapport triangle/ellipse est mesuré, pas la taille du lobule seul.
- 🟡 Trois formes de la planche 06 (ellipse large, trapèze plat, losange) : la vue de dessous donne l'enveloppe lobule + ailes, mais ces trois silhouettes n'ont PAS été re-comparées au profil de largeur de 06. Non prétendues reproduites.
- ⬜ Le L/H de la silhouette de face plafonne à 0,825 sur trois ajustements (cause non établie).
- ⬜ Les archétypes ne sont pas branchés dans le générateur aléatoire (`noseArchetype` : tests et artefacts seulement).

## Angle de caméra
- 🟡 Vue de dessous / dessus et trois quarts : géométrie projetée faite (`underview.ts`, tangage + lacet), vérifiée, 4 constantes z dont 3 calibrées sur la réf. 04. NON fait : profil pur (90° de lacet) comparé aux références, roulis, rendu éclairé.
- ⬜ Narines vues de dessous comme volumes (creux, bord) : seules leurs silhouettes projetées existent.
- ⬜ Columelle / sous-nez comme masse dans la vue de dessous (le sommet du triangle flotte hors de la silhouette).
- ⬜ Enveloppe lisse : l'enveloppe est facettée (enveloppe convexe de polygones peu denses).

## Apparence
- ⬜ Matériau et texture propres au nez (brillance de la pointe, pores, rougeurs de `05.jpg`) : la peau est celle de l'hôte.
- 🟡 Teinte partagée : la vue de dessous reçoit la peau de l'hôte (planche 03) ; cohérence nez/joues/membres supérieurs toujours NON mesurée.
- ⬜ La vue de dessous n'est pas éclairée par `src/relief` (aplats diagnostiques).
- 🟡 Lisibilité : séparation des dômes, sillon alaire, ouverture des narines ne changent que ≈ 1–2 % des pixels (`NOSE-REFS.md` §7) ; inchangé.

## Moteur
- ⬜ Asymétrie des ailes comme région, bosse osseuse volumétrique, cartilage supra-alaire.
- ⬜ `head_3d` garde sa propre silhouette de nez : la vue projetée n'y est pas branchée.
- 🟡 Calibration : `alarBase` faiblement identifié, `lobuleRim` fixé non calibré, estimateur d'ellipse différent de celui de la mesure.
- ⬜ `npm run regress` : voir le message de commit pour l'état réel de la suite.
