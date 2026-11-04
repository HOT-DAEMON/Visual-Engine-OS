import { faceLandmarks, noseGeometry, type FaceLandmarks, type NoseGeometry } from '../face';
import { applyStylization } from '../face/stylize';
import { FaceParams } from '../schema';
import { headLit, type HeadLit, type HeadLitOpts } from './overlay';
import type { LightModel } from './model';

/** Paramètres de visage RÉSOLUS d'un hôte (même chaîne que `render/face/face.ts` : analyse du schéma, stylisation, repères, nez). */
export interface HostFace { readonly p: FaceParams; readonly lm: FaceLandmarks; readonly nose: NoseGeometry }
export function hostFace(host: { readonly face?: unknown; readonly width: number; readonly height: number }): HostFace {
  const p = applyStylization(FaceParams.parse(host.face ?? {})), lm = faceLandmarks(p, host.width, host.height);
  return { p, lm, nose: noseGeometry(p, lm) };
}
/** Pose la couche d'éclairage de la tête sur une scène compilée, dans le repère de l'hôte (même transformation que `composeFigure`), tout à la fin. */
export function litHead(sceneSvg: string, host: { readonly face?: unknown; readonly width: number; readonly height: number }, skin: string, model: LightModel, o: HeadLitOpts = {}): { svg: string; lit: HeadLit; face: HostFace } {
  const hit = /(<rect [^>]*\/>)(<g transform="([^"]*)">)/.exec(sceneSvg); if (!hit) throw new Error('litHead : structure de scène inattendue');
  const face = hostFace(host), lit = headLit(face.p, face.lm, face.nose, skin, model, o), end = sceneSvg.lastIndexOf('</svg>');
  return { svg: `${sceneSvg.slice(0, end)}<g transform="${hit[3]}">${lit.svg}</g></svg>`, lit, face };
}

import { composeFigure } from '../body/compose';
import { renderVolumesPixel, type PixelOpts, type VPixelMarkup } from '../body/volume/pixel';
import type { VolumeSet } from '../body/volume/types';

/** Profondeur z (repère du corps) de l'axe du cou à la hauteur `y` : lue sur l'enveloppe `neck` du corps, pour que la tête et le cou 3D partagent le même plan. */
export function neckAxisZ(set: VolumeSet, y: number): number {
  const st = set.byId.get('neck')?.stations ?? []; if (st.length === 0) return 0;
  const a = [...st].sort((p, q) => Math.abs(p.c.y - y) - Math.abs(q.c.y - y)); return a[0]!.c.z;
}
export interface LitFigure { readonly svg: string; readonly head: HeadLit; readonly body: VPixelMarkup; readonly face: HostFace }
/**
 * FIGURE ÉCLAIRÉE : le corps (rendu par pixel) reçoit l'ombre de la tête (le menton sur le cou et la poitrine) ; la tête reçoit sa couche d'éclairage ; les deux
 * lisent le MÊME `LightModel`. Le corps est dessiné derrière le visage, la couche de tête par-dessus (via `composeFigure`).
 */
export function litFigure(sceneSvg: string, host: { readonly face?: unknown; readonly width: number; readonly height: number }, skin: string, set: VolumeSet, model: LightModel, o: Omit<PixelOpts, 'skin' | 'lightModel' | 'proxy'> & { readonly headPpu?: number } = {}): LitFigure {
  const face = hostFace(host), za = neckAxisZ(set, face.lm.chinY), W = face.lm.W;
  const head = headLit(face.p, face.lm, face.nose, skin, model, { zc: za + 0.05 * W, neckAxisZ: za, ppu: o.headPpu ?? 2.4 });
  const f = head.field, front = (o.camera?.yaw ?? 0) === 0;
  const proxy = front ? (x: number, y: number): number => { const i = Math.floor((x - f.x0) * f.ppu), j = Math.floor((y - f.y0) * f.ppu); return i < 0 || j < 0 || i >= f.w || j >= f.h ? -Infinity : f.depth[j * f.w + i]!; } : undefined;
  const body = renderVolumesPixel(set, { ...o, skin, lightModel: model, ...(proxy ? { proxy } : {}) });
  return { svg: composeFigure(sceneSvg, { back: body.svg, front: front ? head.svg : '' } as never), head, body, face };
}
