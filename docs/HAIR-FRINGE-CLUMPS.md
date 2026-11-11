# Franges `short` / `spiky` : touffes et rubans

Suite de `HAIR-FRINGE-ASPECT.md`. Preuves : `artefacts/hair-dome/details-*.png` (short 9852, spiky 9923), `franges-*.png`.

## Constat
Les franges `short` et `spiky` restaient en PEIGNE : mèches voisines parallèles, de même longueur, équidistantes. Sur le `spiky` blond, un grand coin en mode asymétrique n'était pas traité.

## Ce qui a changé
1. `fringe.ts` (moteur classique) : les mèches se regroupent par 2 à 4 en TOUFFES. Chaque touffe converge vers une pointe commune (abscisse et longueur de sa première mèche, tirage propre) ; les mèches non errantes sont tirées vers cette pointe (x 0,6, y 0,5) et la colonne vertébrale reçoit une ondulation en S. Tableaux `clump`, `wave`, `tipX`, `tipY`.
2. `fringe2.ts` (moteur v2, branche asymétrique) : le coin devient des mèches en RUBAN effilé ; `n = fe.count || 11` ; plus étroites ; déplacement de pointe `xTip` réduit.

## Résultats
- `fringe-wide-share` 0,375 > 0,35 et `fringe-tip-jag` 0,030 = limite (une graine, présents sur short/spiky/curly/afro avant) : plus d'avertissement sur le corpus après (`verification/corpus-*.md`).
- Planche : le grand coin du `spiky` blond a disparu, remplacé par des rubans.

## Limites
- Le caractère « peigne » n'a AUCUNE mesure : les contrôles de frange portent sur le rapport largeur/longueur et l'étagement des pointes, pas sur la régularité des intervalles. Les touffes s'estiment à l'œil ; sur `details-apres.png` la frange `short` se lit encore comme des mèches séparées.
- `spiky` : `shell-rim-bare` 0,556 pour 0,55 (une graine, préexistant).
