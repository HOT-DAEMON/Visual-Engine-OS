# Reste à faire — tête + corps dans le pipeline principal (état au 4 nov. 2026)

> Suite de `PIPELINE-WIRING.md` et `ANATOMY-CONTRACT.md`. Une ligne = un manque réel, avec sa preuve ou sa raison.

## Branchement au pipeline principal

| Élément | État | Reste à faire |
|---|---|---|
| visage de face (crâne, face, nez, bouche, mâchoire, menton, oreilles, cou) | branché (`host shape: 'face'`) | — |
| yeux | branchés (`place` sur les ancres de l'hôte) | — |
| cheveux v2 (`face/hair`) | branchés | — |
| cheveux `hair-grammar` | **non branchés** (aucun import depuis `compile.ts`) | décider de la fusion avec `face/hair` (`HAIR-GRAMMAR-BRIDGE.md`), puis un `kind` ou un champ d'hôte ; preuve visuelle côte à côte |
| crâne de profil (`src/skull`) | **non branché** (`renderProfile` autonome) | un hôte `view: 'profile'` ; le crâne de face est déjà couvert par `cranium` |
| pose 3/4 (`face/pose`) | **non branchée** (`FACE-POSE.md` : « pas encore branchée au rendu ») | appliquer la pose aux repères avant `faceParts` |
| corps : torse + bras | branché (`kind: 'body'`) | — |
| corps : bassin + jambes (`src/body/lower`) | **non branchés** | étendre `BodyParams` ou ajouter `kind: 'legs'` ; le torse s'arrête aujourd'hui sur une coupe droite |
| `relief` (relief de la tête) | non branché | consommer le relief dans `faceParts` |

## Contrat central (Problème 1)

- Orbite : deux définitions (repères vs ajustement de l'œil), 12 visages sur 80 hors orbite. Faire publier l'orbite par l'œil après ajustement ;
  les ombres de contact la consomment. Mettre à jour les références de régression en connaissance de cause.
- Le graphe de contact n'a pas de composant « paupière » ni « arcade » : la relation visuelle œil/paupière n'a donc pas de composant canonique propre.
- Matériau, texture, ombre : ils n'utilisent pas encore l'identifiant canonique (`ANATOMY-CONTRACT.md` §5).

## Relations (Problème 3)

- Couvert : œil (1 géométrique, 3 anatomiques, 2 visuelles).
- Manque : nez ↔ narines/ailes, bouche ↔ commissures ↔ joues, oreille ↔ crâne (attache), mâchoire ↔ menton ↔ cou, cheveux ↔ ligne d'implantation.
  Pour chacune : mesure sur la géométrie compilée + une planche de preuve (voir planche 03 comme modèle).
- Le visuel de la paupière est mesuré par recouvrement de l'iris ; il manque la courbure de la paupière contre le globe (aucune mesure fiable à ce jour).

## Compilateur (Problème 2)

- `faceParts` ordonne les couches à la main : c'est le vrai point de congestion. Seuil de réouverture : plus de ~15 couches, ou composants externes.

## Qualité visuelle constatée sur les planches

- Planche 01 : le torse s'arrête sur une coupe droite en bas (bassin et jambes non branchés) ; l'enfant de 8 ans a les mêmes proportions de bras que l'adulte à l'œil, à vérifier contre `BODY-CANON.md`.
- Planche 02 : le tracé réel du cou commence au niveau du nez (haut caché derrière la tête) ; sans conséquence visuelle, mais le graphe de contact `neck` a le même rectangle.
