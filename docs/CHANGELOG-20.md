# Changelog 20 — reliefs de la tête en rotation (branche `feat/hair-grammar`)

- **Reliefs** (têtes issues d'un visage ; la planche mesurée est inchangée) : bosses pariétales et asymétrie du crâne (`engines/skull-relief.ts`), modelé des joues (`engines/cheek-relief.ts`), assemblés par `engines/head-relief.ts` et appliqués dans `mesh.ts` (déplacement radial borné à la demi-largeur de section). Lus dans `skull.*`, `face.asymmetry`, `cheek.*`, `softTissue.masseter` : aucun nouveau moteur.
- **Oreille lointaine** : omise à 8° – 35° et de dos (`engines/ear-cull.ts`, branché dans `render.ts`), convention de la planche.
- **Cou → épaules** : évasement vers les trapèzes (`engines/neck3d.ts`, `skull.trapezius` / `c7`).
- **Menton à 70°** : `scripts/head-turntable/audit-chin-registration.ts` ; décalage vertical par vue ; forme non modifiée ; cause non prouvée.
- **Vérification** : `verify-relief.ts` (17 contrôles par tête, 5 sur la planche), branché dans les 3 couches ; 13 têtes sans échec bloquant.
- **Tests** : `tests/head-turntable-relief.test.ts` (10) ; suite tête / crâne : 159 tests verts.
- **Artefacts** : `artefacts/head-turntable-v5/` (avant / après, grilles lacet × tangage à côté de `rotation-3d/01.jpg`, champs de relief, menton).
- **Docs** : `HEAD-TURNTABLE-RELIEF.md`, `-RELIEF-VERIFY.md`, `-RELIEF-REMAINING.md` ; mise à jour de `HEAD-TURNTABLE-REMAINING.md` et du README.
- Reste à faire : `docs/HEAD-TURNTABLE-RELIEF-REMAINING.md`.
