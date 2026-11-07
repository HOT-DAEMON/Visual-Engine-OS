# Changelog 18 — cheveux ↔ crâne : coque, portée, masse arrière, vérification (branche `feat/hair-grammar`)

- **Coque anatomique** (`src/face/hair/thickness.ts`) : plafond d'épaisseur par coiffure (`THICKNESS`), genou doux, gain d'asymétrie ≤ ×1,35, soulèvement compté dans l'épaisseur (`shell.ts`). Dôme max : short 0,142 → 0,055 H, long 0,165 → 0,061 H, queue 0,150 → 0,040 H. `HAIR-SKULL.md`.
- **Portée des formes libres** (`reach.ts`, `fitReach`) : cônes, rubans, volutes, mèches `mass`, mèches classiques et mèches arrière recourbées. Montée max : buzz 0,268 → 0,013 H, short 0,440 → 0,057 H, long 0,351 → 0,058 H, afro 0,373 → 0,256 H.
- **Masse arrière** (`back-mass.ts`, `hair-back-fade.ts`, `hair-look.ts`) : fin du bavoir noir, du couvercle plat (0,93–0,95 → 0,54–0,63) et des « oreilles de chat » ; fondu autour de la mâchoire ; teinte 0,27–0,37 → 0,72 (médiane) de la luminance des cheveux. `HAIR-BACK-MASS.md`.
- **Masses d'étage** : plafonnées au 85ᵉ centile des pointes (coin coloré sous le menton supprimé).
- **Coupe rase** : `SHELL.buzz.reach = 'none'` (plateau de tempe de 14 px, 6 % des visages) ; oreille couverte / rangée et favori long écartés à la génération (`random-hair-v2.ts`, après le tirage : les autres valeurs d'une graine sont inchangées).
- **Vérification** (`src/verify/hair-skull.ts`, dans `verifyFace`) : 12 contrôles (géométrie 6, anatomie 4, style 2), contrôles négatifs. `HAIR-SKULL-VERIFY.md`.
- **Test modifié délibérément** : `tests/hair-v2.test.ts` (le gonflement d'une coupe courte est maintenant plafonné ; la mécanique se teste sur `curly`).
- Tests : `tests/hair-skull.test.ts` (39 ; suite complète 2689/2689). `tsc` propre, `npm run regress` exit 0 (rms ≤ 0,26/255).
- Artefacts : `artefacts/hair-skull/` (planches 01–05, `avant/`, `apres/`, `rapport-verification.md`) ; `npx tsx scripts/artefacts-hair-skull.ts`.
- Reste à faire : `HAIR-SKULL-REMAINING.md`.
