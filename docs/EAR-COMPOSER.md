# Moteur d'oreille — compositeur (quasi-infinité d'oreilles singulières)

`composeEar(seed, { character, family, surface, piercings })` (`src/face/ear/compose.ts`) compose une oreille complète pour une graine : ≈ 38 axes morphologiques et de style, famille et mélange, matière, extensions, détails SURF-05, bijoux. Sortie validée par le schéma.

## Grammaire
- `natural` : humain plausible, dispersion 0,55, variantes rares (Darwin 10 %, fente 5 %, étiré 3 %, replié 5 % × 1), exagération ≤ 0,12.
- `caricature` : structure humaine, dispersion 0,95, variantes rares ×3,2, exagération 0,45–0,95.
- `fantasy` : famille tirée, mélange (55 %), matière compatible, 0–3 extensions compatibles, 40 % de style anime, émission pour cristal.
- Un flux pseudo-aléatoire PAR groupe d'axes : ajouter un groupe plus tard ne déplace pas les autres tirages.
- Style cel : au plus un détail de surface et une extension (peu de tons).
- Branchement : `structure: { draw: { ears: 'natural' | 'caricature' | 'fantasy' } }` (le booléen `true` garde le tirage historique).

## Diversité MESURÉE (`scripts/ear-audit/diversity.ts`, `artefacts/oreille-composeur/diversite.json`)
120 graines consécutives (1000–1119) par caractère, rendu réel de face (cadre 130 × 180), distance = pixels changés entre toutes les paires (7 140). Seuil « visiblement distincte » : 1 % du cadre = 234 px.
| Caractère | Paires distinctes | Écart minimal (px) | Médiane (px) | Empilement distinct |
|---|---:|---:|---:|---:|
| natural | 100 % | 891 | 3328 | 120 / 120 |
| caricature | 100 % | 1262 | 3997 | 120 / 120 |
| fantasy | 100 % | 1560 | 6979 | 120 / 120 |
Aucune affirmation « infinie » : on a mesuré que 120 graines donnent 120 oreilles deux à deux distinctes au-delà de 3,8 × le seuil. Un nombre d'oreilles distinctes au-delà de 120 n'est pas mesuré.

## Vérification (trois couches) sur les 120 oreilles par caractère
- Erreurs : 0 après calibrage (voir ci-dessous). Avertissements restants : cassures de contour (`ear-outline-turn`) sur pointes et tubercules : natural 0, caricature 6, fantasy 22 (sur 120).
- Défauts réels que le compositeur a révélés et qui sont corrigés : contour du lobule qui se croise (borne stricte `lobule.length`), incisure sortant du pavillon, tubercule de Darwin à cheval sur le contour.
- Seuils recalibrés et pourquoi : hauteur bilatérale = 2 % + 0,35 × asymétrie + 0,1 × exagération (la hauteur découle du niveau de la racine, qui dépend de la forme) ; palette cel comptée en tons perçus (16 niveaux par canal) +2 par détail actif ; épaisseurs de trait +2 par détail, +3 si émission ; écart lobule/base du nez tient compte de `attach.scale` et du lobule étiré ; cassure de contour élargie par pointe et tubercule demandés.

## Planches
`artefacts/oreille-composeur/planche-natural|caricature|fantasy.png` (120 oreilles chacune), `05` (têtes entières), `06` (trois-quarts).

## Reste à faire
- Oreilles composées jamais validées sur la tête 3D de profil (l'oreille y est dessinée en style anime par construction).
- Couplages anatomiques entre axes (ex. lobule long ↔ pendance) simples : pas de modèle statistique mesuré sur des oreilles réelles.
- Distribution des familles et des variantes rares non calibrée sur des données.
- Avertissements `ear-outline-turn` à réduire (pointes fantasy).
- Hôte : la tête de la graine 16 montre deux panneaux gris de part et d'autre du crâne, identiques quelle que soit l'oreille ; non lié au moteur d'oreille, non investigué.
