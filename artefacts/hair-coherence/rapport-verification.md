# Rapport de vérification — cohérence cheveux ↔ tête

Corpus : 368 visages chevelus (naturels, graines 61000 + 17 k ; 14 par coiffure imposée ; 4 par coiffure sous vent fort). Code : `src/verify/hair-coherence.ts`.

| couche | contrôle | visages | écarts | erreurs | pire valeur | limite |
|---|---|---:|---:|---:|---:|---:|
| anatomy | `bun-radius-bound` | 32 | 0 | 0 | 0.000 | 0.000 |
| anatomy | `bun-visible` | 32 | 0 | 0 | 0.000 | 0.250 |
| anatomy | `tail-length-bound` | 53 | 0 | 0 | 0.000 | 0.020 |
| anatomy | `tail-spread-bound` | 53 | 0 | 0 | 0.000 | 0.050 |
| anatomy | `tie-above-ear` | 48 | 0 | 0 | 0.000 | -0.009 |
| anatomy | `tie-above-skull-top` | 86 | 0 | 0 | 0.000 | -0.060 |
| anatomy | `tie-on-skull` | 48 | 0 | 0 | 0.000 | 0.040 |
| geometry | `crown-covered` | 260 | 0 | 0 | 0.000 | 0.780 |
| geometry | `envelope-coverage` | 368 | 0 | 0 | 0.000 | 0.000 |
| geometry | `lock-envelope-bound` | 368 | 0 | 0 | 0.000 | 0.140 |
| geometry | `lock-envelope-rise` | 368 | 0 | 0 | 0.000 | 0.220 |
| style | `crown-tone-not-black` | 368 | 0 | 0 | 0.000 | 0.410 |
| style | `style-vocabulary` | 368 | 0 | 0 | 0.000 | 0.000 |

« écarts » = contrôles non satisfaits (erreur ou avertissement) ; « erreurs » = gravité `error`. Un chiffre non nul n'est pas masqué : voir `docs/HAIR-COHERENCE-REMAINING.md`.
