# Journal des modifications — suite 4

> Suite de `CHANGELOG-3.md` (discipline : ≤ 200 lignes par fichier). Le plus récent est ici.

## Session 13 — Cheveux complets par mèches, pilosité étendue, axes indépendants

Objectif : les coiffures reposaient sur un volume compact à motifs radiaux. Elles sont maintenant construites mèche par
mèche à partir d'une ligne d'implantation réelle, avec queue / chignon / tresses, et chaque axe morphologique est indépendant.
Les yeux, nez, bouche, pilosité restent des ENFANTS du visage (positions lues dans `face/landmarks.ts`).

### Cheveux (`src/face/hair/`, géométrie pure, un fichier = un domaine ≤ 200 lignes)

- `hairline.ts` : ligne d'implantation réelle (ronde / droite / pic de veuve / tempes), recul des tempes (golfes), irrégularité
  (bruit lisse + encoches, différent à gauche et à droite). Jamais sous `browLimitY − 0,03 H`. Arc du crâne associé.
- `scalp.ts` : sous-couche racine (volume dense) SÉPARÉE du cuir chevelu visible (raie, plaques d'éclaircissement front + sommet),
  densité par racine (éclaircissement, variation de zone), masse arrière sombre (bob/long).
- `flow.ts` : définition de chaque coiffure = champ de direction local (radial / balayé loin de la raie / vers l'arrière) + gravité +
  longueur + largeur ; intégration pas à pas de la ligne médiane de chaque mèche.
- `texture.ts` : TEXTURE indépendante de la coiffure — raide, ondulé, bouclé (boucles fermées), crépu (ressort serré, mèches en paquets),
  tressé (plaits). `'auto'` conserve l'ancien couplage (curly → bouclé, afro → crépu).
- `ribbon.ts` : mèche = ruban effilé ; tresse = chaîne de lentilles obliques alternées (3 brins) serrée en pointe.
- `fringe.ts` : frange (droite / balayée / rideau) accrochée à l'implantation réelle, dents inégales, au-dessus des sourcils.
- `tie.ts` : queue (haute / basse / côté / couettes), chignon (disque festonné + spirales, double chignon), tresses pendantes (1 à 6).
- `guard.ts` : garde-fou « enfant du visage » — chaque sommet de mèche avant est projeté hors de la peau du visage, et les arêtes
  qui traversent la zone interdite sont SUBDIVISÉES (sans cela, une arête entre deux sommets autorisés coupait le coin de tempe).
- Rendu (`render/face/hair.ts`, `hair-detail.ts`) : cuir chevelu, sous-couche « satin », mèches une à une (teinte propre à chacune),
  reflet côté lumière (faible sur le crépu), ombre douce et poils fins qui franchissent l'implantation (transition peau/cheveux).
  `hair-geometry.ts` et `hair-strands.ts` (calotte + brins radiaux) sont supprimés.

### Pilosité faciale (`face/beard-geometry.ts`, `render/face/facial-hair.ts`)

- Barbes : `stubble`, `short` (ras du menton), `full`, `long` (effilée, jusqu'à +0,22 H sous le menton), `goatee` ; moustache seule
  (`beard: 'none'`) ; nouvelle moustache `pencil`. Favoris (`sideburns` : short / long / mutton) indépendants de la coiffure : largeur
  ≤ 0,04 W tant qu'on est dans la zone des yeux.
- Transition peau/poils (`transition`) : halo diffus + poils épars au-delà du bord ; `patchiness` : zones clairsemées (bruit lisse).

### Axes indépendants (`generation/random-axes.ts`, tirés APRÈS tout le reste : les seeds existantes gardent proportions, expression, yeux)

- Peau : clarté × sous-ton continu (rosé → neutre → olive → doré) ; aucune dérive d'un axe vers l'autre.
- Texture de cheveux appliquée à n'importe quelle coiffure ; couleur des cheveux, barbe, implantation tirés séparément.
- Pli de l'œil (pli palpébral dont la monopaupière, pli épicanthique) : appliqué aux deux yeux AVANT l'ajustement à l'orbite.
- Sourcils et cils = systèmes pileux distincts : teinte (identique, plus sombre, plus claire, grise), épaisseur, nombre de poils, arche,
  effilement, longueur ; cils (longueur, densité, teinte) — indépendants de la chevelure.

### Preuves

- Tests : 1461 → 1779 (`tests/hair-system.test.ts` : implantation, recul, pic de veuve, 50 combinaisons coiffure × texture sans œil
  recouvert, queue/chignon/tresses, favoris, barbes, transitions, indépendance statistique des axes, déterminisme).
- Mesures sur 1500 visages (`artefacts/cheveux-pilosite/metrics.json`) : cheveux sur un œil **0**, favoris sur un œil **0**, implantation sous la
  limite des sourcils **0**, marge minimale 3 % de H ; crépu + peau claire 73 cas, raide + peau foncée 126 cas ; sourcils ≠ cheveux 1500/1500.
- Mutation : garde-fou désactivé → 55 échecs détectés. Images : `artefacts/cheveux-pilosite/` (10 images, `scripts/artefacts-hair.ts`).

## Session : cheveux v2 + moteur d'apparence + vérification du rendu

### Ajouté

- **Moteur d'apparence partagé** (`src/appearance/`, contrat `schema/appearance.ts`, `docs/APPEARANCE.md`) : ombre / lumière / contour
  indépendants, dégradés à N couleurs, texture, contraste, saturation, luminosité, opacité, émission, réflexion, réfraction, glow, bloom.
  Lu par les cheveux, la pilosité, le cou, les oreilles, le nez et la transition à l'implantation.
- **Formes de mèches** : grandes mèches en S flottantes, cônes rigides épais à la base, volutes libres sans gravité (`shapes.ts`).
- **Silhouette** : gonflement (`puff`) pour toutes les textures, asymétrie par côté, report de masse (`volume.ts`).
- **Racines relevées à la raie**, **longueurs étagées + sous-couches visibles**, **pointes irrégulières / retroussées / translucides**,
  **trois niveaux d'épaisseur** (masses, moyennes, poils très fins), **textures mélangées par zone**.
- **Moteur générique de frange** : `sheer` (fils individuels, peau visible), `blades` (grandes mèches triangulaires avec jour), `wispy`, `asym_brow`.
- **Comportement par côté** : oreille cachée / dégagée / rangée, mèches de joue, indépendamment à gauche et à droite.
- **Occlusions** : mèches devant le visage (calque `over` après les yeux), recouvrement mesuré = demandé.
- **Ombrage cel** (2–3 tons à bords nets, bande de reflet blanche à contour dur), ombre portée teintée entre mèches.
- **Génération** : `hairEngine: 'v2' | 'classic'`, `occlusions`; 47 % de couleurs vives (contre 16 %), dégradés racine → pointe.
- **Couche de vérification** (`src/verify/`, `docs/VERIFY.md`) : géométrie, anatomie, style ; 40 contrôles distincts.

### Modifié

- `HairGeometry` : `over`, `tierMasses`, `occlusions`, `sides` ; `HairLock` : `kind`, `spine`, `w0`, `sharp`, `profile`, `tier`, `fade`, `edgeFade`.
- `compileScene` : calque final des `overlay` (cheveux devant les yeux). Liste blanche SVG : primitives de filtre inertes.
- Garde-fou : mode `cheek` ; en mode `fringe`, une pointe sous `yF` est **ramenée** à `yF` (plus poussée de côté).
- `polyBox` en boucle (une chevelure de milliers de sommets faisait déborder la pile avec `Math.min(...xs)`).

### Preuves

- Tests : 1779 → 1866 (`tests/hair-v2.test.ts`, 87 tests : formes, franges, côtés, occlusions, étages, pointes, épaisseurs, apparence,
  génération, vérification). Les tests du moteur classique passent `hairEngine: 'classic'`.
- 300 seeds : **300/300** passent les trois couches (`artefacts/hair-v2/metrics.json`). Images : `artefacts/hair-v2/` (10 images, `scripts/artefacts-hair-v2.ts`).

