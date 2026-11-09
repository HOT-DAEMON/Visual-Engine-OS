# Reste à faire — branchement tête + corps (état au 5 nov. 2026)

> Complète `TODO-HEAD-BODY-PIPELINE.md`. Ce fichier ne liste que ce qui n'est **pas fait** et pourquoi.

## Pose 3/4 — non branchée (mais la tête entière tourne : `head_3d`)

> Depuis `PIPELINE-HEAD-3D.md`, un objet `head_3d` rend la tête et le cou d'un hôte à un lacet / tangage quelconques par la 3D du moteur `head-turntable`. `face/pose` (reprojection des composants 2D du visage) reste NON branchée ; la pose 3/4 du visage 2D, elle, n'est pas remplacée : `head_3d` est un rendu séparé en aplats, pas le visage ombré de l'hôte.

`face/pose` est de la **géométrie pure** (projection de repères) : elle ne produit aucun SVG. La brancher exige de reprojeter **chaque composant** du visage
(yeux, nez, bouche, mâchoire, oreilles, cheveux, ombres de contact) : ce n'est pas un champ de plus, c'est une deuxième chaîne de rendu.
Je ne l'ai pas fait plutôt que de l'imiter avec une simple transformation affine (qui donnerait un visage de face écrasé, sans conséquence sur les relations parent/enfants).
Plan : (1) la pose s'applique aux repères et à la géométrie des composants (pas au SVG fini) ; (2) les relations de `FACE-RELATIONS.md` se mesurent alors sous pose ;
(3) l'œil a déjà une rotation 3D par enveloppe (`EYES-SYSTEMS.md`) et sert de modèle.

## `hair-grammar` — non branchée, et pas branchable avant la pose

Les rubans de `src/hair-grammar` sont définis **dans la vue 3/4 de l'image de référence** (cellules `01-tousled`, `02-side_sweep`, `03-swept_back`). Les poser sur un
visage de face serait géométriquement incohérent. Ordre obligatoire : pose 3/4 branchée → pont `HeadFrame` ↔ `FaceLandmarks` (`HAIR-GRAMMAR-BRIDGE.md`) → un `kind`.
De plus, la fidélité de la grammaire aux cellules n'est pas parfaite (`HAIR-GRAMMAR-REMAINING.md`) : la brancher maintenant figerait un rendu insuffisant.

## Crâne de profil — branché, avec trous

Voir `PIPELINE-PROFILE.md` : option `eye` non alimentée (œil et sourcil génériques) ; incohérence de coiffure entre face et profil (deux moteurs de cheveux) ; 90° uniquement.

## Relief — branché, mais lourd

Voir `PIPELINE-RELIEF.md` : ~13× le coût du visage à `ppu` 2,4 ; qualité 1,6 vs 2,4 non comparée ; relief du corps et du profil non branchés.

## Bassin et jambes — branchés (option)

Voir `PIPELINE-LOWER.md` : défaut `legs: false` (buste) ; muscles 3D des jambes, pied détaillé, fidélité aux références d'anatomie.

## Orbite — corrigée

Voir `ORBIT-PUBLISH.md` : constantes d'orbite propres à `relief/head.ts` ; 30 références de régression « close » à régénérer en bloc.

## Relations

Voir `FACE-RELATIONS.md` : relations visuelles manquantes ; mesures sous pose ; dettes mesurées (bouche basse, haut d'oreille, ailes étroites).

## Compilateur (problème 2 du TODO)

Inchangé : `faceParts` ordonne les couches à la main. **Deux nouveaux `kind` (`head_profile`, `head_lit`) ont été ajoutés au registre** sans toucher au `switch` :
le registre `COMPILERS` suffit à ce stade (il rejette à la compilation un `kind` sans compilateur). Seuil de réouverture inchangé : plus de ~15 couches ou composants externes.
Nouveau champ `CompiledObject.top` (couche au-dessus de tous les `overlay`) : premier ordre de dessin explicite entre objets ; si un 2ᵉ calque `top` apparaît, il faudra un `z` explicite.

## Dettes préexistantes rencontrées (non causées par ce travail)

- Doublon d'identifiant `f0-hair-base-clip` dans le rendu du visage seul.
- Manifeste de régression périmé (30 cas « close » sur 34 avant ma modification).
- Aucune comparaison visuelle externe : les planches ont été regardées par moi ; **le jugement de style artistique reste le vôtre**.
