import { dominantColor } from '../materials';
import { anchorFromLandmarks } from '../body/anchor';
import { bodyMarkup } from '../body/markup';
import type { BodyRenderOpts } from '../body/render';
import { figureMarkup } from '../body/lower';
import type { NeckAnchor } from '../body/types';
import { objectTransform, type CompiledObject } from './object';
import { hostFace, skinAppearance } from './face';
import type { BodySpec, HostSpec } from '../schema';
import { el } from '../core/svg';
import { neckPath } from './neck';
import { neckBase } from './neck/skin';

/**
 * Compile un corps suspendu au cou de son hôte. Le corps ne sait du visage que `NeckAnchor` (dérivé des repères STYLISÉS de l'hôte).
 * `back` (torse, bras, mains) part en `underlay` (derrière le visage) ; `front` (fondu de la base du cou) part en `overlay`
 * (après tout, comme `composeFigure`). Les deux portent la transformation de l'hôte : même repère que le visage.
 */
/** Ancre de cou d'un hôte-visage : SEUL lien du corps avec la tête. Repères stylisés (source unique `hostFace`) → dernière section du MOTEUR DE COU (`anchorFromLandmarks`, formule unique). */
export function neckAnchor(host: HostSpec): NeckAnchor {
  const { params, lm } = hostFace(host);
  return anchorFromLandmarks(params, lm);
}

/**
 * Options de rendu d'un corps sur son hôte : SOURCE UNIQUE (la scène et `verifyPipeline` les utilisent, pour que ce qui est vérifié soit ce qui est dessiné).
 * Le fondu de la base du cou est borné par le CONTOUR RÉEL du cou (moteur de cou) : un rectangle de largeur constante dépassait du cou sur le fond.
 */
export function bodyRenderOpts(b: Pick<BodySpec, 'id' | 'level' | 'mode'>, host: HostSpec): BodyRenderOpts {
  const { params, lm } = hostFace(host), skin = dominantColor(host.material.base), ra = skinAppearance(skin, params);
  // Teintes du corps = apparence de la peau du visage (celle que lit le cou) ; le fondu de la base du cou converge vers la couleur de base du COU (même ton que le cou).
  const sf = params.neck.system?.surface, elementColor = sf && sf.pattern !== 'smooth' ? sf.elementColor : null;
  return { skin, level: b.level, mode: b.mode, uid: b.id, appearance: { base: ra.base, shadow: ra.shadow }, ...(params.neck.visible ? { neckContour: neckPath(params, lm), neckTone: neckBase(ra, params.neck.shade, elementColor) } : {}) };
}

export function compileBody(b: BodySpec, host: HostSpec): CompiledObject {
  const opts = bodyRenderOpts(b, host), anchor = neckAnchor(host);
  // `legs: false` → buste (sortie historique identique) ; sinon figure : bassin et jambes DERRIÈRE le tronc, même ancre de cou, même peau.
  const m = b.legs === false ? bodyMarkup(b.body, anchor, opts) : figureMarkup(b.body, b.legs, anchor, opts);
  const g = (inner: string): string => el('g', { transform: objectTransform(host.transform) }, [inner]);
  return { defs: [], markup: '', underlay: g(m.back), overlay: g(m.front) };
}
