# Artefacts — moteur d'oreille, passe 6

Tous les fichiers sont des rendus RÉELS du moteur (aucune retouche). Régénération : `OUT=artefacts/oreille-passe-6 npx tsx scripts/artefacts-ear-6.ts [axes|cmp|tetes|tete3d]` ; mesures : `scripts/ear-refs/`. Détail et limites : `docs/EAR-PASSE-6.md`, `docs/EAR-REMAINING.md`.

| Fichier | Ce qu'il prouve |
|---|---|
| `01-tetes-entieres.png` | 8 têtes entières, oreilles composées « natural » : variété, attache, taille |
| `02-oreille-defaut-4-vues.png` | oreille par défaut : face, trois-quarts, profil, gros plan (conque large, lobule fondu à l'hélix) |
| `03-oreilles-natural-gros-plan.png` | 24 oreilles composées en gros plan : diversité |
| `04-scapha-curvature…`, `04-scapha-gradient…` | axes de scapha lisibles en gros plan (−0,9 / 0 / +0,9) |
| `05-helix-continuity…` | entaille de l'hélix : effet réel mais discret (voir limites) |
| `06-antihelix-upperBend…`, `07-antihelix-lowerBend…` | courbure libre de chaque branche d'anthélix (02B/02C) |
| `08-concha-floor…` | fond du cavum : plateau / neutre / cuvette (05E) |
| `09-helix-darwinSite…` | tubercule de Darwin à site variable |
| `10-tete-3d-oreilles-composees.png` | tête 3D en profil 90° et trois-quarts 55° avec oreilles composées (rendu encre) |
| `cartes-structures/avant`, `/apres` | structures du modèle au code couleur de la référence 01 (rose hélix/lobule, bleu anthélix, vert tragus, gris creux) |
| `cartes-structures/reference-01-masques.png` | segmentation de la référence 01 |
| `mesures/*.json` | mesures du moteur avant/après (100 oreilles « natural »), de l'attache (50 têtes) et de la référence 01 |

Chiffres clés (médianes) : peau nue 23,7 % → 13,4 % ; conque 25,1 % → 26,8 % ; anthélix 15,3 % → 19,6 % ; bas du lobule à 0,21 H → 0,14 H de la tête.
