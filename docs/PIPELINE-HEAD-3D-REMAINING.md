# Tête 3D dans le pipeline — ce qui reste (par composant)

Légende : ✅ fait et vérifié · ⚠️ partiel, limite connue · ⬜ non fait. Voir `PIPELINE-HEAD-3D.md` pour ce qui est branché.

| Composant | État | Ce qui est fait | Ce qui manque |
|---|---|---|---|
| Branchement (`kind`, schéma, registre, vérification) | ✅ | `head_3d` (+ `perspective`), 8 tests, 112 contrôles par hôte avec sourcils (97 + sourcils 9 + coupe du cou 6 ; 105 sans sourcil) ; `roll` ±40° dans le schéma | `ctx.eyes` n'existe que pour les hôtes `face` ; pas de `head_3d` dans les anciens fichiers de scène (aucun à migrer) |
| Crâne | ⚠️ | dérivé du visage de l'hôte (même appel que `head_profile`) ; la largeur suit le visage (graine 42 : crâne large) | indice céphalique 3D 1,05 – 1,12 > 0,98 (avertissement) ; plan latéral aplati de `rotation-3d/07` non reproduit |
| Peau | ⚠️ | teinte dominante du matériau de l'hôte | le visage de face est ombré en dégradés doux, la tête 3D en aplats cel : deux styles côte à côte |
| Cheveux | ⚠️ | lisière RÉELLE de la coiffure de l'hôte ; couleur de l'hôte ; chauve reste chauve | **pas de volume** : bouclés, nattes, longs, chignon restent une calotte posée sur le crâne (graine 3 : natte absente) ; pas de mèches ni de brillance |
| Yeux | ⚠️ | **forme, taille, regard, pupille et couleur de l'hôte** (`eyeHost`, œil effectif `resolveEye`) ; prouvé à 0° sur 8 graines (`HEAD-TURNTABLE-HOST-OVERLAP.md`) | style de la planche conservé (trait de paupière épais, 2 reflets) ; paupière et cils de l'hôte non repris ; un œil absent → yeux de la planche ; pas de contrôle de la teinte d'iris |
| Sourcils | ⚠️ | **forme, épaisseur, inclinaison et couleur de l'hôte** (`browGeometry` du moteur de visage, `HostBrow`) ; un hôte sans sourcil n'en reçoit pas ; 9 contrôles, aire rendue 0,96 – 1,03 du contour (`HEAD-TURNTABLE-HOST-BROWS.md`) | poils (`browHairs`) non repris (aplat) ; pas de froncement ni d'expression ; sourcil lointain à fort lacet non vérifié séparément |
| Nez, bouche, mâchoire, menton, oreille | ⚠️ | moteurs de composants de l'hôte via `from-face.ts` | limites inchangées : pic du menton à 70° recalé non prouvé, pavillon pointillé, bouche fermée, nez en boule sur grands nez (`HEAD-TURNTABLE-REMAINING.md`) |
| Cou | ⚠️ | cloche vers les trapèzes (`HEAD-TURNTABLE-NECK-BELL.md`) ; **SCM, platysma, clavicules et fosse sus-sternale lus du moteur `src/neck`** (`HEAD-TURNTABLE-NECK-RELIEF.md`) | **anneau oblique** à 25° (orifice thoracique, devant plus bas ; `HEAD-TURNTABLE-NECK-CUT.md`) ; **le « seau » est supprimé** : le cou se prolonge et le cadre le coupe en droite (`HEAD-TURNTABLE-NECK-CUT-2.md`, 0 pixel de plan de coupe à tangage 30° – 60°) ; 25° est une convention non mesurée sur référence ; bas du cou = une droite, pas une ligne d'épaules ni un V de col ; épaules plus étroites que la réf. 07 ; `neckScale` toujours là ; `src/body/volume/neck.ts` non branché ; creux seuls (pas de ton clair) |
| Roulis | ⚠️ | **`roll` ±40°** : inclinaison latérale autour de l'axe du nez, cou plié (base immobile) ; 4 contrôles, ligne des yeux à 20° ± 0,06 (`HEAD-TURNTABLE-ROLL.md`) | jonction cou-mâchoire sans pli à fort roulis + lacet ; `ROLL_BEND` réglage anatomique non mesuré sur référence ; coiffure non animée |
| Tangage et perspective | ⚠️ | −60° … 60° accepté ; **caméra en perspective optionnelle** (`perspective`, `HEAD-TURNTABLE-PERSPECTIVE.md`) ; **recalage œil / oreille mesuré** : dérive ≤ 0,05 U à ±30° | dérive jusqu'à 0,047 U (oreille) et 0,09 U (un œil) à ±60° ; perspective hors vérification et non activée par défaut ; `REF_PITCH` unique pour la vérification |
| Hôtes non-visage (`head_profile`) | ⬜ | — | pas de pont entre `head_3d` et `head_profile` : à 90° les deux profils ne sont pas comparés automatiquement |
| Vérification | ⚠️ | 3 couches par tête dans `verifyPipeline` ; **recouvrement à 0° ↔ visage de l'hôte** (IoU, peau, yeux) | pas de contrôle de la couleur d'iris ; la vérification tourne à vues fixes, pas à l'angle demandé ; bornes calibrées sur 8 graines |
| Performance | ⚠️ | mémoïsation par contenu ; peinture 1,9 → 0,9 s par rendu ; vérification d'un sujet 17 – 19 s → 7,5 – 10,5 s (`HEAD-TURNTABLE-SPEED.md`) | reliefs du cou et rendus de roulis ajoutent ≈ 10 – 15 % ; comparaison de bout en bout à refaire sur machine au repos ; pas de rendu incrémental par angle |

## Ordre conseillé

1. ~~Contrôle de recouvrement à 0°~~ ✅ ; ~~yeux de l'hôte~~ ✅ ; ~~SCM / platysma / clavicule~~ ✅ ; ~~roulis~~ ✅ (4 chantiers de `artefacts/tete-hote-cou-roulis/`).
2. ~~Sourcils de l'hôte~~ ✅ (`HEAD-TURNTABLE-HOST-BROWS.md`) ; paupières et cils de l'hôte (repris, pas recréés) ; poils de sourcil et froncement.
3. Volume des cheveux : étendre `hair-bridge.ts` au-delà de la lisière (épaisseur par coiffure, bouclés / nattes) sans nouveau moteur.
4. ~~Coupe oblique du cou~~ ✅ ~~« seau » elliptique~~ ✅ (`HEAD-TURNTABLE-NECK-CUT-2.md`) ; reste : ligne d'épaules (trapèzes, clavicules au-delà du cou) et pli de jonction cou-mâchoire à fort roulis.
5. Teinte d'iris : contrôle et modulation par l'éclairage comme le dessin de face.
