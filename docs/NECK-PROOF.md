# Preuves de visibilité par paramètre (généré par `scripts/artefacts-neck.ts`)

Seuils : ≥ 0,6 % des pixels de la boîte du cou, ou ≥ 1 % de H de silhouette (face ou profil). Valeurs en %.

| Paramètre | Cas | Pixels | Sil. face | Profil | Preuve |
|---|---|---:|---:|---:|---|
| `dimensions.depthRatio` | profondeur AP ×1,6 | 0 | 0 | 11.04 | profil |
| `dimensions.topWidth` | largeur du haut ×0,65 | 37.81 | 6.92 | 0 | face |
| `profile.taper` | cône (large en bas) | 35.4 | 8.01 | 3.8 | face |
| `profile.waist` | sablier | 19.18 | 6.46 | 5.49 | face |
| `profile.curvature` | courbure sagittale | 0 | 0 | 6.63 | profil |
| `profile.sCurve` | cou en S | 0 | 0 | 5.41 | profil |
| `profile.crossSection` | section rectangulaire | 4.88 | 0 | 0 | face |
| `profile.segments` | segments (anneaux) | 1.91 | 3.38 | 1.94 | face |
| `orientation.pitchDeg` | cou penché en avant 30° | 0 | 0 | 14.35 | profil |
| `orientation.rollDeg` | inclinaison latérale 12° | 6.34 | 5.14 | 0 | face |
| `orientation.torsionDeg` | torsion 50° | 15.11 | 1.45 | 1.54 | face |
| `orientation.axisOffset` | axe décalé | 39.89 | 5.14 | 0 | face |
| `asymmetry.leftRightBias` | côté droit plus massif | 27.46 | 4.45 | 0 | face |
| `asymmetry.frontBackBias` | face plus épaisse que la nuque | 0 | 0 | 3.52 | profil |
| `asymmetry.localVariation` | irrégularités locales | 3.99 | 1.38 | 1.21 | face |
| `asymmetry.seed` | graine (variation 1) | 5.11 | 2.93 | 2.15 | face |
| `musculature.trapezius` | trapèzes volumineux | 7.49 | 2.27 | 0.5 | face |
| `musculature.separation` | sillons musculaires marqués | 10.58 | 0 | 0 | face |
| `musculature.tendonVisibility` | tendons visibles | 2.44 | 0 | 0 | face |
| `musculature.tension` | cou tendu | 13.32 | 1.28 | 0.87 | face |
| `softTissue.foldDepth` | plis profonds | 8.6 | 0 | 0 | face |
| `softTissue.foldDistribution` | plis sur toute la longueur | 16.59 | 0 | 0 | face |
| `softTissue.dewlap` | fanon | 1.39 | 0 | 0 | face |
| `reliefs.larynx` | larynx forcé | 1.88 | 0 | 0 | face |
| `reliefs.hyoid` | hyoïde forcé | 1.05 | 0 | 0 | face |
| `reliefs.trachea` | trachée forcée | 2.72 | 0 | 0 | face |
| `reliefs.vessels` | jugulaire forcée | 5.2 | 0 | 0 | face |
| `reliefs.clavicle` | clavicules forcées | 0.71 | 0 | 0 | face |
| `species` | dragon (sans larynx ni SCM) | 8.14 | 0 | 0 | face |
| `style.mode` | mode caricature | 18.98 | 0.6 | 0.44 | face |
| `style.exaggeration` | exagération 1 | 29.11 | 1.01 | 0.8 | face |
| `style.simplification` | simplification 1 | 16.79 | 0 | 0 | face |
| `style.angularity` | facettes (angularité 1) | 6.75 | 0 | 0 | face |
| `style.silhouettePriority` | silhouette prioritaire | 14.9 | 0 | 0 | face |
| `modifiers.age` | âge avancé | 0.88 | 0 | 0 | face |
| `modifiers.mass` | corpulence maximale | 34.12 | 5.27 | 3.55 | face |
| `pose.headTranslate` | tête avancée | 0 | 0 | 17.03 | profil |
| `pose.compression` | compression axiale | 56 | 1.9 | 1.5 | face |
| `pose.stretch` | étirement | 29.92 | 1.58 | 1.25 | face |
| `pose.twistShare` | part de rotation suivie (lacet 70°) | 0 | 1.83 | 1.9 | silhouette |
| `pose.tissueLag` | inertie du fanon et de l'écharpe | 5.79 | 0 | 0 | face |
| `pose.bodyLanguage` | expression « honte » | 27.98 | 0.71 | 8.92 | face |
| `pose.bodyLanguageAmount` | intensité de l'expression | 27.98 | 0.71 | 8.92 | face |
| `strategies` | stratégie « chain » (honte) | 0 | 0 | 2.77 | profil |
| `operators.length_warp` | opérateur length_warp | 3.42 | 0 | 0 | face |
| `operators.width_profile_warp` | opérateur width_profile_warp | 31.54 | 10.22 | 0 | face |
| `operators.depth_profile_warp` | opérateur depth_profile_warp | 0 | 0 | 8.68 | profil |
| `operators.centerline_bend` | opérateur centerline_bend | 45.5 | 18.04 | 0 | face |
| `operators.local_bulge` | opérateur local_bulge | 12.49 | 8.51 | 7.24 | face |
| `operators.local_compression` | opérateur local_compression | 19.52 | 5.11 | 4.34 | face |
| `operators.asymmetric_deformation` | opérateur asymmetric_deformation | 30.83 | 9.36 | 0 | face |
| `operators.muscle_exaggeration` | opérateur muscle_exaggeration | 3.98 | 1.99 | 0 | face |
| `operators.fold_amplification` | opérateur fold_amplification | 2.74 | 0 | 0 | face |
| `operators.silhouette_simplification` | opérateur silhouette_simplification | 10.86 | 0.03 | 0.01 | face |
| `operators.topology_extension` | opérateur topology_extension | 1.18 | 0.9 | 0.76 | face |
| `operators.surface_ripple` | opérateur surface_ripple | 1.98 | 0.93 | 0 | face |
| `surface.pattern` | écailles | 33.79 | 0 | 0 | face |
| `surface.layout` | spirale vs rangées | 1.61 | 0 | 0 | face |
| `surface.size` | éléments ×3 | 1.51 | 0 | 0 | face |
| `surface.density` | densité 1 vs 0 | 1.39 | 0 | 0 | face |
| `surface.overlap` | imbrication 1 vs 0 | 7.15 | 0 | 0 | face |
| `surface.variation` | variation 1 vs 0 | 8.36 | 0 | 0 | face |
| `surface.smoothThroat` | gorge lisse | 25.81 | 0 | 0 | face |
| `surface.skinTension` | peau tendue | 15.51 | 0 | 0 | face |
| `surface.elementColor` | couleur propre des éléments | 74.66 | 0 | 0 | face |
| `attachments` | collier + crête | 13.44 | 0.64 | 0.54 | face |
