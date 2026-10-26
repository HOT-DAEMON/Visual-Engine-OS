# Preuves visuelles — moteur de crâne en profil

Générées par `npx tsx scripts/artefacts-skull.ts 7` (déterministe) ; `bench.json` par `scripts/bench-skull.ts`. Documentation : `docs/SKULL-PROFILE*.md`.

| Image | Ce qu'elle prouve |
|---|---|
| `01-profil-peau.png` | tête de profil finie (style cel), nuque, plis cervicaux, oreille du moteur, lèvres, œil |
| `02-profil-nuque-degagee.png` | coiffure `undercut` : nuque dégagée jusqu'à l'inion |
| `03-anatomie-os-tissus-reperes.png` | os, tissus mous (traits rouges), repères nommés, C1–C7 |
| `04-os-seul.png` | os seul |
| `05-coherence-face-profil.png` | même graine : 4 lignes guides (yeux, base du nez, bouche, menton) traversent les deux vues aux mêmes hauteurs |
| `06-diversite-8-tetes.png` | 8 graines : crâne, nez, menton, cou, coiffure, peau |
| `07-coiffures-nuque.png` | `none / short / undercut / updo` |
| `08-gros-plan-nuque.png` | nuque en gros plan |
| `verification.json` | 200 têtes : 200 sans erreur, avertissements comptés, 29 contrôles de la tête de référence |
| `bench.json` | vitesse (médianes sur 24 têtes) |

Limites visibles : sutures indicatives, mandibule approximative, ligne d'implantation de la nuque lissée, couleurs de cheveux fantaisie du générateur (`docs/SKULL-PROFILE-REMAINING.md`).
