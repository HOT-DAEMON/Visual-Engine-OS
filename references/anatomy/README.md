# Références anatomiques
Images fournies par Daemon (fond noir et les lignes graphiques ignoré au rendu). Mapping et verdict : `docs/BODY-LOWER-REFS.md`.

## ref-04 (écorché, profil + face) — masques
`ref-04.silhouette.gz` (figure de face) et `ref-04.profile.silhouette.gz` (profil) : bits `np.packbits`, ligne par ligne, 564×771. Mesures dans `measures.json` (entrée `ref-04`). Bras droit de la figure de face tronqué par le cadre. Méthode et limites : `docs/BODY-UPPER-LIMB-02.md`.

Profil de `ref-04` : comparé au moteur depuis l'itération 03 (`scripts/body-refs/profile-iou.ts`, recalage en translation) — voir `docs/BODY-UPPER-LIMB-03.md`.

## ref-01 (mannequin féminin ZBrush, dos · face · profil) — masques
`ref-01.back.silhouette.gz`, `ref-01.front.silhouette.gz`, `ref-01.side.silhouette.gz` : bits `np.packbits` ligne par ligne, 874×826 (figure isolée par seuil sur le fond gris uni, trous remplis). Mesures dans `measures.json` (entrée `ref-01` : haut, bas, ligne de cou, ligne de base du cou ; hauteur de tête conventionnelle 100 px). Utilisé par `scripts/body-refs/back-measure.ts` — voir `docs/BODY-UPPER-LIMB-04.md`. Mannequin stylisé : mesure, pas verdict d'anatomie.
