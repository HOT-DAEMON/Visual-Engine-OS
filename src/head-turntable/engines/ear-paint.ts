import { mix, type RGB } from '../color';
import type { Pal } from '../face-tex';
import { smooth } from '../math';
import { REGION } from '../types';
import type { EarField } from './ear-field';
import { inkAt, texelAt } from './ear-field';

/** Structures en creux (ombrées) et en relief (éclaircies) : teintes lues sur le relief du moteur, pas sur une ellipse. */
const DEEP = new Set(['cavum', 'canal', 'cymba', 'fossa', 'scapha', 'notch', 'antihelix:groove-conch', 'antihelix:groove-scapha']);

/** Couleur d'un pixel de l'oreille : face externe (u, v dans le plan) ou dos. `kw` compense le raccourcissement du trait ; `lineU` = épaisseur visible visée (U) ; `hU` = hauteur de l'oreille (U). */
export function earColor(f: EarField, u: number, v: number, front: boolean, kw: number, pal: Pal, lineU: number, hU: number): { c: RGB; region: number; ink: boolean } {
  if (!front) return inkAt(f, u, v) < (0.4 * lineU * kw) / hU ? { c: pal.ink, region: REGION.ear, ink: true } : { c: mix(pal.skin, pal.shade, 0.2), region: REGION.ear, ink: false };
  const t = texelAt(f, u, v);
  if (t.lab === 255) return { c: pal.skin, region: REGION.ear, ink: false };
  if (inkAt(f, u, v) < (0.5 * lineU * kw) / hU) return { c: pal.ink, region: REGION.ear, ink: true };
  const name = t.lab > 0 ? f.names[t.lab - 1]! : '';
  const depth = DEEP.has(name) ? smooth(-t.rel / 0.6) : 0;
  return { c: mix(pal.skin, pal.shade, Math.min(0.85, 0.25 + 0.6 * depth)), region: REGION.ear, ink: false };
}
