# Preuves de visibilité par paramètre (généré par `scripts/artefacts-neck.ts`)

Seuils : ≥ 0,6 % des pixels de la boîte du cou, ou ≥ 1 % de H de silhouette (face ou profil). Valeurs en %.

| Paramètre | Cas | Pixels | Sil. face | Profil | Preuve |
|---|---|---:|---:|---:|---|
| `dimensions.depthRatio` | profondeur AP ×1,6 | 1.21 | 0 | 11.04 | face |
| `dimensions.topWidth` | largeur du haut ×0,65 | 38.91 | 6.92 | 0 | face |
| `profile.taper` | cône (large en bas) | 32.99 | 8.01 | 3.8 | face |
| `profile.waist` | sablier | 17.61 | 6.46 | 5.49 | face |
| `profile.curvature` | courbure sagittale | 5.31 | 0 | 6.63 | face |
| `profile.sCurve` | cou en S | 8.88 | 0 | 5.41 | face |
| `profile.crossSection` | section rectangulaire | 2.26 | 0 | 0 | face |
| `profile.segments` | segments (anneaux) | 1.72 | 3.38 | 1.94 | face |
| `orientation.pitchDeg` | cou penché en avant 30° | 0 | 0 | 14.35 | profil |
| `orientation.rollDeg` | inclinaison latérale 12° | 4.95 | 5.14 | 0 | face |
| `orientation.torsionDeg` | torsion 50° | 10.25 | 1.45 | 1.54 | face |
| `orientation.axisOffset` | axe décalé | 40.97 | 5.14 | 0 | face |
| `asymmetry.leftRightBias` | côté droit plus massif | 25.64 | 4.45 | 0 | face |
| `asymmetry.frontBackBias` | face plus épaisse que la nuque | 0 | 0 | 3.52 | profil |
| `asymmetry.localVariation` | irrégularités locales | 3.99 | 1.38 | 1.21 | face |
| `asymmetry.seed` | graine (variation 1) | 4.62 | 2.93 | 2.15 | face |
| `musculature.trapezius` | trapèzes volumineux | 6.7 | 2.27 | 0.5 | face |
| `musculature.separation` | sillons musculaires marqués | 3.65 | 0 | 0 | face |
| `musculature.tendonVisibility` | tendons visibles | 1.71 | 0 | 0 | face |
| `musculature.tension` | cou tendu | 8.8 | 1.28 | 0.87 | face |
| `softTissue.foldDepth` | plis profonds | 4.51 | 0 | 0 | face |
| `softTissue.foldDistribution` | plis sur toute la longueur | 8.12 | 0 | 0 | face |
| `softTissue.dewlap` | fanon | 11.74 | 0 | 0 | face |
| `reliefs.larynx` | larynx forcé | 1.73 | 0 | 0 | face |
| `reliefs.hyoid` | hyoïde forcé | 1.07 | 0 | 0 | face |
| `reliefs.trachea` | trachée forcée | 2.23 | 0 | 0 | face |
| `reliefs.vessels` | jugulaire forcée | 2.12 | 0 | 0 | face |
| `reliefs.clavicle` | clavicules forcées | 1.21 | 0 | 0 | face |
| `species` | dragon (sans larynx ni SCM) | 7.45 | 0 | 0 | face |
| `style.mode` | mode caricature | 20.13 | 0.6 | 0.44 | face |
| `style.exaggeration` | exagération 1 | 29.25 | 1.01 | 0.8 | face |
| `style.simplification` | simplification 1 | 15.57 | 0 | 0 | face |
| `style.angularity` | facettes (angularité 1) | 5.5 | 0 | 0 | face |
| `style.silhouettePriority` | silhouette prioritaire | 12.42 | 0 | 0 | face |
| `modifiers.age` | âge avancé | 3.13 | 0 | 0 | face |
| `modifiers.mass` | corpulence maximale | 28.39 | 5.27 | 3.55 | face |
| `pose.headTranslate` | tête avancée | 8.3 | 0 | 17.03 | face |
| `pose.compression` | compression axiale | 47.63 | 1.9 | 1.5 | face |
| `pose.stretch` | étirement | 27.27 | 1.58 | 1.25 | face |
| `pose.twistShare` | part de rotation suivie (lacet 70°) | 0 | 1.83 | 1.9 | silhouette |
| `pose.tissueLag` | inertie du fanon et de l'écharpe | 8.96 | 0 | 0 | face |
| `pose.bodyLanguage` | expression « honte » | 24.42 | 0.71 | 8.92 | face |
| `pose.bodyLanguageAmount` | intensité de l'expression | 24.42 | 0.71 | 8.92 | face |
| `strategies` | stratégie « chain » (honte) | 1.21 | 0 | 2.77 | face |
| `operators.length_warp` | opérateur length_warp | 2.74 | 0 | 0 | face |
| `operators.width_profile_warp` | opérateur width_profile_warp | 28.66 | 10.22 | 0 | face |
| `operators.depth_profile_warp` | opérateur depth_profile_warp | 0 | 0 | 8.68 | profil |
| `operators.centerline_bend` | opérateur centerline_bend | 50.66 | 18.04 | 0 | face |
| `operators.local_bulge` | opérateur local_bulge | 10.23 | 8.51 | 7.24 | face |
| `operators.local_compression` | opérateur local_compression | 17.28 | 5.11 | 4.34 | face |
| `operators.asymmetric_deformation` | opérateur asymmetric_deformation | 28.85 | 9.36 | 0 | face |
| `operators.muscle_exaggeration` | opérateur muscle_exaggeration | 2.85 | 1.99 | 0 | face |
| `operators.fold_amplification` | opérateur fold_amplification | 1.56 | 0 | 0 | face |
| `operators.silhouette_simplification` | opérateur silhouette_simplification | 9.22 | 0.03 | 0.01 | face |
| `operators.topology_extension` | opérateur topology_extension | 1.17 | 0.9 | 0.76 | face |
| `operators.surface_ripple` | opérateur surface_ripple | 1.98 | 0.93 | 0 | face |
| `surface.pattern` | écailles | 18.69 | 0 | 0 | face |
| `surface.layout` | spirale vs rangées | 5.24 | 0 | 0 | face |
| `surface.size` | éléments ×3 | 4.92 | 0 | 0 | face |
| `surface.density` | densité 1 vs 0 | 4.45 | 0 | 0 | face |
| `surface.overlap` | imbrication 1 vs 0 | 5.26 | 0 | 0 | face |
| `surface.variation` | variation 1 vs 0 | 19.27 | 0 | 0 | face |
| `surface.smoothThroat` | gorge lisse | 16.11 | 0 | 0 | face |
| `surface.skinTension` | peau tendue | 12.05 | 0 | 0 | face |
| `surface.elementColor` | couleur propre des éléments | 74.61 | 0 | 0 | face |
| `attachments` | collier + crête | 13.44 | 0.64 | 0.54 | face |
