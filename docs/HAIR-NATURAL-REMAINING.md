# Cheveux naturels — reste à faire et limites (par composant)

Fait : `HAIR-NATURAL.md`, `HAIR-NATURAL-FRINGE.md`, `HAIR-NATURAL-VERIFY.md`. Chaque ligne est une limite mesurée ou constatée sur `artefacts/hair-natural/`. Séries précédentes : `HAIR-ROUND-REMAINING.md`, `HAIR-EDGE-REMAINING.md`, `HAIR-BOUNDARY-REMAINING.md`.

## Lisière / implantation (`hairline.ts`, `boundary/`)
1. Mesure sur 300 visages : pente max 0,034 H au coin de tempe, courbure p90 0,012 H ; la ligne d'implantation est lisse (pas de « marche » de l'implantation elle-même : le recul fait une pente forte mais continue). Un lissage supplémentaire des coins n'a rien changé (annulé). NON renforcée par un nouveau contrôle.
2. Constaté (`afro-detail-apres.png`) : des blocs sombres de teinte de racine restent visibles au BAS des ailes (sous l'oreille) et dans les coins du dessus, entre les mèches. Cause probable : le rentrage `tuck.ts` exempte les sommets proches du crâne (`OUTER_FROM 0,4`), dont le bas d'aile arrondi. Essai `OUTER_FROM 0,2` + `maxInset 0,07` : aucun changement visible, annulé.
3. La « marche » / « cuvette » de l'afro 10491 et la petite pointe sombre de l'afro violet de l'ancienne planche ne sont pas reproduites à l'identique (les graines de planche ont changé avec la nouvelle coque) mais le défaut du point 2 en est le proche parent : à traiter ensemble.
4. Pas de contrôle de la lisière en lecture « image » (le bord est mesuré sur la géométrie, pas sur le rendu).

## Masses rondes (`shell.ts`, `ROUND_SHELL`)
5. Valeurs d'ellipse (équateur 0,5, `endShare` 0,3, `minShare` 0,25, plafonds) posées par mesure, pas par une référence dessinée. Pas de variante « afro taillé » (dessus plat) ni de dissymétrie voulue (coiffure penchée) : le contrôle `round-dome-centered` l'interdirait.
6. Dessus : masse comblée par `fillShell` ; reste un aspect « hachuré » régulier des mèches de remplissage (longueur, largeur et direction trop homogènes) : NON traité, c'est le point « mécanique » restant.
7. `curly` : ailes plus courtes qu'afro ; pas de revue séparée des cas à implantation très reculée.

## Franges
8. Frange classique « rideau » (graine 10633) ≈ 30 touffes (limite 20), voir `HAIR-NATURAL-FRINGE.md`. `blades` / `asym_brow` / classique : médiane en baisse, pas de référence externe pour la limite.

## Attaches
9. `bun` : volume revu de face seulement ; pas de revue de profil (`src/skull/hair-shape.ts` non branché). Le chignon est un disque + 3 spirales : pas de mèches de raccord à l'attache.
10. `ponytail` / `braids` : revue chiffrée (reach), pas de revue visuelle complète de l'éventail.

## Vérification
11. `hair-natural` ne couvre que afro / curly (contour, oreilles) et bun (rayon, visibilité). Pas de contrôle de symétrie gauche / droite des archétypes simulés (Verlet).
12. Suite de tests complète non rejouée d'un bloc ; régression visuelle (`npm run regress`) non rejouée ni actualisée.

## Sécurité
13. Un jeton GitHub a été collé en clair dans la conversation : à révoquer (GitHub → Settings → Developer settings → Tokens). Il n'est écrit nulle part dans le dépôt.
