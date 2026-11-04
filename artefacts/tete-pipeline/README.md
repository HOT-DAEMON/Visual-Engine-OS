# Preuves visuelles — tête + corps dans le pipeline principal

Régénérer : `npx tsx scripts/artefacts-head-pipeline.ts`.

| Image | Ce qu'elle prouve |
|---|---|
| `01-tete-corps-pipeline.png` | 3 figures (adulte, adulte, enfant 8 ans) compilées par `compileScene` avec `kind: 'body'`. Sous chaque figure : contrôles passés par couche (géométrie / anatomie / style) via `verifyPipeline`. « anatomy 23/25 » = 2 avertissements d'orbite (dette connue). |
| `02-composants-enfants-tete.png` | Sur le rendu réel d'un même visage : tête/crâne, orbites, yeux, nez, bouche, menton, oreilles, cheveux, cou, chacun surligné avec son identifiant canonique. |
| `03-relations-oeil-orbite.png` | Relations œil ↔ orbite mesurées : graine 11 conforme ; graines 1, 20, 35 hors orbite (rouge, 1,04 à 1,86). Montre la divergence non corrigée décrite dans `docs/ANATOMY-CONTRACT.md` §4. |

Limites : le torse s'arrête sur une coupe droite (bassin et jambes non branchés) ; cheveux `hair-grammar`, crâne de profil et pose 3/4 absents (`docs/TODO-HEAD-BODY-PIPELINE.md`).
