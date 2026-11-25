import { canthusLines, canthusOutline, microLod, type OpeningGeometry } from '../../geometry/eye';
import { el } from '../../core/svg';
import type { EyeSpec } from '../../schema';
import { P } from './helpers';

/**
 * EYE-07G — Peinture des petits plis des canthi (géométrie : geometry/eye/canthus-lines.ts). Chaque ride est une pointe effilée REMPLIE (pas un trait de largeur constante) :
 * large à la racine, nulle à la pointe, comme un pli de peau réel. Fini peint : teinte d'ombre de la peau et opacité modulée par la force ; fini `flat` (cel) : encre pleine
 * de la couleur de paupière, sans transparence — le style plat n'a ni translucide ni ombre douce. Retourne [] quand le paramètre est absent ou que le LOD retire tout le détail fin.
 */
export function renderCanthusLines(eye: EyeSpec, g: OpeningGeometry, th: number, color: string, flat: boolean): string[] {
  const o = eye.microdetail?.canthusLines;
  if (!o) return [];
  const fine = microLod(eye.microdetail?.lod.eyePixels ?? null).fine;
  return canthusLines(g, o, eye.seed, th, fine).map((s) => {
    const pts = canthusOutline(s);
    return el('path', { d: `M${P(pts[0]!)}${pts.slice(1).map((p) => `L${P(p)}`).join('')}Z`, fill: color, 'fill-opacity': flat ? 1 : s.alpha, stroke: 'none' });
  });
}
