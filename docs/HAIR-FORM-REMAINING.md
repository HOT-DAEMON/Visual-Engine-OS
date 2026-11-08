# Forme des cheveux sur le crâne — reste à faire et limites (par composant)

Fait : `HAIR-FORM.md`. Chaque ligne est une limite mesurée ou constatée sur les planches `artefacts/hair-form/` ; rien n'est caché. Les listes précédentes restent valables : `HAIR-SKULL-REMAINING.md`, `HAIR-COHERENCE-REMAINING.md`, `HAIR-BOUNDARY-REMAINING.md`.

## Remplissage de la coque (`crown-fill.ts`)
1. **Bord encore nu** : 0,31 (afro) à 0,53 (bob) en moyenne, jusqu'à 0,68 (long). 4 visages sur 121 dépassent le seuil d'avertissement `shell-rim-bare` (marge minimale −0,095). Les cibles `FILL.rim` (0,2 à 0,45) ne sont pas atteintes partout : la boucle s'arrête au plafond ou faute de mèche utile.
2. **Seuils et longueurs posés à la main** (`rim`, `all`, `len`, `max`, 0,5 pour le bord, 0,75 dur) sur 80 visages imposés + 120 aléatoires ; pas de référence dessinée par un illustrateur.
3. **Longueur de remplissage fixe** (`FILL.len` × H) : pas dérivée de la longueur réelle de la coiffure ni de `lengthVariance`.
4. **Raie (`bare.part`)** : non exclue du remplissage ; des mèches peuvent la recouvrir. Non mesuré.
5. **Coût** : boucle en O(plafond × cellules). Huit géométries `afro` (génération du visage comprise) ≈ 2,1 s ; le coût du remplissage seul n'a pas été isolé. Pistes : grille plus grossière, file de priorité, cache par mèche.
6. **Pas d'interrupteur** du remplissage dans le moteur : le « avant » des artefacts se rend depuis un worktree du commit d'origine (`artefacts/hair-form/README.md`).
7. **Coiffures hors `FILL`** : `ponytail` (bord nu 0,88 en moyenne), `bun` (jusqu'à 1,00), `braids`, `buzz` (0,98) restent des aplats. Choisi pour l'anatomie (cheveux tirés, ras), mais le dessus d'un chignon ou d'une queue montre un dôme lisse : revue humaine à faire.

## Défauts visibles NON traités
8. **Frange en dents de scie** du `short` (festons réguliers à pointes, `artefacts/hair-form/05` visage 1, ancien `HAIR-BOUNDARY-REMAINING.md` 6) : toujours là. Le bord inférieur de la frange n'est pas régularisé.
9. **Plaque de cuir chevelu visible** sur le dessus du `long` rose et du `long` rouge (`01c`, rangée du bas) : inchangée ; cause non vérifiée (raie, éclaircissement ou sous-couche).
10. **`bob` / `long`** : avant/après quasi indiscernables à l'échelle des planches ; le gain est mesuré (bord nu 0,76 → 0,53 et 0,47) mais peu lisible. La retombée n'a pas été retravaillée (`HAIR-SKULL-REMAINING.md` 10 : masse arrière = rectangle arrondi).
11. **Dôme lisse résiduel** sur certains afros (rangée du bas de `01b`, visage rouge) : le bord reste nu à 0,43 au pire.

## Vérification (`hair-form.ts`)
12. `shell-rim-bare` est un **avertissement** ; seul `shell-rim-bare-hard` (0,75) est une erreur. Les coiffures pendantes (`bob`, `long`) sont exclues du seuil dur.
13. `fill-clears-free-ear` tolère 3 mèches dans la zone de l'oreille (max mesuré 2) : tolérance posée sur la mesure, pas sur une règle anatomique.
14. Les mèches de joue (`cheek`) restent hors de `fringe-reach-bound` : elles pendent sous la tempe par conception (`HAIR-SKULL-REMAINING.md` 6, partie joue).
15. « Rapport OK » ≠ beauté. **Revue humaine nécessaire** sur `artefacts/hair-form/01a`–`01d`, `03`, `05`.

## Régression visuelle
16. `npm run regress` relancé après cette série : exit 0, tous les cas `exact` (identiques au pixel). Les 34 images ne contiennent donc aucune coiffure touchée par le remplissage (cause de ce choix de cas non vérifiée). Aucune référence actualisée ; en ajouter avec `afro`, `curly`, `short`, `long` est une décision d'équipe.

## Hors périmètre (inchangé)
17. 3D, profil (`src/skull/`), tête tournante, vent couplé à la simulation Verlet, cheveux simulés (`sim`) : voir `HAIR-COHERENCE-REMAINING.md` 8–10 et `HAIR-BOUNDARY-REMAINING.md` 7–14.

## Sécurité
18. **Un jeton GitHub a de nouveau été collé en clair dans la conversation : à révoquer** (GitHub → Settings → Developer settings → Tokens). Il n'est écrit nulle part dans le dépôt.
