# Journal — passe masses de région, silhouettes, encre, pose 3/4 (branche `feat/hair-masses`)

- Cheveux : `sim.regions` (tempes, pattes, nuque, mèches de joue, zone rasée, volume du dessus, longueur propre à chaque archétype), `sim.ink` (noir franc, masses pleines, bandes blanches, contours noirs). Opt-in.
- Vérification : `hair-zones.ts` (yeux, sourcils, nez, bouche protégés ; tempes, joues, oreilles, cou autorisés avec limites par zone ; silhouette) ; contrôles encre dans `style.ts` ; règle `face-interior-clear` remplacée pour ces cheveux.
- Drapé : une mèche de côté se rapproche progressivement du contour (plus d'arête diagonale à travers le sourcil).
- Pose : `src/face/pose/` (arbre parent/enfants/frères, crâne, cou) — non branché au rendu.
- Perf : `hairGeometry` mémoïsée.
- Tests : `tests/hair-regions.test.ts`, `tests/face-pose.test.ts`.
- Preuves : `artefacts/hair-masses/`.
- Erreurs rencontrées et corrigées : nuque visible en coins noirs sous la mâchoire ; houppe trop haute qui échouait `hair-sim-gravity` ; mèches `hime` sur les sourcils (frange diagonale) ; tests de pose écrits avec le mauvais sens physique du lacet.
