# Bas du corps — ce qui reste à faire (par composant)

**Temps de génération** : non amélioré. Jambes = +~40 % de chemins SVG. Pistes mesurables : fusionner les muscles `level 2` d'un même ton en un `<path>` ; ne pas émettre les atomes `occluded` ni les lignes invisibles aux paliers bas ; dégradé unique par côté ; arrondir les coordonnées à 0,1 px ; mesurer avant/après via `scripts/artefacts-lower.ts`.

| Composant | Reste |
|---|---|
| pelvis | fourche aplatie (pas d'arrondi inguinal) ; taille féminine trop faible vs ref-01 ; fessiers de dos et de profil non rendus |
| thigh | contraste des muscles trop faible (aplat) : ajouter ombres de forme par muscle ; bandelette ilio-tibiale discrète |
| knee | patella et condyles = repères simples ; pas de déformation à la flexion (seulement raccourcissement) |
| shin | gastrocnémien vu seulement par ses bords ; pas de tendon d'Achille (face postérieure) |
| foot | longueur vue en raccourci seulement ; pas d'arche ni de talon ; pas de vue de profil ; phalanges cachées non vérifiées visuellement |
| tous | vue de dos et de profil ; rotation 3D ; âge dans le visage ; peau (rides, veines) ; pose assise/marche ; comparaison pixel à pixel aux références |
| tiers | seuils `min` posés à la main d'après ref-02/04, non calibrés sur une mesure |
