# Vitesse du rendu de la tête tournante

Mesure sur le même poste, même graine (11), vérification complète d'un sujet (`verifyHeadSubject`) : **17 – 19 s → 7,5 – 10,5 s** avant l'ajout des reliefs du cou et des 2 rendus de roulis. Les mesures de fin de session sont bruitées par la charge de la machine ; une comparaison propre de bout en bout reste à refaire (voir « Reste »).

## Méthode

Profil CPU (`node --cpu-prof`) : l'essentiel du coût était la PEINTURE par pixel (≈ 1,9 s sur 2,3 s par rendu à `ss` 2), pas le maillage ni la rastérisation. Chaque optimisation est VÉRIFIÉE à pixels identiques : hash SHA-1 de 12 rendus (3 graines × 4 vues) avant / après.

## Corrections

| Fichier | Défaut | Correction | Gain |
|---|---|---|---|
| `sections.ts` | tangentes de Hermite recalculées (fermeture + divisions) à chaque évaluation de `sectionAt` ; pentes de la lisière `hairlineY` recalculées avec deux tableaux à chaque pixel | tangentes et pentes calculées une fois par table (WeakMap) | paint 1,9 → 1,1 s |
| `engines/face-parts.ts`, `face-tex.ts` | `distPolyline` parcourait tous les segments pour chaque pixel du visage ; polylignes fermées recréées par `[...pl, pl[0]]` à chaque appel | boîte englobante par polyligne (au-delà de 0,03 U : `Infinity`, tous les appelants comparent à ≤ 0,02) ; polylignes fermées mises en cache | paint 1,1 → 0,9 s |
| `engines/ear3d.ts` | `earRig` (modèle + placement + clé de cache canonique) recalculé pour chaque pixel d'oreille | cache par (spec, côté) | vérification 13,5 → 8,1 s |
| `engines/ear-field.ts` | distance d'encre calculée contre toutes les arêtes pour chaque cellule | boîtes des contours + portée 0,15 (les lecteurs comparent à ≤ 0,05) | non mesuré (aucun gain visible sur le premier rendu) |

Le gain ne change aucune décision de rendu : mêmes pixels, mêmes contrôles.

## Reste

- Vérification complète encore ≈ 10 – 14 s : 10 rendus de ≈ 0,6 – 1,2 s ; le premier rendu paie l'échauffement des moteurs (≈ 2,5 s).
- Pistes : `paint.ts` appelle encore `sectionAt` et `signedDistance` par pixel ; rendu par tuiles ou en `worker_threads` (la vérification est synchrone) ; `ss` 1 pour les vues de simple détection de silhouette (changerait les seuils : à recalibrer).
- Comparaison avant / après complète à refaire sur machine au repos (celle de fin de session ne l'était pas).
