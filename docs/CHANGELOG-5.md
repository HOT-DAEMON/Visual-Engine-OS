# Changelog 5 — moteur de visage : anatomie, peau, éclairage, contact, contours

Branche `feat/face-anatomy` (depuis `feat/hair-v2`).

## Ajouté
- **Moteur de nez** (`src/face/nose/`, `src/render/face/nose/`) : racine, dorsum (droit / concave / convexe / asymétrique), pointe, ailes (volume, épaisseur,
  attache), narines (goutte orientée, asymétrie, visibilité), raccords front / orbites / joues / région nasolabiale, profil de côté. Contrat `FaceNose` étendu (anciens champs conservés).
- **Moteur de menton et de mâchoire** (`src/face/jaw/`, `src/render/face/jaw.ts`) : hauteur / projection / largeur indépendantes, symphyse (4 formes), angle mandibulaire,
  corps de la mandibule, transition cou, mobilité (abaissement), déformation des tissus. Contour bas à cubiques C1 ; `Outline.bottomY`, `keys`.
- **Matériau de peau** (`src/skin/`, `SkinMaterial`) : rugosité par région, reflet diélectrique large, diffusion sous-cutanée, terminateur doux, zones lumineuses, pores ; indépendant de la géométrie.
- **Moteur d'éclairage** (`src/lighting/rig.ts`, `LightSpec`) : taille de source, température, dureté, distance, influence par matériau. Valeurs neutres : scènes existantes inchangées.
- **Sous-moteur d'ombres de contact et de lumières de contour** (`src/contact/`) : arbre parent / enfants / frères, registre de composants, plafond et plancher contrôlés.
- **Génération** : `drawAnatomy`, `randomLight` ; tous les axes de l'apparence de la peau ; flux de hasard dérivé (les tirages existants ne bougent pas).
- **Couche de vérification du moteur de visage** (`src/verify/face-engine.ts`) : géométrie, anatomie, style, 71 contrôles ; contrôles négatifs testés.
- Repères : `lm.chin`, `lm.jaw`, `lm.orbit`, `lips` étirées, bouche bornée par le contour ; `face/regions.ts` ; `face/ears-geometry.ts`.

## Modifié
- `faceParts` réécrit (assembleur) ; cou réécrit ; bouche : reflet dirigé, commissures ; barbe : bord intérieur borné, menton arrondi.
- Test de barbe adapté au coin du menton (le menton n'a plus de base plate).

## Corrigé
- Moteur d'apparence : `feMerge` sans `result` (effets enchaînés), bloom borné par l'alpha — voir `docs/ERRORS-4.md`.

## Preuves
- Tests : 1866 → 1926 (35 fichiers, tous verts, `tsc --noEmit` propre) (nez, mâchoire, peau/lumière, contact/rim, vérification). Artefacts : `artefacts/face-anatomy/` (15 images + `verification-report.json`),
  scripts `scripts/artefacts-face-nose-jaw.ts`, `scripts/artefacts-face-skin.ts`.
- Vérification : 120 visages, 71 contrôles, 0 échec, 3 alertes documentées (`chin-height-honoured`, `hair-skin-contrast`, `silhouette-asymmetric`).
