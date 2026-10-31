# Moteur de corps — tronc, épaules, membres supérieurs (feat/hair-grammar)

Code : `src/body/` · vérification : `src/verify/body.ts` · artefacts : `artefacts/body-upper-limb/` · détail : `BODY-CANON.md`, `BODY-ATOMS.md`,
`BODY-VERIFY.md`, `BODY-PERF.md` · reste à faire, composant par composant : `BODY-REMAINING.md` · journal : `CHANGELOG-15.md`, `ERRORS-10.md`.

## Périmètre
VUE DE FACE. Le corps est l'**enfant du cou** : racine = base du cou ; puis ceinture scapulaire (clavicules, trapèzes, acromions, sterno-cléido-mastoïdiens),
tronc (côtes, sternum, pectoraux, seins adultes, abdominaux, flancs) jusqu'à une coupe nette à la ligne des hanches, deux bras complets (racine du bras,
deltoïde, biceps, triceps, coude, avant-bras et ses 12 masses, poignet) et deux mains complètes (paume, éminences, 5 doigts × 3 segments, articulations,
ongles/pulpes, plis, tendons, interosseux, métacarpiens, carpe). Hors périmètre (voir `BODY-REMAINING.md`) : jambes, dos, profil, 3/4, rotation 3D.

## Principe
```
BodyParams (zod strict) ──► bodyFrame (px, canon, Résolveur) ──► atomes (polygones nommés, hiérarchiques) ──► renderBody (SVG sans filtre)
   4 axes indépendants           corrections consignées              ▲ contrats testés par perturbation          ▲ verifyBody (3 couches)
```
- **Ancre** (`NeckAnchor`) : tout ce que le corps sait du visage — hauteur de tête `h`, menton, base du cou, demi-largeur de la base. Seul pont : `anchor.ts`,
  qui lit `faceLandmarks` (source unique). Le corps n'a aucune coordonnée absolue ni dépendance de schéma envers la scène (`compose.ts` l'insère *derrière* le visage).
- **Unité** : 1 hauteur de tête = `h` px. Tout le corps se met à l'échelle avec la tête (un bébé a un corps plus petit *en têtes*, donc plus petit à tête égale).
- **Repère** : x > 0 = côté GAUCHE du corps (à droite de l'image), y vers le bas.
- **Atome** = plus petite unité nommée : polygone de contrôle, `kind`, `part` (composant du contrat), `parent`, `level` (0–3), `side`, `view` (`front`/`occluded`), `z`.
- **Géométrie pure et mémoïsée** par le contenu (`bodyGeometry`, `bodyMarkup`) ; valeurs rendues IMMUABLES.

## Les 4 axes indépendants (+ charpente et pose)
| Axe | Plage | Effet |
|---|---|---|
| `age` | 0–95 ans | canon de proportions (`BODY-CANON.md`) + portes de puberté (10→17) et de vieillesse (55→85) |
| `sex` | −1 féminin … +1 masculin | épaules, taille, hanches, bras, seins — **nul avant la puberté** (porte), vérifié |
| `adiposity` | 0–1 | taille, hanches, bras, ventre ; masque la définition musculaire |
| `muscularity` | 0–1 | épaules, bras, trapèzes ; définition visible = f(muscles, adiposité, âge) |
| `frame.*` (7), `limbs.*` (7), `fingers[5]`, `breast.*` (4), `posture.*` (2) | −1…1 ou 0…1 | écarts par rapport au canon, chacun indépendant (±1 ≈ ±12 % ; doigts ±15 %) |
| `pose.left/right` | abduction, flexion du coude, rotation d'avant-bras, déviation du poignet, pronation, écartement, flexion de chaque doigt | cinématique plane, bras indépendants |

Aucun archétype n'existe dans le moteur : `archetypes.ts` ne donne que 13 points de départ nommés (bébé, petit enfant, enfant, ado F/M, femme, homme, mince,
obèse, musclé, très musclé, femme/homme de 78 ans) et `generateBody(graine, archétype)` ajoute une variation déterministe bornée.

## Contrats (`contracts.ts`)
13 composants (`neck`, `torso-shell`, `shoulder-girdle`, `pectorals`, `breasts`, `abdominals`, `flank`, `skeleton`, `upper-arm.{L,R}`, `forearm.{L,R}`, `hand.{L,R}`) ;
chacun déclare `needs` (dépendances), `reads` (préfixes de paramètres) et `provides` (préfixes d'identifiants d'atomes). Ils sont **testés, pas décrits**
(`tests/body-contracts.test.ts`) : chacun des 51 paramètres est perturbé ; seuls peuvent changer des composants en aval d'un lecteur déclaré, et tout
paramètre doit agir. Un test fabrique volontairement un contrat menteur et vérifie qu'il est détecté. Résultat : 0 changement non déclaré, 0 paramètre sans effet
(`artefacts/body-upper-limb/influence.json`).

## Garde-fous de conception
- **Mineurs** : aucun atome `breast.*` avant 18 ans, quelles que soient l'adiposité et le volume demandés (seul un repère de mamelon neutre, identique pour tous les
  sexes, existe) ; un contrôle d'anatomie et un test le verrouillent.
- **Résolveur** : épaules ≥ 1,9 × demi-cou, tronc < épaules, taille ≤ 1,05 × épaules, acromion sous la base du cou, poignet ≤ 0,85 × avant-bras, paume ≥ poignet.
  Toute valeur ramenée est consignée dans `geo.corrections` (jamais silencieuse).
- **Interprétation de « moignon »** : *racine du bras* = atome `arm.stump` (jonction avec le tronc : capsule + deltoïde + plis axillaires). Si « moignon » désignait
  autre chose (membre amputé ?), c'est une demande à reformuler : non traitée.

## Commandes
`npx vitest run tests/body-*.test.ts` · `npx tsx scripts/artefacts-body.ts` · `npx tsx scripts/bench-body.ts [dossier]`.

## Bas du corps (ajout)
Bassin, cuisses, genoux, jambes, pieds : `docs/BODY-LOWER.md` ; hiérarchie musculaire 0→5 partagée : `docs/BODY-MUSCLE-TIERS.md` ; références : `docs/BODY-LOWER-REFS.md` ; reste : `docs/BODY-LOWER-REMAINING.md`. Commande : `npx tsx scripts/artefacts-lower.ts`.

Volumes 3D (caméra libre, un volume par muscle, éclairage par normales) : `docs/BODY-VOLUMES.md` ; temps : `docs/BODY-VOLUMES-PERF.md` ; reste : `docs/BODY-VOLUMES-REMAINING.md`. Commande : `npx tsx scripts/artefacts-volume.ts`.

Membre supérieur : rendu par pixel, fidélité mesurée à `ref-02` (IoU de silhouette) et vérification du rendu : `docs/BODY-UPPER-LIMB.md` ; reste : `docs/BODY-UPPER-LIMB-REMAINING.md`. Commande : `npx tsx scripts/artefacts-upper-limb.ts`.
