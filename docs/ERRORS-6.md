# Erreurs rencontrées — moteur d'oreille et zones du visage

Chaque erreur : symptôme → cause → correction → garde-fou. Suite de `docs/ERRORS-5.md`.

1. **Contrats** (`contracts.test.ts`, 7 influences non déclarées : `chin.height → ear`, `mouth.open → ear`…) — l'oreille lit la ligne de la bouche et le contour du crâne.
   Correction : `ear` déclare `needs: cranium, eye, nose, mouth, mandible` (`contracts/registry.ts`). Garde-fou : le test d'influence mesurée (aucun cycle introduit).
2. **Monotonie `nose.length`** — le balayage 0,08 → 0,2 devenait plat sous 0,17 (plancher de zone voulu). Correction : balayage 0,17 → 0,26.
3. **Somme des zones ≠ 1** — le bas du menton vaut H/2 + abaissement de la mandibule, pas H/2. Correction : la somme vaut (menton − sommet)/H (`verify/zones.ts`, test).
4. **Philtrum écrasé** (0,056 H < 0,06) — le plancher de la bouche (0,07 H) ignorait l'épaisseur de la lèvre supérieure. Correction : `philtrumFloorY` (même calcul dans `jaw/params.ts`).
5. **Menton hors bornes** sur des visages tirés (0,21–0,226) — bornes 0,12–0,19 trop serrées par rapport aux proportions canoniques (menton ≈ 0,20 H quand le philtrum est borné). Correction : 0,07–0,24.
6. **Implantation hors du crâne** (jusqu'à 4,7 px à la tempe, graine 2334) — défaut préexistant de `buildHairline` (bruit de la ligne). Correction : `hairBoundary` borne à 98,5 % du contour ; le défaut de la ligne de cheveux elle-même reste (voir `EAR-REMAINING.md`).
7. **`ear-attached`** — l'invariant ignorait l'écartement du pavillon (sin α·u·H, u = abscisse de la racine). Correction : formule exacte, tolérance 1e-6.
8. **Test de compression** — j'avais supposé face < trois-quarts < profil. Faux physiquement : le pavillon est vu à plat à 90° − α (66°), donc trois-quarts (0,96) > profil strict (cos α = 0,91). Test corrigé avec les formules.
9. **Marche parasite dans la carte de hauteur** — le polygone du lobule (fermé par une corde) créait une ligne claire en travers de l'oreille. Correction : lobule exclu de la carte, rendu sans arête.
10. **Structures « interdites » détectées à tort (félin)** — la présence venait de `required` ; scapha/crus étaient construits sans être requis. Correction : présence = non interdite (`required` reste la garantie testée).
11. **Bijoux invisibles hors de la vue de face** — projetés avec un lacet 0. Correction : paramètre de lacet dans `earJewelry`.
12. **Excroissances invisibles** — découpées par le masque du pavillon. Correction : dessinées hors du masque ; membrane et canal renforcés.
13. **Fond des vues** — rectangle à dégradé visible (bords). Correction : disque à dégradé radial.
14. **Références visuelles** — 17 cas difficiles changés (nez, philtrum, nouvelles oreilles) : **revus à l'œil** sur planche, puis réécrits (`regress:update`).

## Réserves honnêtes
- Les oreilles alignées sur la bouche mesurent ≈ 0,41 H : c'est la demande, mais c'est grand ; `anchors.mouth` permet de relâcher.
- Le jeton GitHub fourni dans la conversation doit être **révoqué** après usage (il est visible dans l'historique).
