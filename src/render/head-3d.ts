import { deriveSkull } from '../skull/derive';
import { dominantColor } from '../materials';
import { el, num } from '../core/svg';
import { memoPure } from '../perf';
import { defaultFrame, renderHead } from '../head-turntable';
import { headSpecFromHost } from '../head-turntable/engines/from-host';
import { withHostEyes } from '../head-turntable/engines/host-eyes';
import { hostEyesU } from './head-3d-eyes';
import { resolveEye } from './eye/eye';
import type { HeadSource } from '../head-turntable/engines/from-face';
import type { HeadTurnSpec, HostEyes } from '../head-turntable';
import { hostFace } from './face';
import { objectTransform, type CompiledObject } from './object';
import type { PlacedEye } from '../anatomy/relations';
import type { Head3dSpec, HostSpec } from '../schema';

/** Repère natif : 240 px par U (hauteur 420 = 1,75 U) ; l'origine est le pivot du cou à la hauteur du sommet, le cadre de la tête en rotation commence à (−0,75 U, −0,2 U). */
export const HEAD3D_PPU = 240;

export interface Head3dSubject { readonly spec: HeadTurnSpec; readonly lengthH: number }

/**
 * Sujet 3D d'un hôte : le visage STYLISÉ de l'hôte (`hostFace`, source unique du visage de face), le crâne dérivé de la même façon que `head_profile`
 * (`deriveSkull`), la peau du matériau de l'hôte, les cheveux de l'objet ou du visage. Mémoïsé par le CONTENU : la spec est l'étape coûteuse (moteurs + sections).
 */
const buildSubject = (host: HostSpec, o: Pick<Head3dSpec, 'skull' | 'variation' | 'hair' | 'hairline'>, iris?: string, eyes?: HostEyes): Head3dSubject => {
  const { params, lm } = hostFace(host);
  const d = deriveSkull(params, lm.W / lm.H, { hair: 'auto', ...o.skull }, o.variation);
  const src: HeadSource = { face: { params, width: lm.W, height: lm.H }, skull: d.skull, derivation: d, skin: dominantColor(host.material.base), hair: o.hair ?? params.hair.color ?? '#4a3222', ...(iris ? { iris } : {}) };
  const spec = headSpecFromHost(src, lm, o.hairline);
  return { spec: eyes ? withHostEyes(spec, eyes) : spec, lengthH: d.lengthH };
};
export const head3dSubject = memoPure('head-3d-subject', 'geometry', buildSubject, 32);

/** Couleur d'iris de l'hôte : la teinte dominante du matériau de l'œil posé sur lui (le premier ; les deux yeux d'un visage partagent le même iris). */
export const irisOf = (eyes: readonly PlacedEye[]): string | undefined => { const m = eyes[0] && resolveEye(eyes[0].eye).iris.material.base; return m ? dominantColor(m) : undefined; };

const build = (host: HostSpec, o: Head3dSpec, iris?: string, eyes?: HostEyes): { svg: string; box: { x: number; y: number; w: number; h: number } } => {
  const { spec } = head3dSubject(host, o, iris, eyes), frame = defaultFrame(420 * o.resolution);
  const r = renderHead({ yaw: o.yaw, pitch: o.pitch, roll: o.roll }, spec, { frame, ss: 2, background: null });
  return { svg: r.svg, box: { x: -r.originX / o.resolution, y: -r.originY / o.resolution, w: r.w / o.resolution, h: r.h / o.resolution } };
};
const memo = memoPure('head-3d-svg', 'svg', build, 32);

/** Les yeux posés sur l'hôte (forme, taille, regard) en yeux de la tête 3D ; `undefined` s'il manque un côté. */
export const hostEyesOf = (host: HostSpec, eyes: readonly PlacedEye[]): HostEyes | undefined => (eyes.length ? hostEyesU(eyes, hostFace(host).lm.H) : undefined);

export function compileHead3d(o: Head3dSpec, host: HostSpec, eyes: readonly PlacedEye[] = []): CompiledObject {
  const { svg, box } = memo(host, o, irisOf(eyes), hostEyesOf(host, eyes));
  const vb = /viewBox="([^"]+)"/.exec(svg)?.[1] ?? `0 0 ${box.w} ${box.h}`;
  // Le <svg> du rendu (image PNG incrustée, pixels) devient un <svg> imbriqué à l'échelle native : l'objet se place par `transform`, comme `head_profile`.
  const inner = svg.replace(/^<svg[^>]*>/, `<svg x="${num(box.x)}" y="${num(box.y)}" width="${num(box.w)}" height="${num(box.h)}" viewBox="${vb}" overflow="visible">`);
  return { defs: [], markup: el('g', { transform: objectTransform(o.transform) }, [inner]) };
}
