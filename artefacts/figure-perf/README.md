# artefacts/figure-perf — preuves de docs/PERF-4.md

Produits par `npx tsx scripts/artefacts-figure-perf.ts` (l'ancien moteur est un worktree git de `ddbbad4`). Les chronos varient d'une exécution à l'autre (bruit machine, 1 cœur) ; les rapports sont stables.

| Image | Ce qu'elle prouve |
|---|---|
| `01-avant-apres-identiques.png` | même figure, ancien vs nouveau moteur : différence ×16 entièrement noire (0 pixel différent sur 754 560) |
| `02-balayage-lumiere.png` | 6 lumières : relief, AO, G-buffer et occlusion calculés une seule fois ; temps par rendu en légende |
| `03-tete-ombre-x1-x2-verification.png` | ombre de la tête exacte vs `headCastScale: 2` ; différence ×10 (fines lignes de pénombre) ; 20 vérifications géométrie / anatomie / style, 0 échec |
| `04-parametres-consommes.png` | un paramètre à la fois (lumière, style, peau, AO, rainures, caméra…) : il agit là où il doit |
| `05-scene-4-personnages-garde-hors-cadre.png` | 4 personnages dont un à x = 9 000 : rendu sans plantage (garde `resvg`), 3 personnages visibles inchangés |
| `06-temps.png` | temps de calcul : ancien à froid, nouveau à froid, nouveau si seule la lumière change |
| `mesures.json` | les chiffres de cette exécution |

Le visage garde sa peau dans `04` (case « peau foncée ») : la peau de base du visage vient de la scène, pas de `litFigure` (voir `docs/PERF-4-VERIFY.md`).
