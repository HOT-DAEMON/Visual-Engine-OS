# Jambes 3D et rampe poitrine → ventre — itération 06

Branche `feat/hair-grammar`. Suite de `BODY-JUNCTIONS-05.md`. Ce qui reste, composant par composant : `BODY-LEGS-3D-06-REMAINING.md`. Preuves visuelles : `artefacts/upper-limb-06/` (15 images, script `scripts/artefacts-upper-limb-06.ts` ; « avant » = itération 05 dans un worktree, « après » = arbre courant, cadrage identique, `scripts/body-refs/legs-snap.ts`).

**Le résultat n'est pas « parfait sur tous les axes »** : voir le bilan honnête et le fichier des restes.

## La consigne, morcelée, et ce qui en a été fait
| # | Fragment de la consigne | Statut |
|---|---|---|
| 1 | Garder la peau 3D comme simple pont de continuité du bassin | **Fait** (`volume/legs.ts`, `legSkin`) |
| 2 | La dériver de `legGeometry` au lieu de recalculer ses dimensions | **Fait** (`LegGeo.frame`, entrée `legs` relayée) |
| 3 | Porter dans la couche de volumes les atomes du module existant (genoux, pieds, orteils, ongles, muscles) : une seule source | **Fait** (`lower/leg-spec.ts` + `foot.ts` `toeLayout`) |
| 4 | Corriger la doc sur ce point | **Fait** (05, 05-REMAINING, BODY-REMAINING corrigés) |
| 5 | Brancher le corps au pipeline principal | **Non fait** (`BODY-LEGS-3D-06-REMAINING.md` §8) |
| 6 | Rampe poitrine → ventre | **Fait** (mesuré contre ref-04) |
| 7 | Deltoïde enveloppant | **Non fait** |
| 8 | Continuer le membre supérieur / fidélité pixel par pixel « parfaite » | **Non atteint** : seule la rampe touche le haut du corps ; jambes mesurées surtout à l'œil (§ bilan) |
| 9 | Extraire toute l'information de l'image de référence | **Partiel** : inventaire musculaire de ref-02 (quadriceps à 3 chefs, sartorius oblique, adducteurs, tibial antérieur, gastrocnémien, soléaire) ; profil de ref-04 mesuré par bandes ; rien d'autre n'a été mesuré |
| 10 | Dossier artefacts avec preuves visuelles (toute la tête) | **Fait** (`01-corps-avec-tete.png` : tête et corps entier) |
| 11 | Docs ≤ 200 lignes, suites si besoin | **Fait** (tous < 100 lignes) |
| 12 | Couche de vérification : géométrie, anatomie, style artistique | **Fait pour les jambes** (13 contrôles) ; le « style artistique » reste mesuré, pas jugé (§ bilan) |

## Composants traités
1. **Source unique 2D/3D** (`lower/leg-spec.ts`) : `LEG_MUSCLES` (27 muscles : identifiant, parent, niveau, ton, étendue, décalage, largeur ; la 3D ajoute `dz` profondeur et `bz` épaisseur), `LEG_LANDMARKS` (8 repères), `LEG_ATTACH` (origine → insertion), `LEG_KIN` (constantes de cinématique). `leg.ts` et `foot.ts` les lisent ; `toeLayout` donne aux deux rendus la même disposition des orteils. **Contrôle** : empreinte SHA-1 des atomes 2D sur 26 cas (13 archétypes × 2 jeux de paramètres) identique avant/après refactorisation.
2. **Dérivation** : `VolumeParams.legs` (même schéma `LegParams`) ; `build.ts` appelle `legGeometry` ; `makeTrunk` reçoit le `LegFrame` au lieu de recalculer la fourche.
3. **Squelette 3D** (`legs-skeleton.ts`) : hanche → genou → cheville + repère du pied, pose du tronc appliquée une seule fois par `tr.xf`. Genou fléchi vers l'arrière, jambe ramenée vers la verticale (`inward`), pied tourné de `footTurnout`.
4. **Peau = pont** (`legs.ts`, `legs-profile.ts`) : une enveloppe par jambe, profil de peau (`legRows`/`legProf`) **commun** à la peau et aux muscles.
5. **Muscles** (`legs-muscles.ts`) : un loft par entrée de `LEG_MUSCLES`, mis à l'échelle de la peau locale puis **bornés à une coque** de 6 % + 8 % × définition visible autour de la peau. Premier essai (dimensions fixes, sans coque) : muscles en « feuilles » qui sortaient du contour au genou ; la coque l'a corrigé. Paliers d'apparition par `muscle-tiers.ts`, comme le 2D.
6. **Genou et cheville** : rotule (dôme), condyles, tubérosité tibiale, tête du péroné, coussinet, malléoles, sphères d'articulation ; os (fémur, tibia, péroné) cachés.
7. **Pied** (`foot3d.ts`) : enveloppe (talon fermé, voûte, dos), 5 orteils (peau + phalanges cachées + ongle), métatarsiens et calcanéus cachés, naviculaire, 4 tendons extenseurs. Orteils : éventail et flexion du 2D (`toeSpread`, `toeCurl`).
8. **Rampe poitrine → ventre** (`trunk.ts` `RAMP`/`YR`, `front.ts` `PEC`). Balayage sur les bandes de profil de ref-04 (1/16 du tronc) : clé des côtes −5 %, taille et haut de l'abdomen +12 %, bord inférieur du pectoral −20 %. Essais écartés : hausse globale (accentue la bosse des côtes), `pelvisShift` 0,42–0,55 (IoU +0,01 mais erreur de ligne en hausse : le fessier dépasse déjà vers l'arrière).
9. **Vérification** (`verify/legs3d.ts`) et garde-fou de profil resserré 0,25 → 0,15 h (`verify/profile.ts`).

## Mesures avant → après (reproductibles)
| Mesure | Avant (it. 05) | Après (it. 06) |
|---|---|---|
| Volumes (très musclé) | 210 | 364 |
| Temps de construction | 20,6 ms | 21,1 ms |
| Rendu par pixel, 700 px, face | 2 090 ms | 2 333 ms (+12 %) |
| Profil ref-04, IoU adulte / très musclé | 0,863 / 0,858 | **0,871 / 0,875** |
| Profil ref-04, erreur de ligne adulte / très musclé | 0,062 / 0,085 | **0,048 / 0,052** |
| Plus grand saut de profondeur (ref-04 : 0,086 h) | 0,21 h | ≤ 0,126 h (6 morphologies × 2 profils) |
| Atomes 2D du bas du corps ayant un volume 3D de même id | 0 | 148 / 148 |
| Longueur fémur/tibia 3D contre `legGeometry` | — | écart ≤ 0,23 % |
| Dépassement max des muscles hors de la peau (très musclé) | — | 0,042 h (borne 0,05 h) |

Sorties brutes : `artefacts/upper-limb-06/avant|apres/rampe-profil.json`. Outils : `scripts/body-refs/profile-edges.ts`, `legs-snap.ts`.

## Vérification des jambes (`verifyLegs3D`, 13 contrôles)
- **Géométrie** : parité d'identifiants 2D↔3D ; cotes 3D = `legGeometry` (≤ 3 %) ; muscles dans la coque de peau (≤ 0,05 h, section **interpolée exactement** à la hauteur mesurée) ; symétrie gauche/droite ; pied posé au sol (si genou non fléchi).
- **Anatomie** : rotule au-dessus de la tubérosité, toutes deux en avant du genou, tête du péroné plus latérale ; malléole latérale plus distale ; loges avant/arrière distinctes (> 0,04 h) ; orteils décroissants, gros orteil médial ; origine/insertion ≥ 85 % des muscles de niveau 2.
- **Style** : peau, pied et orteils fusionnés dans le tampon de peau, muscles en couches ≥ 3, os cachés sauf la rotule ; relief de luminance de la cuisse comparé à celui du tronc (bande 0,4–3 si définition ≥ 0,25) ; aucun trou translucide.
Contrôles négatifs (3) : mollet gonflé, quadriceps passé derrière le fémur, volume 2D sans équivalent 3D. **Une erreur de ma première version** : le contrôle de coque échantillonnait des tranches trop fines et donnait des dépassements de 0,35 h faux ; remplacé par l'interpolation exacte. Seuils fixés après observation des 13 archétypes : ils protègent d'une régression, ils ne prouvent pas la fidélité.

## Bilan honnête
- Les jambes ne sont plus des tubes lisses sous un tronc sculpté et se lisent comme des jambes dans toutes les vues et poses testées (genou fléchi, écartement, pieds tournés, orteils écartés) ; `artefacts` 02–09 et 13.
- Comparée à ref-02 (`10-jambes-ref02-vs-moteur.png`), la forme reste loin : jambes plus rapprochées et plus étroites aux cuisses, pieds plus petits, quadriceps en fuseaux séparés. **Aucun IoU de jambes n'a été mesuré** : c'est le premier reste.
- Le style est vérifié par des écarts-types de luminance, pas par un jugement artistique ; les images restent à juger à l'œil.
