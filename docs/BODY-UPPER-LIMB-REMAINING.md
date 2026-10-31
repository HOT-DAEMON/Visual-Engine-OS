# Membre supérieur : ce qui reste (par composant)

**Bilan honnête** : la silhouette est plus proche (IoU 0,724 → 0,766, envergure 0,91 → 0,98) et le relief est calculé par pixel, mais le résultat **n'est pas « parfait sur tous les axes »**. `artefacts/upper-limb/04-reference-vs-moteur.png` montre que les formes musculaires de `ref-02` (masses lisses, deltoïdes et pectoraux volumineux, trapèze en pente continue) ne sont pas reproduites : le moteur dessine des muscles séparés qui ressemblent à des pièces posées.

## Fidélité à la référence
- Un seul masque exploitable (`ref-02`, face). `ref-04` (profil + face écorché) : seuillage à refaire (segmentation gris/gris). `ref-01`, `ref-05-mains` : aucune mesure en pixels.
- IoU plafonnée vers 0,77 : épaules encore trop hautes et carrées (zones vertes de `03b`), avant-bras trop proches du corps (rouge sur le bord externe), mains trop rentrées.
- Pas de mesure de couleur ni de comparaison d'ombrage par pixel avec la référence (seule la silhouette est mesurée).
- La région comparée (tronc jusqu'à y = 365) est une convention ; le bassin n'est pas comparé.

## Géométrie
- **Trapèze** : pas de pente continue cou → acromion ; la saillie visible vient de la clavicule et du deltoïde.
- **Deltoïde** : trois chefs en fuseaux séparés, pas de V deltoïdien ni de masse unique.
- **Coude** : raccord de rayon corrigé mais **ligne de couture encore visible** en ombrage (normales de deux enveloppes qui se rejoignent à angle).
- Muscles du bras : fuseaux elliptiques à bouts arrondis ; pas de rond pronateur, anconé, long supinateur détaillé, ni de fascia.
- Tendons et veines : tubes rectilignes, simplement coupés hors de la peau.
- Bas du tronc : coupé net, deux moignons de cuisses visibles sous le tronc (le bas du corps n'est pas porté en 3D).

## Mains et doigts
- Comparaison à `ref-05-mains` : non faite numériquement. Pas de plis cutanés, d'articulations DIP, de tendons fléchisseurs, d'ongles texturés.

## Rendu par pixel
- 2,4 s par vue de 900 px, sans cache ni parallélisme ; PNG incrusté lourd (≈ 400 Ko d'SVG).
- Pas de projection en perspective, pas de diffusion sous-cutanée réelle, pas d'ombres portées entre volumes (seulement AO par horizon et rainures).
- Masquage « derrière la peau » par marge de profondeur (0,05 h) : peut cacher un muscle profond voulu en écorché (`hideFromLayer`).
- Fibres : sinusoïde en θ, pas de faisceaux individuels.

## Vérification
- Les contrôles de style sont des seuils généraux ; pas de contrôle de fidélité de ton à la référence.
- Contrôles d'anatomie limités à deux rapports (épaules/taille, avant-bras/bras) ; rien sur les insertions musculaires visibles.
