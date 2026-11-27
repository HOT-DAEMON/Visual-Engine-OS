# Itération 09 — reste à faire

À lire avec `BODY-JUNCTIONS-09.md`. Rien ci-dessous n'est prétendu fait.

## Tête
- **Non traitée.** Le moteur de visage est 2D : la tête n'est visible que de face, il n'y a ni arrière de crâne ni nuque détaillée. Piste : brancher `scripts/head-turntable/` dans les vues de dos. Les planches `01-tete-corps-avant-apres.png` sont de face.

## Mains (ref-05)
- Seules les palmures sont ajoutées. `references/anatomy/ref-05-mains.jpg` n'a **fait l'objet d'aucune mesure** (proportions des phalanges, losanges de tendons dorsaux, éminences thénar/hypothénar, plis).
- Les doigts restent des phalanges cylindriques segmentées (aspect mannequin) ; main au repos, aucune pose ouverte testée.
- Les palmures sont invisibles de dos : style prouvé de face seulement.

## Deltoïde
- Seule l'insertion du pectoral (08) et l'enveloppe (09) sont là ; des **croissants sombres** assez durs sont visibles à l'origine de chaque chef de profil (`02a-epaule-profil-avant-apres.png`). Non corrigé.
- Les enveloppes sont deux volumes séparés de la masse unique (contrat respecté par le nommage, pas par la forme). Non testé bras levé, de trois-quarts, ni sous un autre éclairage.
- Style non prouvé pour `baby`, `toddler`, `child`, `thin`, `obese`, `elderMale`, `elderFemale` (palier 2).

## Dos
- Le relief du grand dorsal et du losange reste discret : 1,7–3,0 % du corps (obèse 0,65 %), écart maximal 16–45/255. C'est du shading : pas d'ombre portée de la nappe sur le flanc.
- Le **volume** de l'omoplate est ≈ 0,5 vertèbre plus bas que le relief (8,3 contre 7,8 chez l'adulte).
- Épine moins oblique qu'avant (0,61–0,68 vertèbre) : l'acromion du cadre est bas (≈ T4) ; le relever toucherait le bras et le deltoïde.
- Marge de `relief-soft` de 0,4/255 sur `teenFemale` : toute amplitude supplémentaire la dépasse.
- Une ombre dentelée au pli postérieur de l'aisselle (vue de dos, côté droit du corps à l'écran) était déjà présente ; non corrigée.
- Aucune comparaison à une photographie de dos : la validation est interne (contrôles) et visuelle (planches).

## `baby`
- Le contrôle passe par une bande plus large avant 4 ans, justifiée par l'anatomie pédiatrique mais **non confrontée à une référence mesurée**.

## Tests
- Suite complète non lancée (253 fichiers) ; non lancés : tests de visage, cheveux, yeux, oreilles, nez.
