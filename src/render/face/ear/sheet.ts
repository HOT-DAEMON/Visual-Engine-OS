import { resolveAppearance } from '../../../appearance';
import { el, num, urlRef } from '../../../core/svg';
import type { Vec } from '../../../geometry/eye/primitives';
import { earGeometry, type FaceLandmarks } from '../../../face';
import { projectEar, VIEW_YAW, type ViewName } from '../../../face/ear/project';
import { lightVector, type LightVector } from '../../../lighting/light';
import type { FaceParams } from '../../../schema';
import { earJewelry } from './jewelry';
import { renderEarProjected } from './render';

export interface EarViewOptions {
  readonly view: ViewName;
  readonly side?: -1 | 1;
  readonly width: number;
  readonly height: number;
  readonly skin: string;
  /** Lumière (sinon : haut-gauche pour les vues normales, rasante pour le gros plan). */
  readonly light?: LightVector;
  /** Grossissement du cadrage (1 = l'oreille occupe ~78 % de la hauteur). */
  readonly zoom?: number;
}

/**
 * Vue d'UNE oreille (profil, trois-quarts, gros plan éclairé) : le MÊME `EarModel` et le MÊME placement que le rendu de face, projetés avec le lacet de
 * la vue. Le fond est un morceau de la tête (peau, ombre de la joue en avant de l'oreille) : ce n'est pas un second visage, juste le support de lecture.
 * L'oreille gauche se montre avec un lacet négatif (la caméra passe de l'autre côté).
 */
export function earViewSvg(p: FaceParams, lm: FaceLandmarks, o: EarViewOptions): string {
  const side = o.side ?? 1;
  const g = earGeometry(p, lm).find((e) => e.side === side);
  if (!g || !g.model || !g.placement) return el('svg', { xmlns: 'http://www.w3.org/2000/svg', width: o.width, height: o.height, viewBox: `0 0 ${o.width} ${o.height}` });
  const ra = resolveAppearance(o.skin, p.skin);
  const yaw = VIEW_YAW[o.view] * side;
  const L = o.light ?? (o.view === 'close-up' ? lightVector({ azimuthDeg: side > 0 ? 300 : 60, elevationDeg: 32, color: '#ffffff', intensity: 1 }) : lightVector({ azimuthDeg: 330, elevationDeg: 55, color: '#ffffff', intensity: 1 }));
  const pe = projectEar(g.model, g.placement, yaw, o.view);
  const hPx = g.placement.hPx;
  const c = { x: (pe.bbox.x0 + pe.bbox.x1) / 2, y: (pe.bbox.y0 + pe.bbox.y1) / 2 };
  const k = ((o.height * 0.78) / hPx) * (o.zoom ?? 1);
  const defs: string[] = [];
  const earUp = renderEarProjected(`v-${o.view}`, pe, g.model, p.ears, o.skin, ra, L, hPx);
  defs.push(...earUp.defs);
  // Bord antérieur de l'oreille à l'écran → la joue / la face est de CE côté (ombre douce, étalée).
  const ant = pe.landmarks.crus as Vec;
  const toFace = Math.sign((pe.landmarks.tragus as Vec).x - (pe.landmarks.antitragus as Vec).x) || -side;
  const jewels = earJewelry(p, lm, g, yaw).map((j) => j.markup).join('');
  const gid = `bg-${o.view}`;
  defs.push(el('linearGradient', { id: gid, x1: 0, y1: 0, x2: 1, y2: 1 }, [el('stop', { offset: 0, 'stop-color': ra.tone(0.12, o.skin) }), el('stop', { offset: 1, 'stop-color': ra.tone(-0.25, o.skin) })]));
  defs.push(el('radialGradient', { id: `cheek-${o.view}`, cx: num(ant.x + toFace * hPx * 0.7), cy: num(ant.y + hPx * 0.35), r: num(hPx * 0.7), gradientUnits: 'userSpaceOnUse' }, [el('stop', { offset: 0, 'stop-color': ra.shadow, 'stop-opacity': o.view === 'face' ? 0 : 0.4 }), el('stop', { offset: 1, 'stop-color': ra.shadow, 'stop-opacity': 0 })]));
  const cheek = el('circle', { cx: num(ant.x + toFace * hPx * 0.7), cy: num(ant.y + hPx * 0.35), r: num(hPx * 0.7), fill: urlRef(`cheek-${o.view}`) });
  return el('svg', { xmlns: 'http://www.w3.org/2000/svg', width: o.width, height: o.height, viewBox: `0 0 ${o.width} ${o.height}` }, [
    el('defs', {}, defs),
    el('rect', { width: o.width, height: o.height, fill: urlRef(gid) }),
    el('g', { transform: `translate(${num(o.width / 2)} ${num(o.height / 2)}) scale(${num(k)}) translate(${num(-c.x)} ${num(-c.y)})` }, [
      cheek,
      earUp.markup,
      jewels,
    ]),
  ]);
}
