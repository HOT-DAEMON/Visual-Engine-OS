import { el, num } from '../core/svg';
import { resolveAppearance, type ResolvedAppearance } from '../appearance';
import { earGeometry, faceLandmarks } from '../face';
import { projectEar } from '../face/ear/project';
import { lightVector } from '../lighting/light';
import { renderEarProjected } from '../render/face/ear/render';
import { FaceParams } from '../schema';
import type { SkullGeo } from './geometry';

/**
 * OREILLE EN PROFIL : le MÊME modèle d'oreille que la vue de face (`face/ear/`), projeté à 90° (`projectEar`) — pas une seconde géométrie.
 * Hauteurs identiques à la face (hélix à la ligne des yeux, lobule à la base du nez) ; le canal est ancré sur le porion. Le groupe est
 * miroité (l'avant du visage est à droite) ; la lumière est miroitée avec lui pour que l'éclairage reste cohérent avec le reste de la tête.
 */
export function profileEar(g: SkullGeo, faceIn: FaceParams, skin: string, ra: ResolvedAppearance, light: { x: number; y: number; z: number }): { defs: string[]; markup: string; box: { x0: number; y0: number; x1: number; y1: number } } | null {
  const face = FaceParams.parse({ ...faceIn, anatomyEngine: 'structured', ears: { ...faceIn.ears, visible: true, style: { ...faceIn.ears.style, look: 'anime' } } });
  const hostH = g.frame.hostH;
  const lm = faceLandmarks(face, hostH * 0.8, hostH);
  const e = earGeometry(face, lm)[1];
  if (!e?.model || !e.placement) return null;
  const pe = projectEar(e.model, e.placement, 90, 'profile');
  const S = g.frame.S;
  const canal = pe.landmarks.canal as { x: number; y: number };
  const tx = S * canal.x;
  const ty = S * (hostH / 2) + (g.frame.f.porion * g.H - S * (canal.y + hostH / 2));
  const L = lightVector({ azimuthDeg: 330, elevationDeg: 55, color: '#ffffff', intensity: 1 });
  const Lm = { ...L, x: -Math.abs(light.x), y: light.y };
  const out = renderEarProjected('sk-ear', pe, e.model, face.ears, skin, ra, Lm, e.placement.hPx);
  const b = pe.bbox;
  return { defs: out.defs, markup: el('g', { transform: `matrix(${num(-S)} 0 0 ${num(S)} ${num(tx)} ${num(ty)})` }, [out.markup]), box: { x0: -S * b.x1 + tx, x1: -S * b.x0 + tx, y0: S * b.y0 + ty, y1: S * b.y1 + ty } };
}
export { resolveAppearance };
