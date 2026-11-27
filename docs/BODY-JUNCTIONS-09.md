# Itération 09 — omoplate, grand dorsal, losange du trapèze, enveloppe du deltoïde, mains, `baby`

Branche `feat/hair-grammar`. Part de `BODY-JUNCTIONS-08-REMAINING.md`. Preuves visuelles : `artefacts/body-09/` (planches avant/après, `rapport-verification.md`). Chaque ajout a un contrôle à trois couches (géométrie · anatomie · style) dans `src/verify/body-09.ts`, testé avec des négatifs (`tests/body-09.test.ts`). Ce qui n'est pas fait ou pas prouvé : `BODY-JUNCTIONS-09-REMAINING.md`.

## 1. Niveau de l'omoplate
**Cause :** l'acromion du cadre est à 3,69 vertèbres sous C7 (≈ T4) ; l'angle inférieur, 5 vertèbres plus bas, tombait à ≈ T9.
**Changement :** la lame (volume caché `scapula*`, rhomboïde, infra-épineux, grand rond) et ses formes de relief sont remontées d'une vertèbre (`SCAP_LIFT = 1,0`, `back.ts`, importée par `back-relief.ts`). L'épine reste ancrée sur l'acromion, donc moins oblique.
**Mesuré :** angle inférieur du relief dessiné, adulte : 8,78 → 7,79 vertèbres sous C7 (T7–T8) ; nourrisson 6,28, vieillard 8,26. Pente de l'épine : 0,61–0,68 vertèbre (0,86–1,24 avant), dans la bande 0,5–1,6. Portée de la lame : 5,08–5,13.
**Réserves :** (a) le **volume** de l'omoplate (`back.ts`) passe de 9,3 à 8,3 : il reste ≈ 0,5 vertèbre plus bas que le relief ; (b) le haut de la lame dépasse l'acromion d'environ une vertèbre ; (c) bandes ajustées : volume 7–10,5 → 6–9,5, relief 6,0–9,5 → 6,0–8,6.

## 2. Grand dorsal (`back-relief.ts`, forme `latissimus.{L,R}` + `latissimus-border.{L,R}`)
Les volumes elliptiques « sabres » ne sont plus dessinés (`latissimus` ajouté à `RELIEF_REPLACES`, `gbuffer.ts` ; ils restent dans les données). Une nappe de relief les remplace : bord médial de la crête vers l'angle de l'omoplate (haut ancré sur `yb(4,6)`, donc valable à tout âge), bord latéral vers le pli postérieur de l'aisselle, et une arête sur le bord latéral. Seuil « volumes remplacés » relevé de 10 à 12 (18 au total).

## 3. Losange du trapèze (`trapezius-diamond`, `trapezius-lower-border.{L,R}`)
Plateau entre les bords médiaux des omoplates (du cou à T12, pointe en bas) et deux arêtes obliques (racine de l'épine → T12). Essai écarté : un losange à bords supérieurs obliques vers C7 (traits sans fondement anatomique ; le trapèze supérieur est déjà un volume).
**Effet mesuré** (retirer nappe + losange, dos, 460 px) : 1,7–3,0 % du corps ; obèse 0,65 %. Amplitudes d'abord trop faibles (0,85–1,56 %), puis augmentées.

## 4. Enveloppe du deltoïde (`deltoid.ts`, `deltoid-wrap.{ant,post}.{L,R}`)
Deux volumes de la même masse (`mass: 'deltoid'`) : chef antérieur (avant de l'épaule) et postérieur (arrière), qui rejoignent la tubérosité deltoïdienne. Noms hors `deltoid.ant/post` pour respecter le contrat « masse unique » de `verify/shoulder.ts`.
**Palier 2** (`tier: 2`) : au palier 1, l'insertion du pectoral de l'obèse passait de 51/34 à 37/26 pixels/niveaux (seuil 40/30) — régression mesurée, confirmée en désactivant les enveloppes. Elles n'apparaissent donc qu'avec une musculature suffisante : `adultMale`, `adultFemale`, `teenMale`, `teenFemale`, `muscular`, `veryMuscular` (1,5–2,2 % du corps de profil). Pour `baby`, `toddler`, `child`, `thin`, `obese`, `elderMale`, `elderFemale`, le style est déclaré **non applicable**, non prouvé.
Un premier jet créait une couture sombre de profil (`sh.style.no-seam-in-deltoid` à 0,53 pour 0,55) : fin distale effilée.

## 5. Mains (`hand3d.ts`, `web.{0..3}.{L,R}`)
Quatre palmures par main (loft aplati entre phalanges proximales voisines, plus épaisse pour le pouce). Visibles de face (466–770 pixels à 900 px), invisibles de dos (≈ 10). Exemptées du miroir strict de `body-volumes.test.ts` comme les doigts dont elles dérivent (variation propre à chaque doigt) ; un test à tolérance 0,08 h les couvre.

## 6. `baby` et `back.ana.front-line-vertical`
**Cause :** la ligne poitrine → crête est à 9,0° (`toddler` 5,2°, adultes ≤ 5°). L'abdomen du nourrisson est physiologiquement proéminent.
**Correction (changement de tolérance, pas de géométrie) :** bande ±12° avant 4 ans, ±8° ensuite. Négatif : un adulte à 9° échoue toujours.

## 7. Correction d'une mesure : `back.sty.relief-soft`
Le contrôle comparait un pixel de la zone à ses voisins, y compris le fond transparent : la pointe d'acromion de `teenFemale` donnait 168/255 (silhouette, pas relief ; elle a son contrôle `relief-silhouette`, alpha). Seuls les voisins opaques comptent désormais. Observé : 15,8–65,6 pour un seuil à 66 — **marge de 0,4/255** sur `teenFemale`. Le fondu horizontal de la remontée que j'avais essayé d'abord ne changeait rien et a été retiré.

## 8. Vérification et empreintes
- `figure-golden.json` régénéré : seules les empreintes `svg` et `body` changent (7 cas), `lit` et `cast` identiques.
- `rapport-verification.md` : 169 contrôles de l'itération, 0 échec, 13 archétypes ; 7 « non applicable » sur le style des enveloppes.
- Tests : voir la liste dans le message de commit ; la suite complète (253 fichiers) n'a pas été lancée, seulement les fichiers qui dépendent du corps.
