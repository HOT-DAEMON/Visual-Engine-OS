# Ombres de contact et lumières de contour

Contrat : `src/contact/types.ts` ; réglages : `src/schema/face-lighting.ts`. Registre du visage : `src/render/face/components.ts`.
Tests : `tests/contact-rim.test.ts`. Preuves : `artefacts/face-anatomy/` (11, 12).

## Un composant se déclare, le sous-moteur fait le reste

`FaceComponent` = identité, PARENT, type (`caster` posé / `socket` creux), silhouettes, hauteur au-dessus de la surface, receveurs, clés de réglage.
Arbre du visage : `head` → `nose` → (`tip`, `alaL`, `alaR`) ; `head` → `orbitL/R`, `earL/R`, `mouth`, `chin`, `hair`, `neck`.
`relations()` en tire parent / enfants / frères (un parent inconnu est une racine). Ajouter un composant futur (épaule, lunettes, boucle) = en ajouter la déclaration :
test « un composant futur s'ajoute en le déclarant ».

## Ombres de contact (`compileContact`)

Deux termes par composant : occlusion ambiante (trait flou au contact, jamais nulle) + ombre portée (silhouette décalée à l'opposé de la lumière, décalage ∝
hauteur et 1/inclinaison, flou ∝ douceur de la source). `directionality` répartit entre les deux ; `strength × master` donne l'opacité.
- Pièce collée : opacité plafonnée à `MAX_PEAK` = 0,55 (contrôle `contact-not-sticker`).
- Objet flottant : part au contact ≥ `MIN_CONTACT` = 0,35 même en directionnalité 1 (contrôle `contact-not-floating`) ; écart ombre/composant mesuré (`contact-gap`).
- Composant POSÉ : l'ombre est un ANNEAU (silhouette agrandie et décalée moins silhouette, pair-impair sur le remplissage) : rien sous le composant. Composant
  OPAQUE (tête, lèvre, cheveux) : pas d'évidement. CREUX : croissant du côté lumière ; sans bord réel (orbite) il s'estompe, avec bord réel (oreille) il est borné.
- Mâchoire → cou : `jaw.neckTransition` adoucit, `jaw.submental` + abaissement de la mandibule renforcent et étalent l'ombre.
Réglages par composant : `nose`, `alae`, `orbits`, `ears`, `jaw`, `mouth`, `hair` ; `master` global.

## Lumières de contour (`resolveRims`, `renderRim`)

Réglables SÉPARÉMENT par composant (`head`, `nose`, `tip`, `alae`, `ears`, `chin`, `mouth`, `neck`) : `color` (`null` = teinte de contour de l'apparence),
`intensity`, `width` (apparente), `side` (`auto` = côté OPPOSÉ à la lumière principale, contrat du moteur d'apparence ; `left`, `right`, `top`, `bottom`, `all`),
`influence` {parent, enfants, frères}. L'intensité d'un composant se partage UN SAUT (jamais de cascade) à son parent, ses enfants, ses frères ; le reçu est
borné à 0,5 × l'intensité propre (0,25 sans réglage propre) et l'intensité totale à 1. Le liseré est flou, clippé à la silhouette, dégradé le long du
côté éclairé ; les composants à côtés artificiels (menton, cou, racine du nez) portent `rimEdge` (arêtes réelles seulement).
Défauts DISCRETS (0,08–0,22) : un liseré, pas un contour.
