# Erreurs rencontrées — suite 7

1. **Mesure initiale non discriminante.** Première métrique (« inflexions » avec seuil 0,004 rad) identique sur visages signalés et non signalés : le défaut était
   *systémique* (30–80° de rotation à contre-sens partout), pas limité aux 13 visages. Leçon : mesurer sur tous avant de cibler.
2. **Corps de mandibule en S (3–5° résiduels).** Un corps forcé de partir *exactement* vers C ne peut pas être convexe. Corrigé : départ plus vertical que la corde.
3. **Rayon de pointe 0,003–0,007 W** pour les mentons très pointus : poignée du bas bornée par l'intersection des tangentes. Corrigé par réduction progressive de la part de rotation du corps.
4. **Plancher calculé avec l'abaissement de la mâchoire** : ouvrir la bouche changeait la largeur du menton (2 tests `face-deform`). Corrigé : plancher au repos.
5. **`chinWidth` par défaut sous le plancher** : tous les réglages de largeur étaient sans effet sur le visage par défaut (3 tests). Corrigé : défaut 0,35 et `flat` en fraction.
6. **Suite complète bloquée** : `vitest run` global sans sortie > 15 min (rendus lourds, 1 cœur). Contournement : un fichier à la fois, délai 280 s (`/tmp/runtests2.sh`).
7. **Négatif de test mal construit** : première mutation (contrôle extérieur) restait convexe ; corrigée par un contrôle intérieur.
8. **Hypothèse fausse : regrouper les flous.** 99 filtres distincts, aucun réutilisé, aucune suite d'éléments consécutifs partageant un filtre : idée abandonnée.
9. **Régression apparente qui n'en était pas une.** La campagne a signalé 3 nouveaux échecs (`hairline-temple-inside-skull`). Vérifié à l'ancien commit (worktree) : même ratio 1,0377,
   donc défaut antérieur, caché parce que l'ancien rapport datait d'avant ce contrôle. Corrigé à la source (voir CHANGELOG-8). Leçon : comparer au code ancien avant de conclure.
10. **Temps de campagne : mesures non comparables.** 1ʳᵉ exécution 123 s (rendus pendant que d'autres processus tournaient), 2ᵉ exécution 75,5 s, ancien rapport 58,3 s (autre état de cache et de machine). Aucune conclusion de performance n'est tirée de ces trois chiffres ; mesure à froid des deux côtés à refaire.
11. **Échec restant** : graine 46 (`front-clear-mouth`, cheveux sur la bouche) : antérieur et connu, non traité ici (campagne : 99/100).
