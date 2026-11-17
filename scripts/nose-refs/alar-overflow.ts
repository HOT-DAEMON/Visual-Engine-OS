import { generateRandomFace } from '../../src';
import { SceneSpec } from '../../src/schema';
import { head3dSubject } from '../../src/render/head-3d';
import { defaultFrame, renderHead } from '../../src/head-turntable';
import type { HeadTurnSpec } from '../../src/head-turntable';

/**
 * Débordement du nez hors du contour de la joue (tête 3D, lacet donné), mesuré par DIFFÉRENCE DE RENDUS : même tête, une fois avec le nez, une fois avec le nez réduit
 * à un fil (bosse de demi-largeur 0,0005 U, ailes de rayon ≈ 0). Pour chaque rangée de la bande du nez, étendue horizontale de tout pixel non vide ; le débordement d'un côté
 * est de combien le nez repousse ce côté vers l'extérieur (en U). Lacet > 0 : visage tourné vers la GAUCHE de l'image (types.ts), côté lointain = gauche.
 */
export interface Overflow { readonly far: number; readonly near: number; readonly rows: number }
const bare = (s: HeadTurnSpec): HeadTurnSpec => ({ ...s, nose: { ...s.nose, knots: s.nose.knots.map(([y, z]) => [y, z, 0.0005] as const), alaX: 0.0001 } });
const extents = (r: ReturnType<typeof renderHead>, j: number): [number, number] => { let lo = r.w, hi = -1; for (let i = 0; i < r.w; i++) if (r.ids[j * r.w + i]) { if (i < lo) lo = i; hi = i; } return [lo, hi]; };
export function noseOverflow(spec: HeadTurnSpec, yaw: number, heightPx = 420): Overflow {
  const frame = defaultFrame(heightPx), a = renderHead({ yaw, pitch: 0 }, spec, { frame, ss: 1 }), b = renderHead({ yaw, pitch: 0 }, bare(spec), { frame, ss: 1 });
  const ys = spec.nose.knots.map((k) => k[0]), j0 = Math.round(a.originY + Math.min(...ys) * a.ppu), j1 = Math.round(a.originY + Math.max(...ys) * a.ppu);
  let left = 0, right = 0, rows = 0;
  for (let j = j0; j <= j1; j++) { const [la, ra] = extents(a, j), [lb, rb] = extents(b, j); if (ra < 0 || rb < 0) continue; rows++; left = Math.max(left, lb - la); right = Math.max(right, ra - rb); }
  const L = left / a.ppu, R = right / a.ppu;
  return yaw >= 0 ? { far: L, near: R, rows } : { far: R, near: L, rows };
}
export const hostOf = (seed: number, archetype?: string): any => {
  const F: any = generateRandomFace(seed, { id: 'f0', noseArchetype: archetype } as never);
  return SceneSpec.parse({ width: 300, height: 380, background: '#ece6dc', objects: F.objects }).objects.find((o: any) => o.kind === 'host');
};
if (process.argv[1]?.endsWith('alar-overflow.ts')) {
  console.log('far (côté lointain) / near, en U, lacets 0 15 30 45');
  for (const seed of [11, 77, 1203]) for (const a of [undefined, 'pyramide', 'cloche-ailes', 'plat-trapeze'] as const) {
    const { spec } = head3dSubject(hostOf(seed, a), {} as never);
    console.log(String(seed).padEnd(5), String(a).padEnd(13), [0, 15, 30, 45].map((y) => { const o = noseOverflow(spec, y); return `${o.far.toFixed(3)}/${o.near.toFixed(3)}`; }).join('  '));
  }
}
