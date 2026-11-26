# Passe 8 — le reflet de grammaire dans le rendu principal

## Chaîne
`paintHairPro` → `ProLock.ring` (RingBands, gardé par `ringIsSane`) → `interop.toHairLockGeom` → `HairLock.geom.ring` (`HairLockRing {highlight, shade, strength}`) → `lockMarkup` → `render/face/hair-ring.ts`.
- Le rendu n'importe pas la grammaire : le contrat est le type `HairLockRing` (`src/face/hair/types.ts`). `checkHairLockContract` valide l'anneau (≥ 4 points de reflet, valeurs finies, force ∈ [0,1], poids d'ombre ∈ [0,1], non croissants, segments raccordés ; règles `ring*`).
- Couleurs : celles du moteur d'apparence (`ra.shadow`, `ra.highlight`) — une seule apparence, pas une seconde peinture. Opacité du reflet : (0,55 + 0,4 × force) × gain, gain = clamp(0,4 + 1,2 × `reflection.intensity`, 0, 1,6) (0,5 = neutre, comme `hairGloss`).
- Réglage : `LockStyle.ring?: 'off' | 'replace' | 'add'`, PAS dans le schéma `reflection` (partagé avec les yeux et les matières). Absent ou `off` : sortie identique à avant (test au bit près).
- Rognage par le contour de la mèche (`clipPath ${id}-rc${k}`) ; mèches du calque `back` : pas de reflet.
- Ombrage cel : seul le reflet est dessiné ; l'ombre reste aux bandes cel (bords nets = style voulu, pas une limite).

## Décision `replace` ou `add`, sur mesure (planches 04–06, `metrics.json`)
Sur la coiffure finale (50 mèches, 3 lumières × 3 graines × 2 vues) seules 2–10 % des mèches gardent un anneau : l'occlusion croisée (≈ 1 sur ≥ 90 % des échantillons) et le seuil N·H (`RING.minNH` 0,78) écartent les autres.
- `replace` GLOBAL (version initiale) : retirait la bande axiale de ~90 % des mèches, donc un rendu mat. Rejeté.
- `add` : garde tout ; part de pixels clairs 7,35 % contre 6,95 % sans reflet (référence 1,39 % — la brillance principale est déjà 5× au-dessus ; cf. REMAINING).
- RETENU : `replace` PAR MÈCHE — l'anneau remplace la bande axiale seulement là où il existe ; ailleurs la bande axiale reste. Pixels clairs 6,93 % (≈ sans reflet : pas de perte de brillance), 2 à 5 mèches à anneau selon le lacet. Le liseré de bord que la bande axiale jouait sous `add` n'est donc gardé que sur les mèches sans anneau.
- Défaut `off` conservé : la décision dit quoi activer, elle ne change pas le rendu d'un appelant existant.

## Limites connues
- La brillance principale `hairGloss` reste un halo ; `localGlossShare` ne le voit pas cuire avec les anneaux (seules 2–10 % des mèches en portent). Voir REMAINING.
- Aucun appelant de production (`renderHair`) ne transmet encore des mèches de grammaire avec anneau : le branchement est prouvé par tests et planches, pas par un flux complet.
