# Cou 3D : SCM, platysma, clavicules (lus du moteur de cou)

Preuves : `artefacts/tete-hote-cou-roulis/03-cou-reliefs.png` (3 graines × lacet 0 / 35 / 70°) et `05-tete-complete.png`.

## Principe : lire le moteur, ne rien redessiner

`src/head-turntable/engines/neck-relief.ts` ne contient ni muscle ni os. Il lit :

1. les **visibilités** que `src/neck/anatomy.ts` calcule pour le visage de l'hôte (`neckModelFor(e.p, e.lm)` : SCM, platysma, clavicule, avec masse, âge, tension de peau, séparation, visibilité des tendons) ;
2. les **tracés** de `src/render/neck/muscles.ts` et `reliefs.ts`, exprimés en (u le long du cou, ψ autour), posés sur la section elliptique du cou 3D (`x = a·sin ψ`, `z = zc + b·cos ψ` : même paramétrisation que `neck/geometry.sectionPoint`). `u` vient de `uAtY`, la même fonction que le moteur.

| Relief | Tracé repris du moteur | Peint si (opacité du moteur) |
|---|---|---|
| SCM, bord interne | `ψc(u)` de 0,68π (mastoïde) à 0,14π (sternum), `u ∈ [jawU+0,02 ; 0,97]`, demi-largeur `(0,05+0,06·sin πt)·π·(0,7+0,6·v)` | ≥ 0,10 |
| SCM, bord externe | même courbe, côté opposé, plus fin | ≥ 0,10 |
| Cordes du SCM | deux cordes `u ∈ [0,86 ; 0,985]` | tendons × v ≥ 0,06 |
| Platysma | bandes `ψ` de 0,2π à 0,12π depuis le menton | 0,3 × visibilité ≥ 0,10 |
| Clavicules | arc `(ξ, h)` = (0,06 ; 0,03) (0,35 ; 0,048) (0,7 ; 0,04) (0,98 ; 0,015) × H au-dessus de la base | ≥ 0,10 |
| Fosse sus-sternale | ellipse centrée à 0,026 H au-dessus de la base | ≥ 0,15 |

- **Style** : un relief est un CREUX en ton d'ombre durci de 30 % vers l'encre (`markColor`), bord net (cel), jamais un dégradé et jamais de l'encre franche (pas d'îlots d'encre : le contrôle `head.style.specks` ne bouge pas).
- **Asymétrie** : `muscleSide` du moteur module la visibilité gauche/droite comme en 2D.
- **Coût** : tout ce qui ne dépend que de la hauteur est mis en cache par rangée (y quantifié à 0,0005 U, moins d'un demi-pixel) ; ≈ 0,3 µs par pixel de cou, environ 5 % du temps de rendu.
- **Face cachée** : le rasteriseur ne peint que les pixels visibles ; une marque postérieure n'apparaît donc que quand la tête tourne.

## Contrôles (`verify-neck-relief.ts`, couche anatomie)

| Contrôle | Borne | Mesuré (8 graines) |
|---|---|---|
| `head.neck.scm.insertion` : ψ/π du premier creux sous la base | 0,03 – 0,3 | 0,107 – 0,213 |
| `head.neck.scm.mastoid` : ψ/π du creux le plus postéro-latéral | ≥ 0,45 | 0,627 – 0,633 |
| `head.neck.scm.below-ear` : y du premier creux latéral − y du lobe (U) | −0,12 – 0,45 | 0,062 – 0,213 |
| `head.neck.relief.coverage` : part de la face antérieure marquée | 0,002 – 0,12 | 0,034 – 0,038 |
| `head.neck.relief.pixels` : pixels de creux à 0° | ≥ 30 | 786 – 1248 |

Un cou invisible (`neck.visible = false`) ne porte aucune marque ni contrôle (testé).

## Reste à faire

- Les marques sont des creux seuls : pas de ton clair sur le ventre du muscle (le style n'a que peau / ombre / encre).
- Platysma et cordes sont peu visibles sur les cous peu musclés (opacité du moteur sous 0,10) : c'est la lecture du moteur, pas un oubli.
- La coupe du cou reste un disque plat, sans jonction aux épaules (`NECK-BELL`) ; `src/body/volume/neck.ts` n'est pas branché.
- Pas de trapèzes, de pomme d'Adam ni d'os hyoïde 3D ; clavicules sans relief de l'extrémité acromiale.
- Les visibilités viennent d'un visage de FACE : pas de lecture du cou à une pose tournée de l'hôte.
