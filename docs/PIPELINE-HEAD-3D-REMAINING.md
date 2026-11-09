# Tête 3D dans le pipeline — ce qui reste (par composant)

Légende : ✅ fait et vérifié · ⚠️ partiel, limite connue · ⬜ non fait. Voir `PIPELINE-HEAD-3D.md` pour ce qui est branché.

| Composant | État | Ce qui est fait | Ce qui manque |
|---|---|---|---|
| Branchement (`kind`, schéma, registre, vérification) | ✅ | `head_3d`, 8 tests, 79 contrôles par tête | `ctx.eyes` n'existe que pour les hôtes `face` ; pas de `head_3d` dans les anciens fichiers de scène (aucun à migrer) |
| Crâne | ⚠️ | dérivé du visage de l'hôte (même appel que `head_profile`) ; la largeur suit le visage (graine 42 : crâne large) | indice céphalique 3D 1,05 – 1,12 > 0,98 (avertissement) ; plan latéral aplati de `rotation-3d/07` non reproduit |
| Peau | ⚠️ | teinte dominante du matériau de l'hôte | le visage de face est ombré en dégradés doux, la tête 3D en aplats cel : deux styles côte à côte |
| Cheveux | ⚠️ | lisière RÉELLE de la coiffure de l'hôte ; couleur de l'hôte ; chauve reste chauve | **pas de volume** : bouclés, nattes, longs, chignon restent une calotte posée sur le crâne (graine 3 : natte absente) ; pas de mèches ni de brillance |
| Yeux | ⚠️ | iris de l'hôte (olive, vert…) | taille et forme : les yeux 3D sont plus grands et plus ronds que ceux de l'hôte ; regard fixe vers l'avant (celui de l'hôte peut être de côté) ; paupières et cils de l'hôte non repris |
| Sourcils | ⬜ | — | forme et couleur de l'hôte (`browGeometry` du moteur de visage) |
| Nez, bouche, mâchoire, menton, oreille | ⚠️ | moteurs de composants de l'hôte via `from-face.ts` | limites inchangées : pic du menton à 70° recalé non prouvé, pavillon pointillé, bouche fermée, nez en boule sur grands nez (`HEAD-TURNTABLE-REMAINING.md`) |
| Cou | ⚠️ | cloche vers les trapèzes, profil mesuré (`HEAD-TURNTABLE-NECK-BELL.md`) | coupe = disque plat ; ni SCM, ni platysma, ni clavicule ; épaules plus étroites que la réf. 07 ; `neckScale` toujours là ; `src/neck` et `src/body/volume/neck.ts` non branchés |
| Rotation 2D (roulis) | ⬜ | `transform.rotate` de la scène fait tourner l'image entière | pas de roulis 3D de la tête (inclinaison latérale) ; le moteur ne connaît que lacet et tangage |
| Tangage | ⚠️ | −60° … 60° accepté, ±35° vérifié visuellement (`v5/05-…`) | à fort tangage : coupe du cou, oreille et yeux non recalés ; `REF_PITCH` unique pour la vérification |
| Hôtes non-visage (`head_profile`) | ⬜ | — | pas de pont entre `head_3d` et `head_profile` : à 90° les deux profils ne sont pas comparés automatiquement |
| Vérification | ⚠️ | 3 couches par tête dans `verifyPipeline` | pas de contrôle « la tête 3D à 0° recouvre le visage de l'hôte » (cohérence entre les deux rendus) ; pas de contrôle de la couleur d'iris ; la vérification tourne à vues fixes, pas à l'angle demandé |
| Performance | ⚠️ | mémoïsation par contenu | compilation ≈ 6 – 8 s pour 4 têtes à `resolution` 1 ; vérification ≈ 24 s au premier sujet : trop lent pour un usage interactif ; pas de rendu incrémental par angle |

## Ordre conseillé

1. Contrôle de recouvrement tête 3D à 0° ↔ visage de l'hôte (la mesure qui manque pour dire « même personne »).
2. Sourcils et paupières de l'hôte (repris, pas recréés), puis proportions des yeux.
3. Volume des cheveux : étendre `hair-bridge.ts` au-delà de la lisière (épaisseur par coiffure, bouclés / nattes) sans nouveau moteur.
4. Brancher `src/neck` et la coupe aux épaules (`HEAD-TURNTABLE-NECK-BELL.md`).
5. Roulis.
