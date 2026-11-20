# Moteur d'oreille — ce qui n'est PAS fait (par composant)

Rien ici n'est caché : chaque ligne est un manque réel de cette session.

| Composant | Fait | Reste à faire |
|---|---|---|
| Visage 3/4 et profil complet | oreille en 4 vues (support de lecture : morceau de tête) | rotation du **visage entier** (crâne, joue, mâchoire) ; la vue de face seule est un visage complet |
| Contour | 7 segments mesurables, angularité, asymétrie interne | contrôles directs par segment dans le schéma (aujourd'hui via les axes) ; segments en courbes de Bézier éditables |
| Anthélix | corps, branches, jonction, sillons | 02B/02C : courbes libres par branche (aujourd'hui longueur + écart) |
| Conque | cymba, cavum, conduit ; **rebord et paroi distincts (`concha.wall`)** | rebord organique lissé ; profondeur variable en 3D réelle ; volume, inclinaison, transition (`TODO EAR SYSTEM.md` EAR-05) |
| Lobule | longueur, largeur, attache, pendance ; **fendu (`cleft`), étiré avec trou (`stretch`)** | bijou « gauge » dans le trou ; déformation de la joue ; volume du lobule |
| Hélix | épaisseur variable, enroulement ; **Darwin (`darwin`), replié (`fold`)** | Darwin à site variable ; occultation calculée sous le pli ; torsion et continuité (EAR-01) |
| Extensions | six types, compatibilité vérifiée | raccord des extensions au contour par fusion de bords (aujourd'hui superposition) ; excroissances hors boîte non normalisées |
| Familles | 7 profils + mélange | familles asymétriques par oreille ; oreilles mobiles / articulées (animation) |
| Matériaux | 7 | écailles dépendantes de la courbure ; cristal à facettes réelles ; subsurface calculée (aujourd'hui liseré) |
| Éclairage | carte de hauteur + filtre ; croissants | ombres portées de l'oreille sur la tête ; occlusion ambiante ; lumière colorée de contour par structure |
| Cheveux | visibilité mesurée, silhouette partagée | mèches passant devant/derrière un hélix précis ; cheveux collés à la peau |
| Bijoux | 5 points d'attache, gravité, collision cou | physique du pendentif ; collision avec cheveux ; bijoux multi-pièces |
| Tirage aléatoire | **branché en option** : `structure: { draw: { ears: true } }` ou un caractère du compositeur (`'natural' | 'caricature' | 'fantasy'`, `docs/EAR-COMPOSER.md`) (famille humaine 86 %, elfe 9 %, félin 5 % + morphologie modérée, flux dérivé `seed ^ EAR_SALT`, graines existantes inchangées) | activé par défaut dans les campagnes ; familles B/C (draconique, alien…) ; corrélation oreille ↔ crâne/mâchoire |
| Hauteur de l'oreille | **corrigé** : racine de l'hélix sur la ligne des yeux, bas du lobule sur la **base du nez** (anatomie réelle) ; ancienne consigne « bouche » conservée via `anchors.lobuleLine = 'mouth'` | distribution de hauteurs par famille mesurée sur 1 000 visages (aujourd'hui vérifiée par les bornes [0,20 H ; 0,50 H]) |
| Zones | 7 zones, bornes, corrections | bornes de la zone du menton prioritaires sur le philtrum ; zone du cou (non commencées cette session) |
| Paramètres sans effet | **audités et câblés** : scapha.width, softness, fidelity, glow, scale, translucency, detail (`docs/EAR-VISIBILITY-AUDIT.md`) | restent faibles à l'échelle de la tête : cymba, crus, antitragus (orientation), pointe du tragus ; `pitchDeg` invisible de face par construction |
| Détails de surface | **SURF-05** : pigmentation, plis, pores, vaisseaux, pilosité (`docs/EAR-NEW-ANATOMY.md`) | pores sous éclairage, vaisseaux ramifiés, pilosité reliée à la pilosité du visage |
| Vérification | trois couches calibrées sur 360 oreilles composées | avertissements de cassure de contour sur pointes (fantasy) ; tête 3D de profil non vérifiée pour les oreilles composées |
