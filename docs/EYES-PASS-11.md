# Yeux — PASSE 11 : saturation des pics, prisme, bulles nettes, étoile à six pointes, `lowerPeak` branché, galerie 4

Commande des preuves : `npx tsx scripts/artefacts-eyes-pass11.ts` → `artefacts/eyes-pass11/` (01 références / moteur · 02 avant / après vibrance · 03 galerie 4 · 04 têtes entières · 05 `lowerPeak` · 06 rapport JSON).
Règle tenue : AUCUN nouveau moteur. Cinq paramètres ajoutés aux moteurs existants (iris, reflets, recettes), tous consommés et prouvés sur les pixels (`tests/eye-iris-pass11.test.ts`).

## 1. Paramètres ajoutés (défaut = rendu historique, aucun œil existant ne change tant qu'on ne les demande pas)
| Paramètre | Consommé par | Preuve |
|---|---|---|
| `iris.vibrance` (0–1) | `render/eye/globe-inner.ts` : filtre sur le disque d'iris (pupille et reflets exclus) | 0 → aucun filtre dans le SVG ; > 0 → matrice de saturation `1 + 1,6 × v` ; pics mesurés à ± 0,07 de la référence |
| `iris.detail.rainbow` | `render/eye/iris-crystal.ts` (`rainbow`), appelé par `iris-detail.ts` | ≥ 5 secteurs de teinte sur 6 dans l'iris ; `hueFrom` / `hueTo` inversés changent le rendu |
| `iris.detail.bubbles.crisp` (0–1) | `iris-crystal.ts` (`crispBubble`) | moitié haute de l'iris inchangée, moitié basse modifiée, plus de pixels sombres (contour) |
| `highlights.list[].points` (3–12) | `geometry/eye/highlights.ts` | contour à `2 × points` sommets ; sans `points` : 8 (sparkle) |
| `shape.lowerPeak` (recette) | `eye-gallery-ext.ts` (`EyeRecipe.lowerPeak`), `vectorOf`, `eye-gallery-ext4.ts`, `generateRandomFace({ eyeLowerPeak })` | entre dans le profil qui prouve la distinction |
Limite de la liste de reflets : 6 → 12.

**Piège trouvé** : `feColorMatrix type="saturate"` est borné à 1 par resvg (2 pixels de différence sur tout le rendu) ; seule la matrice explicite sature au-delà.

## 2. Saturation des pics d'iris (`satPeaks`, même définition que l'extracteur des réfs)
| Famille | avant | après | référence | vibrance |
|---|---|---|---|---|
| prism-star (04) | 0,624 | 0,783 | 0,783 | 0,23 |
| emerald-facets (07) | 0,510 | 0,740 | 0,738 | 0,35 |
| lime-cyan (08a) | 0,649 | 0,789 | 0,786 | 0,15 |
| fire-halo (10a) | 0,407 | 0,713 | 0,720 | 0,96 |
| ice-star (10b) | 0,445 | 0,730 | 0,729 | 0,61 |
Calibrage : `npx tsx scripts/eye-refs/calibrate-vibrance.ts` (bissection ; valeurs reportées à la main dans `eye-iris-families-photo2.ts`). Les familles photo 2 sont partagées avec la galerie 3 : ses iris sont plus saturés (ses tests passent).
Règle de vérification `iris-peak-saturation` (style, `verify-eye-render.ts`) : pics ≥ 0,62, uniquement si `vibrance` > 0 ; contre-exemple testé (fire-halo à 0,02 → échec).

## 3. Prisme (04), bulles (07), étoile (10b)
- **Prisme** : spectre rouge → violet sur un secteur (`angleDeg`, `span`, `inner`, `outer`), enveloppe d'opacité en sinus (pas de bord franc), bord externe ondulé, stries radiales. Premier jet : roue chromatique à bords durs — corrigé.
- **Bulles nettes** : contour sombre, liseré clair, croissant caustique côté opposé à la lumière, reflet spéculaire. `emerald-facets` : 18 bulles, `crisp` 0,8.
- **Étoile** : six étoiles à six pointes en hexagone (rayon 0,56 de l'iris, premier sommet à −90°) autour de l'étoile centrale ; chacune, retirée seule, change l'image (test).
- `ice-star` : anneaux resserrés et nets → part sombre 0,063 → 0,196 (référence 0,297).

## 4. Galerie 4 — `src/generation/eye-gallery-ext4.ts` (100 yeux de plus)
- Enveloppes tirées dans le domaine MESURÉ des réfs 13 / 17 (`eye-ref-fits.ts`, 27 silhouettes) par interpolation (t ∈ [−0,2 ; 1,2]) entre deux silhouettes du même style + bruit de 6 % ; bornes du schéma respectées. `almond` n'a aucune silhouette 13 / 17 : sept ancres mesurées (`measures.json`, comparées par test).
- Résultat : 10 enveloppes × 10 yeux ; aspect 0,42–0,80, inclinaison −14,4° à 16,9° (galeries 1–3 : −5° à 14°) ; distance minimale 0,0127 aux 348 existants, 0,0113 entre nouveaux ; `lowerPeak` 0,401–0,649.
- Vérifications : `verifyEye` 0 erreur, pixels 0 échec. Un plafond d'aspect à 1,0 puis 0,9 donnait 2 puis 6 échecs `sclera-is-light-tone` (yeux trop hauts et trop ouverts : sclère mangée par le liner) : plafond 0,8.
- Branchement : `eyeSource: 'extended4'` (448 identités, 0–347 identiques à `extended3`), `generateRandomFace({ eyeLowerPeak: nombre | 'auto' })` (flux dérivé `seed ^ 0x10ae9ea4`).

## 5. Reste à faire
Voir `EYES-REMAINING.md` § Passe 11.
