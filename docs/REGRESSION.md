# Régression visuelle

Principe : **la validité mathématique ne garantit pas le rendu artistique.** Les invariants (`docs/CONTRACTS.md`) disent que la
géométrie est cohérente ; la régression visuelle dit que l'image n'a pas dérivé. Les deux sont nécessaires.

Commandes : `npm run regress` (vérifie), `npm run regress:update` (réécrit les références : action EXPLICITE, jamais
déclenchée par un test), `npx tsx scripts/regress-boards.ts` (planches comparatives).

## Références permanentes (`references/visual/`, 34 cas, 170×210)

- **16 tirages standard** à graine fixe (`STANDARD_SEEDS`, ne jamais renuméroter).
- **18 cas difficiles** (`HARD_CASES`), chacun avec la raison de sa difficulté (`why`) : mâchoire minimale / maximale, bouche
  ouverte articulée, stylisation maximale, encre, expression caricaturale, éclairage rasant, contre-jour, nez extrêmes, bouche
  minuscule / immense, menton extrême, cou tendu, tête étroite, et deux défauts RÉELS du moteur de cheveux trouvés par la
  campagne (graines 46 et 81). **Règle : un cas difficile n'est jamais retiré parce qu'il gêne** ; il est corrigé ou documenté.

## Décision (du plus strict au plus tolérant)

1. `exact` : le SVG a le même sha1 que celui de la référence (rien n'a changé) ;
2. `close` : SVG différent mais image sous les seuils (RMS ≤ 1,5 ; pixels > 8/255 ≤ 0,2 %) ;
3. `changed` : au-dessus → ÉCHEC (régression, ou changement voulu à confirmer par `regress:update`) ;
4. `missing` : référence absente.
Mesures : `src/regression/diff.ts` (RMS, écart max, part de pixels > 8 et > 32, carte de chaleur, grille de luminance) ;
décodeur PNG sans dépendance : `src/regression/png.ts`.

## Contrôle négatif (la comparaison voit-elle vraiment ?)

`artefacts/regression/03-controle-negatif.png` : une dérive de 0,04 sur `jawWidth` donne RMS 3,6 et 1,4 % de pixels > 8/255
sur un cas difficile, RMS 7,9 sur un tirage standard : détectée par la comparaison, invisible pour un test d'invariants seul.
Un premier contrôle sur le cas 02 n'a RIEN détecté : ce n'était pas la comparaison qui échouait mais `jawWidth` qui sature
(voir constats).

## Variations sur graines fixes (`src/regression/variations.ts`)

24 graines fixes : distance minimale entre visages > 2 niveaux de gris RMS (mesuré : 5,2), moyenne > 10 (mesuré : 34), aucun
visage aberrant (z robuste par MAD), même graine ⇒ même hachage SVG caches vidés. Mesures de structure qui ne varient jamais
d'un tirage à l'autre : `cranium.templeHalf` (invariant par contrat), `mandible.dropPx` et `neck.platysmaTension` (l'ouverture
de la bouche n'est pas tirée) ; elles sont listées dans le test, pas ignorées.

## Constats mesurés par ces outils

| Constat | Mesure | Statut |
|---|---|---|
| `jawWidth` ∈ [0,9 ; 0,98] sans effet quand masséter et graisse sont au maximum | SVG identique | documenté (contour saturé) |
| `mouth.width` ≈ 0,27 sans effet sur le visage par défaut | correction `mouth-inside-contour` : 45 → 38,6 px | rendue OBSERVABLE (`lm.corrections`) |
| Bouche écrasée dans une mâchoire étroite (cas 01) | 45 → 12,6 px (28 %) | avertissement `contract-no-crushed-request` ; non corrigé |
| Dents inférieures hors de la cavité avec `jawShift` | 82 % dedans (< 90 %), graine 931 | CORRIGÉ (`artefacts/regression/04-…`) |
| Mèche frôlant la bouche (graine 46), oreille couverte (graine 81) | `front-clear-mouth` 0,02/0,02 ; `ear-free-right` 0,13/0,12 | antérieurs à ce travail, cas 17 et 18 |

## Campagne de 100 visages (`scripts/campaign-100.ts`, `artefacts/campagne-100/`)

98 visages sur 100 passent la vérification, 19 ont au moins un avertissement ; 58 s au total (583 ms par visage, rendu +
vérification + planches). Corrections du résolveur sur 100 tirages : `mouth-inside-contour` 53, `chin-height-room` 41,
`neck-between-chin-and-jaw` 14, `mouth-below-nose` 3. Autrement dit, la largeur de bouche demandée est ramenée par le contour sur
plus d'un visage tiré sur deux : la plage utile de `mouth.width` est plus étroite que sa plage déclarée.
Avertissements : `contract-no-crushed-request` 7, `silhouette-asymmetric` 6, `hair-skin-contrast` 5, `chin-height-honoured` 4.

## Reste à faire

- Seuils RMS / pixels fixés à l'œil sur 34 cas : à recalibrer quand le corpus grossira.
- Les références ne couvrent pas les vues de profil et de trois quarts (non implémentées).
- Pas de métrique perceptuelle (SSIM) : RMS et fraction de pixels seulement.
- La carte de chaleur est produite par script, pas par un test.
