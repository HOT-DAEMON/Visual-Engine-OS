import { memoPure } from '../perf';
import { bodyGeometry, type BodyGeo } from './geometry';
import { renderBody, type BodyMarkup, type BodyRenderOpts } from './render';
import { box } from './shape';
import { BodyParams, type BodyInput, type NeckAnchor } from './types';

const build = (p: BodyParams, a: NeckAnchor, o: BodyRenderOpts): BodyMarkup => renderBody(bodyGeometry(p, a), o);
const memo = memoPure('body-svg', 'svg', build, 128);
/** SVG du corps, mémoïsé par le CONTENU (paramètres normalisés + ancre + options) : une 2ᵉ demande identique ne coûte aucun calcul. Résultat IMMUABLE. */
export const bodyMarkup = (raw: BodyInput, a: NeckAnchor, o: BodyRenderOpts): BodyMarkup => memo(BodyParams.parse(raw), a, o);

/**
 * Boîte englobante des atomes VISIBLES + marge (px de l'hôte) : sert à RECADRER l'image au plus juste. Le coût d'un rendu croît avec les pixels peints
 * (rastérisation + encodage PNG) : une toile recadrée sur le corps coûte moins qu'une toile générique (mesuré : `scripts/bench-body.ts`).
 */
export function bodyBounds(geo: BodyGeo, margin = 0.08): { x0: number; y0: number; x1: number; y1: number } {
  const b = box(geo.atoms.filter((a) => a.view === 'front' && a.id !== 'neck').flatMap((a) => [...a.poly]));
  const m = margin * geo.frame.h;
  return { x0: b.x0 - m, y0: Math.min(b.y0, geo.frame.a.chinY) - m, x1: b.x1 + m, y1: b.y1 + m };
}
