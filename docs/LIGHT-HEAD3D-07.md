# Tête en rotation éclairée par le moteur unique `src/relief` (10 nov. 2026)

Branche `feat/hair-grammar`. Suite de `LIGHT-VISIBLE-06.md` (moteur d'éclairage) ; restes de ce moteur : `LIGHT-VISIBLE-06-REMAINING.md`. Preuve visuelle : `artefacts/head3d-lit/`.

## 1. Constat (lu dans le code, pas supposé)
- Le moteur d'éclairage et d'ombre est `src/relief/` (`lightModelOf`, `shadeAt`, `tonesOf`, `castShadow`, `ambientOcclusion`) : une lumière, lue par la tête de face (`head_lit`) et le corps (`volume/pixel.ts`).
- La tête en rotation (`src/head-turntable/paint.ts`) avait **sa propre lumière** : constante `LIGHT = (−0,25 ; −0,55 ; 0,8)`, lissage `shade → skin`, aucune ombre portée, aucune lecture de la lumière de la scène.
- `head_3d` ne recevait pas `lightSpec` (contrairement à `head_lit`).
- Erreur de parcours à ne pas refaire : une première tentative (non commitée, annulée) ajoutait un éclairage parallèle au corps au lieu de lire ce moteur.

## 2. Ce qui a changé (aucun second moteur de lumière)
| Fichier | Changement |
|---|---|
| `head-turntable/paint.ts` | Option `light: LightModel` : par pixel `shadeAt(modèle, normale en repère caméra, ombre portée, AO)` ; teintes `tonesOf` ; multiplicateurs ombre → lumière → cœur (comme la couche `multiply` de `relief/overlay.ts`) ; contour de lumière et reflet en `screen`. Ombres portées et AO : `castShadowScaled` / `ambientOcclusion` appelés sur la PROFONDEUR du G-buffer de la tête tournée. |
| `head-turntable/render.ts` | `RenderOpts.light`, `RenderOpts.shadowTint` transmis à `paint`. |
| `relief/model.ts` | `lightModelOfSpec(scène, réglages)` : l'unique traduction « réglages d'objet → LightModel » ; `head_lit` l'utilise aussi (plus de copie). |
| `schema/head-3d.ts` | `lit` optionnel : `light`, `style`, `shadowHue`, `contrast`, `bias`, `rim` (mêmes champs et défauts que `head_lit`, contrat strict). |
| `render/head-3d.ts`, `render/registry.ts` | La lumière de la scène (`c.lightSpec`) atteint `head_3d` ; la teinte d'ombre imposée de l'hôte (`skin.light.shadow`) est lue comme sur la tête de face. |

**Mode sans `lit` conservé** : ombrage à deux tons de la planche de rotation de référence. Il reste parce que les contrôles de style de `head-turntable` (`tones.skin` ≥ 70 % d'aplats) vérifient cette planche. C'est donc un doublon assumé et temporaire, pas supprimé.

## 3. Mesures (graine 11, scène 420×460, résolution 1, mesure recadrée sur la tête)
| Lacet | Rapport g/d, lumière 270° | Rapport g/d, lumière 90° | Bascule 270°/90° (seuil du test : 1,25) | RMS planche → moteur |
|---|---|---|---|---|
| 0° | 2,26 | 1,06 | 2,13 | 37,2 |
| 45° | 2,84 | 1,14 | 2,50 | 32,0 |
| 90° | 3,51 | 0,97 | 3,63 | 26,8 |

Ombres portées sur la profondeur de la tête tournée (spec de référence, lumière latérale 270°/18° contre frontale 330°/85°) : 29,0 % / 29,5 % / 26,0 % des pixels contre 0,06 % / 0,04 % / 0,00 % à lacet 0° / 45° / 90°. Ce chiffre compte toute occlusion (face éloignée du crâne comprise) : il prouve que le lancer de rayon agit, pas que l'ombre du nez est correcte (elle se lit sur la planche).
Tests : `tests/head3d-relief-light.test.ts` (5 : traduction unique, contrat strict, ombres portées, bascule de lumière à 3 lacets, teinte d'ombre de l'hôte). Tête en rotation + pipeline + relief : 11 fichiers, 138 tests verts. Suite complète non lancée (machine à 1 cœur).
Coût : ≈ 1,6 s par scène à résolution 1 (moyenne mesurée dans les tests, 1 cœur).

## 4. Ce que montre la planche (`01-rotation-eclairage.png`) — lecture honnête
- Mêmes motifs que la tête de face (`LIGHT_PATTERNS` : latérale gauche, Rembrandt, par en dessous), 4 lacets (0°, 45°, 90°, 135°) : le terminateur suit le crâne, le nez projette sur la joue, le cou reçoit l'ombre.
- Ombres **brun chaud** : cette graine impose `#a08974` ; la teinte imposée prime (contrat `APPEARANCE.md`). Sans teinte imposée, elles sont dérivées (gris-froid en cel).
- Défauts visibles, non corrigés : narines qui se lisent comme des taches claires dans l'ombre (texture de narine éclairée comme le reste) ; œil dans l'ombre grisé (iris multiplié par l'ombre et le cœur) ; cheveux presque noirs sous « par en dessous ».

## 5. Reste à faire (par composant)
- **Asymétrie non expliquée** : lumière à 270° bascule fortement g/d, lumière à 90° reste proche de la parité (0,97–1,14), alors que la tête de face donne 0,49 (`LIGHT-VISIBLE-06.md`). Cause non isolée (cheveux, géométrie, fenêtre de mesure ?).
- **Visage / yeux** : l'œil n'est pas une surface (pas de reflet, pas d'ombre de paupière) ; narines à corriger ; cheveux sans ombre portée ni brillance propre.
- **Cou** : coupe du cou exclue du contour de lumière ; pas de contrôle de raccord de lumière tête 3D ↔ cou ↔ corps.
- **Corps** : `head_3d` n'est pas relié au corps par `litFigure` (le corps ne reçoit pas l'ombre de la tête tournée) ; vues autres que de face du corps inchangées.
- **Doublon** : mode « planche » de `paint.ts` (lumière fixe) à retirer quand ses contrôles de style liront le moteur.
- **Vérification de rendu** : pas de couche dédiée géométrie / anatomie / style pour la tête tournée éclairée (seuls les 5 tests ci-dessus) ; résultat mesuré sur une seule graine.
- Relief de la tête de face (champ issu des repères) et relief de la tête tournée (maillage) restent deux sources de normales.
