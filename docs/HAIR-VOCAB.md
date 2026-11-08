# Vocabulaire de formes par coiffure (`vocab.ts`, `shapes.ts`)

`VOCAB[style] = { cones: boolean }`. Table : cônes admis sur `short`, `spiky`, `curly`, `afro` ; proscrits sur `buzz`, sur cheveux PENDANTS (`bob`, `long`) et ATTACHÉS (`ponytail`, `bun`, `braids`). Mesuré avant : 100–130 cônes sur 40 visages `bob`/`long`, une couronne de dents.

Mise en œuvre : `coneLocks` TIRE tous ses nombres aléatoires puis écarte le résultat (`return VOCAB[...].cones ? out : []`) : le flux pseudo-aléatoire, donc le reste de la graine, ne change pas. Les cônes qui restent sont bornés (`reach: true`) et leur racine est sur le DESSUS du crâne (`|s| ≤ 0,7`).

Vérification : `style-vocabulary` (0 cône hors vocabulaire), 0 écart sur 368 visages ; contrôle négatif dans `tests/hair-coherence.test.ts`.
Limite : le vocabulaire est binaire (cônes oui/non) ; les autres formes (`flow`, `wisp`) ne sont pas filtrées par coiffure, seulement bornées. Voir `HAIR-COHERENCE-REMAINING.md`.
