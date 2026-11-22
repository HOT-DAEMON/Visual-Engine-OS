# Moteur d'oreille — preuves visuelles de la passe 5

Rendus RÉELS du moteur, jamais retouchés. Reproduction : `scripts/artefacts-ear-5.ts` (`cmp`, `axes`, `diversite`, `verif`) ; mesures : `scripts/ear-audit/passe5-stats.ts`.
Détail : `docs/EAR-PASSE-5.md` ; manques : `docs/EAR-REMAINING.md`.

| Fichier | Ce qu'il prouve |
|---|---|
| `AVANT-APRES-04-attache.png` | la jupe de peau a disparu : le bord antérieur touche la tête (têtes 11, 15, 18, 22) |
| `AVANT-APRES-01-tetes-entieres.png` | 8 têtes entières : oreilles plus larges de face, jamais un trait |
| `AVANT-APRES-02-oreille-defaut-4-vues.png` | conque agrandie jusqu'à l'antitragus, rebord d'hélix épais jusqu'au lobule |
| `AVANT-APRES-03-oreilles-natural-gros-plan.png` | 24 oreilles composées, avant/après |
| `04-scapha-curvature-{face,three-quarter,close-up,tete}.png` | l'axe renforcé à −0,9 / 0 / +0,9 (effet modéré en gros plan) |
| `05-diversite-{natural,caricature,fantasy}.png` | 12 têtes entières par caractère : chaque oreille est singulière |
| `mesures-avant.json`, `mesures-apres.json` | conque, peau lisse, largeur frontale, écart d'attache (300 oreilles) |
| `verification-rendu.json`, `verification-modele.json` | vérification géométrie / anatomie / style : 24 têtes sans échec ; 90 oreilles, 0 erreur |

Les moitiés « avant » : commit `ddbbad4` (passe 4), même script `cmp`. Les planches sources « avant » ne sont pas conservées (les `AVANT-APRES-*` les contiennent).
