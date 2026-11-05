# Tête de profil dans le pipeline principal (`kind: 'head_profile'`)

> État au 5 nov. 2026. Avant : « crâne de profil non branché (`renderProfile` autonome) ».

## Contrat

`HeadProfileSpec` (`src/schema/head-profile.ts`) = la **même personne vue de côté** : `host` (un hôte `shape: 'face'`), `skull` (axes non dérivés), `variation`,
`hair`, `mode` (`skin` | `anatomy` | `bone`), `transform` (placement dans la scène ; repère natif de hauteur 420).

Le profil ne porte aucune forme libre :

1. le crâne est **dérivé du visage de l'hôte** par `deriveSkull` (largeur du visage → largeur de tête → longueur par l'indice céphalique, front, pommettes, cou) ;
2. `skull` ne donne que les axes que le visage ne détermine pas (occiput, inion, maxillaire, C7…) — les axes dérivés sont **écrasés** par la dérivation ;
3. `variation` = la petite variation libre **bornée** (`ci` ±2,5 points ; 5 axes ±0,08) ; 0 = aucune ;
4. peau = matériau de l'hôte, cheveux = `hair` ou la couleur du visage ; `hair: 'auto'` par défaut (sinon le profil serait chauve), `background: null`.

Le SVG est mémoïsé par le contenu (`memoPure('head-profile-svg')`) ; il est posé comme `<svg>` imbriqué sous la transformation de l'objet.

Validation de scène : hôte introuvable, hôte non-visage, deux profils sur le même hôte, champ inconnu → refus (testés).

## Vérification

`verifyPipeline` exécute `verifyProfile` (3 couches du profil + contrôles croisés face ↔ profil) sur le crâne dérivé, ids préfixés `profile.<id>.`.
Mesuré sur 6 graines : 0 erreur, plus de 15 contrôles par profil, les trois couches présentes. Planche : `artefacts/pipeline-wiring/02-face-profil-relief.png`.

## Ce que la planche montre (honnêtement)

- Le crâne dérivé varie bien avec la largeur du visage (test : ≥ 3 longueurs de tête distinctes sur 5 hôtes, entre 0,7 et 0,95).
- **Incohérence de coiffure** : le profil lit `FaceHair` de l'hôte mais sa coiffure est une calotte générique ; sur les graines 11 et 7 elle ne ressemble pas à la
  coiffure de face (pointes, tresses). Cause : deux moteurs de cheveux (`face/hair` pour la face, `skull` pour le profil). Non corrigé.

## Reste à faire

- Le pipeline n'alimente que `mode`, `skin`, `hair` et `background` de `renderProfile`. `renderProfile` déduit l'œil et le sourcil de profil de l'option `eye` (`ProfileEyeData`, calculée à la génération à partir de l'ajustement de l'œil) : le pipeline ne la fournit pas, donc œil et sourcil de profil sont génériques. Barbe non vérifiée.
- Contrôles face ↔ profil (rapport largeur/longueur, taille de l'œil, présence/longueur des cheveux) non exposés dans la scène (seule `variation` l'est).
- Angles intermédiaires (3/4) : `SKULL-AXES-REMAINING.md` ; le profil est à 90° uniquement.
- Le profil est posé par `transform` : rien n'impose qu'il soit à la même échelle que le visage (à la charge de la scène).
- Doublon d'identifiant **préexistant** `f0-hair-base-clip` dans le rendu du visage seul (non lié au profil) : à corriger dans `face/hair`.
