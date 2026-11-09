# Changelog 22 — tête 3D dans le pipeline, cou en cloche (branche `feat/hair-grammar`)

- **Pipeline** : nouveau `kind: 'head_3d'` (`schema/head-3d.ts`, `render/head-3d.ts`, `render/registry.ts`, `schema/scene.ts`) : tête + cou de l'hôte à un lacet / tangage libres, par la 3D de `head-turntable`. Aucun moteur nouveau : `engines/from-host.ts` lit le visage stylisé de l'hôte, `deriveSkull` dérive le crâne (comme `head_profile`), la lisière des cheveux vient de la coiffure de l'hôte (`hair-bridge.ts`), l'iris de l'œil posé sur l'hôte (`ctx.eyes`).
- **Refactor sans changement de comportement** : `HeadSource` (interface commune de `RandomProfile` et d'un hôte) dans `engines/from-face.ts` ; `SkullVariation` factorisée dans `schema/head-profile.ts`.
- **Cou en cloche** : profil mesuré sur `rotation-3d/07.jpg` (`smooth(t)` à 0,03 près, ×1,7 – 2,3 au lieu de ×1,3) ; `engines/neck3d.ts`, 30 rangées (`mesh.ts`) ; planche inchangée.
- **Vérification** : `verify/head-3d.ts` verse les 3 couches de la tête dans `verifyPipeline` (79 contrôles par tête, 0 échec bloquant sur 3 graines) ; `verify-relief.ts` : `neck.bell`, `neck.monotone`, borne de `neck.flare` 1,9 → 2,2.
- **Tests** : `tests/pipeline-head-3d.test.ts` (8), `tests/head-turntable-neck-bell.test.ts` (4).
- **Artefacts** : `artefacts/head-turntable-v6/`. **Docs** : `PIPELINE-HEAD-3D.md`, `-REMAINING.md`, `HEAD-TURNTABLE-NECK-BELL.md`.
- Reste à faire : `docs/PIPELINE-HEAD-3D-REMAINING.md` (volume des cheveux, yeux, sourcils, recouvrement 0° ↔ visage, SCM / clavicule, roulis).
