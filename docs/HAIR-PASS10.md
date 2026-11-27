# Moteur capillaire — passe 10 : nouvelles coupes (carré, shag) sur le moteur existant

Reste à faire : `HAIR-PASS10-REMAINING.md`. Preuves : `artefacts/hair-engine-pass10/` (planches 01–05 + `06-verification-geometrie-anatomie-style.json`), `tests/hair-grammar-cuts.test.ts` (12 tests ; 19 avec `hair-grammar.test.ts`), script `scripts/hair-grammar/artefacts-pass10.ts`.
Demande : continuer le moteur de cheveux avec de NOUVELLES coupes, en nourrissant le moteur depuis `references/hair`, sans recoder ce qui existe.

## Ce qui existait déjà (vérifié avant de coder, donc NON recodé)
- Générateur de mèches par familles (`grammar.ts`), peinture `paintHairPro` / `MAIN_PRO`, pont vers le rendu principal (`interop.ts`).
- Vérification en trois couches géométrie · anatomie · style (`compose-verify.ts`), localisée par mèche.
- Solveur de réparation (`repair.ts`, `repairCycle`). Une seule coupe de grammaire : `tousled`.
- Aucun solveur, aucune primitive de peinture, aucune règle de vérification n'a été ajouté : une coupe est une donnée de profil.

## Ce qui a été ajouté
- `src/hair-grammar/profiles/bob.ts` : carré au menton, dessus volumineux, frange couvrante, côté gauche plus lourd (asymétrie modérée).
- `src/hair-grammar/profiles/shag.ts` : mi-long en couches, rideau de frange, pointes effilées qui dépassent le menton, côté gauche plus lourd.
- Exports `BOB`, `SHAG` dans `src/hair-grammar/index.ts` (deux lignes).
- `scripts/hair-grammar/lib-cuts.ts` : `scene()` = générer → réparer (`repairCycle`) → peindre → SVG de la tête entière, partagé par les artefacts.

## Méthode et défauts rencontrés (mesurés, pas supposés)
1. Premier jet lu sur les planches de référence : les coupes rendaient des yeux recouverts (`anat.eye`).
2. Cause lue dans `lock-check.ts` : le moteur n'exempte du contrôle « œil » que la famille nommée exactement `back`. Mes familles « arrière » avaient d'autres noms. Renommées `back` (convention du moteur, pas de contournement).
3. Après réparation, les défauts localisés tombaient à 0, mais `ok` restait faux : le contrôle de style « rapport dominante / seconde » (≥ 1,15) valait 1,02–1,13.
4. `analyzeComposition` regroupe les masses par famille : les deux plus grandes étaient la masse arrière et la calotte (`mass`), pas les côtés ; rendre les côtés asymétriques n'y changeait rien. Correction : calotte plus fournie, masse arrière réduite. Mesuré à la livraison (lacet 0°, graine 4) : rapport 1,51 (bob, calotte 0,312 / arrière 0,207) et 1,42 (shag, 0,318 / 0,224), calotte dominante. Le seuil n'a PAS été modifié.
5. Famille `crown` (sommet plat) ajoutée pour atténuer le nœud de mèches au tourbillon : atténué, pas supprimé (voir reste à faire).

## Résultats (planche 06, 8 graines × lacets 0°/+30°/−30° × 2 coupes = 48 cas)
- Défauts localisés avant réparation : bob 90, shag 83 (somme sur 24 cas chacun) ; après `repairCycle` : 0 et 0.
- Verdict global valide : 47/48 (seul échec : bob, lacet −30°, graine 5, rapport dominante / seconde).
- Rotation −60° → +60° (planche 03) : la forme tient, pas d'œil recouvert dans les vues validées.

## Honnêteté sur les références
- Les formes ont été LUES à l'œil sur des planches de contact et des planches à grille des références (06 carré, 53 shag, 32 et 44 pixie). Aucune mesure numérique n'a été produite (pas de `landmarks.json`). Les paramètres de profil sont donc des choix d'artiste, validés par la vérification G/A/S et par la lecture des rendus.
- Pixie : écrit, verdict instable (mesuré pendant la passe, chiffres non conservés), jugé visuellement mauvais (plaques plates sur le front, bloc anguleux au-dessus de l'oreille). NON livré (voir reste à faire).

## Verdict visuel assumé
Les côtés et la retombée (bob, shag) sont crédibles et tiennent en rotation. La calotte est trop bruitée (« chou-fleur » de petites feuilles) et la frange manque de netteté : une vérification qui passe n'est pas un rendu convaincant, et ces deux coupes ne sont pas au niveau d'un rendu d'anime fini.
