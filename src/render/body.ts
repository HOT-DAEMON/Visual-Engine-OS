import { dominantColor } from '../materials';
import { bodyMarkup } from '../body/markup';
import { figureMarkup } from '../body/lower';
import type { NeckAnchor } from '../body/types';
import { objectTransform, type CompiledObject } from './object';
import { hostFace } from './face';
import type { BodySpec, HostSpec } from '../schema';
import { el } from '../core/svg';

/**
 * Compile un corps suspendu au cou de son hôte. Le corps ne sait du visage que `NeckAnchor` (dérivé des repères STYLISÉS de l'hôte).
 * `back` (torse, bras, mains) part en `underlay` (derrière le visage) ; `front` (fondu de la base du cou) part en `overlay`
 * (après tout, comme `composeFigure`). Les deux portent la transformation de l'hôte : même repère que le visage.
 */
/** Ancre de cou d'un hôte-visage : SEUL lien du corps avec la tête (repères stylisés, source unique `hostFace`). */
export function neckAnchor(host: HostSpec): NeckAnchor {
  const { params, lm } = hostFace(host);
  const { half, bottomY } = lm.neck;
  return { h: lm.H, chinY: lm.chinY, baseY: bottomY, baseHalf: half * (1 + params.neck.flare) };
}

export function compileBody(b: BodySpec, host: HostSpec): CompiledObject {
  const opts = { skin: dominantColor(host.material.base), level: b.level, mode: b.mode, uid: b.id };
  // `legs: false` → buste (sortie historique identique) ; sinon figure : bassin et jambes DERRIÈRE le tronc, même ancre de cou, même peau.
  const m = b.legs === false ? bodyMarkup(b.body, neckAnchor(host), opts) : figureMarkup(b.body, b.legs, neckAnchor(host), opts);
  const g = (inner: string): string => el('g', { transform: objectTransform(host.transform) }, [inner]);
  return { defs: [], markup: '', underlay: g(m.back), overlay: g(m.front) };
}
