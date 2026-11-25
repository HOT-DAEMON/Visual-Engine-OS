# Moteur capillaire — passe 7 : le reflet transversal mesuré, son ombre, sa garde de rendu

Code : `src/hair-grammar/{ring-measures,ring-tone,ring-check}.ts` (nouveaux) · `{spec-ring,paint-pro,verify-ring,reference-fit-part}.ts` (modifiés).
Mesure : `scripts/hair-grammar/measure-ref60.py` → `artefacts/hair-engine-pass7/measures-ref60.json` (détail : `HAIR-PASS7-MEASURES.md`).
Tests (2 fichiers nouveaux, 23 tests) : `tests/hair-engine-ring-measures.test.ts` (18) · `tests/hair-engine-part-hidden.test.ts` (5).
Preuves (têtes entières puis détails, 7 planches) : `artefacts/hair-engine-pass7/` — régénérées par `npx tsx scripts/hair-grammar/artefacts-pass7.ts`.
Reste à faire par composant : `HAIR-PASS7-REMAINING.md`.

Méthode : le fichier de tâches de la passe 6 (`HAIR-PASS6-REMAINING.md`, 43 lignes) est relu ligne à ligne. Avant chaque pièce, recherche dans le dépôt qu'elle n'existe pas déjà ; tout réglage reste désactivé par défaut (`ring: 'off'`) et le rendu par défaut est inchangé au bit près (test dédié).

## 1. Verdict ligne par ligne de la passe 6
| Ligne (passe 6) | Verdict | Traitement |
|---|---|---|
| « panneau C (éventail) non mesuré » | FAIT | Éventail mesuré (centre 0,301 R, épaisseur 0,048, creux −33,5 %, mi-retour 0,298 R, retour complet 0,418 R, couverture angulaire 0,943). |
| « zone sombre aval 0,20 L » | CORRIGÉ | Les 3 panneaux s'accordent sur 0,27–0,30 L : la passe 6 avait mesuré la poche sombre seule. `shoulderLen` 0,2 → 0,42 (trois paliers 1 / 0,65 / 0,33). |
| « creux −36 % = 3 paliers de 0,12 » | CORRIGÉ | 0,12 × 3 ne creuse que −24,8 % sur un remplissage clair ; l'opacité dépend du ton (`ring-tone.ts`). |
| « part de mèches à reflet 15–85 %, non mesurée » | REMPLACÉ | Contrôle de style sur l'AIRE : reflets / mèches = 0,0139 (tête illustrée) × [0,25 ; 4]. |
| « raie : point caché non retrouvé » | FAIT | `skullFromImageU` renvoie l'erreur de re-projection ; `partFromObservation` rejette au-delà de 0,03 rx. |
| « ring non branché dans la vérification » | PARTIEL | `ring-check.ts` : défauts LOCALISÉS (`Defect`) et garde de rendu dans `paint-pro.ts` ; pas de réparation (voir REMAINING). |
| « ring off par défaut, replace ou add » | NON DÉCIDÉ | Raison : la brillance du rendu principal est un halo flou, la grammaire n'y est pas branchée. |
| « ombre de peau teintée par la lumière » | DÉCIDÉ DE NE PAS FAIRE | Voir §5. |
| `eye-gallery-ext3`, `nose-visibility` | NON TRAITÉ | Autres flux. |

## 2. Mesures retenues (référence 60, luma sRGB)
| | Ruban A | Ruban B | Éventail C | Retenu |
|---|---|---|---|---|
| Étendue du reflet | 0,053 L | 0,069 L | 0,048 R | `extent` 0,06 (dans la plage) |
| Creux relatif aval | −33,9 % | −36,3 % | −33,5 % | cible −33,5 % |
| Mi-retour (depuis le bord aval du reflet) | 0,280 L | 0,273 L | 0,298 R | `shoulderLen` 0,42 |
| Part d'aire de reflet | 1,46 % | 2,5 % | 2,68 % | tête : 1,39 % (20 grappes) |

## 3. Ombre aval (`ring-tone.ts`, `spec-ring.ts`)
- Longueur : `RING.shoulderLen` 0,42 ; paliers cumulés `[1, 0,65, 0,33] × shoulderLen`. Le profil du moteur reconstruit remonte à mi-niveau à 0,273 L (passe 6 : 0,13) ; la cible de l'éventail est 0,30. RMS du profil contre l'éventail : 0,121 → 0,051 (points r < 0,94 R ; le bord blanc de l'éventail est exclu).
- Opacité par ton : trois paliers cumulent A = 1 − (1 − a)³ ; creux relatif = A·(Y − Ys)/Y ; on résout A pour −33,5 %, borné [0,12 ; 0,2].
- Défaut préexistant corrigé : sur le remplissage sombre `#26262a`, l'ombre `#35353b` ÉCLAIRCISSAIT de 12,6 %. Opacité 0, palier non dessiné.

| Ton (mèche `mass-5`) | Remplissage | Passe 6 : opacité / creux | Passe 7 : opacité / creux |
|---|---|---|---|
| 0,6 | `#f3f1ee` | 0,12 / −24,8 % | 0,171 / −33,5 % |
| −0,3 | `#e2e0dd` | 0,12 / −24,2 % | 0,176 / −33,5 % |
| −0,9 | `#26262a` | 0,12 / **+12,6 %** | 0 / 0 |

Retour arrière : `ProStyle.shoulder = { len: 0.2, opacity: 0.12 }` restitue l'ombre de la passe 6 (test dédié).

## 4. Couche de vérification (géométrie · anatomie · style)
- `ring-check.ts` (partagé, imports de types seulement pour éviter le cycle `paint-pro` ↔ `verify-ring`) : `ringDefects(lock, bandes)` → `Defect[]` : `ring.finite` (sévérité 3) ; `ring.outside`, `ring.transverse` (|cos| > 0,43), `ring.backface`, `ring.exposure` (< 0,5), `ring.area` (> 35 %) (sévérité 1).
- Garde de rendu : `paint-pro.ts` ne peint le reflet que si `ringIsSane`. Un reflet douteux est abandonné (en mode `replace`, la mèche n'a alors pas de reflet, comme une mèche sans N·H).
- `verify-ring.ts` : deux contrôles de style mesurés ajoutés (part d'aire ; creux relatif moyen dans [−0,38 ; −0,30]).
- Résultats (`metrics.json`) : têtes entières, 3 lumières → 17 / 12 / 18 reflets, tous vérifiés, 0 défaut ; lacets −30° / 0° / 30° → 17 / 17 / 20 reflets vérifiés ; 18 cas × part d'aire entre 0,0124 et 0,0307 (borne 0,0035–0,0556).
- Tests par mutation : `shoulderLen` 0,2 fait échouer 3 tests ; contour resserré, normale NaN, dessous forcé, lumière arrière sont détectés.

## 5. Raie cachée et lumière
- Raie : la lecture n'est acceptée que si l'inversion image → crâne revient à ≤ 0,03 rx. Part de positions acceptées : 70,3 % (0°), 66,3 % (30°), 55,4 % (60°), 47,5 % (75°).
- Lumière : planche 07 (rendu principal, influence `hair` 1 / 0,5 / 0,15) : 0,0 % du bas du visage change ; 0,7 % puis 0,9 % de la tête haute — l'effet est isolé sur les cheveux.
- Décision « pas de teinte d'ombre par la lumière, côté cheveux seuls » : la couleur de l'ombre de peau est une propriété d'apparence partagée par visage, cou, corps, jambes (`skinAppearance`). La teinter pour les cheveux seuls rendrait la peau incohérente ; la teinter partout sort du périmètre cheveux.

## 6. Planches (`artefacts/hair-engine-pass7/`)
01 tête entière, ombre aval (sans / passe 6 / passe 7) · 02 détails · 03 trois lacets · 04 une mèche en trois tons · 05 profil de l'ombre, référence contre moteur · 06 raie côté détourné · 07 effet isolé sur les cheveux. Index : `README.md` du dossier.

## 7. Limites honnêtes constatées
- Effet discret à l'échelle de la tête entière (1,4 % d'aire).
- Les paliers d'ombre sont à bords DURS ; la référence est un dégradé lisse. À 0,30–0,42 L la passe 7 est plus sombre que la référence.
- À intensité 1, la brillance du rendu principal est un halo flou, pas un reflet de mèche : c'est l'argument principal pour brancher plus tard le reflet de grammaire.
