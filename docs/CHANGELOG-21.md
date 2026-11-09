# Changelog 21 — raccord cou ↔ corps (branche `hair-grammar`)

- **Constat** : la doc affirmait que la base du corps suivait le cou ; seule `anchorFromFace` le faisait. La scène (`neckAnchor`, `render/body.ts`) gardait `half × (1 + flare)`. Écart mesuré avec la dernière section du cou : −28,8 % (cône), −8,9 % (massif + trapèzes), −8,8 % (compression), 0 % (défaut).
- **Ancre unique** : `anchorFromLandmarks` (`src/body/anchor.ts`) ; `neckAnchor` et `anchorFromFace` l'appellent. Exportée par `src/body/index.ts`.
- **SCM du torse retirés** (`body/torso.ts`, `body/contracts.ts`) : ils doublaient ceux du moteur de cou (≈ 700 px du rendu final, deux coins rigides à l'incisure jugulaire).
- **Fondu de la base du cou** : bornage par le contour du cou (`BodyRenderOpts.neckContour`, `body/render.ts`, passé par `render/body.ts`) ; il débordait sur le fond.
- **Tests** : `tests/neck-body-junction.test.ts` (4, dont un contrôle négatif pixel) ; `tests/pipeline-body.test.ts` utilise la source unique au lieu de la formule recopiée.
- **Erreur de mon propre test corrigée** : le visage porte un roulis aléatoire (`rotate(-2,7)`) ; le balayage du contour doit être fait dans le repère image.
- **Docs** : `TODO-NECK-SYSTEMS.md` (278 lignes) scindé en `TODO-NECK-SYSTEMS.md` + `TODO-NECK-SYSTEMS-2.md` (texte inchangé) ; `NECK-REMAINING.md` §F ; `NECK-ENGINE.md` §10 ; `BODY-ATOMS.md`, `PIPELINE-WIRING.md`.
- Pas encore fait : voir `docs/NECK-REMAINING.md` (A à D, F).
- **Vérification du rendu final** : `src/verify/neck-junction.ts` (géométrie · anatomie · style, mesurée sur l'image), `tests/neck-junction-render.test.ts` (3, dont 2 contrôles négatifs). `bodyRenderOpts` (`render/body.ts`) : options de rendu du corps en source unique, utilisée aussi par `verify/pipeline.ts`.
- **Artefacts** : `artefacts/neck-junction/` (01, 02, 03, 04), `scripts/artefacts-neck-junction.ts`, `docs/NECK-JUNCTION-PROOF.md`.
