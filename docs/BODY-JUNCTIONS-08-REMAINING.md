# Ce qui reste après l'itération 08 (par composant)

Bilan honnête : trois changements gardés (`BODY-JUNCTIONS-08.md`), un coût assumé (dos moins détaillé chez les sujets musclés). La tâche « chef-d'œuvre » n'est pas terminée. Les points des itérations précédentes non repris ici restent ouverts (`BODY-UPPER-LIMB-04-REMAINING.md`, `BODY-JUNCTIONS-07-REMAINING.md`). Chiffres = écarts mesurés ; ce qui n'a pas été mesuré est dit tel quel.

## Deltoïde enveloppant et pectoral — partiellement fait
- **Fait** : insertion du pectoral par-dessus le deltoïde (tendon plat), sillon delto-pectoral visible, 3 contrôles + négatifs.
- **Non fait** : le deltoïde lui-même est inchangé (masse fuselée, bord interne vertical) ; pas de chef antérieur enveloppant la clavicule, pas de fibres du deltoïde qui s'insèrent sous le pectoral.
- Un seul volume d'insertion par côté : pas de distinction entre faisceaux claviculaire et sterno-costal à l'insertion (torsion du tendon : « pli en U » non modélisé).
- Le sillon n'est vu et mesuré que **de face à 460 px**. Rien de profil, de 3/4 avant ni de bras levé : le bras ne bouge pas dans ces rendus, l'insertion n'a pas été testée en abduction/élévation.
- Seuil de style (≥ 40 pixels par côté) calé sur 11 archétypes et un seul éclairage ; pas de test avec une autre direction de lumière.
- `baby`, `toddler` : insertion invisible (comme le sterno-costal) ; le contrôle de style est « non applicable », donc **non prouvé visuellement** pour eux. Géométrie et anatomie sont contrôlées.
- `obese` : sillon très faible (0,24 % du corps), cohérent avec le muscle sous la graisse mais pas validé par une référence.

## Haut du dos et omoplate — fait avec un coût, reste beaucoup
- **Fait** : champ de relief (lame, épine, bord médial, angle inférieur, infra-épineux, grand rond, érecteurs), 10 contrôles + négatifs, silhouette intacte, paramètres ordonnés par musculature.
- **Coût assumé** : trapèze moyen/inférieur, rhomboïde, infra-épineux, grand rond et érecteurs ne sont plus **dessinés** (ils restent dans les données). Chez `adultMale`/`veryMuscular` le dos est plus propre mais **moins riche** : le losange du trapèze inférieur et les rhomboïdes ont disparu, et le relief ne les recrée pas (aucune forme « trapèze » dans le champ).
- **Grand dorsal toujours en sabres** (volumes à sections elliptiques, non repris) ; ils traversent maintenant une zone lisse et ressortent plus qu'avant.
- Petit crochet visible à l'extrémité basse de la gouttière médiale (bout de ligne + coin du contour de lame) : non corrigé. Lisible sur `03-dos-avant-apres.png`.
- Le relief est du **shading** : pas d'ombres portées ni d'occlusion qui réagissent au champ (la profondeur ne change pas). Les creux ne projettent rien.
- **Angle inférieur à ≈ T9 chez l'adulte** (8,7–9,3 vertèbres sous C7 ; anatomie T7–T8). Cause : la lame de l'itération 04 est ancrée sur l'acromion du cadre (`y.acr + 0,005 h`), qui est bas. Contrôlé dans T6–T9 (littérature) et **non corrigé** : le déplacer sans déplacer le volume caché `scapula` casserait la cohérence interne.
- L'épine monte de 0,86 vertèbre à gauche et 1,24 à droite (même sujet) : écart dû à la bascule du contrapposto ; la fourchette 0,5–1,6 est large. Pas de valeur de référence mesurée sur une photo.
- Pas de scapula mobile ni ailée : le champ ne suit ni l'abduction ni l'élévation du bras.
- Aucune comparaison à une référence de dos (ref-01 stylisée et féminine, voir 04-REMAINING) : la preuve est interne (cotes, symétrie, ordre par musculature), pas une mesure contre une photo.
- Style jugé **à l'œil sur 6 sujets** + contrôles de silhouette, de visibilité et de dureté d'arête ; pas de mesure de « convaincant » en soi. Le limiteur de pente (31°) rend le relief doux : il lit moins un sujet très sec qu'une vraie photo.
- Vues vérifiées : dos (180°) et un trois-quarts arrière (145°) à l'œil ; les contrôles automatiques ne s'exécutent que de dos à 460 px.
- Le relief n'agit que sur la peau du tronc (`id === 'trunk'`). Fesses, flancs, nuque et haut des bras n'ont pas de champ.
- Coût de rendu : ≈ +0,3 s de dos à 460 px, 0 de face. Les contrôles ajoutent 3 à 4 rendus (pectoral) + 2 (dos) par vérification : les suites de vérification sont plus lentes.

## Mains (ref-05) — non traité
- ref-05 non quantifiée ; aucune modification des mains dans cette itération.

## Archétype `baby`
- **Levé** : `junction.geo.shoulder-symmetry` passe (0,030 h compensé ; 0,058 h brut). Cause établie (bascule × pente raide), voir `BODY-JUNCTIONS-08.md` §1. C'est un changement de métrique : la géométrie n'a pas bougé.
- **Nouveau constat, préexistant** : `baby` échoue `back.ana.front-line-vertical` (ligne avant poitrine→crête à 9,0° pour une bande de ±8°) ; le dépôt de départ donne la même valeur (`toddler` : 5,2°). Non traité ; cause non étudiée (ventre du nourrisson ?).
- Le relief du dos de `baby`/`toddler` change encore 1,2 % de l'image malgré l'atténuation par l'adiposité : à vérifier visuellement (hmax 0,03 h).

## Images
- Les figures **avec tête** ne sont de face que : le moteur de visage est 2D et ne dessine pas l'arrière de la tête. Le turntable 3D de la tête (`scripts/head-turntable/`) n'a pas été intégré aux figures de dos et de 3/4 arrière.
- « Avant » = dépôt de départ rendu par les mêmes scripts ; un seul éclairage (azimut 305°, élévation 38°), un seul cadrage par vue.
- Planche 01 : 3 sujets avec tête (très musclé, adulte homme, adulte femme) ; `thin` et `obese` sont générés par le script mais ne figurent pas dans la planche.

## Vérification
- Seuils posés après mesure sur 13 archétypes : ils décrivent l'état actuel (utile contre la régression), pas une cible anatomique indépendante. Un seuil trop proche de la valeur observée peut échouer sur un nouvel archétype.
- `poseFreeAsymmetry` suppose une bascule au premier ordre et ignore l'effet de la torsion sur x ; non validé pour de fortes poses (`contrapposto.amount` > 0,3 non balayé).
- La suite **complète** du dépôt n'a pas été relancée. Lancées : `body-*`, `neck-*`, `pipeline-body`, `lower`, `pipeline-relief`, `relief-lit`, `relief-underview`, `anatomy-contract`, `figure-*` ; `body-*` et `figure-*` ont été relancées APRÈS le rebase sur l'amont. Non relancées après le rebase : `neck-*`, `lower`, `anatomy-contract` (vertes avant).
- Les empreintes figées de `figure-golden.json` ont été régénérées (voir `BODY-JUNCTIONS-08.md`) : le propriétaire doit valider ce changement de base de test.
- Les scripts de diagnostic de l'itération (cartes ASCII du champ, comparaison de dureté d'arête, mesures anatomiques) ne sont pas conservés dans le dépôt ; leurs valeurs sont dans `BODY-JUNCTIONS-08.md`.
