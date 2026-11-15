# Rotation 2D/3D — exécution atomique

Branche cible : `feat/hair-grammar`

## Étape 1 — Contrat de rotation (aucune refonte)

### Objectif
Faire tourner un élément graphique dans l'espace autour de X, Y et Z, puis le reprojeter en 2D, sans imposer un rendu volumétrique 3D.

### À inspecter
- `src/face/pose/tree.ts`
- `src/geometry/eye/turn3d.ts`
- `docs/FACE-POSE.md`
- Le point d'entrée du rendu SVG actuellement utilisé par le visage.

### Constat de départ
- `poseTree` gère le lacet et le tangage, mais pas une rotation propre complète XYZ par nœud.
- `turn3d.ts` projette réellement l'ouverture de l'œil, mais ne constitue pas un moteur de rotation commun.
- `FACE-POSE.md` indique que l'arbre de pose n'est pas branché au rendu.

### Contrat à formaliser
Chaque élément doit distinguer :
1. `localPosition` : position dans le repère du parent.
2. `localRotation` : rotations X/Y/Z propres, en degrés.
3. `worldTransform` : transformation héritée des parents.
4. `cameraTransform` : orientation de la caméra, indépendante de l'objet.
5. `projection` : conversion des coordonnées caméra vers l'écran.
6. `visibility/depth` : visibilité et profondeur après transformation.

Conventions : X = horizontal, Y = vertical, Z = profondeur ; documenter explicitement le sens positif de chaque axe. Séparer rotation de l'objet, rotation de caméra et rotation 2D dans le plan de l'image.

### Travail autorisé
- Lire les fichiers listés et remonter uniquement les appels nécessaires au rendu SVG.
- Décrire les conventions et incompatibilités existantes.
- Proposer le plus petit contrat compatible avec le code actuel.
- Ajouter ou corriger uniquement la documentation de ce contrat.

### Interdictions
- Ne pas modifier le moteur de rendu.
- Ne pas convertir les composants en meshes ou volumes 3D.
- Ne pas réécrire `poseTree` ni `turn3d.ts`.
- Ne pas créer un second moteur parallèle.
- Ne pas lancer les étapes yeux, cheveux ou intégration.

### Preuves obligatoires
- Tableau court : axe / convention actuelle / prise en charge / manque.
- Schéma ou exemple chiffré démontrant une rotation X, Y et Z distincte.
- Liste des fichiers réellement appelés par le rendu SVG.
- Tests existants exécutés, avec résultat exact ; aucun test inventé.
- Si une convention est ambiguë, la signaler au lieu de la deviner.

### Critère d'arrêt
L'étape est terminée uniquement quand le contrat est cohérent avec les conventions du code et que le chemin réel jusqu'au rendu SVG est identifié. Ne commencer aucune implémentation avant validation de ce résultat.
