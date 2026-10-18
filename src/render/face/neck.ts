import { darken } from '../../core/color';
import type { ResolvedAppearance } from '../../appearance';
import { el, num, urlRef } from '../../core/svg';
import type { FaceLandmarks } from '../../face';
import { spotGradient } from '../../materials';
import type { FaceParams } from '../../schema';

/** Contour du cou : côtés verticaux sous la tête, puis élargissement (trapèzes) et base arrondie. */
export function neckPath(p: FaceParams, lm: FaceLandmarks): string {
  const { half, topY, bottomY } = lm.neck;
  const flare = half * p.neck.flare;
  const y1 = lm.H / 2 + 0.35 * (bottomY - lm.H / 2);
  const f = (x: number, y: number): string => `${num(x)} ${num(y)}`;
  const xb = half + flare;
  return `M${f(-half, topY)}L${f(-half, y1)}C${f(-half, y1 + 0.4 * (bottomY - y1))} ${f(-xb, y1 + 0.5 * (bottomY - y1))} ${f(-xb, bottomY - 0.02 * lm.H)}Q${f(-xb, bottomY)} ${f(-xb * 0.9, bottomY)}L${f(xb * 0.9, bottomY)}Q${f(xb, bottomY)} ${f(xb, bottomY - 0.02 * lm.H)}C${f(xb, y1 + 0.5 * (bottomY - y1))} ${f(half, y1 + 0.4 * (bottomY - y1))} ${f(half, y1)}L${f(half, topY)}Z`;
}

/**
 * Cou : enfant du visage (sa largeur est bornée entre le menton et la mâchoire, son haut est caché
 * derrière la tête). Teinte de la peau assombrie, ombre portée du menton, deux creux latéraux
 * (sterno-cléido-mastoïdiens). Dessiné AVANT la tête.
 */
export function renderNeck(id: string, p: FaceParams, lm: FaceLandmarks, skin: string, ra: ResolvedAppearance): { defs: string[]; markup: string[] } {
  if (!p.neck.visible) return { defs: [], markup: [] };
  const base = ra.tone(-(0.25 + 0.4 * p.neck.shade), skin);
  const d = neckPath(p, lm);
  const clipId = `${id}-neck-clip`;
  const gid = `${id}-neck-shadow`;
  const { half, bottomY } = lm.neck;
  const len = bottomY - lm.H / 2;
  const defs = [el('clipPath', { id: clipId }, [el('path', { d })]), spotGradient(gid, darken(ra.shadow, 0.55), 0.55 * (0.5 + p.neck.shade), 0.8)];
  const groove = (sg: -1 | 1): string =>
    el('path', { d: `M${num(sg * half * 0.8)} ${num(lm.jawY)}C${num(sg * half * 0.7)} ${num(lm.H / 2 + 0.2 * len)} ${num(sg * half * 0.4)} ${num(lm.H / 2 + 0.6 * len)} ${num(sg * half * 0.2)} ${num(bottomY)}`, fill: 'none', stroke: ra.tone(-1, skin), 'stroke-width': half * 0.12, 'stroke-linecap': 'round', opacity: 0.22 });
  const markup = [
    el('path', { d, fill: base }),
    el('g', { 'clip-path': urlRef(clipId) }, [
      el('ellipse', { cx: 0, cy: lm.H / 2 + 0.04 * lm.H, rx: half * 1.3, ry: Math.max(0.06 * lm.H, 0.45 * len), fill: urlRef(gid) }),
      groove(-1),
      groove(1),
    ]),
  ];
  return { defs, markup };
}
