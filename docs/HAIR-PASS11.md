# Moteur capillaire — passe 11 : coupes hime et pixie, mesure des références

Reste à faire : `HAIR-PASS11-REMAINING.md`. Méthode de mesure : `HAIR-MEASURE.md`. Preuves : `artefacts/hair-engine-pass11/`.
Suite de `HAIR-PASS10.md` (carré, shag).

## Ce qui a été fait
1. **Deux nouvelles familles de coupes**, en données de profil seulement (MÊME générateur, peinture, réparation et vérification) :
   - `HIME` (`profiles/hime.ts`) : frange pleine à bord franc au niveau des sourcils, mèches de joue (temples) droites, dôme étroit, nappe arrière
     dominante. Franges `fringeLow/High/Top` en profil de largeur `flat` jusqu'au bout (bord coupé droit).
   - `PIXIE` (`profiles/pixie.ts`) : « pixie à frange balayée », côtés courts, nuque dégagée, frange balayée en deux familles
     (`fringeR`, `fringeC`), dessus texturé et pointes relevées (`quiff`).
2. **Un seul changement du moteur** (additif, `grammar.ts`) : `FamilySpec.widthProg` optionnel, recopié sur chaque mèche. Le profil `flat` existait
   dans `width-program.ts` mais aucune famille ne pouvait le demander ; une frange coupée droit n'était donc pas exprimable. Vérifié avant : aucune
   autre voie dans le générateur ne transmettait `widthProg`.
3. **Mesure des références** par un estimateur commun (`HAIR-MEASURE.md`) : comble le manque « aucune mesure des références » de la passe 10.
4. **Couche de vérification** : réutilisation de G/A/S existante (`compose-verify.ts`, `repair.ts`, `dome.ts`), sans l'affaiblir. Tests :
   `tests/hair-grammar-cuts-pass11.test.ts` (déterminisme, hiérarchie des masses, verdict G/A/S sur 5 combinaisons par coupe, bord franc de la
   hime, longueur courte du pixie). Planche `06-verification-geometrie-anatomie-style.json` : toutes les combinaisons.
5. Profils exportés par `src/hair-grammar/index.ts`, ajoutés au registre de `render-masks.ts`.

## Résultats mesurés (8 graines × 3 lacets 0°/+30°/−30°, après réparation)
| Coupe | Valides | Échecs |
|---|---|---|
| hime | 22/24 | lacet +30°, graines 5 et 6 : trous parasites (micro-trous, 0,89) |
| pixie | 21/24 | lacet 0° g.7 trous parasites (0,87) ; +30° g.2 rapport dominante / seconde 1,12 ; +30° g.7 axes qui se coupent (sans programme) |
| total passe 11 | 43/48 | les 5 échecs sont documentés, aucun seuil assoupli |

Mesure de ressemblance : bas de frange de la hime −0,085 H (moteur) contre −0,112 H (lu sur la référence 47), écart dans l'incertitude de lecture.

## Impasses assumées (essais abandonnés)
- Hime : mèches de masse 12 → 16 : plus de trous. Retour à 12.
- Pixie : `top` 38, `fringeC` 20, `fringeR` 22 : plus d'échecs (calotte 0,67–0,70). Retour aux effectifs initiaux.
- Pixie fidèle à la référence 32 (front nu, épi haut) : bloqué par `anat.dome`, qui compte le front dans la calotte ; le vérificateur n'a PAS été modifié.

## Artefacts
`artefacts/hair-engine-pass11/` : 01 hime (3 couleurs × 3 graines), 02 pixie, 03 rotation −60° → +60°, 04 avant/après réparation,
05 comparaison carré / hime / pixie, 06 verdicts G/A/S (JSON), 07 référence vs moteur (masques mesurés), `mesures/` (JSON, masques).
Régénération : `npx tsx scripts/hair-grammar/artefacts-pass11.ts`.
