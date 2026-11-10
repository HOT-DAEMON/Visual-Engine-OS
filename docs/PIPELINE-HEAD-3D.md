# Tête 3D dans le pipeline principal (`kind: 'head_3d'`)

La rotation 3D de la tête et du cou (`src/head-turntable`) est branchée au pipeline : un objet `head_3d` rend **la même personne que le visage de face d'un hôte**, à un lacet et un tangage quelconques. Suite : `PIPELINE-HEAD-3D-REMAINING.md` (ce qui n'est pas fait, par composant). Yeux de l'hôte et recouvrement à 0° : `HEAD-TURNTABLE-HOST-OVERLAP.md` ; cou : `HEAD-TURNTABLE-NECK-RELIEF.md` ; roulis : `HEAD-TURNTABLE-ROLL.md` ; vitesse : `HEAD-TURNTABLE-SPEED.md`.

## Contrat

```jsonc
{ "kind": "head_3d", "id": "t0", "host": "f0",      // hôte shape: 'face' obligatoire
  "yaw": 45,        // −180…180 ; 0 = face, 90 = profil, 180 = dos ; yaw > 0 ⇒ le visage se tourne vers la GAUCHE de l'image
  "pitch": 0,       // −60…60 ; > 0 = contre-plongée (caméra sous la tête ; la planche : 17,7°)
  "roll": 0,        // −40…40 ; > 0 = tête inclinée vers la DROITE de l'image (HEAD-TURNTABLE-ROLL.md)
  "skull": {}, "variation": {},   // mêmes règles que head_profile (axes dérivés écrasés, variation bornée)
  "hair": "#…",     // couleur ; défaut = celle du visage de l'hôte
  "hairline": "host",   // 'host' = lisière réelle de la coiffure de l'hôte ; 'short' = calotte courte ; un hôte chauve reste chauve
  "resolution": 2,  // 1…3 px par unité native (1 = 420 px de haut) ; le coût croît comme son carré
  "transform": {} }
```

Repère natif : hauteur 420, 240 px par U ; l'origine (0, 0) est le **pivot du cou à la hauteur du sommet de la tête** ; le cadre rendu couvre x ∈ [−180, 180], y ∈ [−48, 372].
Plusieurs `head_3d` du même hôte sont permis (planche de rotation), contrairement à `head_profile` (un seul par hôte).

## Chaîne (aucun moteur nouveau)

| Étape | Fichier | Rôle |
|---|---|---|
| validation | `src/schema/head-3d.ts`, `schema/scene.ts` | hôte existant et `shape: 'face'` ; variation du crâne partagée avec `head_profile` (`SkullVariation`) |
| visage de l'hôte | `render/face/face.ts` (`hostFace`) | paramètres STYLISÉS + repères : source unique du visage de face |
| crâne | `skull/derive.ts` (`deriveSkull`) | même appel que `head_profile` : le crâne est dérivé du visage |
| iris | `compile.ts` → `ctx.eyes` → `render/head-3d.ts` (`irisOf`) | teinte dominante de l'œil posé sur l'hôte |
| spec | `head-turntable/engines/from-host.ts`, `from-face.ts` (`HeadSource`) | mâchoire, nez, bouche, oreille, cou des moteurs ; lisière de la coiffure via `hair-bridge.ts` |
| rendu | `render/head-3d.ts` | `renderHead` → `<svg>` imbriqué à l'échelle native ; mémoïsé (`head-3d-subject`, `head-3d-svg`) |
| vérification | `verify/head-3d.ts` → `verify/pipeline.ts` | 3 couches de `head-turntable/verify-head.ts` |

`HeadSource` est l'interface commune : `RandomProfile` (planches de graines) la satisfait telle quelle, un hôte du pipeline la fournit par `render/head-3d.ts`. Une seule voie vers les moteurs, deux sources.

## Vérification

`verifyPipeline` ajoute, par tête, 79 contrôles préfixés `head3d.<id>.` : géométrie (36 : la 3D reste fidèle au contour 2D et au profil, mâchoire continue, reliefs bornés), anatomie (21 : tiers, plan mandibulaire, oreille entre sourcil et base du nez, longueur de crâne dérivée), style (22 : contraste d'encre, trait stable, contour fermé, cou en cloche et monotone). `hard` → `error`, `info` → `warn`. Les contrôles lisent des vues fixes : mémoïsés par sujet, ils ne dépendent ni du lacet ni du tangage choisis.
Mesuré (graines 3, 7, 42) : 0 échec bloquant ; 1 avertissement, `head.anat.skull.cephalic3d` (indice céphalique 3D 1,05 – 1,12 pour une borne de 0,98 : les têtes sont plus larges que longues vues du dessus ; connu, voir `HEAD-TURNTABLE-REMAINING.md`).

## Coût

Compilation d'une scène de 1 visage + 4 têtes à `resolution` 1 : ≈ 6 – 8 s. `verifyPipeline` : ≈ 24 s la première fois qu'un sujet est vérifié (mesure sur 1 tête), puis ≈ 1,4 s par tête supplémentaire du même sujet (cache) ; 0,6 s sans `head_3d`. Un rendu de tête est mémoïsé par contenu : seuls le lacet, le tangage, la résolution et les réglages de l'objet le font varier.

## Tests

`tests/pipeline-head-3d.test.ts` (8) : déterminisme, lacet et tangage effectifs, plusieurs angles du même hôte, iris / peau / cheveux / crâne de l'hôte, variété du crâne entre hôtes, lisière (hôte / calotte / chauve), rejets de schéma, 3 couches de vérification. Artefacts : `artefacts/head-turntable-v6/` (`01-pipeline-head-3d-graine{3,7,42}.png`).
