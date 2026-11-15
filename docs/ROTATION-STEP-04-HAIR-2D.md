# Rotation — étape 4 : cheveux 2D sous rotation spatiale

Branche : `feat/hair-grammar`

## Objectif
Faire suivre aux cheveux la rotation spatiale de la tête tout en conservant leur dessin SVG 2D : masses, mèches, contours et style. Ne pas convertir la coiffure en coque, tubes ou maillages 3D.

## Faits vérifiés
- Le rendu graphique des cheveux existe dans `src/render/face/hair.ts` : il produit des calques SVG depuis `hairGeometry()`.
- `src/head-turntable/hair-volume.ts`, `hair-shell.ts`, `hair-parts.ts` et `hair-strands.ts` appartiennent à la voie volumétrique 3D.
- La volumétrie 3D dérive en partie de la silhouette 2D, mais elle ne remplace pas le rendu SVG existant.
- `renderHair()` reçoit actuellement `lm`, `L` et `rot`, mais aucun paramètre explicite de pose spatiale de tête.

## Fichiers à inspecter
- `src/render/face/hair.ts`
- `src/face/hair/index.ts` (ou le fichier réel exportant `hairGeometry`)
- `src/face/pose/tree.ts`
- `src/render/face/face.ts`
- `src/head-turntable/hair-volume-types.ts` (lecture seule : confirmer la séparation 3D)

## Travail demandé
1. Vérifier d'abord que l'étape 2 est réellement intégrée et validée dans le code. Un document de consignes seul ne vaut pas intégration.
2. Identifier les données de pose et la transformation de silhouette réellement utilisées par le rendu SVG.
3. Déterminer comment appliquer cette même pose aux points d'ancrage et courbes des cheveux, dans le repère de la tête, avant génération des chemins SVG.
4. Préserver les couches `back`, `front` et `over` ainsi que l'ordre d'occlusion existant.
5. Commencer par la masse/silhouette de coiffure seulement. Ne transformer les mèches individuelles qu'après validation de cette silhouette.
6. À yaw = 0, conserver le rendu actuel. À yaw non nul, recalculer la forme projetée ; ne pas appliquer un simple `rotate(...)` SVG au groupe.
7. Si le moteur de pose ne fournit pas encore de projection exploitable pour les courbes de cheveux, arrêter et documenter le plus petit prérequis manquant.

## Interdictions
- Ne pas appeler `hairVolumeOf()` pour le rendu SVG.
- Ne pas convertir les cheveux en meshes, coques, ellipsoïdes ou tubes.
- Ne pas modifier `hair-volume.ts`, `hair-shell.ts`, `hair-parts.ts` ou `hair-strands.ts`.
- Ne pas réécrire la grammaire capillaire ni recalculer les coiffures depuis zéro.
- Ne pas modifier yeux, nez, bouche ou oreilles.
- Ne pas ajouter une seconde convention de rotation indépendante de celle de la tête.

## Preuves obligatoires
- Même seed et paramètres : captures SVG à 0°, +30° et −30°.
- À 0° : rendu identique au rendu de référence.
- À ±30° : silhouette capillaire cohérente avec la silhouette du crâne, sans décollement ni inversion gauche/droite.
- Vérifier au moins une coiffure courte et une coiffure longue.
- Test automatique : coordonnées finies, ordre des calques conservé, déterminisme à seed identique.
- Indiquer les tests réellement exécutés et les fichiers modifiés.

## Critère d'arrêt
Ne pas poursuivre vers les mèches individuelles si la masse capillaire n'est pas validée. Si l'étape 2 n'est pas intégrée ou si la projection commune manque, ne pas bricoler une rotation locale : fournir le blocage précis et le prérequis minimal.
