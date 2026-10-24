# Cheveux simulés (Verlet) — `hair.sim`

Moteur additionnel, **désactivé par défaut** (`hair.sim.enabled = false` ⇒ aucun rendu existant ne change ; les 2126 tests historiques passent).

## Principe
Chaque paquet est une chaîne de points 3D (x droite, y bas, z vers la caméra) attachée à une racine du cuir chevelu :
gravité, vent optionnel, raideur angulaire, plaquage au crâne, collision (crâne, visage, cou, épaules), enveloppe de volume (`reach`).
La chute naturelle, la retombée sur les tempes et le drapé viennent de la simulation ; l'anti-gravité n'existe que si `sim.float > 0` (volontaire).

| Fichier | Rôle |
|---|---|
| `src/schema/hair-sim.ts` | Schéma `HairSim` + liste des archétypes |
| `src/face/hair/sim/collider.ts` | Corps de collision : calotte ellipsoïdale, sections lues sur le VRAI contour, cou, épaules |
| `src/face/hair/sim/verlet.ts` | Intégration de Verlet, contraintes, passe finale de longueur exacte |
| `src/face/hair/sim/archetypes.ts` | Table des coiffures : masses (région, longueur, champ d'écoulement, raideur) |
| `src/face/hair/sim/index.ts` | `simLocks` : masse → paquets → brins, projection 2D, ordre de profondeur par z |
| `src/face/hair/sim/drape.ts` | Règles de contact (front, joues) + ombres portées sur la peau |
| `src/verify/hair-sim.ts` | Détecteur « électrocuté », couverture, contrôles 3 couches |
| `scripts/lib/hair-raster.ts` | Mesures SUR LE RASTER (masque = rendu avec − rendu sans cheveux) |

## Hiérarchie
1. **Masse** (`MassDef`) : région du cuir chevelu (`s`, `t`), longueur, balayage / poussée / relevé / tirage arrière.
2. **Paquet** : racine tirée dans la masse (strates), un ruban large (rank `main`).
3. **Brins** : `strandsPerPacket` chaînes fines simulées séparément autour du paquet (rank `fine`).
Champ d'écoulement : tangente à la surface, loin de la raie (`partX`, sommet), + biais de la masse.
Ordre de profondeur : tri par z moyen ; calque `back` si z < −0,06 W ou masse arrière.

## Drapé conscient du visage (remplace le garde-fou binaire)
- Front : la mèche S'ARRÊTE (bout interpolé) au-dessus de la limite des sourcils, sauf masse `limit: 'eye'` (calque `over`, occlusion voulue).
- Joues : bande de 0,08 W le long du contour, sous la zone des yeux ; ailleurs la mèche est repoussée vers le contour.
- Oreilles : `applySides` passe derrière l'oreille les mèches simulées qui la recouvrent si elle est dégagée.
- Épaules : le collisionneur s'évase sous la base du cou.
- Ombres portées : ruban décalé bas-droite (lumière unique), flouté, tronqué au contour (`sim.skinShadow`).

## Vérification (`verifyFace` l'appelle quand `sim.enabled`)
- `hair-sim-gravity` (erreur) : part de mèches dont la corde racine→pointe dépasse 100° par rapport à la gravité ≤ tolérance de l'archétype (0,2 + 0,35·relevé + float).
- `hair-sim-detached`, `hair-sim-coverage`, `hair-sim-segments` (avertissements) ; `hair-sim-finite` (erreur).
- Règles historiques adaptées : occlusion déclarée par l'archétype (`limit: 'eye'`), mèches simulées `cheek` exemptées de la zone centrale.
- Raster (`rasterHair`) : couverture du crâne, dépassement au-dessus / sur les côtés, occlusion de l'œil, peau du front visible.

## Utilisation
```ts
generateRandomFace(321, { hair: { style: 'short', sim: { enabled: true, archetype: 'side_sweep', wind: 0.4 } } });
```
Preuves : `artefacts/hair-sim/` (régénérer : `npx tsx scripts/artefacts-hair-sim.ts`). Reste à faire : `docs/HAIR-SIM-REMAINING.md`.
