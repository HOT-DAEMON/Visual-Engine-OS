# Profil : repères, profondeurs de tissu, mandibule, cou

## Repères (peau) — du sommet à la nuque, dans l'ordre du contour
`vertex`, `bregma`, `frontalEminence`, `supraglabella`, `glabella`, `nasion`, `rhinion`, `supratip`, `pronasale`, `subnasale`, `philtrum`, `vermilionSup`,
`labraleSup`, `stomion`, `labraleInf`, `vermilionInf`, `sublabiale`, `pogonion`, `menton`, `throat`, `thyroid`, `baseFront` ; côté nuque : `baseBack`, `c7`,
`nape`, `nuchalGroove`, `inion`, `opisthocranion`, `lambda`.

## Repères (os)
Pour chaque repère de la table ci-dessous : `<id>:bone`. Sans homologue de peau : `nasospinale`, `prosthion`, `infradentale`, `gnathion`, `gonion`, `condyle`,
`coronoid`, `porion`, `mastoid`, `zygomaxillare`, `orbitale`, `pterion`, `asterion` ; plus les vertèbres `C1…C7` (centre, rayon, pointe d'épineuse).

## Profondeurs de tissu mou (`bone.ts` → `DEPTH`, en fraction de H ; ≈ 0,0043 H par mm sur une tête de 230 mm)

| Repère | Prof. | Sens | Repère | Prof. | Sens |
|---|---|---|---|---|---|
| supraglabella | 0,020 | x− | sublabiale | 0,047 | x− |
| glabella | 0,024 | x− | pogonion | 0,050 | x− |
| nasion | 0,027 | x− | menton | 0,030 | y− |
| rhinion | 0,010 | x− | vertex | 0,024 | y+ |
| subnasale | 0,040 | x− | bregma | 0,024 | y+ |
| philtrum | 0,046 | x− | lambda | 0,022 | y+ |
| labraleSup | 0,040 | x− | opisthocranion | 0,027 | x+ |
| labraleInf | 0,045 | x− | inion | 0,030 | x+ |

Sens : `x−` l'os est en arrière de la peau, `x+` en avant (occiput), `y+` sous la peau (voûte), `y−` au-dessus (menton). Les profondeurs de la voûte sont
multipliées par `0,75 + 0,5·scalp`.
**Honnêteté sur ces valeurs** : la méthode (Rhine & Moore, Helmer, Manhein) est reprise ; les nombres sont des ORDRES DE GRANDEUR plausibles écrits de
mémoire, PAS les tables publiées. Ils ne doivent pas être cités comme tels. Voir `SKULL-PROFILE-REMAINING.md` (calibrage).

## Mandibule
Condyle fixé à (0,015 H ; porion + 0,02 H). Gonion à l'ordonnée de la mâchoire de face (`lm.jawY`). Son abscisse est résolue pour que
∠(gonion→condyle, gonion→gnathion) = `lm.jaw.gonialDeg`. Mesuré : écart < 10⁻¹¹ ° (test `skull.test.ts`, contrôle `gonial-matches-front` ≤ 0,5°).

## Cou et nuque (`neck.ts`)
- Gorge T : à `shelf = (0,16 + 0,10·(cervicomental − 85°)/65°)·H` du menton le long du dessous du menton, de pente β = cervico-mentonnier − 90°.
- Face antérieure : droite, 0,05 vers l'avant par unité descendante (le cou s'élargit vers le thorax) ; thyroïde = bosse locale (`thyroid`).
- Face postérieure = antérieure − profondeur(y) ; profondeur(y) = `d0 + (y − T.y)·(0,5·tan(inclinaison) + 0,06)`, `d0 = (0,34 + 0,16·neckDepth)·H`.
- Nuque : + lordose `0,02 H·sin(π u)`, − saillie C7 gaussienne en u = 0,92 ; rampe du trapèze (`trapezius`) jusqu'à la coupe.
- Contrainte : la nuque reste à 0,03–0,16 H en avant de l'inion (sinon ressaut ou occiput « posé »), consigné si ramené.
- Cou visible ≥ 0,18 H sous la gorge (sinon thyroïde et base se croisent) ; les points de la face antérieure sont des FRACTIONS de la longueur disponible
  (monotonie garantie : un ordre vertical non monotone avait créé une auto-intersection, voir `ERRORS-8.md`).
