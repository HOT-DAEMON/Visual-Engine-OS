# Cheveux ↔ crâne — reste à faire et limites (par composant)

Ce qui est fait : `HAIR-SKULL.md`, `HAIR-BACK-MASS.md`, `HAIR-SKULL-VERIFY.md`. Suite (portée au polygone, attaches, vent, vocabulaire) : `HAIR-COHERENCE.md` ; ses limites : `HAIR-COHERENCE-REMAINING.md`. Suite 2 (remplissage de la coque, couche `hair-form`) : `HAIR-FORM.md` ; limites : `HAIR-FORM-REMAINING.md`. Mises à jour de cette liste : lignes marquées « MAJ ». Rien ci-dessous n'est caché : chaque ligne est une limite mesurée ou constatée sur les planches `artefacts/hair-skull/`.

## Coque et épaisseur (`thickness.ts`, `scalp.ts`, `boundary/shell.ts`)
1. Les plafonds `THICKNESS` (0,01 à 0,32 W) sont des valeurs d'illustrateur posées à la main, pas apprises d'une référence. À recaler sur des visages dessinés.
2. `afro` : dôme max 0,254 H, `curly` 0,176 H (avant 0,264 et 0,192) : ces deux coiffures restent volumineuses PAR CONCEPTION ; seul le gain d'asymétrie a été borné. Une revue humaine doit dire si 0,25 H est encore trop. MAJ : le dôme est désormais texturé par des mèches (bord nu de l'afro 0,70 → 0,31 en moyenne, `HAIR-FORM.md`) ; son VOLUME n'a pas changé.
3. La coque ne tient pas compte du crâne de profil (`src/skull/`) : l'épaisseur est symétrique en profondeur.
4. Arche de l'oreille : exclue de `skull-shell-bound` (l'oreille dépasse du crâne). Sa forme propre n'a pas de borne.

## Portée des formes libres (`reach.ts`)
5. MAJ : attaches posées sur le crâne et bornées (`HAIR-TIE.md`) ; les mèches de corps des coiffures attachées restent non bornées (`HAIR-COHERENCE-REMAINING.md` 1). Avant : les mèches des coiffures attachées (queue, chignon, tresses) qui vont VERS l'attache ne sont pas bornées : leur point d'arrivée est l'attache, qui peut être au-dessus du crâne. La **longueur et le volume de la queue** ne sont pas contrôlés (une queue haute de 0,25 H est admise).
6. MAJ : la frange est contrôlée au polygone (`fringe-reach-bound`, `HAIR-FORM.md` ; max mesuré 0,161 W, limite `REACH.side` + 0,05 W). Les mèches de joue ne passent toujours pas par `fitReach`. Avant : une frange pouvait s'éloigner de 0,15 W du contour sans alerte.
7. Les mèches `hairline` (fines) suivent leur parent : bornées indirectement, pas directement.
8. `REACH` est posé à la main (0,03 à 0,32 H en montée) ; `free-reach-bound` et `body-reach-bound` sont des AVERTISSEMENTS, pas des erreurs : un écart ne casse pas la vérification d'ensemble.
9. MAJ : cônes proscrits hors `short/spiky/curly/afro` (`HAIR-VOCAB.md`) ; portée au polygone (`HAIR-REACH-POLY.md`). L'élégance reste une revue humaine. Avant : les formes libres de la **v2 `mixed`** (cônes + rubans) n'ont pas été revues une à une pour leur élégance : seulement leur extension.

## Masse arrière (`back-mass.ts`, `hair-back-fade.ts`)
10. Le bas (0,76–0,81) et l'aire/boîte (0,85–0,88) gagnent peu (voir `HAIR-BACK-MASS.md`) : la masse reste proche d'un rectangle arrondi pour une chevelure qui tombe droit. Une vraie forme de tombé (poids, ondulation) n'est pas modélisée.
11. Le **fondu** est une bande fixe autour de la mâchoire (0,04 H avant, 0,1 H après) : pas d'adaptation à une couleur très claire ou à un fond clair. Mode encre : aplat sans dégradé (choix).
12. Archétypes simulés (Verlet) : utilisent la masse arrière mais leurs mèches ne passent pas par `fitReach` (leur drapé est déjà résolu par le collisionneur) ; non revus mèche par mèche.
13. MAJ : masses d'étage (`tierMasses`) plafonnées au 85ᵉ centile des pointes ; les étages de 1–2 mèches le sont désormais à la pointe la plus basse relevée de `TIP_INSET`. Le cas de forme en coin d'une enveloppe radiale est traité par le bas seulement, pas par les flancs.

## Génération (`random-hair-v2.ts`)
14. Seule la coupe rase est rendue cohérente (oreille, favori). `short` et `spiky` peuvent encore tirer une oreille couverte ou un favori long : plausible, non jugé.
15. `SHELL.buzz.reach = 'none'` : la coupe rase s'arrête au coin de la tempe ; pas de dégradé (fade) ni de raie rasée.
16. Les visages dont les paramètres de cheveux sont donnés à la main (surcharges) ne passent pas par cette cohérence : un buzz avec rideau d'oreille reste possible et reste signalé par les contrôles.

## Vérification (`hair-skull.ts`)
17. Seuils à la main (0,75 ; 0,92 ; 0,9 ; 0,5 ; 0,02) sur 323 visages ; pas de référence externe.
18. « Rapport OK » ≠ beauté (voir `HAIR-SKULL-VERIFY.md`).
19. En **mode simulé encre** (`sim.ink`), la teinte de la masse arrière n'est pas jugée (`back-mass-not-black` est sautée : l'aplat est voulu).

## Intégration
20. Tête tournante (`src/head-turntable`) et vue de profil (`src/skull/hair-shape.ts`) : n'utilisent ni la masse arrière, ni `REACH`, ni `THICKNESS` (2D de face uniquement). Voir `HEAD-TURNTABLE-REMAINING.md`.
21. MAJ : vent couplé à la portée (`HAIR-WIND-REACH.md`) ; les mèches déjà hors portée (queue, tresse) restent libres.
22. `npm run regress` : exit 0, 34 images stables ; relancé après `hair-form` : toutes `exact`, elles ne montrent aucune coiffure touchée. Aucune référence n'a été actualisée (décision explicite de l'équipe).

## Revue humaine à faire sur `artefacts/hair-skull/`
`03-details-dome-tempes.png` (dôme et tempes), `02-cheveux-longs-masse-noire.png` (tombé), `01a/01b` (équilibre d'ensemble). Puis `artefacts/hair-form/` (`HAIR-FORM-REMAINING.md` 15).
