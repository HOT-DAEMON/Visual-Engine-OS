# PERF-2 — temps de génération d'image (branche `feat/render-speed`)

Suite de `PERF.md` (cache, mesure par étape). Ici : où partait réellement le temps, ce qui a été supprimé, et la preuve que le rendu
n'a pas changé. Chiffres reproductibles : `scripts/bench-perf2.ts`, `scripts/verify-equivalence.ts`, `scripts/artefacts-perf2.ts`.
Reste à faire : `PERF-2-REMAINING.md`.

## 1. Résultat (médianes, machine 1 cœur, bruit de mesure ≈ ±10 %)

| Mesure | Avant | Après | Écart |
|---|---|---|---|
| Pipeline d'une cellule de campagne 170×210, à froid | 565 ms | 378 ms | −33 % |
| Rastérisation 170×210 | 149 ms | 55 ms | −63 % |
| Rastérisation 340×420 | 274 ms | 162 ms | −41 % |
| Rastérisation 680×840 | 688 ms | 493 ms | −28 % |

« Avant » = arbre `feat/hair-masses`, réglages resvg par défaut. Données brutes : `artefacts/perf-2/bench-{avant,apres}.json`.
Graphique : `artefacts/perf-2/03-banc-avant-apres.png`. Le gain décroît avec la taille car le coût fixe (analyse du SVG) pèse moins.

## 2. Ce qui coûtait (profil CPU, `--cpu-prof`)

1. **Polices système** : `resvg-js` met `loadSystemFonts: true` par défaut et rescanne les polices à chaque instance,
   ≈ 65 ms même pour un SVG de 10×10. Le moteur n'émet aucun `<text>` (liste blanche `src/core/svg.ts`).
2. `feTurbulence` (pores + grain) : ≈ 30 % de la rastérisation d'un visage.
3. `boxCoverage` / `coverageOf` (occlusion des cheveux) : 14 % du pipeline ; `num()` 8 % ; `canonical()` 4 %.
4. `verifyFace` (226 ms/face) coûte plus que la rastérisation : non réduit ici (voir REMAINING).

## 3. Changements (un par cause, tous mesurés)

| Changement | Fichiers | Garantie |
|---|---|---|
| `loadSystemFonts` explicite (`false` hors planches étiquetées) | `scripts/lib/raster.ts`, `proof.ts`, `hair-raster.ts`, `render.ts` | pixels identiques (écart 0) ; `tests/raster-fonts.test.ts` |
| Tuile de bruit `feImage` + `feTile` | `src/noise/*`, `src/skin/compile.ts`, `src/appearance/effects.ts` | équivalence statistique (§4) |
| Pré-filtre par boîtes englobantes | `src/face/poly.ts`, `hair/occlusion.ts`, `hair/sides.ts` | résultat exact (mêmes appartenances) |
| `num()` chemin rapide | `src/core/svg.ts` | identique à `toFixed(3)` sur 400 000 valeurs (`tests/svg-num.test.ts`) |
| `canonical()` : clés mémoïsées | `src/perf/content-cache.ts` | identique à l'original sur 3000 structures (`tests/canonical.test.ts`) |
| Régions de flou des ombres de contact réduites à (zone réceptrice ± 4σ) | `src/contact/shadow.ts` | écart ≤ 1/255 sur 16 rendus ; non appliqué aux creux à bord réel (oreilles), clippés par leur silhouette |
| Clé du cache de scène salée par le mode de bruit | `src/compile.ts` | sans cela un cache chaud renvoyait le SVG de l'autre mode (bug trouvé par la vérification) |

### Tuile de bruit
- `src/noise/turbulence.ts` : bruit de Perlin de la spec SVG 1.1 (pur, déterministe, `stitchTiles` ⇒ périodique).
- `png.ts` : PNG gris 8 bits sans dépendance (DEFLATE « stocké »), validé contre `zlib` et un CRC indépendant (`tests/noise-tile.test.ts`).
- `tile.ts` : tuile 64 unités × 2 échantillons/unité (128 px, ≈ 22 ko en base64), cache par contenu, `RESAMPLE_GAIN = 1,15`.
  Sans suréchantillonnage, un décalage sous-pixel lissait le grain (énergie 0,63–0,85 de la référence) ; avec ×2 et gain : 0,87–1,01.
- La base64 contient « NaN » dans ≈ 2 % des tuiles, ce qui déclenchait les contrôles de validité du moteur : un bloc `tEXt` de
  remplissage décale l'alignement jusqu'à l'absence de la sous-chaîne (déterministe).
- Sécurité : `feImage` n'accepte que `data:image/png;base64,…` (regex stricte), `href` uniquement sur `feImage`, `preserveAspectRatio="none"`.
- Mode de référence : `setNoiseMode('turbulence')` reproduit l'ancien SVG **octet pour octet** (vérifié).

## 4. Couche de vérification de rendu (géométrique · anatomique · style)

`src/verify/render-equivalence.ts` compare un rendu de référence à un rendu optimisé. Pires valeurs mesurées sur 24 rendus à 340×420
(`artefacts/perf-2/equivalence.json`) ; 24 rendus à 170×210 : 0 échec.

| Couche | Mesure | Borne | Pire observé | Contrôle négatif (décalage 2 px / peau lissée) |
|---|---|---|---|---|
| Géométrie | tracés SVG identiques | = 1 | 1 | — |
| Géométrie | IoU des silhouettes | ≥ 0,9995 | 0,9999 | 0,93–0,98 |
| Anatomie | corrélation des contours (Sobel) | ≥ 0,985 | 0,996 | 0,53–0,86 |
| Anatomie | IoU des traits sombres (seuil relatif) | ≥ 0,985 | 0,992 | 0,34–0,73 |
| Style | décalage de couleur moyenne | ≤ 1,0 /255 | 0,15 | — |
| Style | rapport de contraste | 0,98–1,02 | 0,997–1,000 | — |
| Style | rapport d'énergie de grain | 0,80–1,25 | 0,867–1,009 | > 3 |

Les 4 contrôles négatifs sont détectés. Historique honnête : première version = 17 échecs ; causes trouvées et corrigées (grain lissé par
le rééchantillonnage ; seuil absolu des traits sombres franchi par le grain sur peau foncée ; cache de scène non salé).
Image : `artefacts/perf-2/01-reference-vs-tuile-ecart.png` (yeux, lèvres, oreilles : écart nul ; seul le grain de peau diffère).

## 5. Impact sur les références visuelles
Le grain n'est plus la même réalisation de bruit : `npm run regress:update` a réécrit les 34 références permanentes
(`references/visual/`). Avant mise à jour : RMS 1,5–2,1 sur les cas standard, 5,05 sur `hard-05` (encre). Toute autre
partie de l'image est inchangée. Planche des tuiles : `artefacts/perf-2/02-tuiles-de-bruit.png`.

## 6. Limites
- Mesures sur 1 cœur partagé ; la parallélisation multi-processus (`JOBS`) n'a pas pu être chiffrée ici.
- Le grain reste une approximation statistique de `feTurbulence` aux fréquences proches de Nyquist (voir `RESAMPLE_GAIN`).
- `src/noise` suppose un rastériseur supportant `feImage`/`feTile` (resvg, navigateurs : oui ; à revérifier pour tout autre moteur).
