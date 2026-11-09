# Frange sans dents de scie (`fringe.ts`, `fringe2.ts`, `hair-fringe-edge.ts`)

Suite de `HAIR-FORM.md`. Traite `HAIR-FORM-REMAINING.md` 8 et `HAIR-BOUNDARY-REMAINING.md` 6.

## Problème
Le bord inférieur de la frange `short` se lisait comme un PEIGNE : mèches de même largeur à pas réguliers, donc dents identiques.

## Mesure (`fringeRhythm`)
Coefficient de variation (écart-type / moyenne) de l'espacement des racines et de la largeur de base des mèches de frange (`kind === 'fringe'` du v2 ou `bang` du classique). `regularity` = max des deux : une scie a les deux faibles. Moins de 6 mèches : rien à juger.
Essai écarté : proéminence et pas des pics de l'enveloppe inférieure (ne discriminait pas ; c'est la SIMILARITÉ des dents qui fait lire le peigne).

## Correction
- **Classique** : écarts de racine `0,45 + 2,6·u·v` (inégaux), largeurs `max(0,006 W, |écart| × mult)`, `sharp` tiré dans [0,15 ; 0,50], 12 % de fils isolés plus fins. Mèches marquées `bang`.
- **Lames (`fringe2`)** : racines tirées à ±0,88 de la demi-portée, largeurs stratifiées, mise en page par TIRAGE REJETÉ (8 essais max) jusqu'à un rythme ≥ 0,4. Les valeurs aléatoires sont tirées avant : la suite de la chevelure ne change pas.
- Racine bornée à ±0,88 xF et `power` 1,05 : sans ces bornes, une lame de bord trop large dépassait `fringe-reach-bound` et la limite des sourcils.

## Vérification
`fringe-rhythm-natural` : `regularity ≥ 0,25` (minimum du corpus après correction : 0,37). Seuil calibré sur le corpus.

## Limites
La frange `wispy` garde un fin zigzag. Le seuil 0,25 n'est pas une référence d'illustrateur. Revue humaine : `artefacts/hair-finish/`.
