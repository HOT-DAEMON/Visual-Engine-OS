import type { ResolvedAppearance } from '../../appearance';
import { el, num, urlRef } from '../../core/svg';
import type { FaceLandmarks } from '../../face';
import { direction2D, type LightVector } from '../../lighting/light';
import { intensityFor } from '../../lighting/rig';
import { gradientStop as stop } from '../../materials';
import type { FaceParams } from '../../schema';
import { lineD, softKit } from './soft';

/** Contour du cou : côtés verticaux sous la tête, puis élargissement (trapèzes) et base arrondie. Le départ de l'évasement suit le bas RÉEL du menton. */
export function neckPath(p: FaceParams, lm: FaceLandmarks): string {
  const { half, topY, bottomY } = lm.neck;
  const flare = half * p.neck.flare;
  const y1 = lm.chinY + 0.35 * (bottomY - lm.chinY);
  const f = (x: number, y: number): string => `${num(x)} ${num(y)}`;
  const xb = half + flare;
  return `M${f(-half, topY)}L${f(-half, y1)}C${f(-half, y1 + 0.4 * (bottomY - y1))} ${f(-xb, y1 + 0.5 * (bottomY - y1))} ${f(-xb, bottomY - 0.02 * lm.H)}Q${f(-xb, bottomY)} ${f(-xb * 0.9, bottomY)}L${f(xb * 0.9, bottomY)}Q${f(xb, bottomY)} ${f(xb, bottomY - 0.02 * lm.H)}C${f(xb, y1 + 0.5 * (bottomY - y1))} ${f(half, y1 + 0.4 * (bottomY - y1))} ${f(half, y1)}L${f(half, topY)}Z`;
}

/**
 * Cou : enfant du visage (largeur bornée entre menton et mâchoire, haut caché derrière la tête), dessiné AVANT la tête. Teinte de la peau
 * assombrie (il est dans l'ombre du menton), ombrage directionnel (côté opposé à la lumière plus sombre), deux creux latéraux
 * (sterno-cléido-mastoïdiens) flous. L'ombre PORTÉE du menton et de la mâchoire sur le cou vient du sous-moteur d'ombres de contact ;
 * la transition mâchoire → cou (`jaw.neckTransition`, `jaw.submental`) en règle la douceur et la force (voir `face.ts`).
 */
export function renderNeck(id: string, p: FaceParams, lm: FaceLandmarks, skin: string, ra: ResolvedAppearance, L: LightVector): { defs: string[]; markup: string[] } {
  if (!p.neck.visible) return { defs: [], markup: [] };
  const kit = softKit(`${id}-neck`, lm.W, lm.H);
  const dir = direction2D(L);
  const I = intensityFor(L, 'skin');
  const base = ra.tone(-(0.25 + 0.4 * p.neck.shade), skin);
  const d = neckPath(p, lm);
  const clipId = `${id}-neck-clip`;
  const gid = `${id}-neck-side`;
  const { half, bottomY } = lm.neck;
  const len = bottomY - lm.chinY;
  const u = lm.W / 300;
  const defs = [
    el('clipPath', { id: clipId }, [el('path', { d })]),
    // Côté opposé à la lumière plus sombre : dégradé horizontal (ou vertical si la lumière est surtout haute/basse) le long de la direction 2D.
    el('linearGradient', { id: gid, gradientUnits: 'userSpaceOnUse', x1: dir.x * half * 1.6, y1: lm.chinY + len / 2 + dir.y * len * 0.5, x2: -dir.x * half * 1.6, y2: lm.chinY + len / 2 - dir.y * len * 0.5 }, [stop(0, ra.light, 0.12 * I), stop(0.5, ra.shadow, 0.05), stop(1, ra.shadow, 0.3 * (0.6 + 0.4 * I))]),
    ...kit.defs,
  ];
  const groove = (sg: -1 | 1): string => kit.stroke(lineD([{ x: sg * half * 0.8, y: lm.jawY }, { x: sg * half * 0.7, y: lm.chinY + 0.2 * len }, { x: sg * half * 0.4, y: lm.chinY + 0.6 * len }, { x: sg * half * 0.2, y: bottomY }]), ra.tone(-1, skin), half * 0.14, 0.24, 2.2 * u);
  const markup = [el('path', { d, fill: base }), el('g', { 'clip-path': urlRef(clipId) }, [el('path', { d, fill: urlRef(gid) }), groove(-1), groove(1)])];
  return { defs, markup };
}
