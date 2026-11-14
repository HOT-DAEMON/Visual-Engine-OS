# Nez : narines en fentes allongées (vue de dessous éclairée)

Mise à jour du 14 nov. 2026, branche `feat/hair-grammar`. Suite de `NOSE-BASE-MASS.md` §4 bis (« les narines sont de petits creux ronds, loin des ouvertures de la réf. 04 »). Reste à faire : `NOSE-REFS-REMAINING.md`.
Légende : ✅ fait et prouvé · 🟡 partiel · ⬜ non fait.
Code : `src/face/nose/base-mass.ts` (`SLIT`, `sdSlit`), `src/face/nose/types.ts` (`NostrilGeo.shape`), `src/relief/underview.ts` (`CAVITY_AO`), `src/verify/nose-lit.ts` (`nostrilElongations`, règle `nose-lit-nostril-elongated`).
Mesure : `scripts/nose-refs/extract_04_nostrils.py` → `references/nez/measures-04-nostrils.json`. Preuves : `artefacts/nez-narines-fentes/` (script `scripts/artefacts-nose-slit.ts`). Tests : `tests/nose-nostril-slit.test.ts` (4).

## 1 · Le défaut
Les cavités de la base étaient des ellipses presque rondes (rapport 1,05 a / 1,25 b ≈ 1,3 dans l'empreinte) : le dessous se lisait comme un museau. La réf. 04 dessine les ouvertures comme des traits épais et allongés, extrémité externe relevée.

## 2 · Ce qui a été mesuré (réf. 04, pas lu à l'œil)
Méthode : pixels sombres → ouverture morphologique 5 × 5 (retire les contours fins) → composantes → axe principal (ACP) lu dans le repère de l'ellipse cyan la plus proche (roulis compensé) ; sont gardés les traits à moins de 45° de l'axe majeur.
| grandeur | valeur | échantillon |
|---|---|---|
| allongement du trait | médiane 3,31 (2,12–5,0) | 9 traits ; **majorant** (l'épaisseur est celle du trait dessiné) |
| élévation de l'extrémité externe | médiane 23° | 8 traits sur 9 positifs |
| longueur / axe majeur de l'ellipse | médiane 0,199 | 9 traits (réf. 03 : 0,217 de la largeur du nez, 34 traits) |
Réf. 03 (`measures-03.json`, déjà versionnée) : allongement médian 2,23 sur 34 traits.

## 3 · Ce qui a été fait ✅
- Les cavités de `base-mass.ts` sont des **fentes** (`sdSlit`) : ellipse de demi-axes (A, B), axe tourné de 23° (extrémité externe plus haute à l'écran), ligne médiane courbée en sourire, symétrie miroir.
- Allongement = 1 + 2,2 × `nostrils.shape` (0 = creux rond, valeur par défaut 0,55 → 2,2 = la médiane de la réf. 03, la plus basse des deux mesures : la réf. 04 est un majorant). `shape` voyage maintenant dans `NostrilGeo` ; il pilotait déjà la goutte de la vue de face.
- Longueur totale = 0,20 × la largeur du nez, mise à l'échelle par la taille choisie (`nostril`).
- Preuve sur l'image (`tests/nose-nostril-slit.test.ts`, `artefacts/nez-narines-fentes/03`, `04`) : l'allongement mesuré sur le rendu croît avec `shape` à 40° et à 60° (0 → 1 : 1,21 → 3,62 à 40° ; 1,00 → 2,69 à 60°), la forme par défaut est à 2,9 (40°) et 2,4 (60°), dans la plage des deux références.
- Règle de vérification `nose-lit-nostril-elongated` (anatomie, `warn`, dès 40°) : allongement mesuré ≥ 1 + 1,5 × `shape` demandé ; elle **détecte** l'ancien creux rond (test) ; balayage de 120 visages tirés (seeds s × 977) à 40° : aucun échec d'erreur, aucun avertissement d'allongement, marge minimale de la règle des cavités +6 pixels.

## 3 bis · Régression trouvée par la suite complète, puis corrigée
Première version : 3 tests rouges sur 3 174 (`face-engine-verify` seed 105516, `hair-v2` seed 52169 et les visages à occlusions) : `nose-lit-nostril-cavities` (7 ou 6 pixels visibles pour 9 exigés à 40°). Cause : sur les petites narines à forte `shape` (a ≈ 2 px, `shape` ≈ 0,7) la fente n'avait que ≈ 1 px de demi-épaisseur. Ma première règle sur 80 visages ne les avait pas tirés. Correction : taille choisie agissant en racine carrée (`sizeExponent` 0,5) et épaisseur plancher 0,04 × la largeur du nez (`minThicknessOverWidth`) ; le nez par défaut est inchangé (B = 2,17 px > plancher 1,92). Après correction : les 5 fichiers concernés passent (114 tests) ; la suite complète n'a PAS été relancée en entier après ce correctif (20 minutes), seulement ces fichiers.

## 4 · Choix NON mesurés (honnêtement)
- Courbure du trait (flèche 0,9 × B) et rapport profondeur / épaisseur de la cavité (1,2 × B, plafonné à 0,95 H) : choix de construction. Plus profonde (4 × B) la cavité est cachée par son bord dès 40° (44 pixels de cavité au lieu de 497) ; plus mince, elle se lit comme un pli.
- `CAVITY_AO = 4` (poids d'occlusion dans les cavités, 1,8 avant) : choix ; l'effet visible est faible (la cavité est déjà sombre par sa géométrie).
- Le rapport longueur / largeur de la fente en vue de face (`dropPoly`) n'est pas modifié.

## 5 · Défauts visibles, non cachés
- Les ouvertures restent petites et peu sombres comparées aux traits noirs de la réf. 04 : sur le rendu, la cavité moyenne a une luminance 0,69 × celle de la peau (92 contre 132), la réf. est un aplat noir. Un dessin au trait et un rendu éclairé ne sont pas comparables pixel à pixel ; aucune mesure ne dit quel niveau de noir est « juste ».
- À 20° les fentes se lisent bien ; à 60° elles se réduisent à un croissant (le bord les masque).
- L'échantillon de la réf. 04 est de 9 traits ; un trait (nez 8, −26°) a une élévation négative : il peut être un morceau de contour ou une autre pose. Médiane et signe majoritaire (8/9) retenus, pas démontrés.
- Le nez de la tête 3D (`head_3d`) ne consomme PAS cette vue : `artefacts/nez-narines-fentes/05` le montre inchangé (bosse + deux ellipsoïdes). Le gain est visible dans la vue de dessous, les artefacts, `verifyFace`.

## 6 · Non fait (inchangé, voir `NOSE-REFS-REMAINING.md`)
Épaisseur de paroi des narines ; branchement de la vue de dessous dans `head_3d` ; lobule allongé à 60°, encoche « cloche-ailes », bandes fines à 40°, ombre très sombre ; réf. 01/02 non quantifiées ; planche 06 non re-comparée ; matériau et texture propres au nez.
