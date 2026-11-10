# Preuves visuelles — yeux de l'hôte, recouvrement à 0°, cou, roulis

Générées par `npx tsx scripts/artefacts-head-host.ts` à partir du rendu réel (`compileScene`, `kind: 'head_3d'`).

| Fichier | Montre |
|---|---|
| `01-recouvrement-0deg.png` | 4 hôtes (graines 11, 42, 77, 3) : dessin de face (haut) ; tête 3D à 55 % par-dessus (bas) ; IoU et couverture de peau |
| `02-yeux-hote-vs-3d.png` | yeux de l'hôte (haut) vs tête 3D à 0° (bas) : forme, taille, regard ; écarts mesurés |
| `03-cou-reliefs.png` | SCM, platysma, clavicules, fosse sus-sternale à 3 lacets (0, 35, 70°) |
| `04-roulis.png` | lacet 0 / 45 / 90° × roulis −30 / 0 / +30° (cou plié, base de niveau) |
| `05-tete-complete.png` | tête entière, lacet 0 → 180°, graines 11 et 42 (chauve) |
| `rapport.json` | contrôles `head.host.*`, `head.neck.*`, `head.roll.*` par graine, échecs |

Limites visibles : la peau du dessin de face est ombrée en dégradés, la tête 3D en aplats cel (deux styles côte à côte) ; le trait de paupière et les reflets suivent le style de la planche ; la teinte d'iris suit la donnée, que le dessin de face module par son éclairage (graine 42).
