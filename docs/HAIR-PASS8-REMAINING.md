# Moteur capillaire — reste à faire après la passe 8, par composant

Bilan : `HAIR-PASS8.md` · rendu : `HAIR-PASS8-RENDER.md` · vérification : `HAIR-PASS8-VERIFY.md`. Remplace `HAIR-PASS7-REMAINING.md` : chaque point y est repris.
Statuts : FAIT · PARTIEL · NON FAIT (raison) · DÉCIDÉ DE NE PAS FAIRE (raison). Rien n'est « fait » sans preuve (tests, planches, `metrics.json`).

## Ombre aval (limite 2 de la passe 7)
- Dégradé lisse mesuré : FAIT (EQM 0,6 contre 5,1 pour les paliers ; planches 02, 03, 07).
- Profil calibré sur UNE référence (60, éventail) : PARTIEL. À corroborer sur d'autres références ; les nœuds sont rejoués par test depuis le JSON, donc re-calibrables.
- Ton noir : pas d'ombre dessinée (écart de luminance < 10) — voulu, mais la bande se lit alors par le seul reflet.
- Ombrage cel : l'ombre reste en bandes dures (style voulu) ; un cel à dégradé n'est pas fait.
- Ombre portée du crâne / oreilles sur la mèche : NON FAIT.

## Reflet transversal (limite 1 de la passe 7)
- Branchement sur le rendu principal : FAIT (type, pont, contrat, `LockStyle.ring`, tests, planches 04–06).
- `replace` / `add` : TRANCHÉ — `replace` par mèche. Défaut `off` conservé (aucun changement de rendu pour les appelants existants).
- NON FAIT : le flux de production (`renderHair`) ne génère pas de mèches de grammaire avec anneau ; aucun réglage utilisateur n'expose `ring`. Il faudrait le placer dans le schéma de coiffure, pas dans `reflection` (partagé yeux/matières).
- NON FAIT : seuils `RING.minNH` (0,78), `fullNH`, `bodyWidth`, `minCoverage` non mesurés ; sur la coiffure finale seules 2–10 % des mèches gardent un anneau (occlusion croisée ≈ 1 sur ≥ 90 % des échantillons). Piste : mesurer la part visible sur d'autres références avant de relâcher `minNH`.
- NON FAIT : `hairGloss` reste un halo ; avec 2–10 % de mèches à anneau, `localGlossShare` ne l'efface pas. Deux brillances coexistent. Piste : réduire le halo en proportion de la part d'aire couverte par les anneaux.
- Part de pixels clairs du rendu principal : 6,9–7,4 % contre 1,39 % sur la tête de référence. Écart d'un facteur 5 hérité de la brillance principale et des bandes, non traité.
- Invariance longueur/largeur de l'étendue : toujours indéterminée. Un reflet par mèche, pas de reflet coloré, pas de lien avec la texture bouclée/crépue : NON FAIT.
- Teinte : la couleur de cheveux `#4a3326` sort bleutée sans lumière de scène (comportement d'apparence préexistant, non traité ici).

## Vérification de rendu
- Part de reflets jugée sur les mèches visibles : FAIT (`HAIR-PASS8-VERIFY.md`). Verdict final 18/18, 0 défaut.
- PARTIEL : une scène finale a 3–7 mèches visibles (< 8) ; la proportion ne se juge que sur un lot.
- NON FAIT : reflet non branché dans `compose-verify.ts` / `repairCycle` (un reflet fautif est écarté, pas réparé) ; `Defect.visible` non consommé ; pas de lancer de rayon ; `anat.balance` sans réparation par ajout de mèche.
- Style = seuils mesurés, pas de jugement esthétique. Bornes d'ingénierie : 15–85 % (part), ×0,25–×4 (aire), `VISIBLE_MIN` 0,4.

## Références (`references/hair`, 68 fichiers)
- Seule la référence 60 a été mesurée en profondeur (passes 6–8). NON FAIT : extraction systématique des autres (silhouettes pour de nouvelles coiffures, profils d'ombre, parts de reflet) ; chaque coiffure nouvelle exige un profil `src/hair-grammar/profiles/*` et sa vérification.
- `references/hair/68.png` : fichier de 2 octets, illisible, à remplacer.

## Raie, apparence principale, interopérabilité, autres flux
Inchangés depuis la passe 7 — voir `HAIR-PASS7-REMAINING.md` (sections Raie, Apparence du moteur principal, Tests d'autres flux, Interopérabilité). Les deux points « brancher le reflet sur le rendu principal » et « ombre à bords durs » de ce fichier sont désormais FAITS / TRANCHÉS (ci-dessus).
- Tests d'autres flux (`eye-gallery-ext3`, `nose-visibility`, suite capillaire complète > 10 min) : NON VÉRIFIÉS cette passe ; seuls les fichiers du flux reflet ont été relancés (34 + 65 tests passent). Suite complète à relancer fichier par fichier.

## Discipline
Chaque fichier de `docs/` ≤ 200 lignes. Aucun jeton ni identifiant n'est écrit dans le dépôt.
