import type { BodyFrame } from '../frame';
import type { Ctl } from './loft';
import { vol } from './mk';
import type { ArmChain } from './limb';
import type { Volume } from './types';
import { add3, mul3, norm3, cross3, type P3 } from './vec3';

/**
 * DELTOÏDE EN UNE MASSE CONTINUE (remplace les trois fuseaux séparés). Un seul volume par épaule : calotte arrondie au-dessus de l'articulation (sa
 * hauteur de sommet est le point mesuré sur ref-02/ref-04, ≈ la chute de l'acromion), ventre large qui enveloppe l'humérus d'un bord à l'autre
 * (largeur antéro-postérieure > rayon du bras), puis effilement en V vers la tubérosité deltoïdienne. Les trois chefs ne sont PAS des volumes :
 * ce sont deux sillons (brins fins posés sur la surface) et la direction des fibres. Toutes les cotes sont des multiples du rayon du bras `rU`
 * (jamais de coordonnée absolue) ; `m` module le volume avec la musculature visible.
 */
const PROFILE: readonly { readonly s: number; readonly off: number; readonly a: number; readonly b: number }[] = [
  { s: 0.05, off: 0.14, a: 0.66, b: 0.50 }, { s: 0.12, off: 0.22, a: 0.90, b: 0.60 }, { s: 0.21, off: 0.26, a: 1.0, b: 0.66 },
  { s: 0.33, off: 0.32, a: 1.0, b: 0.64 }, { s: 0.45, off: 0.36, a: 0.80, b: 0.55 }, { s: 0.57, off: 0.40, a: 0.42, b: 0.46 },
];
export function deltoidMass(ch: ArmChain, f: BodyFrame, m: number): Volume[] {
  const { sh, up, ant } = ch, s = ch.side, sd = s > 0 ? 'L' : 'R', rU = f.arm.armHalf, L = f.arm.upper;
  const out = mul3(norm3(cross3(up, ant)), s) as P3;
  const k = 0.82 + 0.18 * m; // volume : de 0,82 (peu musclé) à 1 (musclé) du profil plein
  const ctl: Ctl[] = PROFILE.map((q) => ({ c: add3(add3(sh, mul3(up, q.s * L)), mul3(out, q.off * rU)), a: q.a * rU * k, b: q.b * rU * k, hint: out }));
  const mass = vol({ id: `deltoid.${sd}`, name: 'deltoïde (masse continue : chefs antérieur, moyen, postérieur)', group: 'shoulder', side: sd as 'L' | 'R', layer: 4, level: 1, tier: 1, mass: 'deltoid',
    fibres: [1.15, 1.35, 1.57, 1.8, 2.0], origin: 'clavicle/acromion/scapular-spine', insertion: 'humerus', n: 12 }, ctl);
  // Sillons entre les chefs : deux brins sur la surface (x/a = ±0,62 de la section, y/b = +0,79), de 12 % à 85 % de la longueur.
  const grooves = ([['ant', 1], ['post', -1]] as const).map(([nm, sg]) => {
    const pts: Ctl[] = [0.14, 0.3, 0.46, 0.62, 0.78, 0.9].map((u) => {
      const i = Math.min(PROFILE.length - 2, Math.floor(u * (PROFILE.length - 1))), t = u * (PROFILE.length - 1) - i;
      const lerp = (g: (q: (typeof PROFILE)[number]) => number): number => g(PROFILE[i]!) + (g(PROFILE[i + 1]!) - g(PROFILE[i]!)) * t;
      const s0 = lerp((q) => q.s), off = lerp((q) => q.off), a = lerp((q) => q.a) * k, b = lerp((q) => q.b) * k;
      const c = add3(add3(add3(sh, mul3(up, s0 * L)), mul3(out, off * rU)), add3(mul3(ant, sg * 0.62 * a * rU), mul3(out, 0.79 * b * rU + 0.006 * f.h)));
      return { c, a: 0.0035 * f.h, b: 0.003 * f.h, hint: out };
    });
    return vol({ id: `deltoid.groove.${nm}.${sd}`, name: `sillon deltoïdien ${nm === 'ant' ? 'antérieur' : 'postérieur'}`, group: 'shoulder', kind: 'landmark', side: sd as 'L' | 'R', level: 3, layer: 6, tier: 3, tone: -0.5, strand: true }, pts);
  });
  return [mass, ...grooves];
}
