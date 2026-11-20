# Moteur d'oreille — preuves visuelles de la session (audit, nouveaux axes, compositeur)

Toute image est un rendu réel du moteur (jamais retouché). Régénérer : `npx tsx scripts/artefacts-ear-3.ts` (planches 01–06), `npx tsx scripts/ear-audit/diversity.ts 120` (planches par caractère + `diversite.json`).

| Fichier | Ce qu'il prouve |
|---|---|
| `01-tete-entiere-axes-corriges.png` | tête entière : paramètres qui ne faisaient rien (scapha, fidélité, douceur, détail, échelle). **Honnêteté** : de face, seule l'échelle se lit à l'œil ; les autres se lisent dans les vues oreille |
| `02-tete-entiere-nouveaux-axes.png` | tête entière : Darwin, replié, fendu, étiré, rebord de conque, fosse, crus, tragus, anthélix |
| `03-nouveaux-axes-vues.png` | les mêmes axes en face, trois-quarts, profil |
| `04-matiere-et-surface.png` | translucidité, émission, pigmentation, plis, pores, vaisseaux, pilosité |
| `05-composeur-tetes-entieres.png` | oreilles composées (natural / caricature / fantasy) sur des têtes entières |
| `06-composeur-trois-quarts.png` | oreilles composées en trois-quarts |
| `planche-natural|caricature|fantasy.png` | 120 oreilles composées chacune (graines 1000–1119) |
| `diversite.json` | distances par paires, empilement, erreurs et avertissements de vérification |

Audit : `../oreille-audit-visibilite/` (`comparaison.md`, `audit-avant-apres.png`, `vues.md`).

Non montré : tête 3D de profil avec oreilles composées (l'oreille y est dessinée en style anime par construction) ; les deux panneaux gris autour de la tête de la graine 16 (planche 05) viennent de l'hôte, identiques pour toute oreille.
