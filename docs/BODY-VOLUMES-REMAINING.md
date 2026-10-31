# Volumes 3D : ce qui reste (par composant)

**Bilan honnête** : la couche 3D fonctionne (caméra libre, volumes séparés, éclairage, vérification, 2388 tests verts), mais la **fidélité pixel par
pixel aux références n'est PAS atteinte** : `artefacts/body-volumes/09-comparaison-references.png` montre un relief beaucoup plus doux et moins riche que
les sculptures. Aucune mesure d'IoU de silhouette n'a été faite (références avec jambes et tête, nos volumes sans jambes).

## Transversal
- Pas de silhouette complète : **pas de membres inférieurs en 3D** (le module 2D `src/body/lower` n'a pas été porté), bassin coupé net au bas du tronc.
- Tête : le moteur de visage est 2D de face ; en vue tournée il n'y a **pas de tête** dans le corps (la tête de profil vient de `src/skull`, planche 08,
  non alignée automatiquement sur le cou 3D).
- Le point de vue est libre sur tout le tronc/bras ; la projection est orthographique (pas de perspective).
- Tri en profondeur « du peintre » par centre de volume + couche : approximatif quand deux volumes se croisent (ex. bras devant le tronc en profil).
- Relief : l'éclairage est par volume (dégradé de section au milieu du volume), pas par pixel : les creux entre muscles viennent des ombres de contact
  et des fibres, pas d'une occlusion ambiante calculée. Pas de reflets environnementaux ni de diffusion sous-cutanée réelle.
- Aucune vérification par IoU de silhouette contre les images de référence ; la couche « style » est mesurée sur le SVG (couleurs, traits), pas sur des pixels.

## Par composant
- **Trapèze / rhomboïdes / infra-épineux** : présents ; rhomboïdes et infra-épineux ne se voient qu'en écorché (couches ≥ 5 retirées) ou chez les sujets secs.
- **Erecteurs du rachis** : 2 colonnes par côté (médiale, latérale) ; spinal/longissimus/ilio-costal non séparés en 3 ; pas de fascia thoraco-lombaire.
- **Fessiers** : grand et moyen ; pas de petit fessier, pas de pli sous-fessier (il dépend des cuisses).
- **Courbures** : la cervicale n'est lisible que sur le cou 3D (court) ; angles mesurés, pas d'inclinaison du bassin indépendante (liée au contrapposto).
- **Thorax / seins** : profondeur et projection paramétriques ; pas de cage costale osseuse, pas de sternum visible, seins sans ptôse asymétrique.
- **Ventre** : une bosse gaussienne unique (pas de pli, pas de graisse sus-ombilicale distincte).
- **Pectoraux / deltoïdes** : fibres en éventail sans striations fines séparées par des faisceaux visibles ; liseré clair + sillon sombre seulement.
- **Abdominaux** : 4 × 2 blocs irréguliers ; pas de bandes tendineuses qui se raccordent, ni de coupe oblique des blocs inférieurs.
- **Intercostaux, V inguinal, crête iliaque** : tracés au trait ou en petit relief ; visibles surtout chez les sujets secs.
- **Contour latéral dentelé–oblique–grand dorsal** : trois volumes qui s'imbriquent, mais pas de dentelure continue du contour.
- **Clavicule / cou / pomme d'Adam** : présents ; trapèze qui s'évase mais pas de fosse sus-claviculaire marquée.
- **Bras** : biceps/triceps/brachial/brachio-radial/fléchisseurs/extenseurs ; pas de rond pronateur, long supinateur détaillé, anconé.
- **Tendons et veines** : 3 + 2 tubes simples ; ils peuvent dépasser légèrement du contour en vue latérale (traits fins visibles hors silhouette).
- **Doigts** : relâchés, variés, coussinets ; pas de plis cutanés, d'articulations DIP en sphère, de tendons fléchisseurs, d'ongles texturés.
- **Sphères d'articulation** : épaule, coude, poignet, C7, T12, hanches, MCP, PIP ; pas de DIP, genou, cheville, vertèbres individuelles.
- **Âge / sexe / morphologie** : la vérification passe sur 17 archétypes mais la lisibilité visuelle bébé → vieux n'a pas été évaluée en détail.
- **Temps de génération** : voir `BODY-VOLUMES-PERF.md` (amélioré seulement par cache et mode `fast`).
