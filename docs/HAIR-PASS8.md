# Moteur capillaire — passe 8 : ombre aval lisse + reflet transversal branché sur le rendu principal

Reste à faire : `HAIR-PASS8-REMAINING.md` · rendu principal et décision `replace`/`add` : `HAIR-PASS8-RENDER.md` · vérification : `HAIR-PASS8-VERIFY.md`.
Preuves : `artefacts/hair-engine-pass8/` (planches 01–07 + `metrics.json`), `tests/hair-engine-ring-shade.test.ts` (34 tests), script `scripts/hair-grammar/artefacts-pass8.ts`.

## Les deux limites de la passe 7, disséquées
1. « Les paliers d'ombre ont des bords durs, alors que la référence est un dégradé lisse. »
   - Pertinent : confirmé par la mesure. Variation max du poids entre deux nœuds : 0,27–0,40 pour un palier, 0,19 pour le profil mesuré ; EQM contre l'éventail de la référence 60 : 5,1 points (paliers) contre 0,6 (lisse) — planche 03.
   - Corrigé (FAIT) : `ring-shade.ts` émet un `linearGradient` par segment le long de l'axe courbe de la mèche ; les nœuds viennent de la mesure (`ring-measures.ts → shadeProfile`, dérivés par régression isotone `ring-profile.ts` à partir de `measures-ref60.json`, rejouée par un test). Continuité C0 exacte aux jonctions (position et opacité).
   - Retour arrière : `ProStyle.shoulder.profile: 'steps'` redonne les trois paliers de la passe 7 (tests passe 7 conservés avec ce réglage).
2. « Le reflet reste désactivé par défaut. Choisir entre `replace` et `add` demande de brancher d'abord le reflet de grammaire sur le rendu principal, dont la brillance est aujourd'hui un halo flou. »
   - Branchement : FAIT (voir `HAIR-PASS8-RENDER.md`). Défaut `off` : conservé volontairement (rendu historique au bit près, test de régression) ; la décision est documentée, le basculement reste à la main de l'appelant.
   - Choix `replace` vs `add` : TRANCHÉ sur mesure — `replace` par mèche (repli sur la bande axiale quand la mèche n'a pas d'anneau).

## Dissection du mécanisme de l'ombre lisse
- Profil : x = distance au bord aval du reflet / 0,418 (récupération complète) ; w = creux relatif / creux max (−33,5 %).
- Crête d'opacité selon le ton (`core/shade.ts → peakShadeOpacity`) : résout A tel que le creux relatif de luminance reste −0,335 ; 0 si le remplissage et l'ombre diffèrent de moins de 10 en luminance (ton noir : pas d'ombre visible à dessiner, planche 07), plafond 0,6, repli 0,4. Module neutre, partagé par la grammaire et le rendu.
- Géométrie : segments suivant la courbure, largeur latérale 0,96 de la lame, tronqués à la pointe ; le dernier poids est 0 sauf pointe tronquée.
- Identifiants des dégradés : empreinte FNV du contenu (`rsh<hash>-<k>`) — pas de collision entre mèches.

## Ce qui n'était pas déjà codé (vérifié avant d'écrire)
Recherche faite dans `src/` : aucun `linearGradient` d'ombre de reflet, aucune lecture de `HairLock.geom.ring`, aucun module de luminance partagé (la luminance était locale à `ring-tone.ts`, désormais importée de `core/shade.ts`). Réutilisé tel quel : `smoothPath` de la grammaire (le rendu recopie le tracé, test d'égalité), `ringIsSane`, `occlusionProfile`.

## Fichiers
Nouveaux : `src/core/shade.ts`, `src/hair-grammar/{ring-profile,ring-shade}.ts`, `src/render/face/hair-ring.ts`. Modifiés : `spec-ring`, `ring-measures`, `ring-tone`, `paint-pro`, `ring-check`, `verify-ring`, `interop`, `src/face/hair/{types,index}.ts`, `src/render/face/hair-lock.ts`.
