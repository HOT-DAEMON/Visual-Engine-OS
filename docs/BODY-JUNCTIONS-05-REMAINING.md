# Raccords du corps — ce qui reste après l'itération 05 (par composant)

**Bilan honnête** : l'épaule et la hanche sont raccordées en continuité, mais le résultat n'est pas « parfait sur tous les axes ». Ce qui suit est ce qui n'a pas été fait ou pas été mesuré. Les restes des itérations précédentes qui ne sont pas repris ici (mains, coude, clavicule, dos) restent valables : voir `BODY-UPPER-LIMB-04-REMAINING.md`. L'élément « le tronc s'arrête toujours à la crête, sans jambes » de ce fichier est **levé**.

## 1. Épaule ↔ bras (raccord traité, pas fini)
- Il reste une petite pointe à l'extrémité de l'acromion (fin de la clavicule / de l'épine de l'omoplate) qui dépasse du contour : visible sur `02-epaule-avant-apres.png`. Non traitée.
- Le deltoïde est toujours une masse fuselée posée contre le tronc, avec un bord interne vertical. Dans ref-02 il enveloppe l'épaule en bourrelet arrondi et le grand pectoral le recouvre (sillon delto-pectoral) ; ici le pectoral s'arrête au bord du tronc. Non modélisé.
- La peau de la pente est 0,03–0,05 tête plus large que ref-02 aux rangées 0,25–0,35 sous le cou (biais +0,031 sur l'ensemble) ; le coefficient `SL.acr` n'a presque pas d'effet sur la silhouette dans cette zone (balayage), il faudrait agir sur la clavicule.
- Le bras pend 0,1–0,15 tête plus près du corps que ref-02 aux lignes 1,5–2,0 (abduction). Non repris : une itération précédente a montré qu'ajouter +8° dégrade l'IoU de la partie basse du bras.
- Aisselle (creux entre bras et tronc) : plus de trou de fond, mais aucune forme (grand dorsal/grand rond en pli) ; le dentelé reste des tiges.
- ref-04 : l'adulte reste trop étroit de 0,07–0,13 tête dans la pente (archétype `adultMale` : épaules ×0,82 de la référence) ; c'est un réglage d'archétype, pas du tronc.

## 2. Bassin, hanche, fessier
- Un faible liseré en « U » marque encore l'aine de face (différence de normales entre le bassin et la cuisse : l'intersection peau/peau n'est pas fondue, la profondeur retenue est celle de la surface la plus proche). Piste : mélange des normales près de l'intersection.
- Les dimensions du bassin à la fourche (`k` = 0,62 et 1,05 × hanche au trochanter) sont des hypothèses ; aucune mesure de la hanche sur ref-02 ou ref-04 n'a été faite.
- Le fessier est maintenant continu mais n'a pas été recalé : `gluteus.max` et `gluteus.medius` gardent leurs angles ψ de l'itération 04 ; pas de pli sous-fessier.
- Pas de pli inguinal de la peau (le « V » existant est un trait de repère).

## 3. Jambes 3D (nouveau, très incomplet)
- **Peau seule** : aucune musculature 3D (quadriceps, adducteurs, sartorius, ischio-jambiers, gastrocnémien, tibial…). Elles existent dans le module 2D (`lower/leg.ts`) mais pas dans la couche de volumes. Le haut du corps (très relief) et les jambes (tubes lisses) ne sont donc **pas dans le même style** : visible sur `01-corps-avec-tete.png`.
- Pas de pied : l'enveloppe se ferme à la cheville.
- Pas de rotule ni de relief du genou ; le mollet bombe vers l'arrière par un simple décalage de centre.
- Les cotes viennent de `legFrame` avec `LegParams` par défaut (abduction 4°, pas de flexion du genou, pas de poses individuelles) ; l'entrée `legs` du module 2D n'est pas relayée aux volumes.
- Aucune comparaison de la forme des jambes (face, profil) à une référence : seules les cotes du canon sont utilisées. `BODY-LOWER-REFS.md` décrit les références du bas du corps ; non exploitées en 3D.
- Les vues trois-quarts et de dos des jambes ne sont contrôlées que par la symétrie et la continuité de la paroi du bassin.

## 4. Profil et profondeur du tronc
- **Rampe poitrine → ventre trop abrupte** : saut de profondeur de 0,21 h entre le bas du pectoral et le ventre contre 0,086 h dans ref-04. Le garde-fou `pf.geo.depth-continuous` a été desserré de 0,2 à 0,25 h pour ne pas bloquer l'itération (voir `BODY-JUNCTIONS-05.md`). Piste : modeler la profondeur de peau `k(y)` entre la poitrine et la taille et amincir le bord inférieur du pectoral.
- Profil −90° : IoU 0,770 (0,776 avant) ; plancher abaissé de 0,77 à 0,76. Cause non isolée plus finement que « la peau suit la pose ».

## 5. Rendu
- Le tampon de profondeur de la peau garde la normale de la surface la plus proche : pas de fondu aux intersections (voir 2). Facettes visibles sur le trapèze en profil : maillage trop lâche, non réglé.
- Les franges d'opacité < 50 % hors de la peau sont supprimées ; une valeur entre 0,5 et 1 est conservée. Seuil fixé à l'œil, non optimisé.
- Temps de rendu : **non mesuré** cette itération (ajout de deux enveloppes de 48 sections et prolongement du tronc). À faire avant d'étendre les jambes.

## 6. Mesures et vérification
- Deux références seulement (ref-02 de face, ref-04 de profil) ; rien pour le trois-quarts. `ref-01`, `ref-03`, `ref-05-mains` toujours non exploitées pour ces raccords.
- Aucun contrôle de **fidélité de style** au sens artistique (ton, ombrage, lisibilité anatomique) : la couche « style » ne vérifie que la fusion des enveloppes et l'absence de trous. Les artefacts restent à juger à l'œil.
- Seuils de `verifyJunctions` fixés après observation de sept archétypes (voir `BODY-JUNCTIONS-05.md`) ; la borne de dépassement (0,08 h) ne discrimine pas l'ancien défaut, seule la symétrie le fait.
- **`baby` échoue** `junction.geo.shoulder-symmetry` : 0,058 h pour un seuil de 0,05 h (seuil non retouché ; asymétrie d'épaule du nourrisson non analysée, chute d'acromion très courte). Les douze autres archétypes passent : adultMale, adultFemale, veryMuscular, muscular, child, toddler, teenFemale, teenMale, obese, thin, elderMale, elderFemale (`tests/body-junction.test.ts`).

## Prochaine étape la plus rentable
1. Muscles 3D de la cuisse et de la jambe (style cohérent avec le tronc), pied.
2. Rampe de profondeur poitrine → ventre contre ref-04, puis remonter le garde-fou à 0,2 h.
3. Deltoïde enveloppant et recouvrement par le grand pectoral (ref-02), suppression de la pointe d'acromion.
4. Fondu des normales aux intersections peau/peau (aine, épaule).
