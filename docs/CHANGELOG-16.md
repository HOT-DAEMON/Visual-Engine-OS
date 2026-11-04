# Changelog 16 — tête + corps dans le pipeline principal, contrat central, relations (branche `feat/hair-grammar`)

- **Audit** (`scripts/audit-wiring.mjs`) : depuis `compileScene`, le visage de face est atteint ; `body`, `skull`, `hair-grammar`, `face/pose`, `relief` ne l'étaient pas (`PIPELINE-WIRING.md` §1).
- **Corps branché** : `kind: 'body'` (`schema/body.ts`, `render/body.ts`), validation de scène, calque `underlay`, `hostFace()` (source unique des repères stylisés). Sortie identique à `composeFigure` sur 3 graines.
- **Registre des compilateurs** (`render/registry.ts`) remplace le `switch` de `compile.ts` ; table typée exhaustive. Pas de registre ouvert (argumentaire : `PIPELINE-WIRING.md` §3).
- **Contrat central** (`src/anatomy/components.ts`) : 28 composants canoniques, alias de 4 vocabulaires, aucun orphelin (testé).
- **Relations** (`src/anatomy/relations.ts`) : géométriques, anatomiques, visuelles de l'œil, mesurées sur la scène compilée.
- **Vérification** (`src/verify/pipeline.ts`, `verifyPipeline`) : géométrie / anatomie / style sur l'assemblage tête + corps.
- **Défauts trouvés** : orbite (12/80 visages, non corrigé, dette bornée par test) ; olécrâne en heptagone (corrigé, 8 sommets) ; contraste du trait sur peau foncée (contrôle relatif + `inkOf`, corrigé).
- Tests : `tests/anatomy-contract.test.ts` (6), `tests/pipeline-body.test.ts` (4) ; tests du corps : 60 verts après correctifs. Régression visuelle `npm run regress` : exit 0.
- Artefacts : `artefacts/tete-pipeline/` (3 planches + `README.md`), `npx tsx scripts/artefacts-head-pipeline.ts`.
- Docs : `ANATOMY-CONTRACT.md`, `PIPELINE-WIRING.md`, `TODO-HEAD-BODY-PIPELINE.md`.
