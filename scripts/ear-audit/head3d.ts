import { compileScene, generateRandomFace } from '../../src';
import { rasterPng } from '../lib/raster';

/** Tête entière en 3D (kind `head_3d`, la tête tourne) avec l'oreille du moteur : rendu réel de `compileScene`. `yaw` en degrés (90 = profil). */
export function head3dPng(seed: number, ears: object, yaw: number, o: { width?: number } = {}): Buffer {
  const f = generateRandomFace(seed, { id: 'f0', hairEngine: 'classic', transform: { x: 400, y: 420, scale: 1 } } as never);
  const host = f.objects[0] as { face: Record<string, unknown> };
  host.face = { ...host.face, anatomyEngine: 'structured', hair: { ...(host.face.hair as object), style: 'bald' }, facialHair: { ...(host.face.facialHair as object), beard: 'none', mustache: 'none' }, ears: { engine: 'morphology', visible: true, ...ears } };
  const objects = [...f.objects, { kind: 'head_3d', id: 't0', host: 'f0', resolution: 2, yaw, pitch: 0, transform: { x: 400, y: 60, scale: 2.1 } }];
  const r = compileScene({ width: 800, height: 800, background: '#ffffff', objects } as never) as { ok: boolean; svg: string; issues: string[] };
  if (!r.ok) throw new Error(r.issues.join('\n'));
  // Retire le dessin de face de l'hôte : ne garde que la tête 3D (dernier groupe).
  const g = r.svg.slice(r.svg.lastIndexOf('<g transform'), r.svg.lastIndexOf('</svg>'));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="800" height="800" viewBox="0 0 800 800"><rect width="800" height="800" fill="#fff"/>${g}</svg>`;
  return rasterPng(svg, { fitWidth: o.width ?? 400 });
}
