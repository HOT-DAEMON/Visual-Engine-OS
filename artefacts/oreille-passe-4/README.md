# Moteur d'oreille — preuves visuelles de la passe 4

Rendus RÉELS du moteur, jamais retouchés. Reproduction : `scripts/artefacts-ear-4.ts` (`cmp`, `axes`, `verif`).
Détail et mesures : `docs/EAR-PASSE-4.md`, `docs/EAR-RENDER-VERIFY.md` ; manques : `docs/EAR-REMAINING.md`.

| Fichier | Ce qu'il prouve |
|---|---|
| `AVANT-APRES-01-tetes-entieres.png` | 8 têtes entières : oreilles moins obliques, reliées à la joue. À l'échelle de la tête le gain est discret ; il est net dans les fichiers 02–04 |
| `AVANT-APRES-02-oreille-defaut-4-vues.png` | conque agrandie (cavum 15,7 % → 21,5 % de l'aire), anthélix en renflement, fond en dégradé |
| `AVANT-APRES-03-oreilles-natural-gros-plan.png` | 24 oreilles composées, avant/après |
| `AVANT-APRES-04-attache-zoom.png` | attache à la tête (jupe de racine, pente d'accrochage) : têtes 11, 15, 18, 22 |
| `04-axes-close-up.png`, `04-axes-three-quarter.png` | les 11 nouveaux axes à −0,9 / 0 / +0,9 |
| `05-axes-tete-entiere.png` | les mêmes axes sur une tête entière : la plupart des axes fins y restent discrets (voir `docs/EAR-PASSE-4.md`) |
| `verification-rendu.json` | vérification du rendu sur 24 têtes : 0 échec (erreur ou avertissement) |

Les moitiés « avant » sont produites sur le commit `f6b5e36` avec le même script (`OUT=/tmp/avant npx tsx scripts/artefacts-ear-4.ts cmp`, favoris neutralisés dans le harnais des deux côtés pour une comparaison équitable) ; les moitiés « après » avec `OUT=… cmp` sur la passe 4. Les planches sources ne sont pas conservées (les fichiers `AVANT-APRES-*` les contiennent).
