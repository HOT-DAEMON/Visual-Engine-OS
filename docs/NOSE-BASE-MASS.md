# Nez : masse de la base (vue de dessous éclairée), règles de vérification, mesures 03/05

Mise à jour du 14 nov. 2026. Suite de `NOSE-UNDERVIEW-LIT.md` (§4) ; reste à faire : `NOSE-REFS-REMAINING.md`. Légende : ✅ fait et prouvé · 🟡 partiel · ⬜ non fait.
Preuves visuelles : `artefacts/nez-base-mass/` (01 réf. 04 / avant / après · 02 métriques · 03 têtes complètes + dessous du même visage). Script : `scripts/artefacts-nose-base-mass.ts`.

## 1 · Le défaut et sa cause
La carte de profondeur v1 posait lobule, ailes et columelle comme des surfaces SÉPARÉES (max de z) à partir des polygones de FACE : deux plaques d'ailes plates à bord vif et une tige. La réf. 04 montre l'inverse : lobule + ailes = UN ovoïde, la columelle un V qui en descend, les narines des cavités. Fusionner les polygones dans le repère de face ne suffit pas (essai 1 : une « corne », la hauteur de face du lobule devenant sa profondeur).

## 2 · Ce qui a été fait (`src/face/nose/base-mass.ts`, utilisé par `src/relief/underview.ts`)
- ✅ La base est construite dans SA empreinte (x × profondeur w) : union lissée (min polynomial) du lobule, des deux ailes, d'un cœur central et de la bande de la columelle ; relief parabolique (pente finie au bord, pas de mur) ; narines = cavités à paroi lisse, positions lues sur `noseGeometry`.
- ✅ Les ailes s'étendent TOUJOURS jusqu'au lobule : sans cela, les nez à forte projection (≥ 2 × la largeur) redevenaient un champignon (col 0,04–0,15) — trouvé par les règles de vérification sur des visages tirés, pas à l'œil.
- ✅ Profondeur d'une narine ≤ 0,9 × son demi-axe : un puits plus profond que large est caché par son bord dès 20–40° (6 visages tirés sans aucun pixel de cavité visible).
- ✅ Corrigés au passage : cadre calculé sur la masse (le nez était tronqué à 60°), plan de peau couvrant tout le cadre, bord de silhouette sur-échantillonné (le plan de peau filtrait en points), lissage de profondeur bilatéral (marches du tampon), option `shadow` de `litUnderview` (teinte d'ombre de l'hôte, comme la tête).
- Constantes de construction (rayons en profondeur, congés `0,42 × largeur`, hauteur `0,20 × largeur`, lobule ≥ `0,24 × largeur`, début des ailes à `0,05 P`) : **CHOIX, NON MESURÉS**. Les rapports de hauteur viennent de `UnderviewModel`, toujours NON validé (`NOSE-UNDERVIEW-CALIB.md`, résultat négatif).

## 3 · Règles de vérification (`src/verify/nose-lit.ts`, dans `verifyFace`)
| couche | règle | borne | sévérité |
|---|---|---|---|
| geometry | `nose-lit-finite`, `nose-lit-no-holes` | valeurs finies ; ≤ 3 trous | error |
| anatomy | `nose-lit-single-mass` (solidité = aire / enveloppe convexe) | ≥ 0,75, dès 40° | error |
| anatomy | `nose-lit-no-stalk` (col = plus étroit / plus large, partie médiane) | ≥ 0,45, dès 40° | error |
| anatomy | `nose-lit-nostril-cavities`, `-cavity-deeper` | ≥ 16 px (à 2 px/px, ramené à la surface) dès 40° (≥ 1 à 20°) ; cavité plus profonde que la peau voisine | error |
| style | `nose-lit-not-flat`, `nose-lit-shadow-not-black` | écart-type de luminance ≥ 12 ; pixels < 0,3 × luminance de la peau ≤ 35 % | warn |
| style | `nose-lit-nostril-separation` | plage de la réf. 03 (0,38–0,50) | warn |
Mesuré : 4 nez × 4 tangages, puis 120 visages tirés à 40° : solidité ≥ 0,793, col ≥ 0,784 ; le défaut v1 (fixture `tests/helpers-nose-underview-v1.ts`) a un col ≈ 0,2 et une solidité ≤ 0,80 (≤ 0,72 à 60°). Le COL est le discriminant fort ; la solidité sépare à 60° seulement. `tests/nose-lit-verify.test.ts` prouve la détection de l'ancien défaut (une règle qui ne détecte rien ne prouve rien). Coût : ≈ 0,11 s par appel de `verifyFace` (rendu à 1,5 px/px, seuils de pixels ramenés à la surface ; à 2 px/px : ≈ 0,18 s). Rebalayé à 1,5 px/px sur 120 visages × 3 tangages : aucune règle d'erreur en échec (col ≥ 0,78, solidité ≥ 0,80, cavités ≥ 14 px pour un seuil de 9). Le test `hair-v2` « occlusions autorisées » (40 × `verifyFace`) a dépassé ses 30 s par défaut : son délai est porté à 90 s.

## 4 · Mesures 03/05 (`scripts/nose-refs/gen-refs.ts` → `src/face/nose/refs.generated.ts`)
- ✅ Les résumés de `measures-03.json` et `measures-05.json` sont générés (test : égalité exacte avec les JSON) et lus par la règle de séparation des narines.
- ⬜ **Aucune brillance, aucun matériau ni couleur de pointe** : 03 et 05 sont des dessins en niveaux de gris, l'information n'existe pas. Rien n'a été inventé.
- ⬜ Moucheture de la réf. 05 (médiane 0,34 / 1000 px²) : ≈ 1 à 2 points par nez, sans effet visible ; aucune texture n'en est dérivée.
- ✅ **Séparation des narines : corrigée après coup** (nez par défaut 0,30 → 0,432 ; mesuré 0,381–0,496) en changeant la loi de placement de `nostrils.ts`, ce qui a déplacé tous les visages (références visuelles mises à jour). Voir `docs/NOSE-NOSTRIL-PLACEMENT.md`.

## 4 bis · Défauts visibles du résultat (non cachés)
- Le défaut « champignon » est corrigé, mais le rendu se lit comme un museau arrondi : **les narines sont de petits creux ronds, loin des ouvertures sombres de la réf. 04, et le V de la columelle est à peine lisible**.
- Le nez par défaut garde un lobule allongé à 60° ; « cloche-ailes » une encoche en haut ; de fines bandes horizontales à 40° (marchage d'ombre, pas la profondeur) ; ombre toujours très sombre (la teinte d'ombre de l'hôte n'a presque rien changé).
- Solidité minimale observée 0,774 à 40° sur d'anciens tirages avant le cœur central, 0,793 après : les nez très larges restent les moins bons.

## 5 · Branchement dans `head_3d` : ⬜ TENTÉ, RETIRÉ
Un maillage de base (`masse` posée sous le nez du maillage de la tête, profondeur ramenée à la projection de pointe du profil) a été écrit et mesuré. À cadrage identique avec/sans, il ne change que 1,6 à 2,5 % des pixels du gros plan (≤ 4,6 % par cellule) et les ombres y sont en éclats. Peu enfoui (0,004 et 0,015 U), il fait échouer `head.roll.joined` (silhouette tête + cou en 3 morceaux, tests `head-turntable-skull` et `pipeline-head-3d`) ; enfoui à 0,03 U la règle passe mais l'effet devient presque nul. Ce n'est ni une preuve visuelle ni un moteur utile : retiré (aucun code mort). **`head_3d` garde sa bosse + deux ellipsoïdes d'ailes** ; la vue de dessous éclairée n'est consommée que par les artefacts, les tests et `verifyFace`. Piste non faite : construire le nez de la tête comme un relief à part entière (cavités percées, normales propres) au lieu d'un patch.

## 6 · Non fait (inchangé)
Réf. 01 et 02 non quantifiées ; planche 06 non re-comparée ; rougeurs de la réf. 05 impossibles ; compilateur propre au nez (non nécessaire, fonctions pures) ; archétypes absents du générateur aléatoire ; asymétrie des ailes, bosse osseuse, cartilage supra-alaire.
