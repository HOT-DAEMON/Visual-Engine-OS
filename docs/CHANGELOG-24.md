# Changelog 24 — yeux de l'hôte, recouvrement à 0°, cou, roulis, vitesse (branche `feat/hair-grammar`)

- **Yeux de l'hôte** : `render/head-3d-eyes.ts`, `head-turntable/eye-host-tex.ts`, `eye-colors.ts`, `engines/host-eyes.ts` : forme d'ouverture, taille, iris, pupille réelle, regard, depuis l'œil effectif (`resolveEye`). `head3dSubject(host, o, iris?, eyes?)`, `checkHead3d(o, host, eyes)`.
- **Recouvrement à 0°** : `verify-host.ts`, 9 contrôles (IoU, couverture, peau, yeux). Défaut corrigé : un hôte chauve n'a plus l'épaisseur de coiffure sur le crâne (`from-face.ts`).
- **Cou** : `engines/neck-relief.ts` + `verify-neck-relief.ts` : SCM, platysma, clavicules, fosse sus-sternale lus du moteur `src/neck` ; 5 contrôles anatomiques.
- **Roulis** : `head_3d.roll` ±40° (`schema/head-3d.ts`), `roll.ts`, `math.ts` (`poseHead`, `poseDir`), `verify-roll.ts` : 4 contrôles. Roulis 0 : rendu identique.
- **Vitesse** : `sections.ts`, `face-parts.ts`, `face-tex.ts`, `ear3d.ts`, `ear-field.ts` ; pixels identiques (hash de 12 rendus) ; vérification d'un sujet 17 – 19 s → 7,5 – 10,5 s.
- **Vérification** : 79 → 97 contrôles par tête ; seuls avertissements : `skull.cephalic3d` et `style.specks.0` (graine 77), antérieurs.
- **Tests** : `head-turntable-host` (6), `head-turntable-neck-relief` (7), `head-turntable-roll` (6). **Artefacts** : `artefacts/tete-hote-cou-roulis/` (script `scripts/artefacts-head-host.ts`). **Docs** : `HEAD-TURNTABLE-HOST-OVERLAP.md`, `-NECK-RELIEF`, `-ROLL`, `-SPEED`.
- Reste à faire : `docs/PIPELINE-HEAD-3D-REMAINING.md` (sourcils, volume des cheveux, coupe du cou, teinte d'iris).
