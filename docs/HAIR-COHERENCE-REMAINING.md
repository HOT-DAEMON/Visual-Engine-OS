# Cohérence cheveux ↔ tête — reste à faire et limites (par composant)

Fait : `HAIR-COHERENCE.md`. Suite (remplissage de la coque, couche `hair-form`) : `HAIR-FORM.md`, ses limites : `HAIR-FORM-REMAINING.md`. Chaque ligne est une limite mesurée ou constatée ; rien n'est caché.

## Portée (`reach.ts`)
1. **Mèches de corps des coiffures attachées** (queue, chignon, tresses) : non bornées par conception (elles convergent vers l'attache, qui peut être haute). Contrôlées seulement par les contrôles d'attache. La longueur et le volume de la queue ne sont pas contrôlés en largeur.
2. MAJ : la **frange** est désormais contrôlée au polygone (`fringe-reach-bound`, ≤ `REACH.side` + 0,05 W ; max mesuré 0,161 W). Les **mèches de joue** restent bornées en axe seulement (`HAIR-SKULL-REMAINING.md` 6).
3. **Cheveux simulés (Verlet)** : hors `bounded` (leur drapé est résolu par le collisionneur).
4. Tolérance du polygone 0,02 W : posée sur la mesure (`guard.fit` ré-écarte ≤ 0,015 W après la borne), pas sur une règle anatomique.
5. `REACH` posé à la main (afro 0,3 W / 0,32 H). Les avertissements restent des avertissements.

## Attaches (`tie.ts`)
6. Chignon bas ou de nuque : invisible de face ; non jugé visuellement.
7. Tresses : portées par `part: 'braid'` mais sans contrôle d'éventail ni de longueur propre.
8. Pas de 3D : l'attache n'est pas implantée sur le crâne de profil (`src/skull/`) ; tête tournante et profil ne lisent ni `TIE` ni `REACH`.

## Vent (`wind.ts`)
9. Les mèches déjà hors portée au repos ne sont pas contraintes (levier libre) : un vent fort peut déplacer une queue de 0,1+ W (assumé, contrôlé par `tail-spread-bound` + levier).
10. 2D de face ; pas de turbulence ni de rafale ; pas de couplage avec `sim/`.

## Vocabulaire et style (`vocab.ts`)
11. Vocabulaire binaire (cônes oui/non). `flow` et `wisp` sont bornés mais pas filtrés par coiffure.
12. Le tombé de la masse arrière (poids, ondulation) reste un rectangle arrondi (`HAIR-SKULL-REMAINING.md` 10). Le fondu ne s'adapte pas à un fond clair (11).
13. Le plancher de ton de racine 0,42 est posé sur le corpus ; pas de jugement sur la teinte (reflets, sous-couche teintée).

## Vérification (`hair-coherence.ts`)
14. Seuils posés sur corpus de 368 visages (0,02 ; 0,05 ; 0,78 ; 0,42 ; 0,25) ; pas de référence externe ni de visage dessiné par un illustrateur.
15. `crown-covered` ne juge que le dessus du crâne au-dessus de l'implantation locale : pas de contrôle du recouvrement de la nuque ni des tempes.
16. « Rapport OK » ≠ beauté : aucune mesure ne juge l'élégance d'une coupe. **Revue humaine nécessaire** sur `artefacts/hair-coherence/01a`, `01b`, `03`.
17. Les surcharges manuelles de paramètres (hors `hair:{}` de `hairFaceSpec`) ne passent pas par la cohérence de génération ; elles restent contrôlées par la vérification.

## Performance
18. `conformReach` coûte (bissection par sommet) : géométrie `short` 55,6 → ≈ 76 ms, `afro` 72,9 → ≈ 95–104 ms par visage (bruit ±15 %), atténué par le cache du contour. Pistes non faites : pas de bissection quand le sommet est déjà dedans (déjà le cas) ; vectoriser `distOut` ; cache par mèche.

## Régression visuelle
19. MAJ : `npm run regress` relancé après la série `hair-form` : exit 0, 34 images `exact` ; elles ne contiennent aucune coiffure touchée. Aucune référence actualisée (décision d'équipe).

## Sécurité
20. Un jeton GitHub a été collé en clair dans la conversation (de nouveau lors de la série `hair-form`) : **à révoquer** (GitHub → Settings → Developer settings → Tokens). Il n'est écrit nulle part dans le dépôt.
