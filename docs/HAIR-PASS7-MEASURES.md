# Passe 7 — mesures sur `references/hair/60.jpg`

Script : `scripts/hair-grammar/measure-ref60.py` (`python3 -I scripts/hair-grammar/measure-ref60.py`) · sortie : `artefacts/hair-engine-pass7/measures-ref60.json` · constantes : `src/hair-grammar/ring-measures.ts` (source unique).
`tests/hair-engine-ring-measures.test.ts` vérifie que `MEASURED` reste à moins de 3 % du JSON et que `RING` reste dans les plages mesurées.
Suite de `HAIR-PASS6-MEASURES.md` (deux rubans) : ajoute l'éventail (C), les bandes recouvertes (D) et la tête illustrée.

## Méthode
- Image 736 × 736. Panneaux : A ruban horizontal (535,170)-(715,245) · B ruban vertical (585,260)-(675,425) · C éventail (505,435)-(725,565) · D bandes recouvertes (515,585)-(715,705).
- Reflet = R > 190 et G > 55, grappes contiguës ≥ 6 px, dans la zone rouge (R − G > 35, R > 60, composantes > 200 px).
- Rubans : axe principal par ACP ; ruban érodé de 3 px (sans cela le liseré anti-aliasé du bord est pris pour un reflet) ; profil de luminance médian par tranches de 0,04 L, hors reflet ; ombre cherchée des DEUX côtés, on garde le sens du creux le plus net.
- Éventail : sommet = point le plus haut de la zone rouge ; rayons en fraction du rayon maximal R ; épaisseur par tranche de 3° ; profil sur le secteur du reflet (± 25°).
- Luminance : luma sRGB 0,299 R + 0,587 G + 0,114 B, dans l'espace où SVG compose l'opacité (pas de conversion linéaire).
- Creux relatif = (min aval − niveau) / niveau, niveau = médiane du ruban (éventail : médiane au-delà de 0,7 R).

## Résultats
| Grandeur | A | B | C (éventail) |
|---|---|---|---|
| Étendue du reflet | 0,053 | 0,069 | 0,048 (R) |
| Creux relatif aval | −0,339 | −0,363 | −0,335 |
| Position du creux (depuis le bord du reflet) | 0,080 | 0,073 | — |
| Mi-retour | 0,280 | 0,273 | 0,298 |
| Retour à 97 % | — | — | 0,418 |
| Centre du reflet | 0,527 | 0,472 | 0,301 R |
| Couverture angulaire | — | — | 0,943 |
| Bord aval du reflet (`edgeAt`) | — | — | 0,362 R |

Part d'aire du reflet (reflet / zone rouge) : A 1,46 % · B 2,5 % · C 2,68 % · D 0,93 % · tête illustrée 1,39 % (20 grappes de ≥ 8 px).

## Ce que cela change par rapport à la passe 6
- La passe 6 donnait 0,20 L pour l'ombre : elle mesurait la poche sombre seule. Le mi-retour est 0,27–0,30 sur trois panneaux indépendants.
- Le creux (−34 / −36 / −33 %) est RELATIF : à opacité fixe il dépend du ton (voir `HAIR-PASS7.md` §3).

## Limites de l'échantillon
- Une seule image, un seul illustrateur ; trois panneaux d'accord entre eux n'en font pas une loi.
- Le profil de l'éventail inclut, vers r ≈ 0,98 R, le bord blanc du dessin (+104 %) : exclu des comparaisons (r < 0,94 R).
- Seuil de reflet unique ; les seuils `minNH`, `fullNH`, `bodyWidth`, `minCoverage` restent non mesurés.
- `68.png` du dossier est un fichier de 2 octets (un saut de ligne), illisible : ignoré, à remplacer.
