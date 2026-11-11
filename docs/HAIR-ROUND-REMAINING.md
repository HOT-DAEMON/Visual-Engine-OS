# Masses rondes, franges, vérification — reste à faire et limites

Fait : `HAIR-ROUND.md`, `HAIR-FRINGE-ASPECT.md`, `HAIR-ROUND-VERIFY.md`. Chaque ligne est mesurée sur `artefacts/hair-round/corpus.md` ou constatée sur les planches.

## Volumes (afro, bouclé)
1. `hair-reach-beyond-skull` : avertissement sur 11 afros sur 40 du corpus (pire 0,651 pour 0,6 ; avant 13 visages, 0,720) et 1 ponytail (0,423 pour 0,42). La masse déborde un peu plus que la portée autorisée ; relever `max`/cibles de remplissage ou borner la portée par style.
2. Dents résiduelles : environ 1 visage sur 60 dépasse 16 (max 18–19) ; `edge-rim-teeth` reste un avertissement. Piste : supprimer les cônes dont la pointe est rognée de plus de la moitié.
3. Un fin croissant sombre subsiste à droite de l'afro violet de la planche `volumes-apres.png` : non mesuré.
4. `topOff` n'a pas changé (médiane 0, p90 0,037, max 0,068) : le sommet n'est pas recentré, seulement borné par un seuil.
5. Marges de gain (0,06 / 0,10) et cibles de remplissage posées sur la mesure, pas sur une référence dessinée.

## Franges
6. `short` / `spiky` gardent une frange en peigne, avec des pointes à bord estompé rose ; un grand coin sur le `spiky` blond (mode `asym_brow` ou autre) n'est pas traité.
7. Frange `curly` : rapport max 2,91 (limite 3,0), géométrie hors `fringe-split` ; mèches larges restantes ≈ 1,0–1,2 après raccourcissement par la garde.
8. `fringe-wide-share` 0,375 (> 0,35) et `fringe-tip-jag` 0,030 (= limite) sur UNE graine du corpus : l'avertissement revient dans toutes les coiffures car le visage est le même. Les pointes étagées de `splitByAspect` (STAGGER 0,9) peuvent frôler la limite de `fringe-tip-jag`.

## Anatomie
9. **Bob, graine 9568 : `hair-covers-face-skin` 0,035 > 0,02 (erreur, préexistante).** Deux grands polygones de frange écrasés par la garde en lamelles horizontales plus une aile diagonale à droite. À traiter dans `guard.clip` pour les polygones larges.
10. `bun` : volume du chignon non revu contre le crâne de profil.
11. Pattes / favoris : leur revue appartient au moteur de poils du visage (le gabarit les désactive désormais).

## Vérification
12. Les contrôles `round-*` ne couvrent que afro / curly ; aucun contrôle de symétrie pour `bob` ou `long`.
13. Le corpus est de 40 graines par coiffure ; les trois couleurs de la revue visuelle ne couvrent pas toutes les textures.
14. `npm run regress` : aucune référence actualisée (décision d'équipe).

## Hors périmètre (inchangé)
15. 3D, profil (`src/skull/`), tête tournante, vent couplé à la simulation Verlet : voir `HAIR-COHERENCE-REMAINING.md` 8–10 et `HAIR-BOUNDARY-REMAINING.md` 7–14.

## Sécurité
16. Un jeton GitHub a été collé en clair dans la conversation : à révoquer (GitHub → Settings → Developer settings → Tokens). Il n'est écrit nulle part dans le dépôt.

## Mise à jour — série dôme (`HAIR-DOME-ROUND.md`, `HAIR-FIT-SIDE.md`, `HAIR-FRINGE-CLUMPS.md`, `HAIR-DOME-VERIFY.md`)
- 1 : TRAITÉ pour afro / curly (0 / 40 hors limite) ; reste `ponytail` 0,423 pour 0,42 (une graine, préexistant).
- 3 : croissant largement résorbé (rentrage, `tuck.ts`) ; reste une petite pointe sombre en haut à droite de l'afro violet, une cuvette et une marche sur l'afro 10491, et le croissant de `curly` non traité.
- 6 : frange `short` / `spiky` en touffes, grand coin du `spiky` blond remplacé par des rubans ; le « peigne » n'a aucune mesure et se lit encore comme des mèches séparées.
- 8 : plus d'avertissement `fringe-wide-share` / `fringe-tip-jag` sur le corpus.
- 9 : TRAITÉ (0 / 572 cellules de peau sur bob 9568, `HAIR-FIT-SIDE.md`) ; confirmation visuelle sur `details-apres.png`.
- Reste ouvert : `spiky` `shell-rim-bare` 0,556 pour 0,55 ; `bun`, lisière / implantation non revues ; suite de tests complète non rejouée d'un bloc (plus de 10 min sur 2 CPU : lots ciblés, 20 fichiers / 675 tests du moteur de cheveux passent).
- 12 : les contrôles dôme ne couvrent que afro (+ balayage du visage pour toutes les coiffures).
