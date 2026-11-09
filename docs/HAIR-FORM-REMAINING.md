# Forme des cheveux sur le crâne — reste à faire et limites (par composant)

Fait : `HAIR-FORM.md` et la série 3 (`HAIR-FORM-ROOTS.md`, `-FRINGE.md`, `-DOMES.md`, `-HUE.md`, `-REVIEW.md`). Chaque ligne est une limite mesurée ou constatée sur les planches `artefacts/hair-form/` ; rien n'est caché. Les listes précédentes restent valables : `HAIR-SKULL-REMAINING.md`, `HAIR-COHERENCE-REMAINING.md`, `HAIR-BOUNDARY-REMAINING.md`.

## Remplissage de la coque (`crown-fill.ts`)
1. **Bord encore nu** : 0,22 (long) à 0,41 (spiky) en moyenne sur 8 visages, jusqu'à 0,58. 1 visage sur 121 dépasse le seuil d'avertissement `shell-rim-bare` (marge minimale −0,088). Les cibles `FILL.rim` (0,2 à 0,45) ne sont pas atteintes partout : la boucle s'arrête au plafond ou faute de mèche utile.
2. **Seuils et longueurs posés à la main** (`rim`, `all`, `len`, `max`, 0,5 pour le bord, 0,75 dur) sur 80 visages imposés + 120 aléatoires ; pas de référence dessinée par un illustrateur.
3. **Longueur de remplissage fixe** (`FILL.len` × H) : pas dérivée de la longueur réelle de la coiffure ni de `lengthVariance`.
4. **Raie (`bare.part`)** : non exclue du remplissage ; des mèches peuvent la recouvrir. Non mesuré.
5. **Coût** : boucle en O(plafond × cellules), avec jusqu'à 3 essais de racine par cellule (une copie de la grille de couverture par essai). Mesuré : 8 `hairGeometry` d'afro ≈ 1,9 s (≈ 230 ms chacune, géométrie seule, remplissage compris ; son coût isolé n'a pas été mesuré). Pistes : grille plus grossière, file de priorité, essais sans copie de grille.
6. **Pas d'interrupteur** du remplissage dans le moteur : le « avant » des artefacts se rend depuis un worktree du commit d'origine (`artefacts/hair-form/README.md`).
7. MAJ série 3 : `ponytail`, `bun`, `braids`, `buzz` ont maintenant des stries de peigne / du chaume avec dégradé (`HAIR-FORM-DOMES.md`). **Reste** : le chaume mat garde une tache diffuse ; l'intérieur du dessus des cheveux longs reste lisse là où aucune mèche ne passe ; seuil `dome-combed` 0,4 calibré sur corpus. Avant : aplats lisses (bord nu 0,88 à 1,00).

## Défauts visibles NON traités
8. MAJ série 3 : frange irrégularisée (écarts et largeurs inégaux, tirage rejeté ; `HAIR-FORM-FRINGE.md`), mesurée par `fringe-rhythm-natural` (≥ 0,25 ; min corpus 0,37). MAJ série 4 : zigzag `wispy` lissé et lames en touffes continues (`HAIR-BLADES.md`). **Reste** : seuils de corpus, pas de référence dessinée (`HAIR-BLADES-REMAINING.md`).
9. **Plaque sur le dessus du `long`** : cause trouvée et corrigée en grande partie (couverture du dôme + teinte d'étage vert olive plafonnée à 24°, `HAIR-FORM.md`). MAJ série 3 : la racine sombre n'est plus la sous-couche mais une bande de repousse à l'implantation et à la raie (`HAIR-FORM-ROOTS.md`) ; le plafond de teinte devient l'harmonie analogue ± 30° (`HAIR-FORM-HUE.md`). **Reste** : planchers de luminance 0,42 / 0,16 calibrés sur corpus ; pas de repousse sur les mèches ni la nuque ; la convention des 12 teintes n'est pas une mesure perceptuelle.
10. **`bob` / `long`** : avant/après quasi indiscernables à l'échelle des planches ; le gain est mesuré (bord nu 0,76 → 0,35 et 0,22) et visible sur le dessus du crâne (`01c`), peu à l'échelle de la retombée. La retombée n'a pas été retravaillée (`HAIR-SKULL-REMAINING.md` 10 : masse arrière = rectangle arrondi).
11. **Dôme lisse résiduel** sur certains afros (rangée du bas de `01b`, visage rouge) : le bord reste nu à 0,43 au pire.

## Vérification (`hair-form.ts`)
12. `shell-rim-bare` est un **avertissement** ; seul `shell-rim-bare-hard` (0,75) est une erreur. Les coiffures pendantes (`bob`, `long`) sont exclues du seuil dur.
13. `fill-clears-free-ear` tolère 3 mèches dans la zone de l'oreille (max mesuré 2) : tolérance posée sur la mesure, pas sur une règle anatomique.
14. Les mèches de joue (`cheek`) restent hors de `fringe-reach-bound` : elles pendent sous la tempe par conception (`HAIR-SKULL-REMAINING.md` 6, partie joue).
15. « Rapport OK » ≠ beauté. **Revue humaine nécessaire** sur `artefacts/hair-form/01a`–`01d`, `03`, `05` et `artefacts/hair-finish/` (la revue du modèle de `HAIR-FORM-REVIEW.md` ne la remplace pas).

## Régression visuelle
16. `npm run regress` relancé après cette série (et après la série 2 : essais de racine, cibles `bob`/`long`, plafond de teinte) : exit 0, 34/34 `exact` (identiques au pixel). Les 34 images ne contiennent donc aucune coiffure touchée par le remplissage (cause de ce choix de cas non vérifiée). Aucune référence actualisée ; en ajouter avec `afro`, `curly`, `short`, `long` est une décision d'équipe.

## Série 3 : points ouverts nouveaux
19. Queues sans vent de 0,42–0,59 W (`HAIR-FORM-REVIEW.md` 1) : non contrôlées en largeur.
20. Les cheveux fous suivent le flux ; leur nombre (`strayShare`) reste tiré, non relié à la densité.

21. **Bord en dents de scie de l'afro/curly** (masse rose, `artefacts/hair-finish/01`) : non traité (série 4 : seule la frange en lames a changé) ; `fringe-rhythm-natural` ne le mesure pas.

## Hors périmètre (inchangé)
17. 3D, profil (`src/skull/`), tête tournante, vent couplé à la simulation Verlet, cheveux simulés (`sim`) : voir `HAIR-COHERENCE-REMAINING.md` 8–10 et `HAIR-BOUNDARY-REMAINING.md` 7–14.

## Sécurité
18. **Un jeton GitHub a de nouveau été collé en clair dans la conversation : à révoquer** (GitHub → Settings → Developer settings → Tokens). Il n'est écrit nulle part dans le dépôt.
