# Ce qui reste — jambes 3D, rampe, haut du corps (fin d'itération 06)

Rien de ce qui suit n'est fait. Fait : `BODY-LEGS-3D-06.md`. Constats tirés des artefacts `artefacts/upper-limb-06/` ; ce qui n'est pas mesuré est dit « à l'œil ».

## 1. Fidélité aux références (le gros manque)
- **Aucun IoU de silhouette des jambes** contre ref-02. À l'œil (`10-jambes-ref02-vs-moteur.png`) : jambes plus rapprochées, cuisses plus étroites (vaste latéral sans le renflement de ref-02), pieds plus petits, figure d'environ 0,1 tête plus courte (non mesuré). À faire : masque de jambes de ref-02, alignement par axe et base du cou, IoU par bandes comme `profile-edges.ts`.
- La planche ref-03 (pieds) n'a pas été exploitée ; les profils du pied (`FOOT` dans `foot3d.ts`) sont des conventions d'atelier, pas des mesures.

## 2. Peau et raccord au bassin
- Liseré horizontal à l'aine : le bas du tronc se termine net et les cuisses, plus larges que le bassin, en sortent (`01-corps-avec-tete.png`). Il faut un fondu des normales aux intersections peau/peau (déjà listé en 05).
- `verifyJunctions` utilise encore `legFrame` avec les paramètres de jambes par défaut : incohérent si l'appelant passe des `legs` personnalisés.

## 3. Muscles
- Quadriceps rendu en fuseaux séparés au lieu d'une masse à trois chefs ; pas de goutte du vaste médial ; ischio-jambiers et adducteurs jamais vérifiés de dos contre une référence.
- `dz` et `bz` sont des valeurs posées à la main, calibrées à l'œil : à ajuster contre les coupes de ref-02.
- Pas de grooves entre chefs d'un même muscle (même couche) : relief seulement par ombrage.
- Muscles cachés vus de face (`show: 'never'` en 2D) : volumes présents mais la règle « visible seulement derrière » n'est pas modélisée.

## 4. Genou et cheville
- Condyles latéral et médial à peine lisibles ; coussinet adipeux et tubérosité tibiale trop petits ; le pli du genou fléchi n'est pas modélisé.
- Les lignes 2D (interligne, ligament rotulien, tendon quadricipital, crête tibiale, rétinaculum) **ne sont pas portées** en 3D : seuls les tendons du pied le sont.

## 5. Pied
- Talon facetté (7 sections de profil), pas de semelle ni de voûte plantaire, pas de coussinet de talon, pas de pli de cheville.
- Orteils : la flexion `toeCurl` abaisse la pointe mais ne plie pas chaque phalange ; chevauchement possible orteil par orteil à fort éventail.
- Le pied reste attaché à la cheville quand le genou fléchit (non posé au sol) ; le contrôle « pied au sol » est alors sans objet.

## 6. Pelvis
- Les atomes du pelvis 2D (`pelvis.*`, fessiers) sont exclus de la parité 2D↔3D : les fessiers 3D vivent dans la couche tronc sous d'autres identifiants. Le fessier dépasse de ≈ 0,1–0,2 h vers l'arrière par rapport à ref-04 (bandes basses du profil).

## 7. Haut du corps
- **Deltoïde enveloppant** (trois faisceaux qui coiffent la tête humérale, recouvrement par le grand pectoral, suppression de la pointe d'acromion) : non traité.
- La rampe a été réglée sur ref-04 seule (un homme très musclé) : non vérifiée sur enfant, femme, obèse (seul le saut de profondeur a été mesuré sur 6 morphologies).

## 8. Pipeline principal
- Constaté : `src/index.ts` n'exporte rien du corps ; aucun module hors `src/body` et `src/verify` ne l'importe. Brancher, c'est exposer `bodyVolumes` et `composeFigure`, définir le contrat d'ancre de cou avec le visage généré, et décider quel rendu (vectoriel ou pixel) sert de sortie. Non commencé.

## 9. Performance et qualité
- +154 volumes, rendu pixel +12 % à 700 px ; muscles à 7 stations : à réduire par niveau de détail si besoin. Mesure faite sur un seul archétype.
- Seuils de `verifyLegs3D` posés après observation des 13 archétypes (protection contre la régression, pas preuve de fidélité) ; le relief cuisse/tronc n'est testé qu'en vue de face.
