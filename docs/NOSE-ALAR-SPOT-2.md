# Aile du nez : continuité du terminateur, aile proche vs lointaine — 18 nov. 2026 (3e passe)

Suite de `NOSE-ALAR-SPOT.md`. Cette passe **corrige une erreur de mesure** de la précédente, établit la cause de l'ovale clair à 60°, le corrige dans l'éclairage (`nose-light.ts`, `paint.ts`, géométrie intacte) et ajoute une règle de vérification.

## 1. Erreur de mesure découverte : la mesure précédente portait sur l'aile LOINTAINE
`spotOf` retenait l'aile de plus petite profondeur moyenne caméra : c'est l'aile la plus **cachée**, du côté ombre (pyramide, graine 11 : 733 pixels de coque à 45° contre 1 350 pour l'aile visible ; 537 contre 1 299 à 60°). Les chiffres de `NOSE-ALAR-SPOT.md` (rapport 1,10 → 1,03, graines 2 et 5 « plus sombres ») valent donc pour l'aile **lointaine**. L'aile proche (la plus visible) n'avait jamais été mesurée, d'où l'ovale « non expliqué » à 60°. `spotOf(spec, yaw, pitch, which)` accepte maintenant `'proche'` (plus de pixels) ou `'lointaine'` (défaut : mêmes valeurs qu'avant).

## 2. Aile lointaine : pourquoi 2 graines sur 6 restent « plus sombres » (0,65 et 0,37)
Décomposition par pixel (pyramide 45°, graines 11 / 48) : lumière directe et rebond nuls des deux côtés ; **contour de lumière (rim)** aile 0,007 / 0,004 contre anneau 0,100 / 0,041 ; n.z moyen aile 0,66 / 0,67, anneau 0,41 / 0,52. L'anneau (2–7 px autour) inclut la joue latérale qui se détourne et reçoit le contour de lumière ; l'aile, ramenée vers la face, est de face et n'en reçoit pas. Écart de luminance de la graine 48 : 15,2 contre 23,0, ce que le seul terme de contour explique.
- **Ablation** (contour coupé, 6 graines, 45°) : rapport 1,108 · 0,948 · 0,961 · 1,064 · 0,897 · 1,108 (au lieu de 1,066 · 0,653 · 0,912 · 1,033 · 0,369 · 1,071) ; le « bord » mesuré tombe à **0 sur les 6** : le saut de 4–13 niveaux de luminance de la mesure précédente était le contour de lumière de l'anneau, pas un bord de l'aile.
- La normale de face de l'aile est cohérente avec la joue voisine : écart angulaire moyen 4,1°–6,8°, max 14°–19° (3 graines × 45°/60°).
- **Conclusion : pas un défaut de rendu.** Le rapport ≠ 1 vient d'un anneau biaisé par la courbure de la joue. La métrique « rapport / bord » ne convient pas ; elle est conservée (reproductibilité) mais ne doit plus servir de critère.

## 3. Aile proche à 60° : cause de l'ovale clair (établie)
Part de pixels **éclairés** de l'aile proche (cel, lumière trois-quarts droite), pyramide, graines 11 / 1203 / 48 : à 60° **0,25 / 0,02 / 0,07** contre **0,00** pour la joue autour. Variantes de la normale de l'aile à 60° : normale du maillage brute 0,71 / 0,74 / 0,74 ; normale adoucie (85 %) 0,25 / 0,02 / 0,07 ; normale de face analytique 0,00 ; moyenne des normales de joue voisines 0,00. Cause : les **15 % de normale d'ellipsoïde** qui survivent à `BLEND` franchissent le seuil franc du cel là où la joue est juste du côté ombre : ovale clair à bord net. Ce n'est ni le rebond (0 des deux côtés), ni l'occlusion. À 45° la part éclairée de l'aile proche est celle de la joue (0,83 / 0,82 / 0,80 contre 0,78 / 0,72 / 0,73).

## 4. Correctif : `terminatorClamp`, `wingLighter` (`nose-light.ts`)
L'aile fait partie de la face : la décision éclairé / ombre se prend sur la face, la rondeur de l'aile ne déplace le terminateur que de `TERMINATOR_MARGIN` = 0,04 (en cosinus). `terminatorClamp(n, nFace, w, dir)` ramène `n·dir` dans `[face − 0,04, face + 0,04]` (fondu par le poids d'aile `w`) en ajoutant la composante nécessaire le long de la lumière (4 renormalisations). `wingLighter(spec, view, L)` assemble adoucissement + continuité et ne résout les ellipsoïdes qu'**une fois** (l'ancien appel par pixel de `softenedNormal` refaisait `alaOf` : une graine passe de ≈ 11 s à 3–8 s, mesure non isolée). `paint.ts` l'utilise pour `PART.bump` ; `ao`, `cast`, `aoBounce`, géométrie : inchangés.
Résultat : part éclairée de l'aile proche à 60° **0,00 / 0,00 / 0,00** ; à 45° 0,85 / 0,82 / 0,80 (inchangé).

## 5. Règle `eng.nose.alar-terminator` (style, bloquante) — `noseLightStyle` dans `verify-engines.ts`
`wingTerminatorGap(spec, view, L, continuity)` échantillonne la coque visible de l'aile la plus visible et renvoie la part des points dont la décision éclairé / ombre diffère de la face **et** dont l'écart de n·l dépasse la marge. Règle : max sur les lacets 30 / 45 / 60 / 70° ≤ 0,02. Mesuré (12 graines × 4 nez, médiane / max) **sans** continuité : 30° 0,01–0,02 / 0,07 ; **45° 0,24–0,26 / 0,29 (libre 0,43)** ; **60° 0,04–0,12 / 0,17** ; 70° 0 ; **avec** : 0 partout. Elle détecte donc l'ancien état ; avec le correctif elle vaut 0 par construction (règle de non-régression : elle échouerait si `BLEND`, la marge ou le chemin de `paint.ts` changeaient).

## 6. Aile lointaine, cloche-ailes, plat-trapèze, après correctif (rapport par graine, 6 graines)
Avant (état de `e40eea6`) → après, sans changement attendu (aile lointaine, lumière directe nulle) :
| Nez / lacet | Avant | Après |
|---|---|---|
| pyramide 45° | 1,067 · 0,659 · 0,912 · 1,033 · 0,380 · 1,072 | 1,066 · 0,653 · 0,912 · 1,033 · 0,369 · 1,071 |
| pyramide 60° | 0,919 · 0,607 · 0,895 · 0,953 · 0,464 · 0,897 | 0,924 · 0,609 · 0,896 · 0,955 · 0,467 · 0,898 |
| cloche-ailes 45° | 1,064 · 0,656 · 0,915 · 1,052 · 0,393 · 1,081 | 1,063 · 0,650 · 0,914 · 1,052 · 0,381 · 1,080 |
| cloche-ailes 60° | 0,915 · 0,593 · 0,895 · 0,949 · 0,461 · 0,895 | 0,921 · 0,596 · 0,897 · 0,952 · 0,465 · 0,896 |
| plat-trapèze 45° | 0,985 · 0,939 · 1,006 · 0,973 · 0,577 · 0,950 | 0,985 · 0,933 · 1,005 · 0,973 · 0,565 · 0,949 |
| plat-trapèze 60° | 0,957 · 0,638 · 0,895 · 0,974 · 0,458 · 0,957 | 0,964 · 0,657 · 0,900 · 0,977 · 0,483 · 0,960 |
Les mêmes graines (2 et 5) sont sombres pour les trois nez et à 60° : c'est l'effet de tête et de contour de lumière du §2, pas du type de nez.

## 7. Preuves et tests
- `artefacts/nez-aile-tache-2/` : `zoom-avant.png` / `zoom-apres.png` (nez ×3, 3 archétypes × 2 graines × 30 / 45 / 60°) ; `tete-avant.png` / `tete-apres.png` (têtes complètes avec cheveux, 2 graines × 0 / 30 / 45 / 60 / 70°). `carte-ailes-60-avant.png` : à gauche le rendu d'avant à 60° (graine 11, ovale clair), à droite l'identification des ailes (rouge = aile proche, la plus visible, qui porte l'ovale ; bleu = lointaine, celle que mesurait la passe précédente ; plus clair = zone de fondu). Régénération : `npx tsx scripts/artefacts-nose-alar-spot2.ts artefacts/nez-aile-tache-2 avant|apres` (« avant » = `nose-light.ts` et `paint.ts` mis de côté).
- `tests/nose-alar-terminator.test.ts` : invariants de `terminatorClamp` (400 tirages) ; règle à 0 sur 4 nez × 6 graines × 4 lacets et > 0,1 sans continuité ; rendu à 60° : part éclairée de l'aile proche ≤ 2 % (3 graines).
- Verts : les 35 fichiers `nose*`, `head-turntable*`, `head3d*`, `light*`, `highlights-system*` (**272 tests**, 280 s), dont `nose-alar-spot` et le nouveau fichier. **Suite complète non relancée** (`tsc --noEmit` propre).

## 8. Limites et restes
- ⬜ Plat-trapèze à 60° : une petite tache claire subsiste à droite du nez sur la planche (graine 11), nettement réduite ; **non quantifiée**, cause non examinée.
- ⬜ Un seul éclairage mesuré (`three-quarter-right`, cel2) ; styles `soft` / `cel3` et autres azimuts non vérifiés.
- ⬜ Aile lointaine : la métrique rapport / bord est biaisée (§2), pas remplacée par une mesure à normale égale ; 6 graines.
- ⬜ La marge 0,04 est un choix visuel (non calibrée sur une référence dessinée) ; pas de mesure de rendu pour 0,02 ou 0,08.
- ⬜ Chiffre de vitesse non isolé (autres processus sur la machine pendant la mesure « avant »).
- ⬜ Toujours **non traités dans cette passe** : plat-trapèze 60°–70° (contour), teinte nez / joues, `round-dome-centered` de la pyramide, rougeurs de la réf. 05, reste de `FACE-STRUCTURE-NOSE.md`, vue de dessous dans `head_3d`.
