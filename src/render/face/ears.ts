import type { ResolvedAppearance } from '../../appearance';
import { el } from '../../core/svg';
import { earGeometry } from '../../face';
import type { FaceLandmarks } from '../../face';
import type { LightVector } from '../../lighting/light';
import type { FaceParams } from '../../schema';
import { earJewelry } from './ear/jewelry';
import { renderEarProjected } from './ear/render';

/** Lumière par défaut (haut-gauche) quand l'appelant n'en fournit pas : celle des scènes de référence. */
const DEFAULT_L: LightVector = { x: -0.45, y: -0.62, z: 0.64, color: '#ffffff', intensity: 1 };

/**
 * Oreilles : posées sur le contour du crâne (géométrie dans `face/ears-geometry.ts`), dessinées DERRIÈRE la tête. Moteur `classic` : ellipses d'avant
 * (inchangées). Moteur `morphology` : le modèle d'oreille projeté de face (`ear/render.ts`) + bijoux. `defs` reçoit les filtres et découpes de l'oreille.
 */
export function renderEars(p: FaceParams, lm: FaceLandmarks, skin: string, ra: ResolvedAppearance, L: LightVector = DEFAULT_L, defs?: string[], idPrefix = 'ear'): string[] {
  const ears = earGeometry(p, lm);
  return ears.map((e) => {
    if (e.model && e.front && e.placement) {
      const id = `${idPrefix}${e.side < 0 ? 'L' : 'R'}`;
      const r = renderEarProjected(id, e.front, e.model, p.ears, skin, ra, L, e.placement.hPx);
      defs?.push(...r.defs);
      const jew = earJewelry(p, lm, e).map((j) => j.markup);
      return r.markup + jew.join('');
    }
    const w = e.rx * 2;
    const h = e.ry * 2;
    const sg = e.side;
    return el('g', { transform: `translate(${e.c.x} ${e.c.y}) rotate(${e.tiltDeg})` }, [
      el('ellipse', { cx: 0, cy: 0, rx: w / 2, ry: h / 2, fill: skin, stroke: ra.tone(-0.8, skin), 'stroke-width': w * 0.05 }),
      el('ellipse', { cx: sg * -w * 0.04, cy: h * 0.02, rx: w * 0.26, ry: h * 0.32, fill: ra.tone(-0.4, skin), opacity: 0.7 }),
    ]);
  });
}
