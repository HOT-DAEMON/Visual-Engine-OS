import { dominantColor } from '../materials';
import { memoPure } from '../perf';
import { headLit, hostFace as reliefFace, lightModelOfSpec } from '../relief';
import type { HeadLitSpec, HostSpec, LightSpec } from '../schema';
import { objectTransform, type CompiledObject } from './object';
import { el } from '../core/svg';

/**
 * Compile l'éclairage par relief d'un hôte-visage : relief → ombres portées + AO → éclairage par pixel (`relief/overlay.ts`), posé PAR-DESSUS tout
 * (`top`) dans le repère de l'hôte. La lumière est celle de la scène, surchargée par `o.light`. Mémoïsé par le contenu (hôte + lumière + options).
 */
const build = (host: HostSpec, o: HeadLitSpec, scene: LightSpec): string => {
  const face = reliefFace(host);
  const model = lightModelOfSpec(scene, o);
  return headLit(face.p, face.lm, face.nose, dominantColor(host.material.base), model, { ppu: o.ppu, ao: o.ao }).svg;
};
const memo = memoPure('head-lit-svg', 'svg', build, 32);

export function compileHeadLit(o: HeadLitSpec, host: HostSpec, scene: LightSpec): CompiledObject {
  return { defs: [], markup: '', top: el('g', { transform: objectTransform(host.transform) }, [memo(host, o, scene)]) };
}
