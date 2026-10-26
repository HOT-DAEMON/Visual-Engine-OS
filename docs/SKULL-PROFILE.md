# Moteur de crâne en vue de profil (`src/skull/`)

Branche `feat/skull-profile` (depuis `feat/render-speed`). Preuves visuelles : `artefacts/skull-profile/`.
Détails : anatomie → `SKULL-PROFILE-ANATOMY.md` ; vérification → `SKULL-PROFILE-VERIFY.md` ; non fait → `SKULL-PROFILE-REMAINING.md` ; vitesse → `PERF-3.md`.

## Principe : une seule tête

Le crâne et le visage sont la même tête. Le profil **ne redéfinit aucune hauteur** : ligne des yeux, base du nez, bouche, sillon, menton, mâchoire
viennent de `faceLandmarks` (source unique, `src/face/landmarks.ts`), ramenées à la hauteur sommet → menton (`Frame.f`). Le profil n'ajoute que la
PROFONDEUR (axe avant-arrière) et ce que la face ne montre pas : voûte, occiput, protubérance occipitale, nuque, cou. L'oreille est le MÊME modèle
que la face (`face/ear/`), projeté à 90° par `projectEar` — pas une seconde géométrie. L'angle gonial du profil est RÉSOLU sur celui du visage de face.
Preuve : `artefacts/skull-profile/05-coherence-face-profil.png` (quatre lignes guides traversent yeux, narines, bouche, menton des deux vues).

## Repère et fichiers

x vers l'avant (le visage regarde à droite), y vers le bas, origine x = porion (conduit auditif), y = 0 au sommet, H = 420 px (sommet → menton).

| Fichier | Rôle (lignes) |
|---|---|
| `types.ts` | `SkullParams` (schéma strict, 19 axes indépendants), `CPoint` (57) |
| `frame.ts` | hauteurs (depuis la face) + profondeurs ; ligne E des lèvres bornée par `Resolver` (57) |
| `vault.ts` | voûte : supraglabelle → bosse frontale → bregma → vertex → lambda → opisthocrânion → inion (40) |
| `face-profile.ts` | glabelle → nasion → dorsum → pointe → columelle → lèvres → sillon → pogonion → menton (49) |
| `neck.ts` | cou incliné, gorge, cartilage thyroïde, nuque (lordose, C7, trapèze) (80) |
| `bone.ts` | repères osseux, profondeurs de tissu, mandibule résolue, vertèbres C1–C7 (87) |
| `geometry.ts` | assemblage + mémoïsation par contenu (`memoPure`) (45) |
| `spline.ts` | cubiques à tangentes de corde (sans dépassement), acuité par point (58) |
| `render*.ts` | peau cel, détails d'encre, oreille, cheveux, os/anatomie (≤ 108 chacun) |
| `../generation/random-skull.ts` | tête aléatoire déterministe (flux dérivé : ne bouge pas le visage) (33) |
| `../verify/skull.ts` | vérification en trois couches (124) |

## Axes du crâne (`SkullParams`, tous bornés et indépendants)

`length` (brachy ↔ dolicho), `vaultHeight` (plénitude), `vaultPeak`, `foreheadSlope` (4°–30°), `frontalBulge`, `browRidge`, `occiput`, `inion`,
`scalp`, `maxilla` (rétrusion ↔ protrusion), `zygoma`, `neckTilt` (5°–28°), `neckDepth`, `lordosis`, `c7`, `trapezius`, `thyroid`, `hair`
(`none|short|undercut|updo`), `napeHairline` (hauteur d'implantation : haute = nuque dégagée).

## Techniques

- **Approximation faciale médico-légale** : os médian → peau = os décalé d'une profondeur de tissu par repère (méthode ; valeurs : ordres de grandeur).
- **Résolution de contrainte** : l'abscisse du gonion est trouvée par dichotomie pour que l'angle ramus/corps égale l'angle gonial de la face (40 pas).
- **Contraintes consignées** (`Resolver`) : ligne E, cou minimal, nuque à 0,03–0,16 H de l'inion ; une valeur ramenée est enregistrée, jamais silencieuse.
- **Rendu sans filtre** : chemins, dégradés, croissants d'ombre/lumière par différence symétrique (`evenodd`) de la silhouette et de sa copie décalée.
- **Cou cohérent** : angle cervico-mentonnier = 90° + pente du dessous du menton ; gorge placée sur cette pente.

## Utilisation

```ts
import { renderProfile, generateRandomProfile, verifyProfile } from './src';
const p = generateRandomProfile(7);
const r = renderProfile(p.face.params, p.skull, { skin: p.skin, hair: p.hair, mode: 'skin' }); // 'skin' | 'anatomy' | 'bone'
verifyProfile(p.face.params, p.skull, { skin: p.skin, hair: p.hair }).ok;
```
Scripts : `npx tsx scripts/artefacts-skull.ts [graine]` (images + `verification.json`), `npx tsx scripts/bench-skull.ts [n]`.
