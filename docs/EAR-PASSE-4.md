# Moteur d'oreille — passe 4

Preuves : `artefacts/oreille-passe-4/` (voir `README.md` du dossier). Rien n'est retouché : chaque image est un rendu du moteur.

## 1. Creux de la conque trop petit

Mesure avant : conque (cavum + cymba) = 17,8 % de l'aire du pavillon ; l'anthélix (`x` canonique 0,40–0,52, largeur 0,05) était trop antérieur et trop fin, ce qui laissait une grande zone plate entre l'anthélix et l'hélix (la « région hélix → lobule »).

| Structure | Avant | Après |
|---|---|---|
| Anthélix, corps | `A0 (0,40 ; 0,665)` → `B (0,52 ; 0,385)`, largeur 0,050 | `A0 (0,52 ; 0,69)` → `B (0,64 ; 0,385)`, largeur 0,072 |
| Cavum | `x` 0,09–0,46 | `x` 0,08–0,58 (jusqu'à l'anthélix) |
| Cymba | `x` 0,12–0,42 | `x` 0,12–0,54 |
| Crus de l'hélix | longueur 0,38 | 0,44 |
| Antitragus | `(0,34 ; 0,675)` | `(0,40 ; 0,695)` |

Rendu : fond des cavités en **dégradé radial** (le centre est le plus profond) au lieu d'un aplat ; crêtes épaisses éclairées avec un croissant **proportionnel à leur propre épaisseur** et adouci (renflement arrondi plutôt qu'un liséré).
Mesure sur l'oreille par défaut (aire du polygone / aire du contour) : cavum 15,7 % → **21,5 %**, cymba 2,2 % → 2,9 %, corps de l'anthélix 3,9 % → 6,1 %, soit une conque de 17,8 % → 24,4 %. Dans une vue d'oreille rendue, le fond du cavum (quantile 25 % de la luminance) est 16–29 % plus sombre que la médiane du pavillon sur 9 oreilles × 2 vues (test `ear-render-verify`). Preuve visuelle : `AVANT-APRES-02`, `AVANT-APRES-03`.

## 2. Oreille mal attachée / oreille en trait

- **Pente d'accrochage** (`place.ts`) : le contour de la tête rentre vite sous l'oreille (mâchoire) alors que le pavillon est quasi vertical. L'oreille suit au moins `EAR_LEAN = 0,5` de la pente, davantage si la mâchoire fuit fort (l'écart du lobule reste ≤ 15 % de H). Moins d'inclinaison oblique « en trait ».
- **Jupe de racine** (`project.ts`, `render.ts`) : peau reliant la chaîne antérieure du contour (C06, C05, C04) au contour réel de la tête, refermée en pointe à la jonction lobule-joue, ton proche de la peau, bord adouci. Absente des planches d'oreille seule (pas de joue).
- **Lisibilité frontale** : largeur frontale ≈ `L·sin α + épaisseur·cos α`. Plancher préférentiel `FRONT_MIN = 0,26 H` et angle d'écartement minimal 21° (canon du dépôt, assoupli par `style.exaggeration`). Correction journalisée `ear-frontal-readable`. Le compositeur « natural » tire maintenant 21°–36° (avant : 16°–34°).
- Mesures (150 têtes, « natural ») : largeur/hauteur frontale minimale 0,21 → 0,26 ; médiane 0,41 → 0,32 (moins d'inclinaison). Les changements ultérieurs (pente adaptative, plage de tirage) n'ont pas été re-mesurés.

## 3. Axes ajoutés (EAR-01, 03, 04, 05, 06, 07)

| Axe | Effet | Tête (px) | Meilleure vue d'oreille (px) |
|---|---|---|---|
| `helix.torsion` | épaisseur du rebord : épais en haut / fin en bas, ou l'inverse | 576 | 5 803 |
| `helix.continuity` | > 0 rebord régularisé ; < 0 entaille à 58 % de la course | 97 | 1 596 |
| `scapha.curvature` | asymétrie haut/bas de la gouttière | 17 | 1 003 |
| `scapha.gradient` | moitié côté anthélix (> 0) ou côté hélix (< 0) plus sombre | 56 | 2 681 |
| `fossa.tilt` | rotation du triangle autour de la jonction des branches (±55°) | 207 | 1 194 |
| `fossa.curvature` | côtés bombés (> 0) ou pincés (< 0) | 174 | 466 |
| `concha.volume` | homothétie de la cuvette + profondeur | 324 | 6 367 |
| `concha.tilt` | inclinaison de la cuvette (±16°) | 426 | 6 420 |
| `concha.transition` | > 0 crus effacé, cuvette continue ; < 0 paroi nette | 253 | 1 868 |
| `tragus.thickness` | relief et épaisseur | 206 | 660 |
| `lobule.volume` | reflet + ombre propre | 243 | 1 977 |

Seuil de visibilité du dépôt : 150 px à l'échelle de la tête, 378 px dans la meilleure vue d'oreille. **Sous le seuil à l'échelle de la tête** : `helix.continuity`, `scapha.gradient`, `scapha.curvature` (structures fines) ; à l'œil, sur une tête entière, la plupart des axes fins restent discrets (`05-axes-tete-entiere.png`) : ils se lisent en gros plan, trois-quarts et profil.
Un bug a été trouvé et corrigé en cours de route : l'ombre de `scapha.gradient` était dessinée *sous* la scapha (1 px de différence) ; elle est maintenant une surimpression (`strength`, champ de `PlacedStructure`).

Le compositeur tire ces axes depuis des flux propres (`pass4`, `rare4`) : les tirages historiques ne bougent pas. Un lobule long est plus charnu (`lobule.volume` couplé à `lobule.length`).

## 4. Cohérence imposée par la vérification

Cymba et crus restent solidaires (pivot au niveau du crus, demi-inclinaison) : sans cela, l'ordre vertical anatomique « cymba < racine < cavum < bas du lobule » se brisait sur des oreilles composées.
Suite : 90 oreilles composées (3 caractères × 30 graines) sans erreur de vérification.

## 5. Défaut de harnais corrigé

Les deux panneaux gris de la tête de la graine 16 n'étaient pas un défaut de la tête hôte : `headShot` neutralisait barbe et moustache mais pas les favoris (`sideburns: 'mutton'`).

## Ce que cette passe ne fait pas

Voir `docs/EAR-REMAINING.md` (lignes Conque, Lobule, Hélix, Paramètres sans effet, Attache à la tête). En particulier : extrémités rectangulaires du crus et de la cymba encore crues, 3D de profil non validée pour les oreilles composées.

## 6. Références visuelles recalées (`references/visual/`)

La passe change le rendu des oreilles : 15 références de `regression-visual` ne correspondaient plus (`hard-01`, `02`, `03`, `04`, `05`, `06`, `07`, `08`, `11`, `12`, `14`, `15`, `16`, `17`, `18`). Les 16 cas standard sont restés exacts ; `hard-09`, `10`, `13` aussi.
Vérifié avant recalage : les pixels qui diffèrent sont tous dans la bande verticale des oreilles (colonnes de bord ; pour les têtes étroites, à 20–22 % de la largeur) ; sur `hard-05` (RMS 19,9, le plus grand écart) les yeux, le nez et la bouche sont identiques.
Recalage : `npx tsx scripts/regress.ts update-some <ids des cas « changed »>` ; `manifest.json` ne change que sur ces 15 entrées.

## 7. Suite complète (code final) : échecs préexistants, non liés

Seuls deux tests échouent, à l'identique sur le commit d'origine `f6b5e36` : `eye-gallery-ext3` (« les sources existantes gardent leurs tirages ») et le garde-fou de hash de `nose-visibility`. Non traités. `hair-boundary` (25,8 s pour un délai de 30 s) échoue quand plusieurs fichiers tournent en parallèle sur une machine à un cœur ; il passe seul.
