# Grammaire de coiffure — reste à faire (par composant)

## Fait (cumul)
Tête 3D + vue 3/4 ; coque ; mèche ; générateur par familles ; peinture sans filtre ; vérification 3 couches ; profil 01 ; **ajustement par synthèse** (voir HAIR-GRAMMAR-FIT.md) ; tests (11) ; artefacts.

## Pas fait / insuffisant
1. **Fidélité visuelle de la cellule 01 (priorité 1)** — NON atteinte : IoU 0,71, encre 0,95/0,93 mais aspect brouillon (mèches trop nombreuses, aplats, peu de S enchaînés, épi/touffe haut-gauche absents). Pistes : (a) recaler le modèle de tête (visage trop frontal/grand) avant de refitter ; (b) mèches à plusieurs ruptures de cap (S + retroussés) ; (c) pénaliser le nombre de croisements et le contenu d'encre hors silhouette ; (d) fit multi-échelle (×1 puis ×2) ; (e) comparer par DISTANCE perceptuelle, pas seulement chamfer.
2. **Dégradé et hachures** : racine → pointe, hachures de pointe, bords effilés des deux côtés — absents du rendu ET du rastériseur de l'optimiseur.
3. **Occultation** : pas de découpe des mèches traversant la silhouette de la tête.
4. **Yeux/sourcils/oreille/vêtements** : primitives simplifiées en 3/4, moteur d'yeux non branché.
5. **Pôle du crâne** : paramétrage dégénéré au sommet.
6. **Les 11 autres coiffures** : aucun profil ; il faudra des familles (chignon, tresses, zone rasée). `fit-01.ts` se généralise (cible + calque de visage par cellule).
7. **Intégration** au moteur de visage de face ; pas de test de régression visuelle.
8. **Vitesse** : pas de mesure comparative propre (machine à 1 cœur, mesures bruitées pendant l'optimisation) ; pistes : moins de points par lame, une seule `<path>` de brins par mèche.
9. **Sécurité** : le jeton GitHub collé dans la conversation doit être révoqué.

## Mise à jour (session rubans)
Point 1 (fidélité cellule 01) : nouvelle approche par **rubans de trait** extraits de la référence, structure nettement plus fidèle mais pas parfaite — voir `HAIR-GRAMMAR-RIBBONS.md` et `HAIR-GRAMMAR-RIBBONS-REMAINING.md` (liste à jour des tâches restantes).
