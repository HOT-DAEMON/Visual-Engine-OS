# Moteur capillaire — passe 12 : coupes à attache (chignons, queue de cheval, tresses)

Reste à faire : `HAIR-PASS12-REMAINING.md`. Mesure des chignons : `HAIR-BUNS.md`. Preuves : `artefacts/hair-engine-pass12/`.
Suite de `HAIR-PASS11.md` (hime, pixie) ; la passe 11 listait « chignons, tresses, queue de cheval : non faits ».

## Ce qui a été fait
Quatre coupes nouvelles, en données de profil (MÊME générateur, peinture, réparation, vérification G/A/S que les autres coupes) :
| Coupe | Fichier | Construction |
|---|---|---|
| `DOUBLE_BUNS` | `profiles/buns.ts` | cadre de la hime + deux chignons (corps de pales rondes + mèches en spirale), nœuds à el 61°, az ±83° |
| `TOP_BUN` | `profiles/buns.ts` | cadre de la hime + un chignon haut (el 80°, az 180°) |
| `PONYTAIL` | `profiles/ponytail.ts` | cheveux tirés vers un nœud arrière-haut, queue de 26 mèches qui se soulève de la nuque puis retombe |
| `TWIN_BRAIDS` | `profiles/braids.ts` | frange, nappes de raie, deux mèches de base remplacées par 3 brins entrelacés (`weaveStrands`, déjà existant) |
Cadre commun (`profiles/frame.ts`) : reprise de familles de `hime.ts` (rien n'est recopié), frange en un seul `group`, couverture arrière `backCover`.

## Changements du moteur (tous additifs, vérifié avant qu'aucun n'existait)
1. `FamilySpec.field` : champ d'écoulement propre à une famille (tourbillon centré sur le nœud d'un chignon). Absent = champ du profil (aucune coupe existante ne change).
2. `FamilySpec.group` + `familyOf(P, label)` : la frange de la hime est 3 familles (longueurs différentes pour aligner les pointes) mais UNE masse pour le dessin.
   Sans groupe, la vérification de hiérarchie (dominante ≥ 0,25, rapport ≥ 1,15) échouait : 15/96 valides au premier essai. Les 5 recherches « famille par id »
   (`autofit`, `repair`, `repair-dome`, `repair-local`, `part-shape`) passent par `familyOf`, sinon la réparation abandonnait en silence les mèches groupées.
3. `HairProfile.post` : étape finale déterministe de `generate` (ici : remplacer les mèches `braidL/R` par `weaveStrands`).
4. Réparation des trous parasites (`compose-verify.ts`, `repair.ts`) : un défaut LOCALISÉ par petit trou (≤ 8) au lieu d'un seul, et deux corrections de plus
   (allonger ×1,12, élargir ×1,8). Le défaut n'est émis que si le contrôle échoue déjà : un verdict valide ne change pas. Effet mesuré sur les coupes
   existantes (8 graines × lacets 0/±30°) : **hime 22/24 → 24/24**, pixie 21/24 (inchangé), carré 23/24 + shag 24/24 = 47/48 (inchangé). Aucune régression.

## Couche de vérification des attaches (`attach-verify.ts`)
S'ajoute à G/A/S (`verifyComposed`) pour ce qu'il ne voit pas : une attache est un objet posé sur le crâne.
- géométrie : chignon borné (largeur 0,28–0,62 H) ; queue ancrée sur la coque, pointe ≥ 0,3 H sous la racine ;
- anatomie : centre du chignon ≥ 0,25 H au-dessus de la ligne des yeux ET de l'oreille ; racine de queue à |azimut| ≥ 150° ;
- style : chignon rond (hauteur/largeur 0,55–1,3) ; chaque tresse ≥ 2 croisements francs entre brins (mesuré 2–3 de face ; le seuil 3 rejetait la tresse droite).
Seuils des chignons issus de la mesure de la référence 04 (`HAIR-BUNS.md`) : diamètre moteur 0,41–0,42 H contre 2 × 0,203 = 0,41 Hc mesuré.

## Résultats mesurés (8 graines × 5 lacets 0°, ±30°, ±60°, après réparation, `08-verification-…json`)
| Coupe | Valides (G/A/S + attaches) | Échecs |
|---|---|---|
| double_buns | 40/40 | — |
| top_bun | 40/40 | — |
| ponytail | 38/40 | +30° g.1 trous parasites ; −30° g.1 lames dégénérées |
| twin_braids | 35/40 | −30° g.1, 3, 5, 6, 8 : tresse droite à 1 croisement visible (couche attaches) |
| total | **153/160** | G/A/S seul : 158/160 ; les 7 échecs sont documentés, aucun seuil assoupli |
Tests : `hair-grammar-cuts-pass12` (26 tests) ; toute la suite `tests/hair-grammar*` : 97/97.

## Impasses assumées (essais abandonnés, gardés pour ne pas les refaire)
- Chignon « éventail de mèches fines » : étoile à rayons, le crâne se voit entre eux. Remplacé par corps de pales rondes + spirale.
- Nœud à el 62°, az 84° : le plan tangent contient l'axe de profondeur, l'éventail radial s'écrase en un trait de face. Nœuds remontés (el 61–66°).
- Corps de chignon dense (count × 0,85) : devient la 2ᵉ masse et fait tomber le rapport dominante/seconde ; frange épaissie (`fringeScale` 1,6) à la place.
- Famille `crown` (écailles arrondies) des tresses : grandes pointes noires en flèche. Retirée. Nappes de raie larges et arrondies : « feuilles » sombres à ±60°. Remplacées par des bandes étroites.
- Tresses : fréquence 5 au lieu de 4 : MOINS de croisements détectés (0 à droite). Retour à 4.
- Racine de tresse à az ±84° : l'oscillation des brins part dans l'axe de profondeur (1 croisement visible contre 3). Ramenée à ±74°.

## Artefacts (`artefacts/hair-engine-pass12/`, toute la tête à chaque fois)
01–04 une coupe × 3 couleurs × 3 graines ; 05a–d rotation −90° → +90° ; 06 avant/après réparation ; 07 comparaison avec la hime (face + 70°) ;
08 verdicts JSON ; 09 référence 04 mesurée contre le moteur ; `mesures/` (JSON, masques, surcouches). Régénération : `npx tsx scripts/hair-grammar/artefacts-pass12.ts`.
Outils : `preview-cuts.ts` (aperçu, `DROP=famille` pour isoler un défaut), `verify-cuts.ts` (verdict rapide), `measure-buns.py`, `compose-ref04.py`.
