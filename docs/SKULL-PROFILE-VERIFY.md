# Couche de vérification du profil (`src/verify/skull.ts`)

`verifyProfile(face, skull, {skin, hair})` → `Report` (même contrat que `verifyFace`). 29–30 contrôles par tête, trois couches. `error` invalide le rapport,
`warn` signale un défaut esthétique.

## Cohérence géométrique (`geometry`, 8 contrôles, tous `error`)
`profile-finite` · `profile-no-self-intersection` (segments, O(n²) sur ~300 points) · `bone-inside-skin` (repères osseux, centres et pointes de vertèbres
dans le polygone de peau) · `tissue-positive` · `landmark-vertical-order` (glabelle < nasion < sous-nasal < stomion < sublabial < pogonion < menton) ·
`heights-match-front` (≤ 10⁻⁹ : hauteurs identiques à la face) · `gonial-matches-front` (≤ 0,5°) · `nothing-above-vertex`.

## Cohérence anatomique (`anatomy`)
`frankfurt-plane` (porion/orbitale ≤ 0,03 H, error) · `e-line-upper-lip` / `e-line-lower-lip` (error) · `tissue-depth-min/max` (0,005–0,07 H, error) ·
`mastoid-behind-porion` (error) · `nape-exposed` (coiffure `undercut`/`updo` : ≥ 0,1 H entre l'implantation et C7, error) ·
warn : `facial-thirds` (≥ 0,6), `nasal-projection` (0,4–0,8 de la longueur nasale), `nasolabial-angle` (70°–135°), `cervicomental-matches` (± 12°),
`neck-depth-range` (0,30–0,56 H), `head-length-range` (0,70–0,92).

## Style artistique (`style`, sur le SVG émis)
`no-filters` (0, error) · `cel-palette` (≤ 40 teintes d'aplat en mode peau, warn) · `ink-contrast` (≥ 4, ou 80 % du maximum atteignable sur peau foncée,
warn) · `stroke-homogeneity` (traits fins : rapport max/min ≤ 14, warn) · `svg-size` (≤ 160 ko, warn).

## Résultats (`artefacts/skull-profile/verification.json`)
200 têtes aléatoires : **200/200 sans erreur**, 29 contrôles chacune, 14 ms/tête (tirage + rendu + vérification). Avertissements : `nasolabial-angle-min` 6,
`facial-thirds` 3, `cervicomental-matches` 1 — défauts réels de proportions de visages tirés, laissés visibles.

## Contrôles négatifs (`tests/skull.test.ts`)
Un repère osseux envoyé hors de la peau → `bone-inside-skin` échoue ; un contour retourné → `profile-no-self-intersection` échoue ; un angle gonial
décalé de 9° → `gonial-matches-front` échoue. La vérification a aussi trouvé deux vrais défauts du moteur pendant la construction (`ERRORS-8.md`, n° 3 et 4).

## Limite
Les contrôles de style lisent le SVG (palette, traits, filtres) : aucune mesure sur l'IMAGE rastérisée (pas de contrôle de pixels du profil). Voir REMAINING.
