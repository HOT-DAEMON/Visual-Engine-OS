# Yeux — passe 6 : détecteur de cellules (réf. 17) et yeux non tracés (réf. 13)

Suite de `EYES-REFS-2.md`. Aucun moteur par référence : les silhouettes mesurées alimentent les **mêmes** recettes d'enveloppe (`fit-recipes.ts` → `eye-ref-fits.ts` → `eye-gallery-ext.ts`).

## 1. Réf. 17 : un motif périodique, pas une image coupée
- La réf. 17 (612 × 612) est un fragment d'un motif qui se répète tous les **477 px** en x et en y (autocorrélation : pics à ±477 ; décalage sous-pixel mesuré par corrélation de phase sur les bandes de recouvrement).
- Les yeux « coupés par la tuile » existent donc en entier ailleurs dans la période. `scripts/eye-refs/detect_cells.py` reconstruit **une période complète** (toutes les copies recalées, moyennées), la pose en 3 × 3 (aucun raccord) et détecte les **cellules** : un groupe d'encre = un œil + cils + sourcil.
- Résultat : 15 cellules (11 yeux ouverts, 4 sourcils ou yeux fermés), annotées : numéro `17-P00…P14`, boîte, aire d'encre, composantes classées (iris / ouverture / sourcil / cils). Sorties : `references/eyes/cells-17.json`, `artefacts/eyes-refs3/17-cellules.png`, `17-periode.png`.
- Essai écarté : ouverture déduite automatiquement par « trous » de l'encre fermée. Les paupières d'encre ne referment pas la fente (iris collé à la paupière, croissants de sclère), le résultat était faux.

## 2. Silhouettes : annotation assistée + accrochage au gradient
- Canthi et 6 à 7 points par marge posés **à la main** sur des recadrages à grille (repère de la période), puis accrochés au plus fort gradient de luminance (`extract.snap`).
- `traced-anchors.json` (nouveau) : 9 yeux de la réf. 17 (`17-P01, P03, P06, P07, P08, P09, P10, P13, P14`) et 9 yeux de la réf. 13 (`13-R{ligne}C{colonne}` : R1C1, R1C2, R1C3, R2C1, R2C3, R3C1, R3C2, R4C1, R4C3). Les 4 silhouettes déjà tracées sont **inchangées**.
- `extract_silhouettes.py` : suffixe `#period` (lit le motif reconstruit) et 6ᵉ élément optionnel = rayon d'accrochage (3 à 4 px pour les yeux « anneau » : P07, P13 et la réf. 13, dont les cils voisins attiraient le gradient).
- Limite assumée : les ancres sont lues à ≈ 2 px près sur des images agrandies ; P07 et P13 sont posées sur une ellipse (anneau iris/paupière), pas sur chaque pixel.
- Non traité : **13-R3C3** (sphère d'iris sans paupière : pas d'ouverture à mesurer).

## 3. Recettes et galerie
- `fit-recipes.ts` : 27 cibles (était 9), graines **figées par identifiant** (les ajustements existants ne dérivent plus quand on ajoute une cible). `13-E10` bouge un peu (aspect 0,5417 → 0,5102) : l'ancien ajustement datait d'avant la correction des angles.
- Galerie des 100 : **24** places occupées par des silhouettes mesurées (était 7) ; distance minimale aux 48 existantes et entre les 100 : 0,0208 (≥ 0,02).
- Iris « encre » : `INK_IRIS_OVER_HEIGHT = 0,85` (lecture sur P07 0,82, P08 0,86, P13 0,85, P14 0,85 ; P03 plein cadre 0,97 en exception). Valeur lue sur les cellules, pas mesurée par pixels.
- `eye-lash-families.ts` : le raccourcissement des cils vers la zone est borné aux minimums du schéma (cils ≥ 0,02, mèche de coin ≥ 0,15) ; sans cela, une enveloppe très ronde faisait lever une `ZodError` (test de dégagement : 0 cil sur l'ouverture sur 18 997, 1 100 combinaisons yeux × familles).
- Dernier recours du générateur : après 4 échecs de `verifyEye`, la famille de cils déterministe de l'indice est abandonnée (cils naturels du tirage) ; elle ne pouvait pas rentrer dans la zone pour 2 enveloppes.

## 4. Vérification
- `verify-eye-render.ts` (règle sclère claire) : ne sonde plus sous le trait de paupière (il remplit la fente des yeux ronds « encre ») et ajoute un point dans le quart bas de la fente (croissant de sclère des réfs 13/17).
- Tests : `eye-ref-fits.test.ts` (27 recettes), `eye-gallery-ext.test.ts` (100 yeux : `verifyEye` + pixels). `artefacts/eyes-refs2/08-verification.json` : 0 erreur, 0 pixel, 0 échec de paire.

## 5. Reste à faire (voir `EYES-REMAINING.md`)
Almond et formes des 100 non retravaillés ; look « encre » encore en dégradés (références : aplats noirs francs) ; 17-P07, P08 (RMS 0,078 et 0,077) et P01, P03 (≈ 0,055) mal ajustées ; réf. 14 ; limbe réf. 15 rangées 3–5 ; facettes d'iris ; épaisseurs de liner et dispersion non mesurées.
