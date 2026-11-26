# Moteur capillaire — reste à faire après la passe 9, par composant

Bilan : `HAIR-PASS9.md`. Reprend `HAIR-PASS8-REMAINING.md` (inchangé pour tout ce qui n'est pas cité ici).
Statuts : FAIT · PARTIEL · NON FAIT (raison) · DÉCIDÉ DE NE PAS FAIRE (raison). Rien n'est « fait » sans preuve (tests, planches, `metrics.json`).

## Teinte (lumière propre aux cheveux)
- Brun foncé et brun très foncé : FAIT (163° → 1°, 165° → 5° ; planches 03 et 05).
- Poils du visage : branchés (`facial-hair.ts`) ; NON VÉRIFIÉ à l'œil sur une barbe brune cette passe (aucune planche), seuls les tests capillaires l'ont couvert.
- Brun encore délavé, lu comme taupe : NON FAIT. Les tons éclairés se mélangent à 70 % vers `light` (l ≈ 0,61, saturation ×0,78) ; c'est le comportement partagé pour toutes les couleurs. Il faudrait mesurer sur les références la saturation des reflets de cheveux bruns avant de toucher `tone()`. Les références n'ont pas été segmentées cette passe.
- Teinte d'ombre (`deriveShadow`, pull vers 250°) : inchangée, non réévaluée.
- Seuils de `blueSheenWeight` (0,12–0,26 en luminosité, 0,22–0,45 en saturation) : choisis pour la continuité et pour garder le noir à l'identique, PAS mesurés sur un corpus de noirs. NON FAIT : les valider sur des noirs réels des références.

## Reflet transversal
- Bords lisses et lentille : FAIT pour le style de passage `MAIN_PRO` ; défaut d'encre inchangé (voulu).
- `ringLens 0,85` : valeur d'oeil, non mesurée. Sur la référence 60 (encre) le reflet est un peigne, pas une lentille : les deux formes coexistent par style. NON FAIT : mesurer le rapport bout / centre sur les références de rendu lisse (06, 19).
- Les lentilles sont petites (étendue 0,06 de la mèche), lues comme des « pilules » isolées : NON FAIT. Un reflet d'anime est une bande continue qui traverse plusieurs mèches (le « halo d'ange ») ; il se compose au niveau de la masse, pas de la mèche. Piste : bande de masse alignée sur la courbure du crâne.
- Le flux de production (`renderHair`) ne génère toujours pas de mèches de grammaire : `MAIN_PRO` n'est utilisé que par les artefacts et les tests.

## Ombrage cel
- Cales quasi noires au pied des mèches (`celBands`, « ombre propre », pleine largeur sur le premier quart, `mix(ombre, noir, 0,22)`) : NON FAIT, DOCUMENTÉ. Sur un brun très sombre la teinte d'ombre est déjà presque noire. Aucune luminance cible mesurée sur les références cel (04, 05, 21) ; la retoucher à l'aveugle serait de l'invention. Piste : mesurer le rapport luminance(ombre propre) / luminance(base) sur 4 références cel.
- Forme : un croissant le long d'un bord serait plus lisible que des triangles au pied : NON FAIT.

## Rendu principal : lecture de masse
- Hypothèse « mèches semi-transparentes » : NON CONFIRMÉE. Sur la coiffure testée aucune mèche n'a de fondu (`fade`) ni d'`alpha` < 1 ; seuls les rangs `fine` / `hairline` sont à 0,88 / 0,85. Le côté « feuilles empilées » vient d'ailleurs (tons très proches, contour fin) : cause NON IDENTIFIÉE.
- Une chevelure d'anime se lit en paquets de 3 à 5 mèches de même ton avec un liseré net, pas mèche par mèche : NON FAIT (nouvelle primitive de regroupement, hors périmètre de cette passe).

## Vérification de rendu
- `ring.band-smooth`, `style.lit-hue` : FAIT. Verdict avant 5 + 1 fautes, après 0 (`metrics.json`).
- `LIT_HUE_MAX` 45° : borne d'ingénierie, pas une mesure.
- NON FAIT : détection des cales sombres, de la lecture « taupe » (saturation des tons éclairés), des mèches isolées sans voisines de même ton. Il faut d'abord fixer une cible mesurée.
- ANATOMIE : pas de règle nouvelle (déjà couvert, voir `HAIR-PASS9.md`).
- Suite capillaire complète : voir la ligne « Tests » du message de commit ; fichiers non relancés listés ci-dessous.

## Références (`references/hair`, 67 fichiers lisibles)
- Cette passe a LU toutes les références en planches contact (cibles visuelles : frange, chignons 04/12/15/21, tresses 09, bouclés 03/08/14, afros 13/16/18, ondulés 06/19) mais n'en a mesuré aucune. NON FAIT : extraction systématique (silhouettes, parts de reflet, saturation des tons éclairés) pour nourrir de nouvelles coiffures. Chaque coiffure exige un profil `src/hair-grammar/profiles/*`.
- `references/hair/68.png` : supprimé de la branche par un commit antérieur (le fichier de 2 octets mentionné en passe 8 n'existe plus).

## Discipline
Chaque fichier de `docs/` ≤ 200 lignes. Aucun jeton ni identifiant n'est écrit dans le dépôt.
