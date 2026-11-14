# Yeux — passe « EYES-REFS-2 » (2026-11-14)

Suite de `EYES-REFS.md`. Principe inchangé : **les références enrichissent le moteur existant** (recettes, défauts, paramètres) ; aucun moteur par référence.
Preuves visuelles : `artefacts/eyes-refs2/` (01–08) et `artefacts/eyes-100/` (galerie régénérée). Reste à faire : § final et `EYES-REMAINING.md`.

## 1. Extraction (scripts Python, `scripts/eye-refs/`)
| Script | Sortie | Méthode |
|---|---|---|
| `extract_silhouettes.py` | `references/eyes/measures-silhouettes.json` | **15** : automatique par canal alpha (composantes connexes, axe des canthi, 64 colonnes) ; **13, 17** : ancres humaines + accrochage au gradient (helpers de `extract.py`) |
| `extract_sprites.py` | `references/eyes/measures-sprites.json` | **15** : iris par limbe (indice + anneau sombre + `fitEllipse`), pupille, reflets, dégradé haut/bas ; **14** : flèches (couleur plate, direction par épaisseur) |

Mêmes descripteurs que `measures.json` (inclinaison, aspect, fraction haute, sommets, profils à 21 points, angles de canthus) → comparables aux 5 yeux photographiques.

Résultats : 10 sprites (5 paires, **gauche/droite concordantes** : aspect 0,887 / 0,886) + 4 yeux tracés (13-E5, 13-E10, 17-A, 17-C).
Sprites 15 rangées 1–2 : iris ovale d'aspect **1,49**, diamètre vertical **0,86–0,90** de l'ouverture (photos : 0,98–1,08), deux reflets (gros haut-droite r ≈ 0,27, petit bas-gauche r ≈ 0,15).

## 2. Ajustement des recettes d'enveloppe (`scripts/eye-refs/fit-recipes.ts` → `src/generation/eye-ref-fits.ts`)
Pour chaque silhouette : 12 styles × 1 800 tirages + affinement par motif ; coût = RMS des profils haut + bas (largeur = 1) ; inclinaison imposée (± 30°).
9 ajustements, RMS 0,020–0,074 (`artefacts/eyes-refs2/02-profils-mesures-vs-moteur.png`). Les paires de la 15 sont moyennées.
`tests/eye-ref-fits.test.ts` **recalcule** les RMS depuis le JSON et vérifie que la galerie consomme l'ajustement (style, inclinaison, fraction haute).
Limite documentée : le schéma borne `upperFraction ≥ 0,4` alors que les sprites plats mesurent 0,22–0,28.

## 3. Galerie des 100 (`eye-gallery-ext.ts`)
- Les silhouettes mesurées passent **en premier** (écartées si à < 0,02 d'une forme existante) : **7 retenues** (13-E5, 17-C, 15-A…E) ; 13-E10 et 17-A écartées (doublons).
- Les 93 autres : échantillonnage du plus éloigné, quotas par style (≥ 8 pour chacun des 12), entrelacement par échange (jamais deux enveloppes identiques consécutives).
- **Looks** (`eye-ref-looks.ts`, paramètres existants uniquement) : `natural` (≈ 40 % des yeux tirés) = sclère en dégradé 3 bandes et peau périoculaire **mesurées** (exposition normalisée,
  ombre bornée), trait de paupière 0,0061–0,0084 de la largeur ; `sprite-tall` (15-A/B) = iris 1,49, pupille large, reflets mesurés, iris à 0,88 de l'ouverture ; `ink` (13/17).
- Reflet principal des planches 12/16 (`dy = −0,44`, mesuré) devient la position par défaut des familles d'iris.

## 4. Détail atomique de l'iris (`iris.detail`, opt-in)
- `facets` : couronnes de quadrilatères irréguliers, ton selon la lumière haut-gauche + biseau (`render/eye/iris-crystal.ts`).
- `bubbles` : sphères translucides (liseré, reflet interne, croissant d'ombre), sans chevauchement, zone basse ou totale.
- Graines dédiées : l'absence des briques laisse le rendu **identique** (testé). Familles : prisme → facettes ; cristal turquoise → bulles ; givre → les deux.
- Preuve : 9 balayages (`iris.detail.*`) dans `eye-param-sweeps.ts` : 770 à 7 004 pixels changés (seuils 300 / 1 500), `05-parametres-iris-consommes-bas-vs-haut.png`.

## 5. Branchement dans `generateRandomFace`
`eyeSource: 'extended'` : 148 identités (48 + 100), identité tirée dans un **flux dérivé** (les autres tirages et le flux `'gallery'` par défaut sont inchangés, testé).
`identity` 0–147 imposable. `extendedPair(i, expression)` dans `eye-pool.ts`. Preuves : `06-tetes-yeux-des-references.png`, `07-tetes-galerie-etendue-12.png`.

## 6. Couche de vérification
- `src/verify/eye-pair.ts`, rattachée à `checkFaceEngine` : géométrie (transformations finies, coins externes opposés, roulis commun), anatomie (asymétrie d'échelle 0,85–1,18 mesurée sur 600 visages,
  hauteur ≤ 0,08 largeur), style (même identité). 5 400 contrôles sur 900 visages : 0 échec ; `tests/verify-eye-pair.test.ts` détecte aussi 5 défauts injectés.
- `verify-eye-render.ts` : le contrôle « sclère claire » sonde 6 points (max) au lieu d'un seul (il tombait sur la caroncule selon la graine).
- Rapport : `artefacts/eyes-refs2/08-verification.json` (0 erreur `verifyEye`, 0 échec pixel sur 100 yeux).

## 7. Almond — passe 2
Canthus de face mesurés : externe **119,0°**, interne **93,7°** ; moteur avant : 127,9° / 98,4°. Ajustement des 6 facteurs avec contrainte d'apex :
`u2dx 0,88→0,96`, `l1dx 0,63→0,73`, `l2dx 1,95→1,96` → externe **123,7°** (erreur 8,9° → 4,7°), RMS de profil +0,0003. L'interne ne bouge pas sans dégrader le profil.

## 8. Reste à faire (aussi dans `EYES-REMAINING.md`)
1. **Réf. 14** : sclère blanche sur fond blanc → pas de silhouette ; iris colorés non segmentés ; 13 flèches mesurées (angles, longueurs) mais **non interprétées** ni consommées.
2. **Réf. 15 rangées 3–5** : le limbe n'est pas détecté (repli sur l'indice, aspect exactement 1,0) → non consommées ; leurs silhouettes le sont.
3. **13 / 17** : ≈ 8 yeux non tracés (canthus externe sous les cils, tuile coupée) ; 17-A écartée de la galerie.
4. **Almond** : contrôle d'angle du canthus interne non exposé ; `tiltDeg` 6° par défaut inchangé.
5. **Iris** : facettes discrètes ; pas de dispersion prismatique, rayons de lumière, cils dorés ; bulles sans réfraction.
6. **Encre** : gris et reflets en lentille interprétés ; peau périoculaire sur 5 photos seulement.
7. **Galerie** : distance minimale 0,0089 ; sprites hauts débordant des cellules de planche.
