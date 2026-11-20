# Moteur capillaire — grammaire de composition (TODO §3.1, §B, §D)

Code : `compose-grid.ts`, `compose.ts` (analyse), `compose-plan.ts` (pilotage) · tests : `tests/hair-engine-compose.test.ts` ·
preuves : `artefacts/hair-engine/05-composition-pilotage.png`, `06-composition-analyse.png`, `11-tete-entiere-vues.png`.

## Existant vérifié avant de coder
Le moteur avait des familles, couches, raie, volumes, asymétries (voir `HAIR-GRAMMAR*.md`) mais RIEN qui mesure une composition ni ne la vise.
Le TODO le dit : « 16 grosses mèches et 20 secondaires » ne font pas une silhouette. D'où deux outils symétriques : MESURER (`analyzeComposition`) et VISER (`composeHair`).

## Les dix items du TODO, un par un
| Item du TODO | Mesure (`analyzeComposition`) | Pilotage (`CompositionSpec`) | Preuve |
|---|---|---|---|
| Hiérarchie des masses dominantes | part visuelle de chaque famille (aire d'union rasterisée), rôle dominant/secondaire/accent, rapport | `hierarchy` : parts cibles → échelle de largeur par famille | test hiérarchie ; titre de 06 |
| Direction principale de lecture | vecteur de lecture pondéré largeur·longueur → angle, cohérence | `reading` : rotation d'ensemble des caps (boucle) | 05 : 20°/90°/160° → mesuré 34°/88°/151° |
| Équilibre G/D | moment (part gauche/droite) | `balance` : échelle de largeur selon le côté de la racine | 05 : −0,25/0/0,25 → −0,21/0,04/0,23 |
| Espaces négatifs | grille fermée (morphologie) − occupation : trous, ratio, parasites (`speckle`), alignement, enveloppe | `channels` : couloirs voulus, mèches qui les traversent retirées (≤ 22 %) | 06 (cercles verts) ; test corridor |
| Points focaux | épi (convergence de racines), faisceau de pointes, accent isolé | `focal` : construit `whorl` (7 racines), `tips` (5), `accent` | 06 ; test focal |
| Lignes de force | contour + flux, portée (`carry`), alignement | — (mesure) | 06 (magenta) |
| Distribution de densité | carte coque `EL_BINS=6 × AZ_BINS=12` normalisée, corrélation | `density` : blobs gaussiens → acceptation des racines proportionnelle | test corrélation ↑ |
| Relations entre groupes | arêtes famille↔famille (`cross`, `emerge`, `adjacent`) | `relations` : règles « fille émerge de mère » (`emergeFrom`) | consommé par le générateur et par `occlusion.ts` |
| Fonction ≠ nombre de mèches | `masses[].role` | `hierarchy` | 06 |
| « consommé par le moteur capillaire » | — | `composeHair` appelle `sampleLock` du générateur commun (pas de fork) | `composeHair(TOUSLED, …)` |

## Boucle de génération
`composeHair(P, spec, seed, view, 6)` : construire → mesurer → corriger (`phi` rotation de lecture, `lam` déséquilibre, `wk[famille]`) jusqu'à tolérance
(0,12 rad, 0,05, 0,04) ou 6 itérations ; renvoie `{specs, composition, journal}`. Déterministe (testé).

## Limites connues (à faire)
- La lecture tombe à ~0,25 rad de la cible sur les angles obliques (artefact 05 : 20° → 34°) : la boucle sature, le champ de flux ne tourne pas au-delà de ~±30°
  sans casser la gravité. Piste : rotation d'`aim` par famille plutôt que globale.
- L'analyse est faite sur le raster des lames (pas sur le rendu final avec filtres SVG).
- Les focaux « tips » et « accent » sont visés par asservissement visuel (8 itérations) : ils peuvent manquer leur cible de ~5 % de la hauteur de tête.
- Les seuils de `style.*` sont des garde-fous calibrés sur TOUSLED, pas des critères d'ordre esthétique.
- Pas de composition 3D : mesures dans une seule vue (`viewAt`) ; changer de vue change l'analyse (voir artefact 11).
