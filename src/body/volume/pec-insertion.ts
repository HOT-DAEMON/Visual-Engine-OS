import type { BodyFrame } from '../frame';
import type { ArmChain } from './limb';
import type { Ctl } from './loft';
import { vol } from './mk';
import type { Trunk } from './trunk';
import type { Volume } from './types';
import { add3, cross3, mul3, norm3, type P3 } from './vec3';

/**
 * INSERTION DU GRAND PECTORAL (itération 08) : prolonge le chef sterno-costal de son bord (aisselle) jusqu'à la lèvre latérale du sillon bicipital de l'humérus, par-dessus le
 * deltoïde (couche 5 contre 4). Anatomie : le muscle se resserre en un tendon plat qui passe DEVANT l'humérus, sous le bord antérieur du deltoïde ; le sillon delto-pectoral est
 * la gouttière entre les deux. Jusqu'à l'itération 07 le pectoral s'arrêtait net au bord du tronc, et le deltoïde restait une masse fuselée sans recouvrement (docs/BODY-JUNCTIONS-07-REMAINING.md).
 * Toutes les cotes sont des multiples de H (hauteur de tête) ou du rayon du bras `rU` ; `k` module l'épaisseur avec la musculature visible (0 = fin, 1 = épais).
 */
export function pectoralInsertion(tr: Trunk, ch: ArmChain, f: BodyFrame, k: number): Volume {
  const H = f.h, y = f.y, s = ch.side, sd = s > 0 ? 'L' : 'R', rU = f.arm.armHalf, L = f.arm.upper, { sh, up, ant } = ch;
  const out = mul3(norm3(cross3(up, ant)), s) as P3, med = mul3(out, -1) as P3;
  // Départ : même point que la dernière section du chef sterno-costal (ψ = 1,12, y = aisselle − 0,01 H, enfoncé de 35 % de b) pour que les deux volumes se rejoignent sans marche.
  const t0 = tr.point(y.axilla - 0.01 * H, s * 1.12, 0.04 * H * 0.35);
  const t1 = tr.point(y.axilla - 0.005 * H, s * 1.3, 0.03 * H * 0.35);
  // Milieu : sur l'avant de l'épaule, devant la tête humérale ; arrivée : face antéro-médiale de l'humérus, sous le bord antérieur du deltoïde.
  const mid: P3 = add3(add3(sh, mul3(up, 0.0 * L)), add3(mul3(ant, rU * 0.8), mul3(med, rU * 0.5)));
  const end: P3 = add3(add3(sh, mul3(up, 0.11 * L)), add3(mul3(ant, rU * 0.7), mul3(med, rU * 0.2)));
  const tip: P3 = add3(add3(sh, mul3(up, 0.165 * L)), add3(mul3(ant, rU * 0.62), mul3(med, rU * 0.1)));
  const th = 0.012 * H * (0.8 + 0.5 * k);
  const ctl: Ctl[] = [
    { c: t0.p, a: 0.05 * H, b: 0.04 * H, hint: t0.n }, { c: t1.p, a: 0.042 * H, b: 0.034 * H + th * 0.4, hint: t1.n },
    { c: mid, a: rU * 0.5, b: 0.026 * H + th * 0.5, hint: ant }, { c: end, a: rU * 0.26, b: 0.014 * H + th * 0.25, hint: ant },
    { c: tip, a: rU * 0.1, b: 0.006 * H, hint: ant }, // tendon plat : l'extrémité s'effile au lieu de se refermer en bulbe
  ];
  return vol({ id: `pectoralis.insertion.${sd}`, name: 'grand pectoral — insertion humérale (tendon plat devant l’humérus)', group: 'chest', side: sd as 'L' | 'R', parent: `pectoralis.sternal.${sd}`, layer: 5, tier: 1,
    fibres: [1.3, 1.45, 1.57, 1.7, 1.85], origin: 'sternum', insertion: 'humerus', n: 12, mass: 'pectoralis' }, ctl);
}
