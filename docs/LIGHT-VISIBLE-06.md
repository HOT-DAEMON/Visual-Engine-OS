# Éclairage visible — itération 06 (ombre et lumière sur la tête et le corps)

Branche `feat/hair-grammar`. Reste à faire : `LIGHT-VISIBLE-06-REMAINING.md`. Références et mesures : `LIGHT-REFERENCES-06.md`. Preuves : `artefacts/lighting-06/`.
Code : `src/relief/` (modèle, relief de la tête, ombres portées, couche d'éclairage), `src/verify/lit.ts`, `src/body/volume/pixel.ts` (corps). Tests : `tests/relief-lit.test.ts` (29).

## 1. Le problème et sa cause (mesurée)
« Les ombres et lumières sont implémentées mais invisibles sur les artefacts. » Mesure : visage n°11, lumière rasante (270°, élévation 25°, dureté 1), luminance moyenne
gauche / droite de la zone yeux-joues : **1,046** (4,6 % d'écart, canevas 380×420) ; 0,951 avec la lumière à 90°. Sur l'artefact 01 (canevas 380×480, fenêtre identique) : 1,038 et 0,941. Les références montrent un rapport de l'ordre de 1,5 à 2.
Causes trouvées dans le code :
1. **Visage** (`skin/compile.ts`) : l'ombre est UN dégradé linéaire sur tout le visage, indépendant de la forme. Le terminateur démarre à `0,45 + 0,25·Lz` de la traversée (≥ 65 %) et la teinte
   d'ombre est « proche de la couleur principale » (L × 0,62 mélangé de bleu) : le contraste est mathématiquement faible. Aucune ombre PORTÉE : le nez, le sourcil, le menton ne
   projettent rien (« l'ombre portée du menton » n'existait que comme dégradé de contact).
2. **Corps** (`volume/shade.ts`) : un éclairage fixe (`DEFAULT_LIGHT`, jamais relié à la `LightSpec` de la scène), ambiant 0,28, diffus lissé, AO et rainures seules : le relief se lisait,
   mais aucun bras, aucune main ne projetait d'ombre ; tête et corps n'avaient pas la même lumière.
3. **Pas de pont** entre la lumière de la scène (azimut, élévation, couleur, température, dureté) et le corps.

## 2. Ce qui a été construit (dans l'ordre)
| Composant | Fichier | Rôle |
|---|---|---|
| Modèle de lumière unique | `relief/model.ts` | `lightModelOf(LightSpec, opts)` → direction (espace vue), douceur, style `soft` / `cel2` / `cel3`, écart ombre-lumière ΔL (OKLab), teinte d'ombre chaude/froide, biais de terminateur, lumière de contour, rebond, projection (gobo). `shadeAt` = éclairage d'un pixel. `tonesOf` = tons en multiplicateurs par canal. |
| Couleur perceptuelle | `relief/oklab.ts` | OKLab ; ombre = base − ΔL ; ombre froide par chemin droit dans le plan a-b (désature, ne passe pas par le rose : défaut trouvé et corrigé). |
| Relief de la tête | `relief/head.ts`, `field.ts` | Surface déduite des REPÈRES du visage (contour, nez, orbites, bouche, menton, oreilles, cou) : crâne gonflé + arcade + orbites + pyramide nasale + pommettes + lèvres + menton + oreilles + cou. |
| Ombres portées | `relief/cast.ts` | Marche de rayon sur la profondeur avec pénombre croissante ; AO par horizon ; version à grille grossière (corps). |
| Couche d'éclairage de la tête | `relief/overlay.ts` | Deux images posées PAR-DESSUS le visage : `multiply` (lumière teintée / ombre / cœur) et `screen` (contour, reflet). Les yeux, les cils, les cheveux sont ombrés sans être recouverts. |
| Corps | `volume/pixel.ts` | Même modèle ; ombres portées entre volumes (bras sur le tronc, muscle sur muscle) ; la tête est un occulteur sans surface visible (`proxy`). `lightModel: null` = ancien éclairage. |
| Figure | `relief/figure.ts` | `litFigure` : corps derrière, couche de tête devant (`composeFigure`), même `LightModel`. |
| Motifs | `relief/patterns.ts` | 7 motifs lus sur les planches 01 / 06 / 09 (latérale, trois-quarts, zénithale, par en dessous, frontale), + projections « store » et « feuillage » (planche 05). |
| Vérification | `verify/lit.ts` | 10 à 13 contrôles en 3 couches (voir 4). |

## 3. Choix de conception (et pourquoi)
- **Multiplier plutôt que recouvrir.** Une ombre en `mix-blend-mode: multiply` colorie tout ce qui est dessiné dessous. Un calque d'ombre opaque aurait caché les cils et les détails d'iris.
  Vérifié : resvg rend `multiply` (test), les navigateurs aussi.
- **Relief déduit des repères, pas de nouvelle coordonnée.** Le moteur de visage reste la source unique : changer le nez, le menton ou la mâchoire change l'ombre portée.
- **Biais de terminateur τ.** Les planches lisent le terminateur plus haut que la physique (la face plane reste dans l'ombre quand la lumière rase). `bias` (défaut 0 = physique) est réglé par
  motif (0,1 latéral, 0,2 zénithal, 0,36 par en dessous). Choix assumé : sans lui, « par en dessous » éclairerait tout le visage.
- **Cel : l'occlusion est un seuil**, pas un dégradé (sinon 17–33 % de pixels « en transition », mesuré avant correction ; 0,3 % après).
- **Teinte imposée.** `Appearance.light.shadow`, si elle est définie, donne la TEINTE et la saturation de l'ombre, mais sa clarté est plafonnée à `base − ΔL` : les visages aléatoires imposent une ombre « proche de la couleur principale », cause directe du contraste de 5 % (première version : teinte lue telle quelle → rapport retombé à 1,18, test en échec, corrigé).
- **Défaut du corps changé** : `renderVolumesPixel` utilise le nouveau modèle par défaut. Les 2 465 tests existants passent sans modification (ils mesurent la géométrie).

## 4. Couche de vérification (rendu : géométrie · anatomie · style)
- **Géométrie** : normales unitaires et tournées vers l'observateur ; pointe du nez devant la joue (≥ 0,05 W) et devant le front ; menton devant le cou (≥ 0,10 W, c'est le surplomb qui projette l'ombre) ;
  ombre portée du nez à l'opposé de la source (cosinus < −0,3). Les échantillons doivent être finis (la première version du contrôle du nez passait à vide : `Infinity ≥ 0,05`, corrigé).
- **Anatomie** : ombre du menton sur la bande centrale du cou (≥ 40 %) quand la lumière vient d'en haut ; pour chaque motif, part éclairée par côté / bande dans la fourchette lue sur la référence.
- **Style** : ΔL OKLab (cel 0,15–0,40 ; peint 0,20–0,60 ; références 0,21–0,30 et 0,40–0,50) ; ombre froide plus bleue / chaude plus saturée ; bords nets en cel (≤ 10 % de transition) ; lumière ET ombre lisibles
  (8–92 %) ; cœur d'ombre jamais noir (clarté OKLab > 0,20).
- **Contrôles négatifs** (ils DOIVENT échouer) : motif gauche avec lumière de droite ; relief aplati ; contraste nul. Régression du défaut d'origine : rapport gauche/droite > 1,25 (1,046 avant, > 2 après).

## 5. Résultats mesurés
| Mesure | Avant | Après |
|---|---|---|
| Rapport de luminance gauche/droite, lumière 270°/25° (artefact 01) | 1,038 | **2,011** |
| Idem, lumière 90°/25° | 0,941 | **0,489** |
| Plage de luminance du corps (P95 − P5) | 1 | ≥ 1,3 × (test) |
| Ombre portée du nez, du sourcil, du menton, des bras | aucune | oui (artefacts 02, 04, 05) |
| Temps : tête seule · figure complète (1 100 px) | — | ≈ 2,5 s · ≈ 9 s (corps seul : 3,1 s → 4,4 s) |
| Tests | 2 439 | 2 494 (90 fichiers, tous passent) |
