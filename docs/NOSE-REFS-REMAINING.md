# Nez : ce qui n'est PAS fait (suite de `docs/NOSE-REFS.md`)

Légende : ⬜ non fait · 🟡 partiel. Rien ici n'est prétendu fait ailleurs.

## Références
- ⬜ `01`–`05` ne sont pas quantifiées : seule `06.png` l'est. À extraire : ellipse + triangle de `04.jpg` (rapport lobule/base, hauteur du triangle
  de narines selon l'inclinaison), formes de narines de `03.jpg`, détails de peau de `05.jpg`.
- ⬜ Trois formes de la planche 06 (ellipse large, trapèze plat, losange) non reproduites : ce sont des vues par dessous ou à base fermée par le lobule.
- ⬜ Le L/H du moteur plafonne à 0,825 sur trois ajustements (cause non établie) ; « cloche-ailes » a un profil correct mais un L/H de 0,83 pour 0,98.
- ⬜ Contour du bas du nez : les références ferment la silhouette par le lobule, le moteur par une base plate (écart sur les 28 % du bas).
- ⬜ Les archétypes ne sont pas branchés dans le générateur aléatoire : ils sont disponibles (`noseArchetype`) et utilisés par tests et artefacts seulement.

## Angle de caméra
- ⬜ Vue de dessous / de dessus, trois quarts et profil du nez (réf. 01, 03, 04, 05) : la silhouette du moteur est de FACE uniquement. C'est la
  cause probable des trois formes non reproduites. Non commencé : il faudrait une élévation 3D des régions puis une projection selon tangage et lacet.
- ⬜ Narines vues de dessous (déjà listé dans `FACE-STRUCTURE-REMAINING.md`, T1).

## Apparence
- ⬜ Matériau et texture propres au nez (brillance de la pointe, pores plus marqués, rougeurs de `05.jpg`) : le nez ne fait que fournir une hauteur au moteur
  d'éclairage, la peau est celle de l'hôte.
- ⬜ Cohérence de teinte mesurée entre nez, joues et membres supérieurs (valable par construction, non mesurée).
- 🟡 Lisibilité : séparation des dômes, sillon alaire et ouverture des narines changent ≈ 1–2 % des pixels ; à rendre plus convaincants.

## Moteur
- ⬜ Asymétrie des ailes comme région, bosse osseuse volumétrique, cartilage supra-alaire (déjà listés en T1).
- ⬜ Le relief du nez n'est évalué que pour la tête vue de face ; `head_3d` garde sa propre silhouette de nez.
- ⬜ Non lancé : `npm run regress` complet (les tests de relief et de nez passent ; voir le message de commit pour l'état de la suite complète).
