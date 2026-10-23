# Journal des changements — suite 8 (continuité du menton, lobule, tirage d'oreilles, performance)

## Corrigé

- **Mentons « décollés » / en goutte d'eau** (planches 01–03 de la campagne, 13 visages signalés) : le bas du contour est reconstruit convexe par
  construction. Détail, formules et limites : `docs/JAW-CHIN-CONTINUITY.md`. Mesure : rotation de tangente à contre-sens 30–80° → 0° ;
  10 000 visages tirés, 0 violation (`scripts/chin-fuzz.ts`).
- **Alignement des lobules** (erreur de consigne de l'utilisateur, reconnue) : le bas du lobule vise la **base du nez** (`anchors.lobuleLine = 'nose-base'`).
  L'ancienne cible (ligne de la bouche) donnait ≈ 0,41 H ; elle reste disponible (`'mouth'`) pour comparaison. Champ renommé
  `lobuleToMouthLine` → `lobuleToLine` (+ `lobuleLineY`), contrôle `ear-lobule-on-line-*`.
- `chinWidth` par défaut 0,22 → 0,35 (0,22 était sous le plancher de continuité : menton élargi d'office).

- **Extrémité de l'implantation hors du crâne** (défaut antérieur, révélé par la campagne : graines 35, 65, 89 ; ratio 1,038) : bornée à la demi-largeur réelle du crâne
  (`src/face/zones.ts`). Cause : contour presque horizontal près du sommet, deux échantillonnages (40 et 48 points) donnaient des largeurs différentes.

## Ajouté

- `src/verify/jaw-continuity.ts` : mesures de silhouette et contrôles sur trois couches (géométrique, anatomique, style), branchés dans `checkFaceEngine`.
- Tirage aléatoire des oreilles en option : `structure: { draw: { ears: true } }` (flux dérivé ; graines existantes inchangées, testé).
- Rendu de campagne multi-processus : `scripts/lib/parallel.ts` + `campaign-worker.ts` (`JOBS=n`, défaut = nombre de cœurs ≤ 8). Sortie identique à la série,
  octet pour octet (vérifié sur 4 graines).
- Tests : `chin-continuity` (800 visages, extrêmes, plancher, contrôle négatif), `ear-draw`.

## Performance

- `rightSamples` mémoïsé par contour (WeakMap) et `halfWidthAt` dichotomique : le profil montrait ~27 % du temps de vérification dans le recalcul des échantillons.
  Vérification d'un visage, caches vidés : **≈ 490 → ≈ 280 ms** (même résultat : tests inchangés).
- Rastérisation (≈ 250–300 ms/visage à 340×420) : **non améliorée**. Profil : 95 flous distincts (aucun partageable), 2 turbulences (~30 %), formes ~107 ms.
- Le gain de `JOBS` n'a pu être mesuré ici (machine à 1 cœur) : attendu proche de ×(nombre de cœurs), à confirmer sur la machine de l'utilisateur.

## Changements de contrat à connaître

- `chin.widthPx` dépend de la mâchoire quand le plancher est actif (`dependencies.ts`). `chinWidth` < plancher est saturée (balayage de `monotone.ts` décalé à 0,34–0,46).
- `shape.flat` est une fraction de la largeur atteignable (le réglage « largeur de la symphyse » n'est plus écrêté).
- Références visuelles (`references/visual/`) régénérées : le menton a changé sur tous les visages structurés.
