# Membre supérieur — ce qui reste après l'itération 02 (par composant)

**Bilan honnête** : l'épaule a la bonne pente et un coin à la bonne hauteur, le deltoïde est une masse et la vérification chiffre ces points. Le résultat n'est **pas** « parfait sur tous les axes » : voir les écarts mesurés ci-dessous.

## Fidélité à `ref-02` / `ref-04`
- Coin du deltoïde : la paroi externe n'est atteinte qu'à y = 0,79 h dans `ref-02` ; le moteur l'atteint à 0,49 h (épaule encore trop haute et large dans sa partie supérieure). La peau du bras (`arm.env`) porte encore le contour à x = 1,08–1,16 h, 0,04–0,06 h trop haut.
- Largeur d'épaules `ref-02` : 0,91 × la référence en pose calibrée (0,90 en pose par défaut).
- Pose par défaut : bras trop rentrés (paroi externe de 1,40 h contre 1,60 h au milieu de l'avant-bras de `ref-02`) ; la fidélité n'est atteinte qu'avec la pose calibrée.
- Longueurs : l'avant-bras canon (1,15 h) colle à `ref-04` (1,18 h) mais pas à `ref-02` (0,78 h, stylisée) ; la flexion de 23° compense. Pas d'axe moteur permettant ±30 % de longueur d'avant-bras.
- `ref-04` de profil : masque produit mais **jamais comparé** (le moteur n'est mesuré que de face). `ref-01`, `ref-05-mains` : aucune mesure en pixels.
- Aucune mesure de couleur ni d'ombrage par pixel contre la référence ; seule la silhouette est mesurée.
- Bras droit de `ref-04` tronqué par le cadre : envergure mesurée sur une moitié.

## Géométrie
- **Trapèze** : toujours 3 parties × 2 côtés (marquées « une masse » : pas de rainure entre elles), pas une nappe unique en losange ; vu de face, seule sa silhouette compte, le plateau du tronc au-dessus des pectoraux reste plat.
- **Deltoïde** : section d'ellipse décalée, pas de vrai croissant enveloppant ; sillons = brins, pas de séparation des fibres en trois faisceaux ; couture visible entre la calotte du deltoïde et le tronc (bord interne).
- **Clavicule** : tube régulier posé sur la peau, pas de relief osseux.
- Coude : couture d'ombrage encore visible ; muscles du bras en fuseaux ; tendons et veines rectilignes ; bas du tronc coupé net.
- Gros plan de profil des artefacts (`03`) : cadrage identique avant/après non garanti (bornes différentes).

## Mains et doigts
- Comparaison à `ref-05-mains` non faite ; pas de plis, d'articulations DIP, de tendons fléchisseurs, d'ongles texturés.

## Rendu par pixel
- ≈ 2,4 s par vue de 900 px, sans cache ; PNG incrusté lourd ; pas de perspective, de diffusion sous-cutanée ni d'ombres portées entre volumes.
- Masquage « derrière la peau » par marge de profondeur : peut cacher un muscle profond voulu en écorché.

## Vérification
- Les huit contrôles de l'épaule ne sont calculés que pour la vue de face ; rien sur les vues de profil/dos.
- Seuils de pente et de chute : bandes larges tirées de DEUX références ; pas de population.
- Style : pas de contrôle de fidélité de ton à la référence.

## Prochaine étape la plus rentable
Abaisser le coin du deltoïde (profil supérieur plus étroit, paroi externe verticale à 1,2 h) puis comparer le profil de `ref-04` au moteur de profil.
