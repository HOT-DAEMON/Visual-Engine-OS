# Grammaire de coiffure — reste à faire (par composant)

## Fait
Tête 3D + vue 3/4 calée ; coque ; primitive de mèche ; générateur par familles et champ d'écoulement ; peinture d'encre sans filtre ; vérification géométrique/anatomique/style + IoU contre la référence ; profil 01 ; tests (7) ; artefacts ; pipeline rapide.

## Pas fait / insuffisant
1. **Fidélité de la cellule 01 (priorité 1)** — IoU de silhouette ≈ 0,53, pas « parfait ». À faire : recaler le volume (cheveux décalés à droite/bas, trop bas de ≈ 10 px) ; épi + touffe haut-gauche ; chaînes de S avec retroussés de pointe à plusieurs ruptures ; mèches moins régulières ; boucle d'optimisation automatique des paramètres de famille sur l'IoU (non écrite).
2. **Hachures et gris** : dégradé racine → pointe, hachures aux pointes, bandes de ton par mèche (l'original a des gris doux) — absents.
3. **Occultation** : couche d'une mèche décidée par sa normale moyenne ; pas de découpe des mèches qui traversent la silhouette de la tête (segments cachés/visibles).
4. **Yeux** : primitives 3/4 simplifiées dans `face3q.ts` ; le moteur d'yeux complet n'est pas branché sur la vue 3/4. Sourcils, oreille détaillée, vêtements (col, nœud papillon) non traités.
5. **Pôle du crâne** : le paramétrage (y, azimut) est dégénéré au sommet → mèches aplaties près de l'épi.
6. **Les 11 autres coiffures** : aucun profil écrit (volontairement, consigne : finir la 01 d'abord). Le générateur est prêt ; il faudra sans doute ajouter des familles (chignon, tresses/rangées, zone rasée).
7. **Intégration** : le module est autonome (`src/hair-grammar/`), non branché au moteur de visage de face (`src/face/hair`). Aucun test de régression visuelle (snapshot) ajouté.
8. **Mesure de vitesse comparative** : pas de mesure sur le même cas avec l'ancien moteur ; seules les médianes de ce module sont mesurées.
9. **Vue calée sur 6 repères** : le repère « œil lointain » est caché par les cheveux dans la référence (±4 px d'incertitude) ; lacet −46° vs ~35° estimé à l'œil non arbitré.
10. **Sécurité** : le jeton GitHub fourni dans la conversation doit être révoqué (voir la réponse).
