import { toHsl } from '../appearance';
import { faceLandmarks } from '../face';
import { hairGeometry, type HairGeometry } from '../face/hair';
import { FILL, fillKeep, relaxedBare, shellCoverage } from '../face/hair/crown-fill';
import { distanceOutsideSkull } from '../face/hair/thickness';
import { REACH } from '../face/hair/reach';
import { inPoly } from '../face/poly';
import type { RandomFace } from '../generation/random-face';
import { UNDER_HUE_MAX, hairAppearance, tierHueShift } from '../render/face/hair-look';
import { check, type Check } from './types';

/**
 * FORME DES CHEVEUX SUR LE CRÂNE (`docs/HAIR-FORM.md`) : la couche de vérification du rendu pour le remplissage de la coque. Lit la même `HairGeometry` que
 * le rendu ; `override` = géométrie à contrôler à la place de celle du visage (contrôles négatifs).
 *
 *  GÉOMÉTRIE  — le dôme est dessiné par des mèches, pas par un casque lisse :
 *    `shell-rim-bare`       part NUE de la moitié extérieure de la coque ≤ seuil de la coiffure + 0,15 (`FILL.rim`, relâché par `fillKeep` : densité et éclaircissement ;
 *                           les zones clairsemées voulues sont hors mesure) — avertissement ;
 *    `shell-rim-bare-hard`  même part ≤ 0,75 (relâché de même) : en deçà, la silhouette est un aplat (mesuré avant remplissage : 0,89 afro, 0,85 court, 0,79 bouclé) — erreur ;
 *                           coiffures à mèches pendantes exclues : leur bord est la retombée, mesurée par `lock-envelope-bound` ;
 *    `fill-within-reach`    aucune forme de remplissage au-delà de la portée de la coiffure (mèches rognées au bord de la coque) ;
 *    `fringe-reach-bound`   une frange ne s'éloigne pas du crâne de plus que la portée de la coiffure + 0,05 W (maximum mesuré 0,099 W sur 80 visages ;
 *                           `HAIR-SKULL-REMAINING.md` 6 : jusqu'ici non contrôlé au polygone) ;
 *  ANATOMIE   — la tête décide :
 *    `fill-clears-free-ear-{left,right}`  aucune mèche de corps dans la zone d'une oreille qui doit rester dégagée
 *                           (une mèche sous l'implantation n'est PAS une erreur : frange et cheveux pendants y descendent ; yeux et sourcils : `guard.ts`) ;
 *  STYLE      — la forme reste du cheveu de la coiffure :
 *    `tier-hue-near-hair`   la sous-couche d'étage reste dans la famille de teinte des cheveux : écart de teinte (rendu) ≤ `UNDER_HUE_MAX` + 24° (`tone()` seul en
 *                           décale jusqu'à 21° : mesuré sur 720 étages) ; avant le plafond, 66° : sous-couche vert olive sous des cheveux rouges. Cheveux gris (saturation < 0,15) exclus ;
 *    `fill-style-scope`     seules les coiffures de `FILL` reçoivent un remplissage, dans son plafond : chignon, queue, tresses, coupe rase et cheveux simulés restent des aplats / leur propre moteur.
 */
type Style = Exclude<RandomFace['params']['hair']['style'], 'bald'>;
const HANG: readonly string[] = ['bob', 'long'];

const hueGap = (a: number, b: number): number => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };

/** `shift` : décalage de teinte appliqué à un étage (le rendu) ; remplaçable pour les contrôles négatifs. */
export function checkHairForm(face: RandomFace, override?: HairGeometry, shift: typeof tierHueShift = tierHueShift): Check[] {
  const p = face.params;
  if (p.hair.style === 'bald') return [];
  const lm = faceLandmarks(p, face.width, face.height);
  const geo = override ?? hairGeometry(p, lm);
  if (!geo) return [];
  const { W } = lm, S = geo.boundary.skull, style = p.hair.style as Style, spec = FILL[style], out: Check[] = [];

  // --- géométrie ---
  if (spec && !p.hair.sim.enabled) {
    const polys = geo.locks.filter((l) => l.layer === 'front' && l.rank !== 'hairline').map((l) => l.poly);
    const cov = shellCoverage(S, geo.base[0] as never, W, polys, geo.bare.thin), keep = fillKeep(p.hair);
    out.push(check('geometry', 'shell-rim-bare', '<=', cov.rim, relaxedBare(spec.rim, keep) + 0.15, 'le bord de la coque est un aplat lisse : peu de mèches dessinent la silhouette du dôme', 'warn'));
    if (!HANG.includes(style)) out.push(check('geometry', 'shell-rim-bare-hard', '<=', cov.rim, relaxedBare(0.75, keep), 'le bord de la coque est presque entièrement nu : la silhouette est un casque lisse, pas des cheveux'));
  }
  let away = 0;
  for (const l of geo.locks) if (l.bounded && !l.sim && l.layer === 'front') for (const q of l.poly) if (q.y <= (HANG.includes(style) ? lm.hair.sideY : Infinity)) away = Math.max(away, distanceOutsideSkull(S, q) / W);
  out.push(check('geometry', 'fill-within-reach', '<=', away, REACH[style].side + 0.1 * Math.min(1, Math.hypot(p.hair.wind.x, p.hair.wind.y) * p.hair.wind.flex) + 0.02, 'une forme de cheveux dépasse la portée de la coiffure'));

  let fr = 0;
  for (const l of geo.locks) if (l.kind === 'fringe' && l.layer === 'front' && !l.sim) for (const q of l.poly) fr = Math.max(fr, distanceOutsideSkull(S, q) / W);
  out.push(check('geometry', 'fringe-reach-bound', '<=', fr, REACH[style].side + 0.05, 'une frange s\'éloigne du crâne plus que la portée de la coiffure'));

  // --- anatomie ---
  for (const side of ['left', 'right'] as const) {
    const info = geo.sides[side];
    if (info.ear === 'covered') continue;
    const hit = geo.locks.filter((l) => l.layer === 'front' && l.rank !== 'hairline' && l.rank !== 'mass' && !l.part && l.poly.some((q) => inPoly(info.earZone, q.x, q.y))).length;
    out.push(check('anatomy', `fill-clears-free-ear-${side}`, '<=', hit, 3, `des mèches recouvrent l'oreille ${side === 'left' ? 'gauche' : 'droite'} alors qu'elle doit rester dégagée`));
  }

  // --- style ---
  const ra = hairAppearance(p.hair), base = toHsl(ra.base);
  if (base.s >= 0.15 && geo.tierMasses.length) {
    let gap = 0;
    for (const m of geo.tierMasses) gap = Math.max(gap, hueGap(toHsl(ra.tone(p.hair.tiers.underTone * Math.min(1, 0.6 + 0.2 * m.tier))).h + shift(p.hair, m.tier), base.h));
    out.push(check('style', 'tier-hue-near-hair', '<=', gap, UNDER_HUE_MAX + 24, 'la sous-couche d\'étage change de famille de teinte : plaque étrangère sous les mèches'));
  }
  const nFill = new Set(geo.locks.filter((l) => l.fill).map((l) => l.fill)).size;
  out.push(check('style', 'fill-style-scope', '<=', nFill, spec && !p.hair.sim.enabled ? spec.max : 0, spec && !p.hair.sim.enabled ? 'plus de mèches de remplissage (indices distincts) que le plafond de la coiffure' : 'cette coiffure est un aplat (rase, attachée, simulée) : elle ne reçoit aucune mèche de remplissage'));
  return out;
}
