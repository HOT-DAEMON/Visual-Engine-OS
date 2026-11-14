import { compileScene, SceneSpec } from '../../src';
import { placedEyesByHost } from '../../src/anatomy/placed';
import { head3dSubject, hostEyesOf } from '../../src/render/head-3d';
import { hairFace, type CleanStyle } from '../lib/hair-faces';
import type { HostSpec } from '../../src/schema';
import type { HeadTurnSpec } from '../../src/head-turntable';

/** Sujet 3D d'un visage à coiffure imposée (graine, style) : la tête tournante construite par le pipeline hôte (même chaîne que `kind: 'head_3d'`). */
export function subjectOf(style: CleanStyle, k: number, o: { seed?: number; hair?: Record<string, unknown>; identity?: number } = {}): { spec: HeadTurnSpec; lengthH: number; sceneObjects: unknown[] } {
  const f = hairFace(style, k, { ...(o.seed !== undefined ? { seed: o.seed } : {}), ...(o.hair ? { hair: o.hair } : {}), ...(o.identity !== undefined ? { identity: o.identity } : {}), id: 'f0', transform: { x: 150, y: 220, scale: 0.8 } });
  const sc = SceneSpec.parse({ width: 700, height: 460, objects: [...f.objects, { kind: 'head_3d', id: 't0', host: 'f0', resolution: 1 }] });
  const host = sc.objects.find((x) => x.kind === 'host') as HostSpec, eyes = hostEyesOf(host, placedEyesByHost(sc).get('f0') ?? []);
  const sub = head3dSubject(host, { skull: {}, variation: { ci: 0, axes: {} }, hair: undefined, hairline: 'host' }, undefined, eyes);
  return { spec: sub.spec, lengthH: sub.lengthH, sceneObjects: f.objects };
}
export { compileScene };
