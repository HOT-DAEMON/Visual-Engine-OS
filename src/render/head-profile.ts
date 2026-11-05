import { deriveSkull } from '../skull/derive';
import { renderProfile } from '../skull';
import { dominantColor } from '../materials';
import { el, num } from '../core/svg';
import { memoPure } from '../perf';
import { hostFace } from './face';
import { objectTransform, type CompiledObject } from './object';
import type { HeadProfileSpec, HostSpec } from '../schema';

/**
 * Compile la tête de PROFIL d'un hôte-visage : crâne dérivé du visage (`deriveSkull`, déterministe), peau et cheveux du visage, rendu `renderProfile`.
 * `hair: 'auto'` (défaut du profil lié à un visage) : la coiffure de profil est lue sur `FaceHair` de l'hôte, pas chauve.
 * Le profil ne sait du visage que `FaceParams` + le rapport W/H de ses repères (source unique : `hostFace`). Le SVG est mémoïsé par le CONTENU.
 */
const build = (host: HostSpec, o: HeadProfileSpec): { svg: string; box: { x: number; y: number; w: number; h: number } } => {
  const { params, lm } = hostFace(host);
  const d = deriveSkull(params, lm.W / lm.H, { hair: 'auto', ...o.skull }, o.variation);
  const r = renderProfile(params, d.skull, { mode: o.mode, skin: dominantColor(host.material.base), hair: o.hair ?? params.hair.color ?? '#4a3222', background: null });
  return { svg: r.svg, box: r.box };
};
const memo = memoPure('head-profile-svg', 'svg', build, 64);

export function compileHeadProfile(o: HeadProfileSpec, host: HostSpec): CompiledObject {
  const { svg, box } = memo(host, o);
  // Le <svg> du profil devient un <svg> imbriqué : son repère natif (boîte du profil) se pose sous la transformation de l'objet.
  const inner = svg.replace(/^<svg[^>]*>/, `<svg x="${num(box.x)}" y="${num(box.y)}" width="${num(box.w)}" height="${num(box.h)}" viewBox="${num(box.x)} ${num(box.y)} ${num(box.w)} ${num(box.h)}" overflow="visible">`);
  return { defs: [], markup: el('g', { transform: objectTransform(o.transform) }, [inner]) };
}
