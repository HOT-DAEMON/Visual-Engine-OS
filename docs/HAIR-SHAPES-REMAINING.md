# Formes de cheveux, vent, tête tournante — reste à faire (par composant)

Fait : `HAIR-SHAPES.md`, `HAIR-WIND.md`, `HEAD-TURNTABLE-HAIR.md`. Chaque ligne est une limite constatée sur les planches de `artefacts/hair-shapes/`.

## Formes (classic)
1. Ailes de tempe : plus de dalles, mais sur certaines graines la masse de tempe reste mince et la couronne du `bob` paraît creuse ; chignon (`bun`) parfois peu lisible.
2. Frange `short` : festons arrondis, plus de peigne ; l'élégance du dessin (rythme des mèches, asymétrie) n'est pas jugée.
3. Gain en vue de face : modeste hors ailes, queue de cheval et frange. Aucun correctif ne change la silhouette d'ensemble.

## Moteur v2 / cheveux simulés (Verlet)
4. Cônes v2 corrigés (racines sur le dessus du crâne, axe radial, longueurs bornées) ; `spiky`/`afro` restent volumineux (avertissements d'atteinte).
5. **Archétypes simulés non traités** : leurs mèches ne passent ni par `wings` ni par `applyWind`, et leur lisière propre n'est pas reliée à `boundary`.

## Vent
6. Intégré en 2D de face, classic seulement, **statique** (une pose, pas de dynamique : pas de rafale, turbulence, retour élastique, couplage avec `sim/`).
7. Pas de vent sur la tête tournante (la région peinte est plate) ; `windDir` 3D toujours sans consommateur.

## Tête en rotation
8. Lisière reliée (région en azimut/U) ; **volume de cheveux 3D absent** : pas de masse longue/bob/queue de cheval ni de mèches en 3D sur la tête tournante.
9. Pas de perspective des mèches sur le côté et la nuque ; le point de vue n'est ni vérifié contre `src/skull/` (profil).

## Profil
10. `src/skull/hair-shape.ts` : non branché sur la nouvelle lisière ni sur les correctifs de forme.

## Vérification
11. Seuils posés à la main ; ils attrapent des défauts (3 injectés dans les tests) mais ne jugent pas la beauté. **Revue visuelle humaine nécessaire.**
12. Corpus de balayage : 10 coiffures × 24 graines, classic ; pas de v2/sim, pas de visages d'enfant.

## Régression visuelle
13. Les 34 références ne montrent pas ces changements (`npm run regress` : « close »/« exact », rms ≤ 0,26/255). Ajouter des références avec cheveux : **non fait** (actualiser les références est une décision explicite du propriétaire).

## Sécurité
14. Le jeton GitHub collé en clair dans la conversation est à **révoquer** ; il n'est écrit nulle part dans le dépôt ni dans l'URL distante.
