# Rapport de vérification crâne ↔ cheveux

Corpus : 323 visages chevelus (200 tirés au naturel, graines 52000 + 13 k, plus 14 par coiffure imposée, axes v2 cohérents). Code : `src/verify/hair-skull.ts`.

| couche | contrôle | visages | écarts | erreurs | pire valeur | limite |
|---|---|---:|---:|---:|---:|---:|
| anatomy | `back-mass-above-skull` | 68 | 0 | 0 | 0.000 | 0.010 |
| anatomy | `body-reach-bound` | 323 | 0 | 0 | 0.000 | 0.105 |
| anatomy | `free-dist-bound` | 323 | 0 | 0 | 0.000 | 43.992 |
| anatomy | `free-reach-bound` | 323 | 0 | 0 | 0.000 | 0.105 |
| geometry | `back-mass-closed-bottom` | 68 | 0 | 0 | 0.000 | 0.900 |
| geometry | `back-mass-inside-hair` | 68 | 0 | 0 | 0.000 | 0.050 |
| geometry | `back-mass-no-bar` | 68 | 0 | 0 | 0.000 | 0.920 |
| geometry | `back-mass-no-lid` | 68 | 0 | 0 | 0.000 | 0.750 |
| geometry | `skull-dome-bound` | 323 | 0 | 0 | 0.000 | 26.764 |
| geometry | `skull-shell-bound` | 323 | 0 | 0 | 0.000 | 26.764 |
| style | `back-mass-not-black` | 68 | 0 | 0 | 0.000 | 0.500 |
| style | `back-mass-tip-visible` | 68 | 0 | 0 | 0.000 | 0.020 |

« écarts » = contrôles non satisfaits (erreur ou avertissement) ; « erreurs » = ceux de gravité `error`. Un chiffre non nul n'est pas masqué : voir `docs/HAIR-SKULL-REMAINING.md`.
