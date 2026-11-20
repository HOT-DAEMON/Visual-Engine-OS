# Moteur capillaire — chevauchement et occlusion locale (TODO §3.3, §D)

Code : `occlusion.ts` (graphe, ordre) · `occlusion-paint.ts` (rendu) · tests : `tests/hair-engine-occlusion.test.ts` (10) · preuve : `artefacts/hair-engine/04-occlusion.png`.

## Réponse aux huit questions du TODO
1. Qui passe devant : `relationsOf` compare la profondeur le long des deux axes (signe avec hystérésis `EPS = 0,02`).
2–3. Début/fin : chaque relation porte des `Interval` `{a0,a1,b0,b1,front,gap}` en paramètre t des deux mèches (`SPAN_MIN = 0,03`).
4. Portion visible : `visibleSpans`.
5. Ombre de contact : bord de la lame de devant, rogné par le contour de celle de derrière (opacité 0,3).
6. Sous-couche qui réapparaît : une mèche croisée est découpée en `PIECES = 8` tronçons clippés, chacun dessiné à son rang.
7. Deux mèches qui se croisent : alternance devant/derrière sur la longueur (test : tresse ; artefact 04 gauche/droite).
8. Silhouette préservée : écart d'alpha de la silhouette < 0,3 % entre rendu simple et rendu résolu (test).
Ordre : tri topologique stable (Kahn) sur le graphe ; en cas de cycle, l'ordre d'écriture tranche.

## Constat honnête : le résolveur est OPT-IN
Mesuré sur TOUSLED et sur une coiffure générée : la profondeur de coque n'est pas fiable sur les cheveux denses naturels (28 croisements « détectés » sur
50 mèches, dont la plupart sont des recouvrements d'écriture voulus par l'artiste). Appliquer l'ordre résolu partout donnait bords déchiquetés et
grosses masses devant le visage. Décision : l'ordre d'écriture reste le défaut ; seules s'imposent (a) les relations `emerge` (fille sous la mère),
(b) les groupes `LockSpec.weave` (tresses, entrelacs). `imposes(r, locks, mode)` porte la règle ; `mode = 'all'` force tout (outil de diagnostic).

## Limites connues (à faire)
- ~~Le moteur ne sait pas AUTEURISER un entrelacs~~ FAIT (passe 2) : `weaveStrands` + segment `weave` ; le résolveur a été corrigé (correspondance appariée, coupes aux bornes d'intervalles) — `HAIR-WEAVE.md`. L'artefact 04 reste sur lames fabriquées (historique).
- Profondeur de coque → profondeur réelle : à remplacer par une profondeur de volume (épaisseur de mèche) pour fiabiliser le mode `all`.
- Les ombres de contact sont de simples traits ; pas d'ombre portée douce ni d'occlusion ambiante.
- Pas de réapparition de sous-couche (cheveux de dessous visibles à travers un trou) : seul l'ordre d'écriture le gère.
- Le moteur principal (`src/render/face/hair-*`) n'a pas encore le graphe : voir `HAIR-INTEROP.md`.
