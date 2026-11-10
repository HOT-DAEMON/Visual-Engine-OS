# Lisière extérieure et retombée — reste à faire et limites (par composant)

Fait : `HAIR-EDGE.md`. Chaque ligne est une limite mesurée ou constatée sur les planches `artefacts/hair-edge/` ; rien n'est caché. Listes précédentes toujours valables : `HAIR-BOUNDARY-REMAINING.md`, `HAIR-SKULL-REMAINING.md`, `HAIR-COHERENCE-REMAINING.md`, `HAIR-FORM-REMAINING.md`.

## Triangles sombres des longs (`guard.clip`, `smoothSpine`, `cutSpine`)
1. **Aucun contrôle dédié** : une mesure largeur / longueur des mèches a été essayée puis abandonnée (dominée par de minuscules mèches de frange, valeur max 11,7 identique avant et après). La disparition des triangles est donc constatée sur les planches (`02-details-longs.png`), pas mesurée par un seuil.
2. **Exemption pendante** : les mèches de corps `main` / `fine` des coiffures pendantes ne sont pas coupées mais déviées par `guard.fit` (voir `HAIR-EDGE.md` 1). Un ruban large de cette famille peut donc encore s'écraser en coin ; non constaté sur les 12 cas, non mesuré sur un corpus.
3. Le plafond de largeur (longueur / 3), le seuil d'abandon (12 %), les facteurs de reconstruction (0,8 / 0,64 / 0,5 / 0,4) sont posés à la main, pas appris d'une référence dessinée.
4. Coût : `reachOk` est évalué par sommet à chaque reconstruction (jusqu'à 4) ; temps non mesuré.

## Retombée (`FALL`)
5. **L'ourlet reste généré, pas dessiné** : bas en U, convergence et ondulation d'ensemble existent, mais pas de boucles, de mèches qui se croisent ou d'épaules (la chevelure ne repose pas sur les épaules). Un cheveu long qui tombe devant une épaule n'est pas modélisé.
6. `FALL` est posé à la main (`long` 0,30 / 0,16 / 0,03 ; `bob` 0,12 / 0,09 / 0,008). Seul `long` / `bob` : `ponytail`, `braids` et les archétypes simulés (Verlet) ne l'utilisent pas.
7. Le ton et la ligne de pointe des mèches arrière ne sont pas revus ; sur certains longs une mèche isolée descend bien plus bas que les autres (planche 05, long blond n° 3).
8. L'ondulation `amp` est une sinusoïde unique par chevelure (phase issue de la graine) : pas de variation entre mèches ; un long très ondulé (boucles lâches) n'est pas couvert.

## Lisière afro / bouclé (`rim.ts`)
9. **Dôme décentré et croissant noir** (planche 05, afro n° 1 et n° 2) : la coque est plus large d'un côté (gain d'asymétrie) et les mèches ne la remplissent pas, d'où un croissant noir hors des mèches. NON traité : le rognage ramène les mèches sur la coque, il ne remplit pas la coque. Piste : borner `ctx.gain` côté large, ou étendre `fillShell` à ce croissant. Non mesuré par un contrôle.
10. **Dents résiduelles** : `edge-rim-teeth` (avertissement ≤ 16) a un p90 de 13 (afro) et 15 (curly) et un max de 24 : sur une minorité de visages la silhouette garde de petites dents (bases de cônes ramenées sur le contour). Piste : supprimer les cônes dont la pointe est rognée de plus de la moitié.
11. Le rognage s'arrête au sourcil (`browLimitY`) : les ailes de volume qui descendent le long des tempes et au-dessus des oreilles ne sont pas lissées. Les `wisp` (duvet) ne le sont volontairement pas : leur nombre reste tiré.
12. Seuls `afro` et `curly` ont une entrée `RIM`. `short` et `spiky` (cônes) gardent leurs pointes par conception ; la frange `short` / `spiky` garde ses triangles (planche 05, rangée 1–2).
13. Marges (0,022 W afro, 0,018 W curly) posées sur la mesure (dépassement médian après 0,022 / 0,018), pas sur une référence. Le contrôle `edge-rim-bound` tolère `marge + 0,04` (max observé 0,049 sur tresses `plait`).

## Revue de chaque coiffure contre le crâne (planche 05)
14. **Plaques anguleuses aux joues** des `ponytail` et `braids` (n° 3 de chaque : plaques dorées trapézoïdales de chaque côté de la mâchoire) : non traité, non mesuré. À examiner : mèches `cheek` / pattes de `sides.ts`.
15. **Triangles de frange** `short` et `spiky` (rangées 1–2) : hors périmètre (frange, `HAIR-FORM-FRINGE.md`) ; la frange en dents triangulaires est toujours là.
16. `bun` (chignon « oreilles d'ours » n° 1) : volume du chignon non revu contre le crâne de profil.
17. La revue est visuelle sur 3 visages par coiffure (couleurs brun / noir / blond) : pas un corpus. Les contrôles chiffrés (`hair-skull`, `hair-coherence`, `hair-form`, `hair-boundary`, `hair-edge`) ne jugent pas l'élégance.

## Vérification (`hair-edge.ts`)
18. Les 4 contrôles ne couvrent que afro / curly (rim, dents) et long / bob (convergence). Aucun contrôle de symétrie du dôme (point 9) ni d'ourlet en U (la mesure `lowerFlare` ne voit que la largeur).
19. `edge-hem-converges` est un avertissement ≤ 1,0 : il ne ferait échouer qu'un évasement, pas une retombée encore raide (le long a une médiane 0,795 : le seuil est lâche, par prudence).
20. Seuils sur 60 visages / coiffure + 30 graines déformées ; aucune référence externe.

## Régression visuelle
21. `npm run regress` : résultat après cette série noté dans `artefacts/hair-edge/README.md` ; aucune référence actualisée (décision d'équipe).

## Hors périmètre (inchangé)
22. 3D, profil (`src/skull/`), tête tournante, vent couplé à la simulation Verlet, cheveux simulés : voir `HAIR-COHERENCE-REMAINING.md` 8–10 et `HAIR-BOUNDARY-REMAINING.md` 7–14.

## Sécurité
23. **Un jeton GitHub a de nouveau été collé en clair dans la conversation : à révoquer** (GitHub → Settings → Developer settings → Tokens). Il n'est écrit nulle part dans le dépôt ni dans l'URL du dépôt distant ; il n'a servi que par un en-tête HTTP temporaire.
